const express = require('express');
const { body, param, query } = require('express-validator');
const driverController = require('../controllers/driverController');
const { protect, admin, driver } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { DRIVER_STATUS } = require('../utils/constants');

const router = express.Router();

/**
 * ===========================
 *  ROTAS EXISTENTES (ADMIN)
 * ===========================
 */

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

/**
 * ===========================
 *  NOVAS ROTAS: ROTAS / RASTREAMENTO (APP MOTORISTA)
 * ===========================
 *
 * Todas protegidas pelo middleware `driver`,
 * ou seja, apenas o motorista autenticado pode chamar.
 */

// Iniciar viagem (coleta / entrega / retorno / pausa / outro)
router.post(
  '/trips/start',
  protect,
  driver,
  [
    body('type', 'Tipo de viagem é obrigatório')
      .trim()
      .notEmpty(),
    body('type', 'Tipo de viagem inválido')
      .isIn(['coleta', 'entrega', 'retorno_central', 'pausa', 'outro']),
    body('orderId')
      .optional({ checkFalsy: true })
      .isMongoId()
      .withMessage('ID de pedido inválido'),
    body('origin')
      .optional()
      .isObject()
      .withMessage('Origem deve ser um objeto'),
    body('destination')
      .optional()
      .isObject()
      .withMessage('Destino deve ser um objeto')
  ],
  validateRequest,
  driverController.startTrip
);

// Atualizar posição GPS durante a viagem
router.post(
  '/trips/position',
  protect,
  driver,
  [
    body('lat', 'Latitude é obrigatória').isFloat({ min: -90, max: 90 }),
    body('lng', 'Longitude é obrigatória').isFloat({ min: -180, max: 180 }),
    body('speed')
      .optional({ checkFalsy: true })
      .isFloat({ min: 0 })
      .withMessage('Velocidade deve ser um número positivo'),
    body('heading')
      .optional({ checkFalsy: true })
      .isFloat({ min: 0, max: 360 })
      .withMessage('Heading deve estar entre 0 e 360 graus'),
    body('accuracy')
      .optional({ checkFalsy: true })
      .isFloat({ min: 0 })
      .withMessage('Accuracy deve ser um número positivo')
  ],
  validateRequest,
  driverController.updatePosition
);

// Finalizar viagem atual
router.post(
  '/trips/end',
  protect,
  driver,
  [
    body('notes')
      .optional({ checkFalsy: true })
      .isString()
      .withMessage('Notas devem ser texto')
  ],
  validateRequest,
  driverController.endTrip
);

// Obter viagem atual do motorista
router.get(
  '/trips/current',
  protect,
  driver,
  driverController.getCurrentTrip
);

// Histórico de viagens do motorista (para filtros no app do motorista)
router.get(
  '/trips/history',
  protect,
  driver,
  [
    query('from')
      .optional({ checkFalsy: true })
      .isISO8601()
      .withMessage('O parâmetro "from" deve ser uma data válida'),
    query('to')
      .optional({ checkFalsy: true })
      .isISO8601()
      .withMessage('O parâmetro "to" deve ser uma data válida'),
    query('type')
      .optional({ checkFalsy: true })
      .isIn(['coleta', 'entrega', 'retorno_central', 'pausa', 'outro'])
      .withMessage('Tipo de viagem inválido'),
    query('limit')
      .optional({ checkFalsy: true })
      .isInt({ min: 1, max: 500 })
      .withMessage('Limit deve ser um inteiro entre 1 e 500')
  ],
  validateRequest,
  driverController.getMyTripsHistory
);

module.exports = router;
