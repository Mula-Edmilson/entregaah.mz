// Ficheiro: backend/routes/adminRoutes.js (NOVO)

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// @route   DELETE /api/admin/orders/history
// @desc    Admin apaga o histórico de encomendas (mais antigo que 30 dias)
// @access  Privado (Admin)
// (Nota: o 'protect' e 'admin' são aplicados no server.js)
router.delete('/orders/history', adminController.deleteOldHistory);

// (Futuramente, outras rotas de perigo podem vir aqui)
// router.delete('/clients/inactive', adminController.deleteInactiveClients);

module.exports = router;