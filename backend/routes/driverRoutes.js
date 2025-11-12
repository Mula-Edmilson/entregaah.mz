const express = require('express');
const { body, param } = require('express-validator');
const driverController = require('../controllers/driverController');
const { protect, admin, driver } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { DRIVER_STATUS } = require('../utils/constants');

const router = express.Router();

router.get('/', protect, admin, driverController.getAllDrivers);

router.get('/available', protect, admin, async (_req, res) => {
  const drivers = await driverController.getAllDriversForAvailability();
  res.status(200).json(drivers);
});