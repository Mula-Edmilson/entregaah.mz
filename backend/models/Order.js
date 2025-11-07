// Ficheiro: backend/models/Order.js (Completo e Atualizado)
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    // --- Detalhes do Serviço ---
    service_type: { type: String, required: true }, // 'doc', 'farma', etc.
    
    // --- (NOVA ADIÇÃO) ---
    price: {
        type: Number,
        required: true,
        default: 0
    },
    // --- FIM DA ADIÇÃO ---

    // --- Detalhes do Destinatário ---
    client_name: { type: String, required: true },
    client_phone1: { type: String, required: true },
    client_phone2: { type: String },

    // --- Detalhes do Local ---
    address_text: { type: String },
    // address_coords: { lat: Number, lng: Number }, // Futuramente, para o mapa

    // --- Identificação ---
    image_url: { type: String }, // O URL da imagem (após upload com Multer)
    verification_code: { type: String, required: true }, // O código de 5 dígitos

    // --- Atores (Quem fez o quê) ---
    created_by_admin: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    assigned_to_driver: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'DriverProfile' 
    },

    // --- O IMPORTANTE: Status e o Timer ---
    status: {
        type: String,
        enum: ['pendente', 'atribuido', 'em_progresso', 'concluido', 'cancelado'],
        default: 'pendente'
    },
    timestamp_created: { type: Date, default: Date.now }, // Quando o admin criou
    timestamp_started: { type: Date }, // Quando o motorista clicou em "Iniciar"
    timestamp_completed: { type: Date } // Quando o motorista inseriu o código
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;