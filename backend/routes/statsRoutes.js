// Ficheiro: backend/routes/statsRoutes.js (Completo e Atualizado)

const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const { protect, admin } = require('../middleware/authMiddleware');

// @route   GET /api/stats/overview
// @desc    Admin obtém as estatísticas para a visão geral
// (Esta rota alimenta os 4 cartões)
router.get('/overview', protect, admin, statsController.getOverviewStats);


// --- (NOVA ADIÇÃO - Ponto 1) ---
// @route   GET /api/stats/services
// @desc    Admin obtém dados para o gráfico de desempenho
// @access  Privado (Admin)
router.get('/services', protect, admin, statsController.getServicePerformanceStats);
// --- FIM DA ADIÇÃO ---


module.exports = router;