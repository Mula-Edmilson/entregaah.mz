// backend/models/CompanyCost.js

const mongoose = require('mongoose');

const COMPANY_COST_CATEGORIES = [
  'salarios',
  'renda',
  'manutencao',
  'comunicacao',
  'marketing',
  'combustivel',
  'diversos'
];

const companyCostSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: COMPANY_COST_CATEGORIES,
      required: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    date: {
      type: Date,
      default: Date.now
    },

    // Quem criou o registo
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },

    // NOVO: custo atribuído a um funcionário (motorista/gestor)
    assignedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    // NOVO: custo atribuído a um cliente
    assignedClient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Guardar as categorias disponíveis no próprio schema
companyCostSchema.statics.CATEGORIES = COMPANY_COST_CATEGORIES;

const CompanyCost = mongoose.model('CompanyCost', companyCostSchema);

module.exports = CompanyCost;
module.exports.COMPANY_COST_CATEGORIES = COMPANY_COST_CATEGORIES;
