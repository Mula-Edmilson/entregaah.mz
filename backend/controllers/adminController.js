const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const DriverProfile = require('../models/DriverProfile');
const Trip = require('../models/Trip');
const { TRIP_STATUS } = require('../models/Trip');
const { ORDER_STATUS } = require('../utils/constants');

/**
 * ===========================
 *  FUNÇÃO EXISTENTE
 * ===========================
 */

exports.deleteOldHistory = asyncHandler(async (_req, res) => {
  const cutoffDate = new Date();
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 30);

  const result = await Order.deleteMany({
    status: { $in: [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELED] },
    timestamp_completed: { $lt: cutoffDate }
  });

  if (!result.deletedCount) {
    return res.status(200).json({
      message: 'Nenhuma encomenda antiga encontrada para apagar.'
    });
  }

  return res.status(200).json({
    message: `${result.deletedCount} encomendas antigas foram apagadas com sucesso.`
  });
});

/**
 * ===========================
 *  NOVAS FUNÇÕES: CONTROLE DE ROTAS / RASTREAMENTO (ADMIN)
 * ===========================
 */

/**
 * Obter localização de todos os motoristas (para mapa em tempo real)
 *
 * Retorna apenas motoristas que não estão OFFLINE,
 * com suas posições atuais, status, viagem atual, etc.
 */
exports.getAllDriversLocation = asyncHandler(async (_req, res) => {
  const drivers = await DriverProfile.find({
    status: { $ne: 'offline' }
  })
    .populate('user', 'nome telefone email')
    .populate({
      path: 'currentTrip',
      select: 'type status startedAt order',
      populate: {
        path: 'order',
        select: 'client_name service_type address_text'
      }
    })
    .select('user vehicle_plate status currentLocation currentTrip stats')
    .lean();

  res.status(200).json({ drivers });
});

/**
 * Obter histórico completo de viagens (todos os motoristas)
 *
 * query params:
 *  - driverId?: string (filtrar por motorista específico)
 *  - from?: ISODate
 *  - to?: ISODate
 *  - type?: 'coleta' | 'entrega' | 'retorno_central' | 'pausa' | 'outro'
 *  - status?: 'em_andamento' | 'concluida' | 'cancelada'
 *  - limit?: number (default 100)
 */
exports.getAllTrips = asyncHandler(async (req, res) => {
  const { driverId, from, to, type, status, limit = 100 } = req.query;

  const filter = {};

  if (driverId) {
    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      res.status(400);
      throw new Error('ID de motorista inválido.');
    }
    filter.driver = driverId;
  }

  if (type) {
    filter.type = type;
  }

  if (status) {
    filter.status = status;
  }

  if (from || to) {
    filter.startedAt = {};
    if (from) filter.startedAt.$gte = new Date(from);
    if (to) filter.startedAt.$lte = new Date(to);
  }

  const trips = await Trip.find(filter)
    .populate({
      path: 'driver',
      select: 'user vehicle_plate',
      populate: {
        path: 'user',
        select: 'nome telefone'
      }
    })
    .populate('order', 'client_name service_type price address_text')
    .sort({ startedAt: -1 })
    .limit(parseInt(limit, 10))
    .lean();

  res.status(200).json({ trips });
});

/**
 * Obter detalhes completos de uma viagem específica (replay de rota)
 *
 * Retorna todas as posições GPS, métricas, pedido relacionado, etc.
 */
exports.getTripDetails = asyncHandler(async (req, res) => {
  const { tripId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(tripId)) {
    res.status(400);
    throw new Error('ID de viagem inválido.');
  }

  const trip = await Trip.findById(tripId)
    .populate({
      path: 'driver',
      select: 'user vehicle_plate stats',
      populate: {
        path: 'user',
        select: 'nome telefone email'
      }
    })
    .populate('order')
    .lean();

  if (!trip) {
    res.status(404);
    throw new Error('Viagem não encontrada.');
  }

  res.status(200).json({ trip });
});

/**
 * ✅ OPCIONAL: Cancelar uma viagem em andamento (admin)
 *
 * Útil se o motorista esquecer de finalizar ou houver problema.
 */
exports.cancelTrip = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const { reason } = req.body;

  if (!mongoose.Types.ObjectId.isValid(tripId)) {
    res.status(400);
    throw new Error('ID de viagem inválido.');
  }

  const trip = await Trip.findById(tripId);
  if (!trip) {
    res.status(404);
    throw new Error('Viagem não encontrada.');
  }

  if (trip.status !== TRIP_STATUS.EM_ANDAMENTO) {
    res.status(400);
    throw new Error('Esta viagem já foi finalizada ou cancelada.');
  }

  trip.status = TRIP_STATUS.CANCELADA;
  trip.finishedAt = new Date();
  trip.notes = reason || 'Cancelada pelo administrador';
  await trip.save();

  // Atualizar motorista
  const driverProfile = await DriverProfile.findById(trip.driver);
  if (driverProfile && driverProfile.currentTrip && driverProfile.currentTrip.equals(trip._id)) {
    driverProfile.currentTrip = null;
    driverProfile.status = 'online_livre'; // ou outro status padrão
    await driverProfile.save();
  }

  res.status(200).json({
    message: 'Viagem cancelada com sucesso.',
    trip
  });
});

/**
 * ✅ OPCIONAL: Estatísticas gerais de rotas (dashboard admin)
 *
 * Retorna métricas agregadas:
 *  - total de viagens (por tipo)
 *  - distância total percorrida
 *  - tempo total em rota
 *  - velocidade média geral
 */
exports.getTripsStats = asyncHandler(async (req, res) => {
  const { from, to } = req.query;

  const matchFilter = { status: TRIP_STATUS.CONCLUIDA };

  if (from || to) {
    matchFilter.startedAt = {};
    if (from) matchFilter.startedAt.$gte = new Date(from);
    if (to) matchFilter.startedAt.$lte = new Date(to);
  }

  const stats = await Trip.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalDistance: { $sum: '$metrics.distance' },
        totalDuration: { $sum: '$metrics.duration' },
        avgSpeed: { $avg: '$metrics.avgSpeed' }
      }
    }
  ]);

  // Totais gerais
  const totals = await Trip.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: null,
        totalTrips: { $sum: 1 },
        totalDistance: { $sum: '$metrics.distance' },
        totalDuration: { $sum: '$metrics.duration' }
      }
    }
  ]);

  res.status(200).json({
    byType: stats,
    totals: totals[0] || { totalTrips: 0, totalDistance: 0, totalDuration: 0 }
  });
});

/**
 * ✅ OPCIONAL: Apagar viagens antigas (similar ao deleteOldHistory)
 *
 * Remove viagens concluídas/canceladas com mais de X dias.
 */
exports.deleteOldTrips = asyncHandler(async (req, res) => {
  const { days = 90 } = req.query; // padrão: 90 dias

  const cutoffDate = new Date();
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - parseInt(days, 10));

  const result = await Trip.deleteMany({
    status: { $in: [TRIP_STATUS.CONCLUIDA, TRIP_STATUS.CANCELADA] },
    finishedAt: { $lt: cutoffDate }
  });

  if (!result.deletedCount) {
    return res.status(200).json({
      message: 'Nenhuma viagem antiga encontrada para apagar.'
    });
  }

  return res.status(200).json({
    message: `${result.deletedCount} viagens antigas foram apagadas com sucesso.`
  });
});
