const express = require('express');
const { body, param } = require('express-validator');
const driverController = require('../controllers/driverController');
const { protect, admin, driver } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { DRIVER_STATUS } = require('../utils/constants');

const router = express.Router();

// Listar todos os motoristas
router.get('/', protect, admin, driverController.getAllDrivers);

// Listar motoristas disponíveis
router.get('/available', protect, admin, async (_req, res) => {
  const drivers = await driverController.getAllDriversForAvailability();
  res.status(200).json(drivers);
});

// Obter motorista por ID (usado pelo modal de edição)
router.get(
  '/:id',
  protect,
  admin,
  [param('id', 'ID de motorista inválido').isMongoId()],
  validateRequest,
  driverController.getDriverById
);

// Atualizar dados do motorista
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

// Relatório de um motorista
router.get(
  '/:id/report',
  protect,
  admin,
  [param('id', 'ID de motorista inválido').isMongoId()],
  validateRequest,
  driverController.getDriverReport
);

// Ganhos do motorista autenticado (app do motorista)
router.get('/me/earnings', protect, driver, driverController.getMyEarnings);

module.exports = router;
