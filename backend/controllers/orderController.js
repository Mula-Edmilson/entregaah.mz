// Ficheiro: backend/controllers/orderController.js (Completo e Corrigido)
const Order = require('../models/Order');
const DriverProfile = require('../models/DriverProfile');

// Função auxiliar para gerar o código de 5 dígitos
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
exports.createOrder = async (req, res) => {
    try {
        const { service_type, client_name, client_phone1, client_phone2, address_text, price, lat, lng, clientId } = req.body;

        // --- (A CORREÇÃO ESTÁ AQUI) ---
        // Como estamos a usar upload.any(), a imagem está em req.files (um array)
        let imageUrl = null;
        if (req.files && req.files.length > 0) {
            // Pega no primeiro ficheiro que foi enviado
            imageUrl = `/uploads/${req.files[0].filename}`;
        }
        // --- FIM DA CORREÇÃO ---
        
        const verification_code = generateVerificationCode();
        const availableDriver = await DriverProfile.findOne({ status: 'online_livre' });
        
        let driverId = null;
        let orderStatus = 'pendente';

        if (availableDriver) {
            driverId = availableDriver._id;
            orderStatus = 'atribuido'; 
        }

        let coordinates = null;
        if (lat && lng) {
            coordinates = {
                lat: parseFloat(lat),
                lng: parseFloat(lng) 
            };
        }

        const newOrder = new Order({
            service_type, 
            price,
            client_name, 
            client_phone1, 
            client_phone2,
            address_text, 
            address_coords: coordinates,
            client: clientId || null, // O clientId agora será lido corretamente do req.body
            image_url: imageUrl, 
            verification_code: verification_code,
            created_by_admin: req.user._id, 
            assigned_to_driver: driverId,
            status: orderStatus
        });
        await newOrder.save();
        
        res.status(201).json({ message: 'Encomenda criada com sucesso!', order: newOrder });
    } catch (error) {
        console.error('Erro ao criar encomenda:', error);
        res.status(500).json({ message: 'Erro do servidor' });
    }
};

/**
 * Obtém as encomendas atribuídas a um motorista
 */
exports.getMyDeliveries = async (req, res) => {
    try {
        const driverProfile = await DriverProfile.findOne({ user: req.user._id });
        if (!driverProfile) {
            return res.status(404).json({ message: 'Perfil de motorista não encontrado' });
        }
        const orders = await Order.find({
            assigned_to_driver: driverProfile._id,
            status: { $in: ['atribuido', 'em_progresso'] }
        }).sort({ timestamp_created: -1 });
        res.status(200).json({ orders });
    } catch (error) {
        console.error('Erro ao buscar encomendas do motorista:', error);
        res.status(500).json({ message: 'Erro do servidor' });
    }
};

/**
 * Motorista clica em "Iniciar Entrega"
 */
exports.startDelivery = async (req, res) => {
    try {
        const orderId = req.params.id;
        const driverProfile = await DriverProfile.findOne({ user: req.user._id });
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Encomenda não encontrada' });
        }
        if (order.assigned_to_driver.toString() !== driverProfile._id.toString()) {
            return res.status(403).json({ message: 'Não autorizado para esta encomenda' });
        }
        order.status = 'em_progresso';
        order.timestamp_started = Date.now();
        await order.save();
        driverProfile.status = 'online_ocupado';
        await driverProfile.save();
        const io = req.app.get('socketio'); 
        io.to('admin_room').emit('delivery_started', { id: order._id, driverName: req.user.nome });
        res.status(200).json({ message: 'Entrega iniciada', order: order });
    } catch (error) {
        console.error('Erro ao iniciar entrega:', error);
        res.status(500).json({ message: 'Erro do servidor' });
    }
};

/**
 * Motorista finaliza a entrega com o código
 */
exports.completeDelivery = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { verification_code } = req.body;
        const driverProfile = await DriverProfile.findOne({ user: req.user._id });
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Encomenda não encontrada' });
        }
        if (order.assigned_to_driver.toString() !== driverProfile._id.toString()) {
            return res.status(403).json({ message: 'Não autorizado para esta encomenda' });
        }
        if (order.verification_code !== verification_code.toUpperCase()) {
            return res.status(400).json({ message: 'Código de verificação incorreto' });
        }
        order.status = 'concluido';
        order.timestamp_completed = Date.now();
        await order.save();
        driverProfile.status = 'online_livre';
        await driverProfile.save();
        const io = req.app.get('socketio');
        io.to('admin_room').emit('delivery_completed', { id: order._id });
        res.status(200).json({ message: 'Entrega finalizada com sucesso!' });
    } catch (error) {
        console.error('Erro ao completar entrega:', error);
        res.status(500).json({ message: 'Erro do servidor' });
    }
};

/**
 * Obtém todas as encomendas (para o Admin - depreciado)
 */
exports.getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('assigned_to_driver') 
            .populate('created_by_admin', 'nome email')
            .sort({ timestamp_created: -1 });
        res.status(200).json({ orders });
    } catch (error) {
        console.error('Erro ao buscar todas as encomendas:', error);
        res.status(500).json({ message: 'Erro do servidor' });
    }
};

/**
 * Obtém todas as encomendas ativas (pendentes, atribuidas, em progresso)
 */
exports.getActiveOrders = async (req, res) => {
    try {
        const orders = await Order.find({
            status: { $in: ['pendente', 'atribuido', 'em_progresso'] }
        })
        .populate('created_by_admin', 'nome') 
        .populate({
            path: 'assigned_to_driver',
            populate: { path: 'user', select: 'nome' } 
        })
        .sort({ timestamp_created: -1 });
        res.status(200).json({ orders });
    } catch (error) {
        console.error('Erro ao buscar encomendas ativas:', error);
        res.status(500).json({ message: 'Erro do servidor' });
    }
};

/**
 * Atribui uma encomenda a um motorista
 */
exports.assignOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { driverId } = req.body;
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Encomenda não encontrada' });
        }
        const driverProfile = await DriverProfile.findById(driverId);
        if (!driverProfile) {
            return res.status(404).json({ message: 'Motorista não encontrado' });
        }
        order.assigned_to_driver = driverId;
        order.status = 'atribuido';
        await order.save();
        res.status(200).json({ message: 'Encomenda atribuída com sucesso', order });
    } catch (error) {
        console.error('Erro ao atribuir encomenda:', error);
        res.status(500).json({ message: 'Erro do servidor' });
    }
};

/**
 * Obtém o histórico de encomendas (concluídas ou canceladas)
 */
exports.getHistoryOrders = async (req, res) => {
    try {
        const orders = await Order.find({
            status: { $in: ['concluido', 'cancelado'] }
        })
        .populate({
            path: 'assigned_to_driver',
            populate: { path: 'user', select: 'nome' }
        })
        .sort({ timestamp_completed: -1 });
        res.status(200).json({ orders });
    } catch (error) {
        console.error('Erro ao buscar histórico de encomendas:', error);
        res.status(500).json({ message: 'Erro do servidor' });
    }
};

/**
 * Obtém os detalhes de UMA encomenda específica
 */
exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('created_by_admin', 'nome')
            .populate({
                path: 'assigned_to_driver',
                populate: { path: 'user', select: 'nome telefone' }
            });

        if (!order) {
            return res.status(404).json({ message: 'Encomenda não encontrada' });
        }
        
        res.status(200).json({ order });

    } catch (error) {
        console.error('Erro ao buscar encomenda por ID:', error);
        res.status(500).json({ message: 'Erro do servidor' });
    }
};