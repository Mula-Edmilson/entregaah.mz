// backend/routes/costRoutes.js

const express = require('express');
const { body } = require('express-validator');
const costController = require('../controllers/costController');
const { protect, admin } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { COMPANY_COST_CATEGORIES } = require('../models/CompanyCost');

const router = express.Router();

/**
 * POST /api/costs
 * Cria um novo custo (apenas admin)
 */
router.post(
  '/',
  protect,
  admin,
  [
    body('category')
      .isString()
      .notEmpty()
      .withMessage('Categoria é obrigatória.')
      .custom(value => COMPANY_COST_CATEGORIES.includes(value))
      .withMessage('Categoria de custo inválida.'),
    body('amount')
      .notEmpty()
      .withMessage('Valor do custo é obrigatório.')
      .isFloat({ min: 0 })
      .withMessage('Valor do custo deve ser um número >= 0.')
  ],
  validateRequest,
  costController.createCost
);

/**
 * GET /api/costs
 * Lista custos (com filtros simples opcionalmente)
 */
router.get('/', protect, admin, costController.getCostsList);

/**
 * GET /api/costs/dashboard-summary
 * Resumo para o dashboard (gráficos)
 */
router.get('/dashboard-summary', protect, admin, costController.getDashboardSummary);

module.exports = router;
