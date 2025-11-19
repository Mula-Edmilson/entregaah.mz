// backend/routes/driverRoutes.js

const express = require('express');
const { body, param } = require('express-validator');
const driverController = require('../controllers/driverController');
const { protect, admin, driver } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { DRIVER_STATUS } = require('../utils/constants');

const router = express.Router();

// Lista todos os motoristas (para o ecrã de gestão)
router.get('/', protect, admin, driverController.getAllDrivers);

// Lista motoristas DISPONÍVEIS (online_livre) para atribuir encomendas
router.get(
  '/available',
  protect,
  admin,
  driverController.getAllDriversForAvailability
);

module.exports = router;
