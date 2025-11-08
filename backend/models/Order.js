// Ficheiro: backend/models/Order.js (Completo e Atualizado)
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    // --- Detalhes do Serviço ---
    service_type: { type: String, required: true }, // 'doc', 'farma', etc.
    price: {
        type: Number,
        required: true,
        default: 0
    },

    // --- Detalhes do Destinatário ---
    client_name: { type: String, required: true },
    client_phone1: { type: String, required: true },
    client_phone2: { type: String },

    // --- Detalhes do Local ---
    address_text: { type: String },
    
    // --- (CAMPO ATIVADO) ---
    address_coords: { 
        lat: { type: Number }, 
        lng: { type: Number }
    },
    // --- FIM DA ATIVAÇÃO ---

    // --- Identificação ---
    image_url: { type: String }, 
    verification_code: { type: String, required: true }, 

    // --- Atores (Quem fez o quê) ---
    created_by_admin: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    assigned_to_driver: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'DriverProfile' 
    },

    // --- (CAMPO NOVO) ---
    // Ligação ao Cliente Registado
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
        required: false 
    },
    // --- FIM DO CAMPO NOVO ---

    // --- Status e Timestamps ---
    status: {
        type: String,
        enum: ['pendente', 'atribuido', 'em_progresso', 'concluido', 'cancelado'],
        default: 'pendente'
    },
    timestamp_started: { type: Date }, 
    timestamp_completed: { type: Date } 

}, {
    // Usa os timestamps automáticos (createdAt e updatedAt)
    timestamps: true 
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;