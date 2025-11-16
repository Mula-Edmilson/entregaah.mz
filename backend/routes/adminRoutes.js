const express = require('express');
const asyncHandler = require('express-async-handler');
const { query, param, body } = require('express-validator');
const { protect, admin } = require('../middleware/authMiddleware');
const { generateFinancialReport } = require('../utils/excelExport');
const Expense = require('../models/Expense');
const Order = require('../models/Order');
const { validateRequest } = require('../middleware/validateRequest');
const adminController = require('../controllers/adminController');
const { ORDER_STATUS } = require('../utils/constants');

const router = express.Router();

/**
 * ===========================
 *  ROTA EXISTENTE: EXPORTAÇÃO FINANCEIRA
 * ===========================
 */

router.get(
  '/export-financial',
  protect,
  admin,
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      res.status(400);
      throw new Error('Datas de início e fim são obrigatórias.');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const expenses = await Expense.find({
      date: { $gte: start, $lte: end }
    })
      .populate('employee', 'nome telefone role')
      .lean();

    const orders = await Order.find({
      status: ORDER_STATUS.COMPLETED,
      timestamp_completed: { $gte: start, $lte: end }
    })
      .populate('assigned_to_driver')
      .populate({
        path: 'assigned_to_driver',
        populate: { path: 'user', select: 'nome telefone' }
      })
      .lean();

    const drivers = await require('../models/User')
      .find({ role: 'driver' })
      .populate('profile')
      .lean();

    const workbook = await generateFinancialReport({
      expenses,
      orders,
      drivers,
      startDate,
      endDate
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Relatorio_Financeiro_${startDate}_${endDate}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  })
);

/**
 * ===========================
 *  NOVAS ROTAS: RASTREAMENTO / ROTAS (ADMIN)
 * ===========================
 */

// Localização de todos os motoristas (para mapa em tempo real)
router.get(
  '/drivers/locations',
  protect,
  admin,
  adminController.getAllDriversLocation
);

// Histórico de viagens (todos os motoristas, com filtros)
router.get(
  '/trips',
  protect,
  admin,
  [
    query('driverId')
      .optional({ checkFalsy: true })
      .isMongoId()
      .withMessage('ID de motorista inválido'),
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
    query('status')
      .optional({ checkFalsy: true })
      .isIn(['em_andamento', 'concluida', 'cancelada'])
      .withMessage('Status de viagem inválido'),
    query('limit')
      .optional({ checkFalsy: true })
      .isInt({ min: 1, max: 1000 })
      .withMessage('Limit deve ser um inteiro entre 1 e 1000')
  ],
  validateRequest,
  adminController.getAllTrips
);

// Detalhes completos de uma viagem (para replay de rota)
router.get(
  '/trips/:tripId',
  protect,
  admin,
  [param('tripId', 'ID de viagem inválido').isMongoId()],
  validateRequest,
  adminController.getTripDetails
);

// Cancelar uma viagem em andamento (admin)
router.post(
  '/trips/:tripId/cancel',
  protect,
  admin,
  [
    param('tripId', 'ID de viagem inválido').isMongoId(),
    body('reason')
      .optional({ checkFalsy: true })
      .isString()
      .withMessage('Motivo deve ser texto')
  ],
  validateRequest,
  adminController.cancelTrip
);

// Estatísticas agregadas de viagens (para dashboard)
router.get(
  '/trips/stats',
  protect,
  admin,
  [
    query('from')
      .optional({ checkFalsy: true })
      .isISO8601()
      .withMessage('O parâmetro "from" deve ser uma data válida'),
    query('to')
      .optional({ checkFalsy: true })
      .isISO8601()
      .withMessage('O parâmetro "to" deve ser uma data válida')
  ],
  validateRequest,
  adminController.getTripsStats
);

// Apagar viagens antigas (admin)
router.delete(
  '/trips/old',
  protect,
  admin,
  [
    query('days')
      .optional({ checkFalsy: true })
      .isInt({ min: 1, max: 365 })
      .withMessage('Days deve ser um inteiro entre 1 e 365')
  ],
  validateRequest,
  adminController.deleteOldTrips
);

module.exports = router;
