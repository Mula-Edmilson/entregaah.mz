// Ficheiro: backend/routes/orderRoutes.js (Corrigido)

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const orderController = require('../controllers/orderController');
const { protect, admin, driver } = require('../middleware/authMiddleware');
const { body, param } = require('express-validator');

// --- Configuração do Multer (sem alterações) ---
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
router.post(
    '/', 
    protect, 
    admin, 
    upload.any(),
    [
        body('service_type', 'O tipo de serviço é obrigatório').notEmpty(),
        body('client_name', 'O nome do cliente é obrigatório').notEmpty().trim(),
        body('client_phone1', 'O telefone principal é obrigatório').notEmpty().trim().isLength({ min: 9 }),
        body('price', 'O preço é obrigatório e deve ser um número').notEmpty().isNumeric(),
        body('lat', 'Latitude deve ser um número').optional().isFloat(),
        body('lng', 'Longitude deve ser um número').optional().isFloat(),
        
        // --- (A CORREÇÃO ESTÁ AQUI) ---
        // Adicionámos { checkFalsy: true }
        // Isto diz ao validador: "Se o clientId for 'false', '', null ou undefined,
        // considera-o opcional e não tentes validar se é um MongoId."
        body('clientId', 'ID do Cliente inválido')
            .optional({ checkFalsy: true }) 
            .isMongoId(),
        // --- FIM DA CORREÇÃO ---
    ],
    orderController.createOrder
);

// --- RESTANTE DO FICHEIRO (Sem alterações) ---

// @route   GET api/orders/my-deliveries (Motorista vê as suas)
router.get('/my-deliveries', protect, driver, orderController.getMyDeliveries);

// @route   POST api/orders/:id/start (Motorista inicia)
router.post(
    '/:id/start', 
    protect, 
    driver, 
    [ 
        param('id', 'ID da encomenda inválido').isMongoId()
    ],
    orderController.startDelivery
);

// @route   POST api/orders/:id/complete (Motorista finaliza)
router.post(
    '/:id/complete', 
    protect, 
    driver, 
    [
        param('id', 'ID da encomenda inválido').isMongoId(),
        body('verification_code', 'O código de verificação é obrigatório e deve ter 5 caracteres')
            .notEmpty()
            .trim()
            .isLength({ min: 5, max: 5 })
    ],
    orderController.completeDelivery
);

// @route   PUT api/orders/:orderId/assign (Admin atribui)
router.put(
    '/:orderId/assign', 
    protect, 
    admin, 
    [
        param('orderId', 'ID da encomenda inválido').isMongoId(),
        body('driverId', 'ID do motorista é obrigatório e inválido').notEmpty().isMongoId()
    ],
    orderController.assignOrder
);

// @route   GET api/orders/active
router.get('/active', protect, admin, orderController.getActiveOrders);

// @route   GET api/orders/history
router.get('/history', protect, admin, orderController.getHistoryOrders);

// @route   GET api/orders (TODAS)
router.get('/', protect, admin, orderController.getAllOrders);

// @route   GET api/orders/:id (UMA)
router.get(
    '/:id', 
    protect, 
    admin, 
    [
        param('id', 'ID da encomenda inválido').isMongoId()
    ],
    orderController.getOrderById
);

module.exports = router;