const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, admin } = require('../middleware/authMiddleware');

// @route   DELETE /api/admin/orders/history
// @desc    Admin apaga o histórico de encomendas (mais antigo que 30 dias)
// @access  Privado (Admin)
router.delete('/orders/history', protect, admin, adminController.deleteOldHistory);

module.exports = router;