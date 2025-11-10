// Ficheiro: backend/controllers/driverController.js (Atualizado)

const User = require('../models/User');
const DriverProfile = require('../models/DriverProfile');
const Order = require('../models/Order');
const asyncHandler = require('express-async-handler');
const { validationResult } = require('express-validator');
const { DRIVER_STATUS, ORDER_STATUS } = require('../utils/constants');
const mongoose = require('mongoose');

// @desc    Admin obtém a lista de TODOS os motoristas
// @route   GET /api/drivers
// @access  Privado (Admin)
exports.getAllDrivers = asyncHandler(async (req, res) => {
    // Esta função já usa .populate('profile'),
    // por isso irá buscar automaticamente a 'commissionRate'.
    const drivers = await User.find({ role: 'driver' })
        .populate('profile')
        .sort({ nome: 1 });
        
    res.status(200).json({ drivers });
});

// @desc    Admin obtém um motorista por ID (para preencher o modal)
// @route   GET /api/drivers/:id
// @access  Privado (Admin)
exports.getDriverById = asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }
    
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(404);
        throw new Error('Motorista não encontrado (ID inválido)');
    }

    // Esta função também já usa .populate('profile'),
    // por isso irá buscar a 'commissionRate'.
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }

    // (MUDANÇA) Adicionámos 'commissionRate' vindo do req.body
    const { nome, telefone, vehicle_plate, status, commissionRate } = req.body;
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
    // (MUDANÇA) Adicionámos 'commissionRate' ao objeto de atualização
    const profile = await DriverProfile.findOneAndUpdate(
        { user: userId },
        { 
            vehicle_plate: vehicle_plate,
            status: status,
            commissionRate: commissionRate // <-- AQUI ESTÁ A MUDANÇA
        },
        { new: true, upsert: true }
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
    // ... (Esta função permanece 100% igual) ...
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }
    const userId = req.params.id;
    const profile = await DriverProfile.findOne({ user: userId });
    if (!profile) {
        res.status(404);
        throw new Error('Perfil de motorista não encontrado');
    }
    const orders = await Order.find({ 
        assigned_to_driver: profile._id,
        status: ORDER_STATUS.COMPLETED
    }).sort({ timestamp_completed: -1 });
    res.status(200).json({ 
        totalOrders: orders.length,
        orders: orders 
    });
});