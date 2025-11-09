// Ficheiro: backend/controllers/driverController.js (Completo, Criado com Base nas Rotas e Melhorias)

const User = require('../models/User');
const DriverProfile = require('../models/DriverProfile');
const Order = require('../models/Order');

// --- (MELHORIA) Importar ferramentas e constantes ---
const asyncHandler = require('express-async-handler');
const { validationResult } = require('express-validator');
const { DRIVER_STATUS, ORDER_STATUS } = require('../utils/constants');
const mongoose = require('mongoose');
// --------------------------------------------------


// @desc    Admin obtém a lista de TODOS os motoristas
// @route   GET /api/drivers
// @access  Privado (Admin)
exports.getAllDrivers = asyncHandler(async (req, res) => {
    // Encontra todos os Users com o cargo 'driver'
    // (MELHORIA) Usa .populate('profile') para trazer os dados do DriverProfile
    // Isto funciona por causa da 'virtual' que definiu no seu modelo User.js
    const drivers = await User.find({ role: 'driver' })
        .populate('profile')
        .sort({ nome: 1 });
        
    res.status(200).json({ drivers });
});

// @desc    Admin obtém um motorista por ID (para preencher o modal)
// @route   GET /api/drivers/:id
// @access  Privado (Admin)
exports.getDriverById = asyncHandler(async (req, res) => {
    // --- (MELHORIA) Bloco de Validação ---
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }
    // ------------------------------------
    
    // (MELHORIA) Validação de ID do Mongoose (redundante graças ao validator, mas seguro)
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(404);
        throw new Error('Motorista não encontrado (ID inválido)');
    }

    const driver = await User.findById(req.params.id).populate('profile');

    if (!driver || driver.role !== 'driver') {
        res.status(404);
        throw new Error('Motorista não encontrado');
    }
    
    res.status(200).json({ driver });
});

// @desc    Admin atualiza um motorista
// @route   PUT /api/drivers/:id
// @access  Privado (Admin)
exports.updateDriver = asyncHandler(async (req, res) => {
    // --- (MELHORIA) Bloco de Validação ---
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }
    // ------------------------------------

    const { nome, telefone, vehicle_plate, status } = req.body;
    const userId = req.params.id;

    // 1. Atualizar a coleção 'User'
    const user = await User.findById(userId);
    if (!user || user.role !== 'driver') {
        res.status(404);
        throw new Error('Motorista não encontrado');
    }
    
    user.nome = nome;
    user.telefone = telefone;
    await user.save();

    // 2. Atualizar a coleção 'DriverProfile'
    // (Usamos findOneAndUpdate para o caso de o perfil não existir,
    // embora em teoria devesse sempre existir)
    const profile = await DriverProfile.findOneAndUpdate(
        { user: userId }, // Encontra o perfil associado a este User
        { 
            vehicle_plate: vehicle_plate,
            status: status 
        },
        { new: true, upsert: true } // 'new: true' retorna o doc atualizado
    );

    res.status(200).json({ 
        message: 'Motorista atualizado com sucesso',
        user: user,
        profile: profile
    });
});

// @desc    Admin obtém o relatório de um motorista
// @route   GET /api/drivers/:id/report
// @access  Privado (Admin)
exports.getDriverReport = asyncHandler(async (req, res) => {
    // --- (MELHORIA) Bloco de Validação ---
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }
    // ------------------------------------

    const userId = req.params.id;

    // 1. Encontrar o Perfil do Motorista (porque as Encomendas ligam-se ao Perfil)
    const profile = await DriverProfile.findOne({ user: userId });
    
    if (!profile) {
        res.status(404);
        throw new Error('Perfil de motorista não encontrado');
    }

    // 2. Encontrar todas as encomendas concluídas associadas a esse PERFIL
    const orders = await Order.find({ 
        assigned_to_driver: profile._id, // Compara com o ID do Perfil
        status: ORDER_STATUS.COMPLETED  // (MELHORIA) Usando constante
    }).sort({ timestamp_completed: -1 });

    res.status(200).json({ 
        totalOrders: orders.length,
        orders: orders 
    });
});