// Ficheiro: backend/routes/orderRoutes.js (Completo e Corrigido)

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const orderController = require('../controllers/orderController');
const { protect, admin, driver } = require('../middleware/authMiddleware');

// --- Configuração do MulTER ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, 'uploads/'); },
    filename: function (req, file, cb) { cb(null, `${Date.now()}-${file.originalname}`); }
});
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/gif') {
        cb(null, true);
    } else {
        cb(new Error('Formato de imagem não suportado'), false);
    }
};
const upload = multer({ storage: storage, fileFilter: fileFilter, limits: { fileSize: 1024 * 1024 * 5 } });
// ------------------------------

// @route   POST api/orders (Admin cria encomenda)
router.post('/', protect, admin, upload.single('deliveryImage'), orderController.createOrder);

// @route   GET api/orders/my-deliveries (Motorista vê as suas)
router.get('/my-deliveries', protect, driver, orderController.getMyDeliveries);

// @route   POST api/orders/:id/start (Motorista inicia)
router.post('/:id/start', protect, driver, orderController.startDelivery);

// @route   POST api/orders/:id/complete (Motorista finaliza)
router.post('/:id/complete', protect, driver, orderController.completeDelivery);

// @route   PUT api/orders/:orderId/assign (Admin atribui)
router.put('/:orderId/assign', protect, admin, orderController.assignOrder);


// --- ### A CORREÇÃO ESTÁ AQUI ### ---
// As rotas 'GET' específicas têm de vir ANTES da rota genérica 'GET /:id'.

// @route   GET api/orders/active
// @desc    Admin obtém encomendas ativas
// @access  Privado (Admin)
router.get('/active', protect, admin, orderController.getActiveOrders);

// @route   GET api/orders/history
// @desc    Admin obtém o histórico de encomendas
// @access  Privado (Admin)
router.get('/history', protect, admin, orderController.getHistoryOrders);

// @route   GET api/orders (Isto também é específico, mas menos que os outros)
// @desc    Admin obtém TODAS as encomendas
// @access  Privado (Admin)
router.get('/', protect, admin, orderController.getAllOrders);

// @route   GET api/orders/:id
// @desc    Admin obtém UMA encomenda por ID
// @access  Privado (Admin)
// (Esta rota genérica tem de ser a ÚLTIMA rota 'GET')
router.get('/:id', protect, admin, orderController.getOrderById);
// --- ### FIM DA CORREÇÃO ### ---


module.exports = router;