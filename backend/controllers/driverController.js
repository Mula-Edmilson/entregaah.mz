const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const User = require('../models/User');
const DriverProfile = require('../models/DriverProfile');
const Order = require('../models/Order');
const Trip = require('../models/Trip');
const { TRIP_TYPE, TRIP_STATUS } = require('../models/Trip');
const { DRIVER_STATUS, ORDER_STATUS, FINANCIAL } = require('../utils/constants');
const { parseCommissionRate } = require('../utils/helpers');

/**
 * ===========================
 *  BLOCO EXISTENTE (ADMIN)
 * ===========================
 */

exports.getAllDrivers = asyncHandler(async (_req, res) => {
  const drivers = await User.find({ role: 'driver' })
    .populate('profile')
    .sort({ nome: 1 })
    .lean();

  res.status(200).json({ drivers });
});

exports.getAllDriversForAvailability = asyncHandler(async (_req, res) => {
  const profiles = await DriverProfile.find({
    status: { $in: [DRIVER_STATUS.ONLINE_FREE, DRIVER_STATUS.ONLINE_BUSY] }
  })
    .populate('user')
    .lean();

  res.status(200).json({ drivers: profiles });
});

exports.getDriverById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(404);
    throw new Error('Motorista não encontrado (ID inválido).');
  }

  const driver = await User.findById(id).populate('profile');

  if (!driver || driver.role !== 'driver') {
    res.status(404);
    throw new Error('Motorista não encontrado.');
  }

  res.status(200).json({ driver });
});

exports.updateDriver = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = req.filtered || req.body;
  const { nome, telefone, vehicle_plate, status, commissionRate } = data;

  const user = await User.findById(id);
  if (!user || user.role !== 'driver') {
    res.status(404);
    throw new Error('Motorista não encontrado.');
  }

  user.nome = nome;
  user.telefone = telefone;
  await user.save();

  const parsedCommission = parseCommissionRate(
    commissionRate,
    FINANCIAL.DEFAULT_COMMISSION_RATE
  );

  const profile = await DriverProfile.findOneAndUpdate(
    { user: id },
    {
      vehicle_plate,
      status,
      commissionRate: parsedCommission
    },
    { new: true, upsert: true }
  );

  res.status(200).json({
    message: 'Motorista atualizado com sucesso.',
    user,
    profile
  });
});

exports.getDriverReport = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(404);
    throw new Error('Motorista não encontrado (ID inválido).');
  }

  const profile = await DriverProfile.findOne({ user: id });
  if (!profile) {
    res.status(404);
    throw new Error('Perfil de motorista não encontrado.');
  }

  const orders = await Order.find({
    assigned_to_driver: profile._id,
    status: ORDER_STATUS.COMPLETED
  })
    .sort({ timestamp_completed: -1 })
    .lean();

  res.status(200).json({
    totalOrders: orders.length,
    orders
  });
});

exports.getMyEarnings = asyncHandler(async (req, res) => {
  const profile = await DriverProfile.findOne({ user: req.user.id });

  if (!profile) {
    res.status(404);
    throw new Error('Perfil de motorista não encontrado.');
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  startOfMonth.setUTCHours(0, 0, 0, 0);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  endOfMonth.setUTCHours(23, 59, 59, 999);

  const orders = await Order.find({
    assigned_to_driver: profile._id,
    status: ORDER_STATUS.COMPLETED,
    timestamp_completed: { $gte: startOfMonth, $lte: endOfMonth }
  })
    .sort({ timestamp_completed: -1 })
    .lean();

  const totalGanhos = orders.reduce((total, order) => total + order.valor_motorista, 0);

  res.status(200).json({
    commissionRate: profile.commissionRate,
    totalGanhos,
    totalOrders: orders.length,
    ordersList: orders
  });
});

/**
 * ===========================
 *  NOVO BLOCO: CONTROLE DE ROTAS / RASTREAMENTO
 * ===========================
 *
 * Endpoints pensados para uso pelo app/painel do motorista:
 *  - startTrip: iniciar coleta/entrega/retorno/pausa
 *  - updatePosition: atualizar posição GPS
 *  - endTrip: finalizar viagem
 *  - getCurrentTrip: ver viagem atual
 *  - getMyTripsHistory: histórico de viagens
 */

/**
 * Iniciar uma nova viagem (coleta, entrega, retorno, pausa)
 *
 * body:
 *  - type: 'coleta' | 'entrega' | 'retorno_central' | 'pausa' | 'outro'
 *  - orderId?: string (obrigatório se for coleta/entrega)
 *  - origin?: { lat, lng, address }
 *  - destination?: { lat, lng, address }
 */
exports.startTrip = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const { type, orderId, origin, destination } = req.body;

  if (!Object.values(TRIP_TYPE).includes(type)) {
    res.status(400);
    throw new Error('Tipo de viagem inválido.');
  }

  // Encontrar perfil do motorista
  const driverProfile = await DriverProfile.findOne({ user: userId });
  if (!driverProfile) {
    res.status(404);
    throw new Error('Perfil de motorista não encontrado.');
  }

  // Verificar se já existe viagem em andamento
  const activeTrip = await Trip.findOne({
    driver: driverProfile._id,
    status: TRIP_STATUS.EM_ANDAMENTO
  });

  if (activeTrip) {
    res.status(400);
    throw new Error('Já existe uma viagem em andamento. Finalize-a antes de iniciar outra.');
  }

  let order = null;
  if (orderId) {
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      res.status(400);
      throw new Error('ID de pedido inválido.');
    }

    order = await Order.findById(orderId);
    if (!order) {
      res.status(404);
      throw new Error('Pedido não encontrado.');
    }

    // Garantir que este pedido pertence a este motorista (foi atribuído)
    if (!order.assigned_to_driver || !order.assigned_to_driver.equals(driverProfile._id)) {
      res.status(403);
      throw new Error('Este pedido não está atribuído a este motorista.');
    }
  }

  // Criar nova viagem
  const now = new Date();
  const trip = await Trip.create({
    driver: driverProfile._id,
    order: order ? order._id : null,
    type,
    status: TRIP_STATUS.EM_ANDAMENTO,
    startedAt: now,
    origin: origin || undefined,
    destination: destination || undefined
  });

  // Atualizar driverProfile
  driverProfile.currentTrip = trip._id;

  // Atualizar status do motorista
  switch (type) {
    case TRIP_TYPE.COLETA:
      driverProfile.status = DRIVER_STATUS.A_CAMINHO_COLETA;
      break;
    case TRIP_TYPE.ENTREGA:
      driverProfile.status = DRIVER_STATUS.A_CAMINHO_ENTREGA;
      break;
    case TRIP_TYPE.RETORNO_CENTRAL:
      driverProfile.status = DRIVER_STATUS.RETORNO_CENTRAL;
      break;
    case TRIP_TYPE.PAUSA:
      driverProfile.status = DRIVER_STATUS.PAUSA;
      break;
    default:
      driverProfile.status = DRIVER_STATUS.ONLINE_BUSY;
  }

  await driverProfile.save();

  // Atualizar status do pedido (se houver)
  if (order) {
    if (type === TRIP_TYPE.COLETA) {
      order.status = ORDER_STATUS.COLETA_INICIADA;
    } else if (type === TRIP_TYPE.ENTREGA) {
      // Se ainda não tinha timestamp de início, marca agora
      order.status = ORDER_STATUS.IN_PROGRESS;
      if (!order.timestamp_started) {
        order.timestamp_started = now;
      }
    }
    await order.save();
  }

  res.status(201).json({
    message: 'Viagem iniciada com sucesso.',
    trip
  });
});

/**
 * Atualizar posição GPS durante uma viagem
 *
 * body:
 *  - lat: Number
 *  - lng: Number
 *  - speed?: Number
 *  - heading?: Number
 *  - accuracy?: Number
 */
exports.updatePosition = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { lat, lng, speed, heading, accuracy } = req.body;

  if (lat == null || lng == null) {
    res.status(400);
    throw new Error('Latitude e longitude são obrigatórias.');
  }

  // Encontrar perfil do motorista
  const driverProfile = await DriverProfile.findOne({ user: userId });
  if (!driverProfile) {
    res.status(404);
    throw new Error('Perfil de motorista não encontrado.');
  }

  // Atualizar localização atual no DriverProfile
  driverProfile.currentLocation = {
    lat,
    lng,
    speed: speed || 0,
    heading: heading || 0,
    accuracy: accuracy || 0,
    lastUpdated: new Date()
  };
  await driverProfile.save();

  // Se não tiver viagem ativa, apenas registra posição atual e retorna
  if (!driverProfile.currentTrip) {
    return res.status(200).json({
      message: 'Localização atualizada (sem viagem ativa).'
    });
  }

  const trip = await Trip.findById(driverProfile.currentTrip);
  if (!trip || trip.status !== TRIP_STATUS.EM_ANDAMENTO) {
    return res.status(200).json({
      message: 'Localização atualizada (viagem não encontrada ou já finalizada).'
    });
  }

  // Adicionar posição à viagem
  trip.positions.push({
    lat,
    lng,
    speed: speed || 0,
    heading: heading || 0,
    accuracy: accuracy || 0,
    recordedAt: new Date()
  });

  // Limitar histórico de posições para evitar documentos gigantescos
  if (trip.positions.length > 2000) {
    trip.positions = trip.positions.slice(-2000);
  }

  await trip.save();

  res.status(200).json({
    message: 'Localização e rota atualizadas com sucesso.'
  });
});

/**
 * Finalizar a viagem atual
 *
 * body:
 *  - notes?: string
 */
exports.endTrip = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { notes } = req.body;

  const driverProfile = await DriverProfile.findOne({ user: userId });
  if (!driverProfile) {
    res.status(404);
    throw new Error('Perfil de motorista não encontrado.');
  }

  if (!driverProfile.currentTrip) {
    res.status(400);
    throw new Error('Nenhuma viagem ativa encontrada para este motorista.');
  }

  const trip = await Trip.findById(driverProfile.currentTrip);
  if (!trip) {
    // Corrigir estado se a trip tiver sido apagada
    driverProfile.currentTrip = null;
    driverProfile.status = DRIVER_STATUS.ONLINE_FREE;
    await driverProfile.save();

    res.status(404);
    throw new Error('Viagem não encontrada.');
  }

  const now = new Date();
  trip.finishedAt = now;
  trip.status = TRIP_STATUS.CONCLUIDA;
  if (notes) {
    trip.notes = notes;
  }

  // Calcular métricas (distância, duração, velocidades)
  trip.calculateMetrics();
  await trip.save();

  // Atualizar estatísticas do motorista
  driverProfile.stats.totalTrips += 1;
  driverProfile.stats.totalDistance += trip.metrics.distance || 0;
  driverProfile.stats.totalDuration += trip.metrics.duration || 0;
  driverProfile.stats.lastTripEndedAt = now;
  driverProfile.currentTrip = null;

  // Ao terminar viagem, motorista volta a ficar livre (ou você pode decidir outra lógica)
  driverProfile.status = DRIVER_STATUS.ONLINE_FREE;
  await driverProfile.save();

  // Se a viagem estiver ligada a um pedido de entrega, podemos opcionalmente
  // NÃO marcar como concluído aqui (porque você já tem lógica de finalização via código de verificação).
  // Mas se quiser atrelar:
  //
  // if (trip.order) {
  //   const order = await Order.findById(trip.order);
  //   if (order && order.status !== ORDER_STATUS.COMPLETED) {
  //     order.status = ORDER_STATUS.COMPLETED;
  //     order.timestamp_completed = now;
  //     await order.save();
  //   }
  // }

  res.status(200).json({
    message: 'Viagem finalizada com sucesso.',
    trip
  });
});

/**
 * Obter viagem atual do motorista (para o app poder saber o estado)
 */
exports.getCurrentTrip = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const driverProfile = await DriverProfile.findOne({ user: userId });
  if (!driverProfile) {
    res.status(404);
    throw new Error('Perfil de motorista não encontrado.');
  }

  if (!driverProfile.currentTrip) {
    return res.status(200).json({ trip: null });
  }

  const trip = await Trip.findById(driverProfile.currentTrip)
    .populate('order')
    .lean();

  res.status(200).json({ trip });
});

/**
 * Histórico de viagens do motorista (para tela "Minhas rotas" ou auditoria)
 *
 * query:
 *  - from?: ISODate
 *  - to?: ISODate
 *  - type?: 'coleta' | 'entrega' | ...
 *  - limit?: number (default 50)
 */
exports.getMyTripsHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { from, to, type, limit = 50 } = req.query;

  const driverProfile = await DriverProfile.findOne({ user: userId });
  if (!driverProfile) {
    res.status(404);
    throw new Error('Perfil de motorista não encontrado.');
  }

  const filter = {
    driver: driverProfile._id,
    status: TRIP_STATUS.CONCLUIDA
  };

  if (from || to) {
    filter.startedAt = {};
    if (from) filter.startedAt.$gte = new Date(from);
    if (to) filter.startedAt.$lte = new Date(to);
  }

  if (type && Object.values(TRIP_TYPE).includes(type)) {
    filter.type = type;
  }

  const trips = await Trip.find(filter)
    .populate('order', 'client_name service_type price')
    .sort({ startedAt: -1 })
    .limit(parseInt(limit, 10))
    .lean();

  res.status(200).json({ trips });
});
