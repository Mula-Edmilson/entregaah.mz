const mongoose = require('mongoose');
const { DRIVER_STATUS, FINANCIAL } = require('../utils/constants');

const driverProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    vehicle_plate: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: Object.values(DRIVER_STATUS),
      default: DRIVER_STATUS.OFFLINE,
      index: true
    },
    commissionRate: {
      type: Number,
      min: 0,
      max: 100,
      default: FINANCIAL.DEFAULT_COMMISSION_RATE
    },

    // ✅ NOVO - Localização atual do motorista (tempo real)
    currentLocation: {
      lat: { type: Number },
      lng: { type: Number },
      speed: { type: Number, default: 0 },        // km/h
      heading: { type: Number, default: 0 },      // direção (0-360°)
      accuracy: { type: Number, default: 0 },     // precisão em metros
      lastUpdated: { type: Date }
    },

    // ✅ NOVO - Referência à viagem/rota atual (se estiver em movimento)
    currentTrip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      default: null
    },

    // ✅ NOVO - Estatísticas acumuladas do motorista (cache para performance)
    stats: {
      totalTrips: { type: Number, default: 0 },           // total de viagens concluídas
      totalDistance: { type: Number, default: 0 },        // distância total em metros
      totalDuration: { type: Number, default: 0 },        // tempo total em segundos
      lastTripEndedAt: { type: Date }                     // última viagem finalizada
    }
  },
  { timestamps: true }
);

// ✅ NOVO - Índice composto para consultas de motoristas ativos com localização
driverProfileSchema.index({ status: 1, 'currentLocation.lastUpdated': -1 });

module.exports = mongoose.model('DriverProfile', driverProfileSchema);
