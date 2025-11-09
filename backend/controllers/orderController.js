// Ficheiro: backend/controllers/orderController.js (MELHORADO com Otimização de Imagem)

const Order = require('../models/Order');
const DriverProfile = require('../models/DriverProfile');
const asyncHandler = require('express-async-handler');
const { validationResult } = require('express-validator');
const { DRIVER_STATUS, ORDER_STATUS, ADMIN_ROOM } = require('../utils/constants');
const mongoose = require('mongoose');

// --- (MELHORIA) Importar 'sharp' e 'fs' (File System) ---
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
// -----------------------------------------------------

// Função auxiliar (gerar código)
function generateVerificationCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 5; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Cria uma nova encomenda (Pedido)
 */
exports.createOrder = asyncHandler(async (req, res) => {
    // 1. Validação de dados (que já tínhamos)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }

    const { service_type, client_name, client_phone1, client_phone2, address_text, price, lat, lng, clientId } = req.body;

    let imageUrl = null;

    // --- (MELHORIA) Bloco de Otimização de Imagem ---
    if (req.files && req.files.length > 0) {
        const file = req.files[0];
        
        // Define um novo nome de ficheiro (ex: 123456.jpeg)
        const newFilename = `${Date.now()}.jpeg`;
        const outputPath = path.join('uploads', newFilename);

        try {
            // Usa o 'sharp' para processar a imagem
            await sharp(file.path) // Abre o ficheiro temporário que o multer guardou
                .resize(1200, 1200, { fit: 'inside' }) // Redimensiona (máx 1200x1200)
                .jpeg({ quality: 80 }) // Comprime para JPEG com 80% de qualidade
                .toFile(outputPath); // Salva no destino final
            
            // Apaga o ficheiro original (grande) que o multer guardou
            fs.unlinkSync(file.path);
            
            // Guarda o *novo* caminho no banco de dados
            imageUrl = `/uploads/${newFilename}`;

        } catch (err) {
            console.error('Erro ao otimizar imagem:', err);
            // Se falhar a otimização, apaga o ficheiro temporário e continua sem imagem
            fs.unlinkSync(file.path);
            // Não lança um erro, a encomenda pode ser criada sem imagem
        }
    }
    // --- Fim do Bloco de Otimização ---

    // 2. Lógica de criação da encomenda (que já tínhamos)
    const verification_code = generateVerificationCode();
    const availableDriver = await DriverProfile.findOne({ status: DRIVER_STATUS.ONLINE_FREE });
    
    let driverId = null;
    let orderStatus = ORDER_STATUS.PENDING;

    if (availableDriver) {
        driverId = availableDriver._id;
        orderStatus = ORDER_STATUS.ASSIGNED;
    }

    let coordinates = null;
    if (lat && lng) {
        coordinates = { lat: parseFloat(lat), lng: parseFloat(lng) };
    }
    
    const numericPrice = parseFloat(price);

    const newOrder = new Order({
        service_type, 
        price: isNaN(numericPrice) ? 0 : numericPrice,
        client_name, 
        client_phone1, 
        client_phone2,
        address_text, 
        address_coords: coordinates,
        client: clientId || null,
        image_url: imageUrl, // <-- Vai usar o 'imageUrl' otimizado
        verification_code: verification_code,
        created_by_admin: req.user._id, 
        assigned_to_driver: driverId,
        status: orderStatus
    });
    await newOrder.save();
    
    res.status(201).json({ message: 'Encomenda criada com sucesso!', order: newOrder });
});


/* --- RESTANTE DAS FUNÇÕES ---
   (As outras funções como getMyDeliveries, startDelivery, completeDelivery, etc.
   permanecem exatamente iguais ao ficheiro anterior. Não precisam de ser alteradas.)
*/

// @desc    Obtém as encomendas atribuídas a um motorista
exports.getMyDeliveries = asyncHandler(async (req, res) => {
    const driverProfile = await DriverProfile.findOne({ user: req.user._id });
    if (!driverProfile) {
        res.status(404);
        throw new Error('Perfil de motorista não encontrado');
    }
    
    const orders = await Order.find({
        assigned_to_driver: driverProfile._id,
        status: { $in: [ORDER_STATUS.ASSIGNED, ORDER_STATUS.IN_PROGRESS] }
    }).sort({ timestamp_created: -1 });
    
    res.status(200).json({ orders });
});

// @desc    Motorista clica em "Iniciar Entrega"
exports.startDelivery = asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }

    const orderId = req.params.id;
    const driverProfile = await DriverProfile.findOne({ user: req.user._id });
    
    if (!driverProfile) {
        res.status(404);
        throw new Error('Perfil de motorista não encontrado');
    }

    const order = await Order.findById(orderId);
    if (!order) {
        res.status(404);
        throw new Error('Encomenda não encontrada');
    }
    if (order.assigned_to_driver.toString() !== driverProfile._id.toString()) {
        res.status(403);
        throw new Error('Não autorizado para esta encomenda');
    }
    
    order.status = ORDER_STATUS.IN_PROGRESS;
    order.timestamp_started = Date.now();
    await order.save();
    
    driverProfile.status = DRIVER_STATUS.ONLINE_BUSY;
    await driverProfile.save();
    
    const io = req.app.get('socketio'); 
    io.to(ADMIN_ROOM).emit('delivery_started', { id: order._id, driverName: req.user.nome });
    io.to(ADMIN_ROOM).emit('driver_status_changed', { 
        driverId: driverProfile._id, 
        newStatus: driverProfile.status 
    });
    
    res.status(200).json({ message: 'Entrega iniciada', order: order });
});

// @desc    Motorista finaliza a entrega com o código
exports.completeDelivery = asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }

    const orderId = req.params.id;
    const { verification_code } = req.body;
    
    const driverProfile = await DriverProfile.findOne({ user: req.user._id });
    if (!driverProfile) {
        res.status(404);
        throw new Error('Perfil de motorista não encontrado');
    }

    const order = await Order.findById(orderId);
    if (!order) {
        res.status(404);
        throw new Error('Encomenda não encontrada');
    }
    if (order.assigned_to_driver.toString() !== driverProfile._id.toString()) {
        res.status(403);
        throw new Error('Não autorizado para esta encomenda');
    }
    if (order.verification_code !== verification_code.toUpperCase()) {
        res.status(400);
        throw new Error('Código de verificação incorreto');
    }
    
    order.status = ORDER_STATUS.COMPLETED;
    order.timestamp_completed = Date.now();
    await order.save();
    
    driverProfile.status = DRIVER_STATUS.ONLINE_FREE;
    await driverProfile.save();
    
    const io = req.app.get('socketio');
    io.to(ADMIN_ROOM).emit('delivery_completed', { id: order._id });
    io.to(ADMIN_ROOM).emit('driver_status_changed', { 
        driverId: driverProfile._id, 
        newStatus: driverProfile.status 
    });
    
    res.status(200).json({ message: 'Entrega finalizada com sucesso!' });
});

// @desc    Obtém todas as encomendas (para o Admin - depreciado)
exports.getAllOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find()
        .populate('assigned_to_driver') 
        .populate('created_by_admin', 'nome email')
        .sort({ timestamp_created: -1 });
    res.status(200).json({ orders });
});

// @desc    Obtém todas as encomendas ativas
exports.getActiveOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find({
        status: { $in: [ORDER_STATUS.PENDING, ORDER_STATUS.ASSIGNED, ORDER_STATUS.IN_PROGRESS] }
    })
    .populate('created_by_admin', 'nome') 
    .populate({
        path: 'assigned_to_driver',
        populate: { path: 'user', select: 'nome' } 
    })
    .sort({ timestamp_created: -1 });
    
    res.status(200).json({ orders });
});

// @desc    Atribui uma encomenda a um motorista
exports.assignOrder = asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }

    const { orderId } = req.params;
    const { driverId } = req.body;
    
    const order = await Order.findById(orderId);
    if (!order) {
        res.status(404);
        throw new Error('Encomenda não encontrada');
    }
    
    const driverProfile = await DriverProfile.findById(driverId);
    if (!driverProfile) {
        res.status(404);
        throw new Error('Motorista não encontrado');
    }
    
    order.assigned_to_driver = driverId;
    order.status = ORDER_STATUS.ASSIGNED;
    await order.save();
    
    res.status(200).json({ message: 'Encomenda atribuída com sucesso', order });
});

// @desc    Obtém o histórico de encomendas
exports.getHistoryOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find({
        status: { $in: [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELED] }
    })
    .populate({
        path: 'assigned_to_driver',
        populate: { path: 'user', select: 'nome' }
    })
    .sort({ timestamp_completed: -1 });
    
    res.status(200).json({ orders });
});

// @desc    Obtém os detalhes de UMA encomenda específica
exports.getOrderById = asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }

    const order = await Order.findById(req.params.id)
        .populate('created_by_admin', 'nome')
        .populate({
            path: 'assigned_to_driver',
            populate: { path: 'user', select: 'nome telefone' }
        });

    if (!order) {
        res.status(404);
        throw new Error('Encomenda não encontrada');
    }
    
    res.status(200).json({ order });
});