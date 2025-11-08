// Ficheiro: backend/models/Client.js

const mongoose = require('mongoose');

const ClientSchema = new mongoose.Schema({
    nome: {
        type: String,
        required: [true, 'O nome do cliente é obrigatório']
    },
    telefone: {
        type: String,
        required: [true, 'O telefone do cliente é obrigatório'],
        unique: true
    },
    email: {
        type: String,
        unique: false, // O email é opcional e pode ser repetido
        sparse: true   // Permite múltiplos clientes com email 'null'
    },
    empresa: {
        type: String
    },
    nuit: {
        type: String
    },
    endereco: {
        type: String
    },
    // Referência ao Admin que criou este cliente
    created_by_admin: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    }
}, {
    timestamps: true // Adiciona 'createdAt' e 'updatedAt' automaticamente
});

module.exports = mongoose.model('Client', ClientSchema);
