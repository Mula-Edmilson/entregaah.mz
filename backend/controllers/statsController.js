// Ficheiro: backend/controllers/statsController.js (Atualizado)

const Order = require('../models/Order');
const DriverProfile = require('../models/DriverProfile');
const User = require('../models/User');
const asyncHandler = require('express-async-handler');
const { ORDER_STATUS, DRIVER_STATUS } = require('../utils/constants');

// @desc    Admin obtém as estatísticas para a visão geral
// @route   GET /api/stats/overview
exports.getOverviewStats = asyncHandler(async (req, res) => {
    // Definir o início e o fim do dia de hoje (em UTC)
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);

    const pendentes = await Order.countDocuments({ status: ORDER_STATUS.PENDING });
    const emTransito = await Order.countDocuments({ status: ORDER_STATUS.IN_PROGRESS });
    const concluidasHoje = await Order.countDocuments({
        status: ORDER_STATUS.COMPLETED,
        timestamp_completed: { $gte: start, $lte: end }
    });
    const motoristasOnline = await DriverProfile.countDocuments({
        status: { $in: [DRIVER_STATUS.ONLINE_FREE, DRIVER_STATUS.ONLINE_BUSY] }
    });

    res.status(200).json({
        pendentes,
        emTransito,
        concluidasHoje,
        motoristasOnline
    });
});

// @desc    Admin obtém dados para o gráfico de desempenho
// @route   GET /api/stats/services
exports.getServicePerformanceStats = asyncHandler(async (req, res) => {
    // Agregação no MongoDB para agrupar por 'service_type'
    const stats = await Order.aggregate([
        {
            $match: { status: ORDER_STATUS.COMPLETED } // Apenas encomendas concluídas
        },
        {
            $group: {
                _id: '$service_type', // Agrupar por tipo de serviço (ex: 'doc', 'farma')
                totalValue: { $sum: '$price' }, // Somar o preço
                totalOrders: { $sum: 1 } // Contar o número de encomendas
            }
        },
        {
            $sort: { totalValue: -1 } // Ordenar por valor (mais lucrativo primeiro)
        }
    ]);

    // Formatar os dados para o Chart.js
    const labels = stats.map(item => {
        // Mapeia a 'key' (ex: 'farma') para o nome (ex: 'Farmácia')
        const serviceNames = {
            'doc': 'Doc.',
            'farma': 'Farmácia',
            'carga': 'Cargas',
            'rapido': 'Delivery Rápido',
            'outros': 'Outros'
        };
        return serviceNames[item._id] || item._id;
    });
    const dataValues = stats.map(item => item.totalValue);
    const adesaoValues = stats.map(item => item.totalOrders);

    res.status(200).json({ labels, dataValues, adesaoValues });
});


// --- (NOVA MELHORIA) ---
// @desc    Admin obtém os dados financeiros (Receita, Lucro, Ganhos Motorista)
// @route   GET /api/stats/financials
exports.getFinancialStats = asyncHandler(async (req, res) => {
    
    // 1. Define o período (este mês)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setUTCHours(23, 59, 59, 999);

    const query = {
        status: ORDER_STATUS.COMPLETED,
        timestamp_completed: {
            $gte: startOfMonth,
            $lte: endOfMonth
        }
    };

    // 2. Agregação no MongoDB para somar os novos campos financeiros
    const financialStats = await Order.aggregate([
        {
            $match: query // Apenas encomendas concluídas este mês
        },
        {
            $group: {
                _id: null, // Agrupar tudo num único documento
                totalReceita: { $sum: '$price' },
                totalGanhosMotorista: { $sum: '$valor_motorista' },
                totalLucroEmpresa: { $sum: '$valor_empresa' }
            }
        }
    ]);

    // 3. Busca o melhor motorista (o que tem mais ganhos este mês)
    const topDriverStats = await Order.aggregate([
        {
            $match: query
        },
        {
            $group: {
                _id: '$assigned_to_driver', // Agrupar por motorista
                totalGanhos: { $sum: '$valor_motorista' }
            }
        },
        {
            $sort: { totalGanhos: -1 } // Ordenar (o melhor primeiro)
        },
        {
            $limit: 1 // Pegar apenas o Top 1
        },
        {
            // Fazer "lookup" (join) para buscar os dados do perfil
            $lookup: {
                from: 'driverprofiles',
                localField: '_id',
                foreignField: '_id',
                as: 'profile'
            }
        },
        {
            $unwind: '$profile' // Desfazer o array do lookup
        },
        {
            // Fazer outro "lookup" para buscar o nome (que está no 'User')
            $lookup: {
                from: 'users',
                localField: 'profile.user',
                foreignField: '_id',
                as: 'user'
            }
        },
        {
            $unwind: '$user'
        },
        {
            // Formatar o resultado final
            $project: {
                _id: 0,
                nome: '$user.nome',
                totalGanhos: '$totalGanhos'
            }
        }
    ]);

    let stats = {
        totalReceita: 0,
        totalGanhosMotorista: 0,
        totalLucroEmpresa: 0,
        topDriver: {
            nome: 'N/A',
            totalGanhos: 0
        }
    };

    if (financialStats.length > 0) {
        stats.totalReceita = financialStats[0].totalReceita;
        stats.totalGanhosMotorista = financialStats[0].totalGanhosMotorista;
        stats.totalLucroEmpresa = financialStats[0].totalLucroEmpresa;
    }
    
    if (topDriverStats.length > 0) {
        stats.topDriver = topDriverStats[0];
    }

    res.status(200).json(stats);
});
// --- FIM DA MELHORIA ---