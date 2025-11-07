// Ficheiro: backend/routes/driverRoutes.js (Completo e Corrigido)

const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { protect, admin } = require('../middleware/authMiddleware');
const User = require('../models/User');

// @route   GET /api/drivers
// @desc    Admin obtém a lista de TODOS os motoristas
router.get('/', protect, admin, driverController.getAllDrivers);


// --- ### A CORREÇÃO ESTÁ AQUI (A ORDEM MUDOU) ### ---

// @route   GET /api/drivers/available
// @desc    Admin obtém a lista de motoristas LIVRES
// (Esta rota específica TEM de vir ANTES de '/:id')
router.get('/available', protect, admin, async (req, res) => {
    try {
        const allDrivers = await User.find({ role: 'driver' }).populate('profile');
        const availableDrivers = allDrivers.filter(driver => {
            return driver.profile && driver.profile.status === 'online_livre';
        });
        res.status(200).json({ drivers: availableDrivers });
    } catch (error) {
        console.error("Erro em GET /api/drivers/available:", error); 
        res.status(500).json({ message: 'Erro do servidor' });
    }
});

// @route   GET /api/drivers/:id/report
// @desc    Admin obtém o relatório de um motorista
// @access  Privado (Admin)
// (Esta rota específica TEM de vir ANTES de '/:id')
router.get('/:id/report', protect, admin, driverController.getDriverReport);


// @route   GET /api/drivers/:id
// @desc    Admin obtém um motorista por ID (para preencher o modal)
// (Esta rota genérica TEM de vir DEPOIS das específicas)
router.get('/:id', protect, admin, driverController.getDriverById);

// @route   PUT /api/drivers/:id
// @desc    Admin atualiza um motorista
router.put('/:id', protect, admin, driverController.updateDriver);

// --- ### FIM DA CORREÇÃO ### ---

module.exports = router;