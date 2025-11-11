// Ficheiro: backend/models/DriverProfile.js (Otimizado com Índices)
const mongoose = require('mongoose');

const driverProfileSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, // Liga ao ID do 'User'
        ref: 'User', 
        required: true 
    },
    vehicle_plate: { type: String, default: '' }, // Placa da viatura
    status: {
        type: String,
        enum: ['online_livre', 'online_ocupado', 'offline'],
        default: 'offline',
        index: true // <-- (MELHORIA 3) Índice para pesquisas rápidas por status
    },

    // --- (MELHORIA FINANCEIRA) ---
    // A percentagem (ex: 20) que o motorista ganha por entrega.
    commissionRate: {
        type: Number,
        default: 20, // 20% por defeito
        min: 0,
        max: 100
    }
    // --- FIM DA MELHORIA ---
});

const DriverProfile = mongoose.model('DriverProfile', driverProfileSchema);
module.exports = DriverProfile;