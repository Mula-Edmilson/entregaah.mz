// Ficheiro: backend/routes/authRoutes.js (Melhorado com Validação)

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect, admin } = require('../middleware/authMiddleware');

// --- (MELHORIA) Importar o 'body' para criar regras de validação ---
const { body } = require('express-validator');
// ------------------------------------------------------------------

// @route   POST api/auth/register-driver
// @desc    Admin regista um novo motorista
// @access  Privado (Admin)
router.post(
    '/register-driver', 
    protect, 
    admin, 
    // --- (MELHORIA) Array de regras de validação ---
    [
        body('nome', 'O nome é obrigatório').notEmpty().trim(),
        body('email', 'Por favor, insira um email válido').isEmail(),
        body('telefone', 'O telefone é obrigatório (mín. 9 dígitos)')
            .notEmpty()
            .trim()
            .isLength({ min: 9 }),
        body('password', 'A senha deve ter pelo menos 6 caracteres')
            .isLength({ min: 6 }),
        body('vehicle_plate', 'A placa é opcional').optional().trim()
    ],
    // ----------------------------------------------------
    authController.registerDriver
);


// @route   POST api/auth/login
// @desc    Login para Admin ou Motorista
// @access  Público
router.post(
    '/login',
    // --- (MELHORIA) Array de regras de validação ---
    [
        body('email', 'O email é obrigatório').isEmail(),
        body('password', 'A senha é obrigatória').notEmpty(),
        body('role', 'O tipo de utilizador (role) é obrigatório').isIn(['admin', 'driver'])
    ],
    // ----------------------------------------------------
    authController.login
);

module.exports = router;