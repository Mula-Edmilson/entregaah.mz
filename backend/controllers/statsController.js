const asyncHandler = require('express-async-handler');
const Order = require('../models/Order');
const DriverProfile = require('../models/DriverProfile');
const { ORDER_STATUS, DRIVER_STATUS } = require('../utils/constants');

exports.getOverviewStats = asyncHandler(async (_req, res) => {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);

  const [pendentes, emTransito, concluidasHoje, motoristasOnline] = await Promise.all([
    Order.countDocuments({ status: ORDER_STATUS.PENDING }),
    Order.countDocuments({ status: ORDER_STATUS.IN_PROGRESS }),
    Order.countDocuments({
      status: ORDER_STATUS.COMPLETED,
      timestamp_completed: { $gte: start, $lte: end }
    }),
    DriverProfile.countDocuments({
      status: { $in: [DRIVER_STATUS.ONLINE_FREE, DRIVER_STATUS.ONLINE_BUSY] }
    })
  ]);

  res.status(200).json({
    pendentes,
    emTransito,
    concluidasHoje,
    motoristasOnline
  });
});

exports.getServicePerformanceStats = asyncHandler(async (_req, res) => {
  const stats = await Order.aggregate([
    { $match: { status: ORDER_STATUS.COMPLETED } },
    {
      $group: {
        _id: '$service_type',
        totalValue: { $sum: '$price' },
        totalOrders: { $sum: 1 }
      }
    },
    { $sort: { totalValue: -1 } }
  ]);

  const serviceNames = {
    doc: 'Doc.',
    farma: 'Farmácia',
    carga: 'Cargas',
    rapido: 'Delivery Rápido',
    outros: 'Outros'
  };

  res.status(200).json({
    labels: stats.map((item) => serviceNames[item._id] || item._id),
    dataValues: stats.map((item) => item.totalValue),
    adesaoValues: stats.map((item) => item.totalOrders)
  });
});

exports.getFinancialStats = asyncHandler(async (_req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  startOfMonth.setUTCHours(0, 0, 0, 0);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  endOfMonth.setUTCHours(23, 59, 59, 999);

  const query = {
    status: ORDER_STATUS.COMPLETED,
    timestamp_completed: { $gte: startOfMonth, $lte: endOfMonth }
  };

  const [financialStats] = await Order.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalReceita: { $sum: '$price' },
        totalGanhosMotorista: { $sum: '$valor_motorista' },
        totalLucroEmpresa: { $sum: '$valor_empresa' }
      }
    }
  ]);

  const [topDriver] = await Order.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$assigned_to_driver',
        totalGanhos: { $sum: '$valor_motorista' }
      }
    },
    { $sort: { totalGanhos: -1 } },
    { $limit: 1 },
    {
      $lookup: {
        from: 'driverprofiles',
        localField: '_id',
        foreignField: '_id',
        as: 'profile'
      }
    },
    { $unwind: '$profile' },
    {
      $lookup: {
        from: 'users',
        localField: 'profile.user',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        _id: 0,
        nome: '$user.nome',
        totalGanhos: '$totalGanhos'
      }
    }
  ]);

  res.status(200).json({
    totalReceita: financialStats?.totalReceita || 0,
    totalGanhosMotorista: financialStats?.totalGanhosMotorista || 0,
    totalLucroEmpresa: financialStats?.totalLucroEmpresa || 0,
    topDriver: topDriver || { nome: 'N/A', totalGanhos: 0 }
  });
});