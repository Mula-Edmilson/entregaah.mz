// Ficheiro: backend/controllers/statsController.js (Completo e 100% Realista)

const Order = require('../models/Order');
const DriverProfile = require('../models/DriverProfile');

/**
 * PONTO 3: Obtém as estatísticas para os cartões da Visão Geral
 * Acedido por: Admin
 */
exports.getOverviewStats = async (req, res) => {
    try {
        const pendentes = await Order.countDocuments({ status: 'pendente' });
        const emTransito = await Order.countDocuments({ status: 'em_progresso' });

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const concluidasHoje = await Order.countDocuments({
            status: 'concluido',
            timestamp_completed: { $gte: startOfDay, $lte: endOfDay }
        });
        const motoristasOnline = await DriverProfile.countDocuments({
            status: { $in: ['online_livre', 'online_ocupado'] }
        });

        res.status(200).json({
            pendentes,
            emTransito,
            concluidasHoje,
            motoristasOnline
        });

    } catch (error) {
        console.error('Erro ao buscar estatísticas da visão geral:', error);
        res.status(500).json({ message: 'Erro do servidor' });
    }
};


// --- (FUNÇÃO ATUALIZADA - 100% REALISTA) ---
/**
 * PONTO 1: Obtém as estatísticas para o gráfico de Desempenho de Serviços
 * Acedido por: Admin
 */
exports.getServicePerformanceStats = async (req, res) => {
    
    // O priceMap fictício foi REMOVIDO.
    
    try {
        // 1. Usar o Pipeline de Agregação do MongoDB
        const stats = await Order.aggregate([
            {
                // 2. Encontrar apenas encomendas concluídas
                $match: { status: 'concluido' }
            },
            {
                // 3. Agrupar por tipo de serviço
                $group: {
                    _id: '$service_type', // Agrupa por 'service_type' (ex: 'doc', 'farma')
                    count: { $sum: 1 },    // Conta 1 por cada encomenda
                    // (NOVO) Soma o campo 'price' de cada encomenda no grupo
                    totalRevenue: { $sum: '$price' } 
                }
            },
            {
                // 4. Ordenar do mais popular para o menos popular
                $sort: { count: -1 } 
            }
        ]);

        // 5. Formatar os dados para o Chart.js
        const labels = [];       // (ex: ['Delivery Rápido', 'Documentos'])
        const adesaoValues = []; // (ex: [310, 120])
        const dataValues = [];   // (ex: [77500, 60000])

        const serviceNames = {
            'doc': 'Doc.',
            'farma': 'Farmácia',
            'carga': 'Cargas',
            'rapido': 'Delivery Rápido',
            'outros': 'Outros'
        };

        // 6. Calcular a receita (agora com dados reais)
        for (const item of stats) {
            const serviceKey = item._id; 
            const count = item.count;
            const revenue = item.totalRevenue; // <-- USA O DADO REAL DA BASE DE DADOS
            
            labels.push(serviceNames[serviceKey] || serviceKey);
            adesaoValues.push(count);
            dataValues.push(revenue);
        }

        res.status(200).json({
            labels,
            adesaoValues,
            dataValues
        });

    } catch (error) {
        console.error('Erro ao buscar estatísticas de serviços:', error);
        res.status(500).json({ message: 'Erro do servidor' });
    }
};
// --- FIM DA ATUALIZAÇÃO ---