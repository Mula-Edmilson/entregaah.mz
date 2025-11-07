// Ficheiro: backend/controllers/driverController.js (Completo e Corrigido)
const User = require('../models/User');
const DriverProfile = require('../models/DriverProfile');

// --- (ESTA É A CORREÇÃO QUE FALTAVA) ---
// O modelo 'Order' precisa de ser importado para podermos
// procurar pelo histórico de encomendas do motorista.
const Order = require('../models/Order');
// ----------------------------------------

/**
 * Obtém todos os motoristas para o painel do admin
 */
exports.getAllDrivers = async (req, res) => {
    try {
        const drivers = await User.find({ role: 'driver' })
            .populate('profile', 'vehicle_plate status');

        res.status(200).json({ drivers });

    } catch (error) {
        console.error('Erro ao buscar motoristas:', error);
        res.status(500).json({ message: 'Erro do servidor' });
    }
};


/**
 * Obtém os detalhes de um motorista específico por ID (do User)
 */
exports.getDriverById = async (req, res) => {
    try {
        const driver = await User.findById(req.params.id)
            .populate('profile', 'vehicle_plate status');

        if (!driver || driver.role !== 'driver') {
            return res.status(404).json({ message: 'Motorista não encontrado' });
        }

        res.status(200).json({ driver });

    } catch (error) {
        console.error('Erro ao buscar motorista por ID:', error);
        res.status(500).json({ message: 'Erro do servidor' });
    }
};


/**
 * Atualiza os detalhes de um motorista
 */
exports.updateDriver = async (req, res) => {
    try {
        const { nome, telefone, vehicle_plate, status } = req.body;
        const userId = req.params.id;

        const user = await User.findByIdAndUpdate(userId, 
            { nome, telefone },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ message: 'Motorista não encontrado' });
        }

        await DriverProfile.findOneAndUpdate(
            { user: userId },
            { vehicle_plate, status },
            { new: true }
        );

        res.status(200).json({ message: 'Motorista atualizado com sucesso' });

    } catch (error) {
        console.error('Erro ao atualizar motorista:', error);
        res.status(500).json({ message: 'Erro do servidor' });
    }
};


/**
 * Obtém o relatório de encomendas de um motorista
 * Acedido por: Admin
 */
exports.getDriverReport = async (req, res) => {
    try {
        const userId = req.params.id;

        // 1. Encontrar o perfil do motorista
        const driverProfile = await DriverProfile.findOne({ user: userId });
        if (!driverProfile) {
            return res.status(404).json({ message: 'Perfil de motorista não encontrado' });
        }

        // 2. Encontrar todas as encomendas concluídas
        // (Esta linha é a que estava a falhar porque 'Order' estava 'undefined')
        const completedOrders = await Order.find({
            assigned_to_driver: driverProfile._id,
            status: 'concluido'
        }).sort({ timestamp_completed: -1 });

        res.status(200).json({ orders: completedOrders });

    } catch (error) {
        console.error('Erro ao buscar relatório do motorista:', error);
        res.status(500).json({ message: 'Erro do servidor' });
    }
};