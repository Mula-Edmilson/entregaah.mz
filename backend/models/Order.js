// Ficheiro: backend/models/Order.js (Otimizado com Índices)
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    // --- Detalhes do Serviço ---
    service_type: { type: String, required: true },
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
    address_coords: { 
        lat: { type: Number }, 
        lng: { type: Number }
    },

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
        ref: 'DriverProfile',
        index: true // <-- (MELHORIA 3) Índice para pesquisas rápidas por motorista
    },
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
        required: false 
    },

    // --- Status e Timestamps ---
    status: {
        type: String,
        enum: ['pendente', 'atribuido', 'em_progresso', 'concluido', 'cancelado'],
        default: 'pendente',
        index: true // <-- (MELHORIA 3) Índice para pesquisas rápidas por status
    },
    timestamp_started: { type: Date }, 
    timestamp_completed: { type: Date },

    // --- (MELHORIA FINANCEIRA) ---
    // Estes valores são calculados quando a entrega é 'concluida'
    valor_motorista: {
        type: Number,
        default: 0
    },
    valor_empresa: {
        type: Number,
        default: 0
    }
    // --- FIM DA MELHORIA ---

}, {
    timestamps: true 
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;