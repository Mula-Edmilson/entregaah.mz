const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['salarios', 'renda', 'diversos', 'manutencao', 'comunicacao', 'marketing', 'combustivel'],
      required: true,
      index: true
    },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, index: true },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

expenseSchema.index({ date: -1 });
expenseSchema.index({ category: 1, date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);