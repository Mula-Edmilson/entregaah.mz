// Ficheiro: backend/controllers/orderController.js (Atualizado com Reatribuição)

const Order = require('../models/Order');
const DriverProfile = require('../models/DriverProfile');
const asyncHandler = require('express-async-handler'); // (Corrigido da última vez)
const { validationResult } = require('express-validator');
const { DRIVER_STATUS, ORDER_STATUS, ADMIN_ROOM } = require('../utils/constants');
const mongoose = require('mongoose');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const { getDistanceFromLatLonInKm } = require('../utils/helpers');
const { getSocketUserMap } = require('../socketHandler');


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
    // ... (Esta função permanece 100% igual à versão anterior) ...
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }
    
    const { 
        service_type, client_name, client_phone1, client_phone2, 
        address_text, price, lat, lng, clientId, autoAssign 
    } = req.body;

    let imageUrl = null;
    if (req.files && req.files.length > 0) {
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

    if (autoAssign === 'true' && coordinates) {
        console.log('Modo de Atribuição Automática ativado...');
        
        const availableDriverProfiles = await DriverProfile.find({ status: DRIVER_STATUS.ONLINE_FREE });
        const socketUserMap = getSocketUserMap(); 
        
        let bestDriverId = null;
        let minDistance = Infinity; 

        for (const profile of availableDriverProfiles) {
            const driverIdStr = profile.user.toString();
            let driverLocation = null;

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

                if (distance < minDistance) {
                    minDistance = distance;
                    bestDriverId = profile._id; 
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
        assigned_to_driver: driverId, 
        status: orderStatus 
    });
    await newOrder.save();
    
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


// @desc    Admin atribui ou reatribui uma encomenda
// @route   PUT /api/orders/:orderId/assign
exports.assignOrder = asyncHandler(async (req, res) => {
    // ... (Validação sem alterações) ...
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }

    const { orderId } = req.params;
    const { driverId } = req.body; // ID do NOVO motorista (vem do Profile)
    const io = req.app.get('socketio');

    const order = await Order.findById(orderId);
    if (!order) {
        res.status(404);
        throw new Error('Encomenda não encontrada');
    }

    // (MELHORIA) Não permite reatribuir se já estiver em progresso
    if (order.status === ORDER_STATUS.IN_PROGRESS) {
        res.status(400);
        throw new Error('Não é possível reatribuir uma encomenda que já está em progresso.');
    }

    // (MELHORIA) Pega o ID do motorista antigo (se existir)
    const oldDriverProfileId = order.assigned_to_driver;

    // Busca o perfil do NOVO motorista
    const newDriverProfile = await DriverProfile.findById(driverId);
    if (!newDriverProfile) {
        res.status(404);
        throw new Error('Novo perfil de motorista não encontrado');
    }

    // --- (A CORREÇÃO ESTÁ AQUI) ---
    // 1. Notificar o motorista ANTIGO (se houver um e for diferente do novo)
    if (oldDriverProfileId && oldDriverProfileId.toString() !== newDriverProfile._id.toString()) {
        try {
            const oldProfile = await DriverProfile.findById(oldDriverProfileId);
            if (oldProfile) {
                const oldUserId = oldProfile.user.toString();
                console.log(`A notificar motorista antigo ${oldUserId} sobre reatribuição...`);
                io.to(oldUserId).emit('entrega_cancelada', { orderId: order._id });
            }
        } catch (e) {
            console.error("Erro ao notificar motorista antigo:", e.message);
        }
    }

    // 2. Atribuir o NOVO motorista
    order.assigned_to_driver = driverId;
    order.status = ORDER_STATUS.ASSIGNED;
    await order.save();

    // 3. Notificar o NOVO motorista
    const newUserId = newDriverProfile.user.toString();
    console.log(`A notificar novo motorista ${newUserId} sobre atribuição...`);
    io.to(newUserId).emit('nova_entrega_atribuida', {
        orderId: order._id,
        clientName: order.client_name,
        serviceType: order.service_type
    });
    // --- FIM DA CORREÇÃO ---

    res.status(200).json({ message: 'Encomenda atribuída com sucesso', order });
});


// --- Restante do Ficheiro (sem alterações) ---

// @desc    Motorista obtém as suas encomendas ativas
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

// @desc    Motorista inicia uma entrega
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

// @desc    Motorista completa uma entrega
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

// @desc    Admin obtém todas as encomendas
exports.getAllOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find()
        .populate('assigned_to_driver') 
        .populate('created_by_admin', 'nome email')
        .sort({ timestamp_created: -1 });
    res.status(200).json({ orders });
});

// @desc    Admin obtém encomendas ativas
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

// @desc    Admin obtém o histórico de encomendas
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

// @desc    Admin obtém uma encomenda por ID
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