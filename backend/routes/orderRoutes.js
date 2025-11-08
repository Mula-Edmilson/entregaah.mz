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

// --- (A CORREÇÃO ESTÁ AQUI) ---
// Trocámos upload.single('deliveryImage') por upload.any()
// upload.any() irá SEMPRE analisar o formulário (req.body) para nós,
// mesmo que nenhuma imagem seja enviada.
//
// @route   POST api/orders (Admin cria encomenda)
router.post('/', protect, admin, upload.any(), orderController.createOrder);
// --- FIM DA CORREÇÃO ---

// @route   GET api/orders/my-deliveries (Motorista vê as suas)
router.get('/my-deliveries', protect, driver, orderController.getMyDeliveries);

// @route   POST api/orders/:id/start (Motorista inicia)
router.post('/:id/start', protect, driver, orderController.startDelivery);

// @route   POST api/orders/:id/complete (Motorista finaliza)
router.post('/:id/complete', protect, driver, orderController.completeDelivery);

// @route   PUT api/orders/:orderId/assign (Admin atribui)
router.put('/:orderId/assign', protect, admin, orderController.assignOrder);

// @route   GET api/orders/active
router.get('/active', protect, admin, orderController.getActiveOrders);

// @route   GET api/orders/history
router.get('/history', protect, admin, orderController.getHistoryOrders);

// @route   GET api/orders (TODAS)
router.get('/', protect, admin, orderController.getAllOrders);

// @route   GET api/orders/:id (UMA)
router.get('/:id', protect, admin, orderController.getOrderById);


module.exports = router;