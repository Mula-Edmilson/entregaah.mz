// Ficheiro: backend/routes/driverRoutes.js (Atualizado)

const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { protect, admin } = require('../middleware/authMiddleware');
const User = require('../models/User');
const { body, param } = require('express-validator');
const { DRIVER_STATUS } = require('../utils/constants');

// @route   GET /api/drivers
router.get('/', protect, admin, driverController.getAllDrivers);

// @route   GET /api/drivers/available
router.get('/available', protect, admin, async (req, res) => {
    try {
        const allDrivers = await User.find({ role: 'driver' }).populate('profile');
        const availableDrivers = allDrivers.filter(driver => {
            return driver.profile && driver.profile.status === DRIVER_STATUS.ONLINE_FREE;
        });
        res.status(200).json({ drivers: availableDrivers });
    } catch (error) {
        console.error("Erro em GET /api/drivers/available:", error); 
        res.status(500).json({ message: 'Erro do servidor' });
    }
});

// @route   GET /api/drivers/:id/report
router.get(
    '/:id/report', 
    protect, 
    admin, 
    [
        param('id', 'ID do motorista inválido').isMongoId()
    ],
    driverController.getDriverReport
);

// @route   GET /api/drivers/:id
router.get(
    '/:id', 
    protect, 
    admin, 
    [
        param('id', 'ID do motorista inválido').isMongoId()
    ],
    driverController.getDriverById
);

// @route   PUT /api/drivers/:id
router.put(
    '/:id', 
    protect, 
    admin, 
    [
        param('id', 'ID do motorista inválido').isMongoId(),
        body('nome', 'O nome é obrigatório').notEmpty().trim(),
        body('telefone', 'O telefone é obrigatório (mín. 9 dígitos)')
            .notEmpty()
            .trim()
            .isLength({ min: 9 }),
        body('vehicle_plate', 'A placa é opcional').optional().trim(),
        body('status', 'Status inválido')
            .isIn([
                DRIVER_STATUS.ONLINE_FREE, 
                DRIVER_STATUS.ONLINE_BUSY, 
                DRIVER_STATUS.OFFLINE
            ]),
        
        // --- (NOVA VALIDAÇÃO) ---
        body('commissionRate', 'A comissão deve ser um número entre 0 e 100')
            .optional()
            .isFloat({ min: 0, max: 100 })
        // --- FIM DA VALIDAÇÃO ---
    ],
    driverController.updateDriver
);

module.exports = router;