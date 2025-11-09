// Ficheiro: backend/controllers/clientController.js (Completo e Corrigido com Validação e Async Handler)

const Client = require('../models/Client');
const Order = require('../models/Order'); 
const mongoose = require('mongoose');

// --- (MELHORIA) Importar ferramentas ---
const asyncHandler = require('express-async-handler');
const { validationResult } = require('express-validator');
const { ORDER_STATUS } = require('../utils/constants');
// ------------------------------------

// @desc    Admin cria um novo cliente
// (MELHORIA) Envolvido em asyncHandler
exports.createClient = asyncHandler(async (req, res) => {
    
    // --- (MELHORIA) Bloco de Validação ---
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400); // Bad Request
        // Devolve a primeira mensagem de erro
        throw new Error(errors.array()[0].msg); 
    }
    // ------------------------------------

    const { nome, telefone, email, empresa, nuit, endereco } = req.body;

    const clientExists = await Client.findOne({ telefone });
    if (clientExists) {
        res.status(400); // Bad Request
        throw new Error('Um cliente com este número de telefone já existe.');
    }

    const client = new Client({
        nome,
        telefone,
        email,
        empresa,
        nuit,
        endereco,
        created_by_admin: req.user._id 
    });

    await client.save();
    res.status(201).json({ message: 'Cliente criado com sucesso', client });
});

// @desc    Admin obtém todos os clientes
exports.getAllClients = asyncHandler(async (req, res) => {
    const clients = await Client.find().sort({ nome: 1 }); 
    res.status(200).json({ clients });
});

// @desc    Admin obtém um cliente por ID
exports.getClientById = asyncHandler(async (req, res) => {
    // (MELHORIA) Validação de ID do Mongoose
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(404);
        throw new Error('Cliente não encontrado (ID inválido)');
    }
    
    const client = await Client.findById(req.params.id);
    if (!client) {
        res.status(404);
        throw new Error('Cliente não encontrado');
    }
    res.status(200).json({ client });
});

// @desc    Admin atualiza um cliente
exports.updateClient = asyncHandler(async (req, res) => {
    
    // --- (MELHORIA) Bloco de Validação ---
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }
    // ------------------------------------

    const { nome, telefone, email, empresa, nuit, endereco } = req.body;
    
    const client = await Client.findById(req.params.id);
    if (!client) {
        res.status(404);
        throw new Error('Cliente não encontrado');
    }
    
    // Verifica se o novo telefone já está em uso por OUTRO cliente
    if (telefone !== client.telefone) {
        const clientExists = await Client.findOne({ telefone });
        if (clientExists) {
            res.status(400);
            throw new Error('Este novo número de telefone já está em uso por outro cliente.');
        }
    }

    const updatedClient = await Client.findByIdAndUpdate(
        req.params.id,
        { nome, telefone, email, empresa, nuit, endereco },
        { new: true, runValidators: true }
    );

    res.status(200).json({ message: 'Cliente atualizado com sucesso', client: updatedClient });
});

// @desc    Admin apaga um cliente
exports.deleteClient = asyncHandler(async (req, res) => {
    const client = await Client.findById(req.params.id);
    if (!client) {
        res.status(404);
        throw new Error('Cliente não encontrado');
    }
    
    // (MELHORIA) Lógica de segurança - Verifica se o cliente tem encomendas
    // Apenas um exemplo, pode querer implementar isto
    /*
    const clientOrders = await Order.findOne({ client: req.params.id });
    if (clientOrders) {
        res.status(400);
        throw new Error('Não é possível apagar clientes com histórico de encomendas.');
    }
    */
    
    await client.deleteOne();
    res.status(200).json({ message: 'Cliente apagado com sucesso' });
});


// @desc    Admin obtém o extrato de um cliente
exports.getStatement = asyncHandler(async (req, res) => {
    const { id } = req.params; // ID do Cliente
    const { startDate, endDate } = req.query; // Datas (ex: '2025-11-08')

    if (!startDate || !endDate) {
        res.status(400);
        throw new Error('Datas de início e fim são obrigatórias');
    }

    const start = new Date(startDate);
    start.setUTCHours(0, 0, 0, 0); 

    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999); 

    const clientId = new mongoose.Types.ObjectId(id);

    const orders = await Order.find({
        client: clientId,
        status: ORDER_STATUS.COMPLETED, // (MELHORIA) Usando constantes
        timestamp_completed: {
            $gte: start,
            $lte: end
        }
    }).sort({ timestamp_completed: 1 });

    let totalValue = 0;
    orders.forEach(order => {
        totalValue += order.price; 
    });

    res.status(200).json({
        totalValue: totalValue,
        totalOrders: orders.length,
        ordersList: orders 
    });
});