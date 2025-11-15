const express = require('express');
const asyncHandler = require('express-async-handler');
const { protect, admin } = require('../middleware/authMiddleware');
const { generateFinancialReport } = require('../utils/excelExport');
const Expense = require('../models/Expense');
const Order = require('../models/Order');
const User = require('../models/User');
const { ORDER_STATUS } = require('../utils/constants');

const router = express.Router();

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

    const drivers = await User.find({ role: 'driver' }).populate('profile').lean();

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

module.exports = router;