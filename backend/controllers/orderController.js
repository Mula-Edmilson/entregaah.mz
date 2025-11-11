// Ficheiro: backend/controllers/orderController.js (Corrigido)

const Order = require('../models/Order');
const DriverProfile = require('../models/DriverProfile');
// (CORREÇÃO) A linha abaixo estava errada. Foi corrigida para importar o módulo.
const asyncHandler = require('express-async-handler');
const { validationResult } = require('express-validator');
const { DRIVER_STATUS, ORDER_STATUS, ADMIN_ROOM } = require('../utils/constants');
const mongoose = require('mongoose');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// --- (NOVA MELHORIA) ---
// Importa a nossa função de cálculo de distância
const { getDistanceFromLatLonInKm } = require('../utils/helpers');
// Importa o mapa de sockets (precisa de uma pequena mudança no socketHandler)
const { getSocketUserMap } = require('../socketHandler');
// --- FIM DA MELHORIA ---


function generateVerificationCode() {
    // ... (função sem alterações) ...
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }
    
    // (MUDANÇA) Lemos o novo campo 'autoAssign' do body
    const { 
        service_type, client_name, client_phone1, client_phone2, 
        address_text, price, lat, lng, clientId, autoAssign 
    } = req.body;

    let imageUrl = null;
    if (req.files && req.files.length > 0) {
        // ... (lógica de imagem sem alterações) ...
        const file = req.files[0];
        const newFilename = `${Date.now()}.jpeg`;
        const outputPath = path.join('uploads', newFilename);
        try {
            await sharp(file.path).resize(1200, 1200, { fit: 'inside' }).jpeg({ quality: 80 }).toFile(outputPath);
            fs.unlinkSync(file.path);
            imageUrl = `/uploads/${newFilename}`;
        } catch (err) {
            console.error('Erro ao otimizar imagem:', err);
            fs.unlinkSync(file.path);
        }
    }
    
    const verification_code = generateVerificationCode();
    let driverId = null;
    let orderStatus = ORDER_STATUS.PENDING;
    let coordinates = null;
    
    if (lat && lng) {
        coordinates = { lat: parseFloat(lat), lng: parseFloat(lng) };
    }

    // --- (LÓGICA DE ATRIBUIÇÃO MELHORADA) ---
    
    // Se o admin clicou em "Atribuição Automática" E forneceu um PIN no mapa
    if (autoAssign === 'true' && coordinates) {
        console.log('Modo de Atribuição Automática ativado...');
        
        // 1. Buscar todos os motoristas 'online_livre'
        const availableDriverProfiles = await DriverProfile.find({ status: DRIVER_STATUS.ONLINE_FREE });
        const socketUserMap = getSocketUserMap(); // Pega o mapa de localizações
        
        let bestDriverId = null;
        let minDistance = Infinity; // Começa com distância infinita

        // 2. Calcular a distância para cada um
        for (const profile of availableDriverProfiles) {
            const driverIdStr = profile.user.toString();
            let driverLocation = null;

            // Encontra a localização em tempo real do motorista
            // (Iteramos o socketUserMap para encontrar o 'userId')
            for (const [socketId, data] of socketUserMap.entries()) {
                if (data.userId === driverIdStr && data.lastLocation) {
                    driverLocation = data.lastLocation;
                    break;
                }
            }
            
            if (driverLocation) {
                const distance = getDistanceFromLatLonInKm(
                    coordinates.lat, 
                    coordinates.lng,
                    driverLocation.lat,
                    driverLocation.lng
                );
                
                console.log(`Distância para ${profile.user}: ${distance.toFixed(2)} km`);

                // 3. Encontrar o mais próximo
                if (distance < minDistance) {
                    minDistance = distance;
                    bestDriverId = profile._id; // Este é o ID do *Perfil*
                }
            }
        }
        
        if (bestDriverId) {
            console.log(`Melhor motorista encontrado: ${bestDriverId} a ${minDistance.toFixed(2)} km`);
            driverId = bestDriverId;
            orderStatus = ORDER_STATUS.ASSIGNED;
        } else {
            console.log('Atribuição automática falhou (nenhum motorista com localização). A encomenda ficará pendente.');
        }

    } else if (autoAssign === 'true' && !coordinates) {
        console.log('Atribuição automática falhou (sem pin no mapa). A encomenda ficará pendente.');
    }
    
    // --- FIM DA LÓGICA DE ATRIBUIÇÃO ---
    
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
        image_url: imageUrl, 
        verification_code: verification_code,
        created_by_admin: req.user._id, 
        assigned_to_driver: driverId, // Será 'null' ou o 'bestDriverId'
        status: orderStatus // Será 'pendente' ou 'atribuido'
    });
    await newOrder.save();
    
    // Se foi atribuído, envia a notificação para o motorista
    if (orderStatus === ORDER_STATUS.ASSIGNED) {
        const assignedProfile = await DriverProfile.findById(driverId);
        const io = req.app.get('socketio');
        const assignedUserId = assignedProfile.user.toString();
        io.to(assignedUserId).emit('nova_entrega_atribuida', {
            orderId: newOrder._id,
            clientName: newOrder.client_name,
            serviceType: newOrder.service_type
        });
    }
    
    res.status(201).json({ message: 'Encomenda criada com sucesso!', order: newOrder });
});

// ... (getMyDeliveries, startDelivery, completeDelivery - sem alterações) ...
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
exports.completeDelivery = asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }
    const orderId = req.params.id;
    const { verification_code } = req.body;
    const driverUser = req.user; 
    const driverProfile = await DriverProfile.findOne({ user: driverUser._id });
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
    const commissionRate = driverProfile.commissionRate || 20;
    const precoTotal = order.price;
    const ganhoMotorista = precoTotal * (commissionRate / 100);
    const ganhoEmpresa = precoTotal - ganhoMotorista;
    order.valor_motorista = ganhoMotorista;
    order.valor_empresa = ganhoEmpresa;
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

// ... (getAllOrders, getActiveOrders, assignOrder, getHistoryOrders, getOrderById - sem alterações) ...
exports.getAllOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find()
        .populate('assigned_to_driver') 
        .populate('created_by_admin', 'nome email')
        .sort({ timestamp_created: -1 });
    res.status(200).json({ orders });
});
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
        throw new Error('Perfil de motorista não encontrado');
    }
    order.assigned_to_driver = driverId;
    order.status = ORDER_STATUS.ASSIGNED;
    await order.save();
    const io = req.app.get('socketio');
    const assignedUserId = driverProfile.user.toString(); 
    io.to(assignedUserId).emit('nova_entrega_atribuida', {
        orderId: order._id,
        clientName: order.client_name,
        serviceType: order.service_type
    });
    res.status(200).json({ message: 'Encomenda atribuída com sucesso', order });
});
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