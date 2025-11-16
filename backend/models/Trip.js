const mongoose = require('mongoose');

/**
 * Tipos de viagem/movimento do motorista
 */
const TRIP_TYPE = Object.freeze({
  COLETA: 'coleta',                    // indo buscar encomenda no ponto A
  ENTREGA: 'entrega',                  // levando encomenda até o cliente (ponto B)
  RETORNO_CENTRAL: 'retorno_central',  // voltando para a base/central
  PAUSA: 'pausa',                      // parado (almoço, combustível, etc.)
  OUTRO: 'outro'                       // movimento genérico
});

/**
 * Status da viagem
 */
const TRIP_STATUS = Object.freeze({
  EM_ANDAMENTO: 'em_andamento',
  CONCLUIDA: 'concluida',
  CANCELADA: 'cancelada'
});

const tripSchema = new mongoose.Schema(
  {
    // Motorista que fez a viagem
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DriverProfile',
      required: true,
      index: true
    },

    // Pedido relacionado (se for coleta ou entrega)
    // null se for retorno, pausa ou outro movimento
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null
    },

    // Tipo de movimento
    type: {
      type: String,
      enum: Object.values(TRIP_TYPE),
      required: true,
      index: true
    },

    // Status da viagem
    status: {
      type: String,
      enum: Object.values(TRIP_STATUS),
      default: TRIP_STATUS.EM_ANDAMENTO,
      index: true
    },

    // Timestamps de início e fim
    startedAt: {
      type: Date,
      required: true,
      index: true
    },
    finishedAt: {
      type: Date,
      default: null
    },

    // Ponto de origem (onde começou)
    origin: {
      lat: { type: Number },
      lng: { type: Number },
      address: { type: String, trim: true }  // endereço textual (opcional)
    },

    // Ponto de destino (onde deve chegar)
    destination: {
      lat: { type: Number },
      lng: { type: Number },
      address: { type: String, trim: true }
    },

    // Array de posições GPS capturadas durante a viagem
    // Cada posição é registrada a cada 15-30 segundos
    positions: [
      {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        speed: { type: Number, default: 0 },      // km/h
        heading: { type: Number, default: 0 },    // direção (0-360°)
        accuracy: { type: Number, default: 0 },   // precisão em metros
        recordedAt: { type: Date, required: true }
      }
    ],

    // Métricas calculadas automaticamente
    metrics: {
      distance: { type: Number, default: 0 },     // distância total em metros
      duration: { type: Number, default: 0 },     // duração em segundos
      avgSpeed: { type: Number, default: 0 },     // velocidade média (km/h)
      maxSpeed: { type: Number, default: 0 }      // velocidade máxima (km/h)
    },

    // Notas/observações (opcional)
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

// ========== ÍNDICES PARA PERFORMANCE ==========

// Consultas por motorista e data
tripSchema.index({ driver: 1, startedAt: -1 });

// Consultas por pedido
tripSchema.index({ order: 1 });

// Consultas por status e data (para relatórios)
tripSchema.index({ status: 1, startedAt: -1 });

// Consultas por tipo e status
tripSchema.index({ type: 1, status: 1 });

// ========== MÉTODOS DO MODEL ==========

/**
 * Calcula a distância total percorrida usando a fórmula de Haversine
 * Percorre todas as posições GPS e soma as distâncias entre pontos consecutivos
 */
tripSchema.methods.calculateDistance = function () {
  if (this.positions.length < 2) {
    this.metrics.distance = 0;
    return 0;
  }

  let totalDistance = 0;

  for (let i = 1; i < this.positions.length; i++) {
    const prev = this.positions[i - 1];
    const curr = this.positions[i];
    totalDistance += haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);
  }

  this.metrics.distance = Math.round(totalDistance);
  return this.metrics.distance;
};

/**
 * Calcula a duração da viagem em segundos
 */
tripSchema.methods.calculateDuration = function () {
  if (!this.finishedAt) {
    // Se ainda não terminou, calcula até agora
    this.metrics.duration = Math.floor((Date.now() - this.startedAt.getTime()) / 1000);
  } else {
    // Se já terminou, calcula a diferença
    this.metrics.duration = Math.floor(
      (this.finishedAt.getTime() - this.startedAt.getTime()) / 1000
    );
  }
  return this.metrics.duration;
};

/**
 * Calcula velocidade média e máxima
 */
tripSchema.methods.calculateSpeeds = function () {
  if (this.positions.length === 0) {
    this.metrics.avgSpeed = 0;
    this.metrics.maxSpeed = 0;
    return;
  }

  // Velocidade máxima
  this.metrics.maxSpeed = Math.max(...this.positions.map(p => p.speed || 0));

  // Velocidade média (distância / tempo)
  if (this.metrics.duration > 0 && this.metrics.distance > 0) {
    // (metros / segundos) * 3.6 = km/h
    this.metrics.avgSpeed = Math.round(
      (this.metrics.distance / this.metrics.duration) * 3.6
    );
  } else {
    this.metrics.avgSpeed = 0;
  }
};

/**
 * Calcula todas as métricas de uma vez
 */
tripSchema.methods.calculateMetrics = function () {
  this.calculateDistance();
  this.calculateDuration();
  this.calculateSpeeds();
};

// ========== FUNÇÕES AUXILIARES ==========

/**
 * Fórmula de Haversine para calcular distância entre dois pontos GPS
 * Retorna a distância em metros
 *
 * @param {Number} lat1 - Latitude do ponto 1
 * @param {Number} lon1 - Longitude do ponto 1
 * @param {Number} lat2 - Latitude do ponto 2
 * @param {Number} lon2 - Longitude do ponto 2
 * @returns {Number} Distância em metros
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // raio da Terra em metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distância em metros
}

// ========== EXPORTAR ==========

module.exports = mongoose.model('Trip', tripSchema);
module.exports.TRIP_TYPE = TRIP_TYPE;
module.exports.TRIP_STATUS = TRIP_STATUS;