const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true },
    telefone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, lowercase: true, trim: true, sparse: true },
    empresa: { type: String, trim: true },
    nuit: { type: String, trim: true },
    endereco: { type: String, trim: true },
    created_by_admin: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User'
    }
  },
  { timestamps: true }
);

clientSchema.index({ nome: 1 });

module.exports = mongoose.model('Client', clientSchema);