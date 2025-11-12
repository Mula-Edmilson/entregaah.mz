const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const User = require('../models/User');
const DriverProfile = require('../models/DriverProfile');
const Order = require('../models/Order');
const { DRIVER_STATUS, ORDER_STATUS, FINANCIAL } = require('../utils/constants');
const { parseCommissionRate } = require('../utils/helpers');

exports.getAllDrivers = asyncHandler(async (_req, res) => {
  const drivers = await User.find({ role: 'driver' })
    .populate('profile')
    .sort({ nome: 1 })
    .lean();

  res.status(200).json({ drivers });
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