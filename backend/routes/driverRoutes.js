// Ficheiro: backend/routes/driverRoutes.js (Melhorado com Validação)

const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { protect, admin } = require('../middleware/authMiddleware');
const User = require('../models/User');

// --- (MELHORIA) Importar validadores ---
const { body, param } = require('express-validator');
const { DRIVER_STATUS } = require('../utils/constants');
// ------------------------------------

// @route   GET /api/drivers
// @desc    Admin obtém a lista de TODOS os motoristas
router.get('/', protect, admin, driverController.getAllDrivers);


// @route   GET /api/drivers/available
// @desc    Admin obtém a lista de motoristas LIVRES
// (Esta rota específica TEM de vir ANTES de '/:id')
router.get('/available', protect, admin, async (req, res) => {
    // (NOTA: Idealmente, esta lógica estaria no driverController,
    // mas vamos mantê-la aqui por agora para focar na validação)
    try {
        const allDrivers = await User.find({ role: 'driver' }).populate('profile');
        const availableDrivers = allDrivers.filter(driver => {
            return driver.profile && driver.profile.status === DRIVER_STATUS.ONLINE_FREE; // (MELHORIA) Usando constante
        });
        res.status(200).json({ drivers: availableDrivers });
    } catch (error) {
        console.error("Erro em GET /api/drivers/available:", error); 
        res.status(500).json({ message: 'Erro do servidor' });
    }
});

// @route   GET /api/drivers/:id/report
// @desc    Admin obtém o relatório de um motorista
router.get(
    '/:id/report', 
    protect, 
    admin, 
    [ // (MELHORIA) Valida o ID na URL
        param('id', 'ID do motorista inválido').isMongoId()
    ],
    driverController.getDriverReport
);


// @route   GET /api/drivers/:id
// @desc    Admin obtém um motorista por ID (para preencher o modal)
router.get(
    '/:id', 
    protect, 
    admin, 
    [ // (MELHORIA) Valida o ID na URL
        param('id', 'ID do motorista inválido').isMongoId()
    ],
    driverController.getDriverById
);

// @route   PUT /api/drivers/:id
// @desc    Admin atualiza um motorista
router.put(
    '/:id', 
    protect, 
    admin, 
    [ // (MELHORIA) Valida o ID na URL e os dados no body
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
            ])
    ],
    driverController.updateDriver
);

module.exports = router;