const express = require('express');
const { body, param } = require('express-validator');
const driverController = require('../controllers/driverController');
const { protect, admin, driver } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { DRIVER_STATUS } = require('../utils/constants');

const router = express.Router();

// Listar todos os motoristas (admin)
router.get('/', protect, admin, driverController.getAllDrivers);

// Listar motoristas disponíveis (admin)
router.get('/available', protect, admin, driverController.getAllDriversForAvailability);

// Ganhos do motorista autenticado (app do motorista)
router.get('/my-earnings', protect, driver, driverController.getMyEarnings);

// Obter motorista por ID (admin - usado pelo modal de edição)
router.get(
  '/:id',
  protect,
  admin,
  [param('id', 'ID de motorista inválido').isMongoId()],
  validateRequest,
  driverController.getDriverById
);

// Atualizar dados do motorista (admin)
router.put(
  '/:id',
  protect,
  admin,
  [
    param('id', 'ID de motorista inválido').isMongoId(),
    body('nome', 'O nome é obrigatório').trim().notEmpty(),
    body('telefone', 'O telefone é obrigatório (mín. 9 dígitos)').trim().isLength({ min: 9 }),
    body('vehicle_plate').optional({ checkFalsy: true }).trim(),
    body('status', 'Estado inválido')
      .optional({ checkFalsy: true })
      .isIn([DRIVER_STATUS.ONLINE_FREE, DRIVER_STATUS.ONLINE_BUSY, DRIVER_STATUS.OFFLINE]),
    body('commissionRate', 'A comissão deve ser um número entre 0 e 100')
      .optional({ checkFalsy: true })
      .isFloat({ min: 0, max: 100 })
  ],
  validateRequest,
  driverController.updateDriver
);

// Relatório de um motorista (admin)
router.get(
  '/:id/report',
  protect,
  admin,
  [param('id', 'ID de motorista inválido').isMongoId()],
  validateRequest,
  driverController.getDriverReport
);

module.exports = router;
