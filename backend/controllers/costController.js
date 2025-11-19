// backend/controllers/costController.js

const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const CompanyCost = require('../models/CompanyCost');
const Order = require('../models/Order');
const { ORDER_STATUS } = require('../utils/constants');
const { COMPANY_COST_CATEGORIES } = require('../models/CompanyCost');

/**
 * Helper: devolve início e fim de um mês (UTC safe)
 */
function getMonthRange(year, monthIndex) {
  // monthIndex: 0-11
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

/**
 * POST /api/costs
 * Cria um novo custo da empresa.
 * Body: { category, amount, description?, date? }
 */
exports.createCost = asyncHandler(async (req, res) => {
  const { category, amount, description, date } = req.body;

  if (!COMPANY_COST_CATEGORIES.includes(category)) {
    res.status(400);
    throw new Error('Categoria de custo inválida.');
  }

  const parsedAmount = Number(amount);
  if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
    res.status(400);
    throw new Error('Valor do custo inválido.');
  }

  let parsedDate = new Date();
  if (date) {
    const tmp = new Date(date);
    if (!Number.isNaN(tmp.getTime())) parsedDate = tmp;
  }

  const cost = await CompanyCost.create({
    category,
    amount: parsedAmount,
    description: description || '',
    date: parsedDate,
    createdBy: req.user ? req.user.id : undefined
  });

  res.status(201).json({
    message: 'Custo registado com sucesso.',
    cost
  });
});

/**
 * GET /api/costs
 * Lista custos com filtros simples (opcional):
 *   ?month=YYYY-MM  (ex: 2025-11)
 *   ?limit=50
 */
exports.getCostsList = asyncHandler(async (req, res) => {
  const { month, limit } = req.query;

  const query = {};
  if (month) {
    const [yearStr, monthStr] = month.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    if (!Number.isNaN(year) && !Number.isNaN(monthIndex) && monthIndex >= 0 && monthIndex <= 11) {
      const { start, end } = getMonthRange(year, monthIndex);
      query.date = { $gte: start, $lte: end };
    }
  }

  const max = Number(limit) && Number(limit) > 0 ? Number(limit) : 100;

  const costs = await CompanyCost.find(query)
    .sort({ date: -1 })
    .limit(max)
    .lean();

  res.status(200).json({
    total: costs.length,
    costs
  });
});

/**
 * GET /api/costs/dashboard-summary
 *   ?months=6  (opcional, nº de meses de histórico)
 *
 * Devolve:
 * {
 *   currentMonth: {
 *     label: '11/2025',
 *     totalCosts: 1234,
 *     costsByCategory: { salarios: 500, renda: 300, ... }
 *   },
 *   history: {
 *     labels: ['06/2025', '07/2025', ...],
 *     revenue: [ ... ], // receita total por mês (sum(price))
 *     costs: [ ... ]    // custos totais por mês
 *   }
 * }
 */
exports.getDashboardSummary = asyncHandler(async (req, res) => {
  const monthsCount = Number(req.query.months) && Number(req.query.months) > 0
    ? Number(req.query.months)
    : 6;

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonthIndex = now.getUTCMonth();

  // Range do mês atual
  const { start: currentStart, end: currentEnd } = getMonthRange(currentYear, currentMonthIndex);

  // Agrega custos por categoria no mês atual
  const categoryAgg = await CompanyCost.aggregate([
    {
      $match: {
        date: { $gte: currentStart, $lte: currentEnd }
      }
    },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' }
      }
    }
  ]);

  const costsByCategory = {};
  COMPANY_COST_CATEGORIES.forEach(cat => {
    costsByCategory[cat] = 0;
  });
  let totalCostsCurrentMonth = 0;

  categoryAgg.forEach(item => {
    costsByCategory[item._id] = item.total;
    totalCostsCurrentMonth += item.total;
  });

  // Histórico de receita x custos (últimos N meses)
  const labels = [];
  const revenue = [];
  const costs = [];

  for (let i = monthsCount - 1; i >= 0; i--) {
    const date = new Date(Date.UTC(currentYear, currentMonthIndex - i, 1, 0, 0, 0, 0));
    const year = date.getUTCFullYear();
    const monthIndex = date.getUTCMonth();

    const { start, end } = getMonthRange(year, monthIndex);
    const label = `${String(monthIndex + 1).padStart(2, '0')}/${year}`;
    labels.push(label);

    // Receita: soma do price de encomendas concluídas nesse mês
    const revenueAgg = await Order.aggregate([
      {
        $match: {
          status: ORDER_STATUS.COMPLETED,
          timestamp_completed: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: null,
          totalReceita: { $sum: '$price' }
        }
      }
    ]);

    const totalReceita = revenueAgg.length > 0 ? revenueAgg[0].totalReceita : 0;

    // Custos totais no mês
    const costAgg = await CompanyCost.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: null,
          totalCosts: { $sum: '$amount' }
        }
      }
    ]);

    const totalCosts = costAgg.length > 0 ? costAgg[0].totalCosts : 0;

    revenue.push(totalReceita);
    costs.push(totalCosts);
  }

  res.status(200).json({
    currentMonth: {
      label: `${String(currentMonthIndex + 1).padStart(2, '0')}/${currentYear}`,
      totalCosts: totalCostsCurrentMonth,
      costsByCategory
    },
    history: {
      labels,
      revenue,
      costs
    }
  });
});
