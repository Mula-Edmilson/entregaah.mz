// Ficheiro: backend/controllers/driverController.js (Atualizado)

const User = require('../models/User');
const DriverProfile = require('../models/DriverProfile');
const Order = require('../models/Order');
const asyncHandler = require('express-async-handler');
const { validationResult } = require('express-validator');
const { DRIVER_STATUS, ORDER_STATUS } = require('../utils/constants');
const mongoose = require('mongoose');

// ... (getAllDrivers, getDriverById, updateDriver - sem alterações) ...
exports.getAllDrivers = asyncHandler(async (req, res) => {
    const drivers = await User.find({ role: 'driver' })
        .populate('profile')
        .sort({ nome: 1 });
    res.status(200).json({ drivers });
});

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
    const driver = await User.findById(req.params.id).populate('profile');
    if (!driver || driver.role !== 'driver') {
        res.status(404);
        throw new Error('Motorista não encontrado');
    }
    res.status(200).json({ driver });
});

exports.updateDriver = asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }
    const { nome, telefone, vehicle_plate, status, commissionRate } = req.body;
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user || user.role !== 'driver') {
        res.status(404);
        throw new Error('Motorista não encontrado');
    }
    user.nome = nome;
    user.telefone = telefone;
    await user.save();
    const profile = await DriverProfile.findOneAndUpdate(
        { user: userId },
        { 
            vehicle_plate: vehicle_plate,
            status: status,
            commissionRate: commissionRate
        },
        { new: true, upsert: true }
    );
    res.status(200).json({ 
        message: 'Motorista atualizado com sucesso',
        user: user,
        profile: profile
    });
});


// @desc    Admin obtém o relatório de um motorista (para o admin ver)
// @route   GET /api/drivers/:id/report
exports.getDriverReport = asyncHandler(async (req, res) => {
    // ... (Esta função permanece a mesma) ...
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


// --- (NOVA FUNÇÃO ADICIONADA) ---
// @desc    Motorista logado obtém o seu extrato de ganhos
// @route   GET /api/drivers/my-earnings
// @access  Privado (Motorista)
exports.getMyEarnings = asyncHandler(async (req, res) => {
    // 1. Encontrar o perfil do motorista logado (o ID vem do token)
    const profile = await DriverProfile.findOne({ user: req.user.id });
    if (!profile) {
        res.status(404);
        throw new Error('Perfil de motorista não encontrado');
    }

    // 2. Definir o período (este mês)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setUTCHours(23, 59, 59, 999);

    const query = {
        assigned_to_driver: profile._id,
        status: ORDER_STATUS.COMPLETED,
        timestamp_completed: {
            $gte: startOfMonth,
            $lte: endOfMonth
        }
    };

    // 3. Buscar todas as encomendas concluídas (este mês)
    const orders = await Order.find(query).sort({ timestamp_completed: -1 });

    // 4. Calcular os totais
    let totalGanhos = 0;
    orders.forEach(order => {
        totalGanhos += order.valor_motorista;
    });

    res.status(200).json({
        commissionRate: profile.commissionRate, // Envia a comissão atual
        totalGanhos: totalGanhos,
        totalOrders: orders.length,
        ordersList: orders
    });
});
// --- FIM DA NOVA FUNÇÃO ---