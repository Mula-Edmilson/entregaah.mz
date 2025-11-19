const express = require('express');
const multer = require('multer');
const path = require('node:path');
const { body, param } = require('express-validator');
const orderController = require('../controllers/orderController');
const { protect, admin, driver } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/'),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const fileFilter = (_req, file, cb) => {
  const allowedMime = ['image/jpeg', 'image/png', 'image/gif'];
  if (allowedMime.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Formato de imagem não suportado'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.UPLOAD_IMAGE_MAX_SIZE || `${5 * 1024 * 1024}`, 10) }
});

router.post(
  '/',
  protect,
  admin,
  upload.any(),
  [
    body('service_type', 'O tipo de serviço é obrigatório').trim().notEmpty(),
    body('client_name', 'O nome do cliente é obrigatório').trim().notEmpty(),
    body('client_phone1', 'O telefone principal é obrigatório').trim().isLength({ min: 9 }),
    body('price', 'O preço é obrigatório e deve ser um número').isFloat({ min: 0 }),
    body('lat').optional({ checkFalsy: true }).isFloat(),
    body('lng').optional({ checkFalsy: true }).isFloat(),
    body('clientId').optional({ checkFalsy: true }).isMongoId(),
    body('autoAssign').optional({ checkFalsy: true }).isBoolean().toBoolean()
  ],
  validateRequest,
  orderController.createOrder
);

router.get('/my-deliveries', protect, driver, orderController.getMyDeliveries);

router.post(
  '/:id/start',
  protect,
  driver,
  [param('id', 'ID da encomenda inválido').isMongoId()],
  validateRequest,
  orderController.startDelivery
);

router.post(
  '/:id/complete',
  protect,
  driver,
  [
    param('id', 'ID da encomenda inválido').isMongoId(),
    body('verification_code', 'O código de verificação é obrigatório e deve ter 5 caracteres')
      .trim()
      .isLength({ min: 5, max: 5 })
  ],
  validateRequest,
  orderController.completeDelivery
);

router.put(
  '/:orderId/assign',
  protect,
  admin,
  [
    param('orderId', 'ID da encomenda inválido').isMongoId(),
    body('driverId', 'ID do motorista é obrigatório e inválido').notEmpty().isMongoId()
  ],
  validateRequest,
  orderController.assignOrder
);

router.get('/active', protect, admin, orderController.getActiveOrders);
router.get('/history', protect, admin, orderController.getHistoryOrders);
router.get('/', protect, admin, orderController.getAllOrders);

router.get(
  '/:id',
  protect,
  admin,
  [param('id', 'ID da encomenda inválido').isMongoId()],
  validateRequest,
  orderController.getOrderById
);

module.exports = router;