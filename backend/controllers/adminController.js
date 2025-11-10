// Ficheiro: backend/controllers/adminController.js (NOVO)

const Order = require('../models/Order');
const asyncHandler = require('express-async-handler');
const { ORDER_STATUS } = require('../utils/constants');

/**
 * @desc    Admin apaga o histórico de encomendas (mais antigo que 30 dias)
 * @route   DELETE /api/admin/orders/history
 * @access  Privado (Admin)
 */
exports.deleteOldHistory = asyncHandler(async (req, res) => {
    
    // 1. Define a data de corte (1 minuto atrás) - APENAS PARA TESTE
const cutoffDate = new Date();
cutoffDate.setMinutes(cutoffDate.getMinutes() - 1); // 1 minuto no passado
    // 2. Define o critério de busca
    const query = {
        status: { $in: [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELED] },
        timestamp_completed: { $lt: cutoffDate } // $lt = Less Than (mais antigo que)
    };

    // 3. Executa a deleção
    const result = await Order.deleteMany(query);

    if (result.deletedCount === 0) {
        res.status(200).json({ 
            message: 'Nenhuma encomenda antiga (com mais de 30 dias) foi encontrada para apagar.' 
        });
    } else {
        res.status(200).json({ 
            message: `${result.deletedCount} encomendas antigas foram apagadas com sucesso.` 
        });
    }
});