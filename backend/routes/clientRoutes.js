const express = require('express');
const { body, param, query } = require('express-validator');
const clientController = require('../controllers/clientController');
const { protect, admin } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');

const router = express.Router();

router.post(
  '/',
  protect,
  admin,
  [
    body('nome', 'O nome do cliente é obrigatório').trim().notEmpty(),
    body('telefone', 'O telefone é obrigatório (mín. 9 dígitos)').trim().isLength({ min: 9 }),
    body('email', 'Por favor, insira um email válido')
      .optional({ checkFalsy: true })
      .isEmail()
  ],
  validateRequest,
  clientController.createClient
);

router.get('/', protect, admin, clientController.getClients);

router.patch(
  '/:id',
  protect,
  admin,
  [
    param('id', 'ID de cliente inválido').isMongoId(),
    body('nome').optional().trim().notEmpty(),
    body('telefone').optional().trim().isLength({ min: 9 }),
    body('email').optional({ checkFalsy: true }).isEmail()
  ],
  validateRequest,
  clientController.updateClient
);

router.delete(
  '/:id',
  protect,
  admin,
  [param('id', 'ID de cliente inválido').isMongoId()],
  validateRequest,
  clientController.deleteClient
);

// ✅ Extrato do cliente / statement
router.get(
  '/:id/statement',
  protect,
  admin,
  [
    param('id', 'ID de cliente inválido').isMongoId(),
    // O controller usa req.query.startDate / req.query.endDate,
    // por isso faz mais sentido validar em query em vez de body.
    query('startDate').optional(),
    query('endDate').optional()
  ],
  validateRequest,
  clientController.getStatement
);

module.exports = router;
