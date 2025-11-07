// Ficheiro: backend/models/DriverProfile.js
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
        default: 'offline'
    }
});

const DriverProfile = mongoose.model('DriverProfile', driverProfileSchema);
module.exports = DriverProfile;