// Ficheiro: backend/routes/authRoutes.js (Atualizado)

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect, admin } = require('../middleware/authMiddleware'); 
const { body } = require('express-validator');


// @route   POST api/auth/register-driver
router.post(
    '/register-driver', 
    protect, 
    admin, 
    [
        body('nome', 'O nome é obrigatório').notEmpty().trim(),
        body('email', 'Por favor, insira um email válido').isEmail(),
        body('telefone', 'O telefone é obrigatório (mín. 9 dígitos)')
            .notEmpty()
            .trim()
            .isLength({ min: 9 }),
        body('password', 'A senha deve ter pelo menos 6 caracteres')
            .isLength({ min: 6 }),
        body('vehicle_plate', 'A placa é opcional').optional().trim(),
        
        // --- (NOVA VALIDAÇÃO) ---
        body('commissionRate', 'A comissão deve ser um número entre 0 e 100')
            .optional()
            .isFloat({ min: 0, max: 100 })
        // --- FIM DA VALIDAÇÃO ---
    ],
    authController.registerDriver
);


// @route   POST api/auth/login
router.post(
    '/login',
    [
        body('email', 'O email é obrigatório').isEmail(),
        body('password', 'A senha é obrigatória').notEmpty(),
        body('role', 'O tipo de utilizador (role) é obrigatório').isIn(['admin', 'driver'])
    ],
    authController.login
);

// @route   PUT api/auth/change-password
router.put(
    '/change-password',
    protect,
    [
        body('senhaAntiga', 'A senha antiga é obrigatória').notEmpty(),
        body('senhaNova', 'A nova senha deve ter pelo menos 6 caracteres')
            .isLength({ min: 6 })
    ],
    authController.changePassword
);

module.exports = router;