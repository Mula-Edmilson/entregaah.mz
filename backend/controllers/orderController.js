const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const DriverProfile = require('../models/DriverProfile');
const { DRIVER_STATUS, ORDER_STATUS, ADMIN_ROOM, FINANCIAL } = require('../utils/constants');
const { getDistanceFromLatLonInKm, parseCommissionRate } = require('../utils/helpers');
const { getSocketUserMap } = require('../socketHandler');

const MAX_IMAGE_BYTES = parseInt(process.env.UPLOAD_IMAGE_MAX_SIZE || `${5 * 1024 * 1024}`, 10);

const generateVerificationCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 5; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const normalizeCoordinates = (lat, lng) => {
  if (lat === undefined || lng === undefined) return null;
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);

  if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
    return null;
  }

  return { lat: parsedLat, lng: parsedLng };
};

const optimizeUpload = async (file) => {
  const normalizedName = `${Date.now()}-${file.originalname}`.replace(/\s+/g, '_');
  const outputPath = path.join('uploads', normalizedName);

  await sharp(file.path)
    .resize(1200, 1200, { fit: 'inside' })
    .jpeg({ quality: 80 })
    .toFile(outputPath);

  await fs.unlink(file.path);

  return `/uploads/${normalizedName}`;
};

const findBestDriverProfile = async (coordinates) => {
  if (!coordinates) return null;

  const availableProfiles = await DriverProfile.find({
    status: DRIVER_STATUS.ONLINE_FREE
  }).lean();

  if (!availableProfiles.length) return null;

  const sockets = getSocketUserMap();
  let bestProfileId = null;
  let minDistance = Infinity;

  availableProfiles.forEach((profile) => {
    const userId = profile.user.toString();

    sockets.forEach((data) => {
      if (data.userId === userId && data.lastLocation) {
        const distance = getDistanceFromLatLonInKm(
          coordinates.lat,
          coordinates.lng,
          data.lastLocation.lat,
          data.lastLocation.lng
        );

        if (distance < minDistance) {
          minDistance = distance;
          bestProfileId = profile._id;
        }
      }
    });
  });

  return bestProfileId;
};

exports.createOrder = asyncHandler(async (req, res) => {
  const data = req.filtered || req.body;
  const {
    service_type,
    client_name,
    client_phone1,
    client_phone2,
    address_text,
    price,
    lat,
    lng,
    clientId,
    autoAssign
  } = data;

  let imageUrl = null;

  if (req.files?.length) {
    const file = req.files[0];

    if (file.size > MAX_IMAGE_BYTES) {
      await fs.unlink(file.path);
      res.status(400);
      throw new Error('Imagem acima do limite permitido (5MB por defeito).');
    }

    try {
      imageUrl = await optimizeUpload(file);
    } catch (error) {
      await fs.unlink(file.path).catch(() => {});
      res.status(500);
      throw new Error('Falha ao processar a imagem.');
    }
  }

  const coordinates = normalizeCoordinates(lat, lng);

  let assignedDriverProfileId = null;
  let orderStatus = ORDER_STATUS.PENDING;

  if (autoAssign === true || autoAssign === 'true') {
    assignedDriverProfileId = await findBestDriverProfile(coordinates);
    if (assignedDriverProfileId) {
      orderStatus = ORDER_STATUS.ASSIGNED;
    }
  }

  const verificationCode = generateVerificationCode();

  const order = await Order.create({
    service_type,
    price: Number(price) || 0,
    client_name,
    client_phone1,
    client_phone2,
    address_text,
    address_coords: coordinates,
    client: clientId || null,
    image_url: imageUrl,
    verification_code: verificationCode,
    created_by_admin: req.user._id,
    assigned_to_driver: assignedDriverProfileId,
    status: orderStatus
  });

  const io = req.app.get('socketio');

  if (orderStatus === ORDER_STATUS.ASSIGNED && assignedDriverProfileId) {
    const assignedProfile = await DriverProfile.findById(assignedDriverProfileId).lean();
    if (assignedProfile) {
      io.to(assignedProfile.user.toString()).emit('nova_entrega_atribuida', {
        orderId: order._id,
        clientName: order.client_name,
        serviceType: order.service_type
      });
    }
  } else {
    io.to(ADMIN_ROOM).emit('order_pending', { orderId: order._id });
  }

  res.status(201).json({ message: 'Encomenda criada com sucesso!', order });
});

exports.assignOrder = asyncHandler(async (req, res) => {
  const data = req.filtered || req.body;
  const { orderId } = req.params;
  const { driverId } = data;

  const order = await Order.findById(orderId);
  if (!order) {
    res.status(404);
    throw new Error('Encomenda não encontrada.');
  }

  if (order.status === ORDER_STATUS.IN_PROGRESS) {
    res.status(400);
    throw new Error('Não é possível reatribuir uma encomenda em progresso.');
  }

  const newDriverProfile = await DriverProfile.findById(driverId);
  if (!newDriverProfile) {
    res.status(404);
    throw new Error('Perfil de motorista não encontrado.');
  }

  const io = req.app.get('socketio');

  if (order.assigned_to_driver && !order.assigned_to_driver.equals(driverId)) {
    const oldProfile = await DriverProfile.findById(order.assigned_to_driver).lean();
    if (oldProfile) {
      io.to(oldProfile.user.toString()).emit('entrega_cancelada', { orderId: order._id });
    }
  }

  order.assigned_to_driver = driverId;
  order.status = ORDER_STATUS.ASSIGNED;
  await order.save();

  io.to(newDriverProfile.user.toString()).emit('nova_entrega_atribuida', {
    orderId: order._id,
    clientName: order.client_name,
    serviceType: order.service_type
  });

  res.status(200).json({ message: 'Encomenda atribuída com sucesso.', order });
});

exports.getMyDeliveries = asyncHandler(async (req, res) => {
  const driverProfile = await DriverProfile.findOne({ user: req.user._id });
  if (!driverProfile) {
    res.status(404);
    throw new Error('Perfil de motorista não encontrado.');
  }

  const orders = await Order.find({
    assigned_to_driver: driverProfile._id,
    status: { $in: [ORDER_STATUS.ASSIGNED, ORDER_STATUS.IN_PROGRESS] }
  })
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({ orders });
});

exports.startDelivery = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const driverProfile = await DriverProfile.findOne({ user: req.user._id });
  if (!driverProfile) {
    res.status(404);
    throw new Error('Perfil de motorista não encontrado.');
  }

  const order = await Order.findById(id);
  if (!order) {
    res.status(404);
    throw new Error('Encomenda não encontrada.');
  }

  if (!order.assigned_to_driver?.equals(driverProfile._id)) {
    res.status(403);
    throw new Error('Não autorizado para esta encomenda.');
  }

  order.status = ORDER_STATUS.IN_PROGRESS;
  order.timestamp_started = Date.now();
  await order.save();

  driverProfile.status = DRIVER_STATUS.ONLINE_BUSY;
  await driverProfile.save();

  const io = req.app.get('socketio');
  io.to(ADMIN_ROOM).emit('delivery_started', {
    id: order._id,
    driverName: req.user.nome
  });
  io.to(ADMIN_ROOM).emit('driver_status_changed', {
    driverId: driverProfile._id,
    newStatus: driverProfile.status
  });

  res.status(200).json({ message: 'Entrega iniciada.', order });
});

exports.completeDelivery = asyncHandler(async (req, res) => {
  const data = req.filtered || req.body;
  const { id } = req.params;
  const { verification_code } = data;

  const driverProfile = await DriverProfile.findOne({ user: req.user._id });
  if (!driverProfile) {
    res.status(404);
    throw new Error('Perfil de motorista não encontrado.');
  }

  const order = await Order.findById(id);
  if (!order) {
    res.status(404);
    throw new Error('Encomenda não encontrada.');
  }

  if (!order.assigned_to_driver?.equals(driverProfile._id)) {
    res.status(403);
    throw new Error('Não autorizado para esta encomenda.');
  }

  if (order.verification_code !== verification_code.toUpperCase()) {
    res.status(400);
    throw new Error('Código de verificação incorreto.');
  }

  const commissionRate = parseCommissionRate(
    driverProfile.commissionRate,
    FINANCIAL.DEFAULT_COMMISSION_RATE
  );
  const totalPrice = order.price;
  const driverValue = totalPrice * (commissionRate / 100);
  const companyValue = totalPrice - driverValue;

  order.valor_motorista = driverValue;
  order.valor_empresa = companyValue;
  order.status = ORDER_STATUS.COMPLETED;
  order.timestamp_completed = Date.now();
  await order.save();

  driverProfile.status = DRIVER_STATUS.ONLINE_FREE;
  await driverProfile.save();

  const io = req.app.get('socketio');
  io.to(ADMIN_ROOM).emit('delivery_completed', { id: order._id });
  io.to(ADMIN_ROOM).emit('driver_status_changed', {
    driverId: driverProfile._id,
    newStatus: driverProfile.status
  });

  res.status(200).json({ message: 'Entrega finalizada com sucesso!' });
});

exports.getAllOrders = asyncHandler(async (_req, res) => {
  const orders = await Order.find()
    .populate('assigned_to_driver')
    .populate('created_by_admin', 'nome email')
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({ orders });
});

exports.getActiveOrders = asyncHandler(async (_req, res) => {
  const orders = await Order.find({
    status: { $in: [ORDER_STATUS.PENDING, ORDER_STATUS.ASSIGNED, ORDER_STATUS.IN_PROGRESS] }
  })
    .populate('created_by_admin', 'nome')
    .populate({
      path: 'assigned_to_driver',
      populate: { path: 'user', select: 'nome' }
    })
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({ orders });
});

exports.getHistoryOrders = asyncHandler(async (_req, res) => {
  const orders = await Order.find({
    status: { $in: [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELED] }
  })
    .populate({
      path: 'assigned_to_driver',
      populate: { path: 'user', select: 'nome' }
    })
    .sort({ timestamp_completed: -1 })
    .lean();

  res.status(200).json({ orders });
});

exports.getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(404);
    throw new Error('Encomenda não encontrada (ID inválido).');
  }

  const order = await Order.findById(id)
    .populate('created_by_admin', 'nome')
    .populate({
      path: 'assigned_to_driver',
      populate: { path: 'user', select: 'nome telefone' }
    })
    .lean();

  if (!order) {
    res.status(404);
    throw new Error('Encomenda não encontrada.');
  }

  res.status(200).json({ order });
});