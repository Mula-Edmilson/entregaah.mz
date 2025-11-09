// Ficheiro: backend/routes/authRoutes.js (Adicionada nova rota)

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
// (MUDANÇA) 'protect' é necessário, mas 'admin' não (ambos podem mudar)
const { protect, admin } = require('../middleware/authMiddleware'); 
const { body } = require('express-validator');


// ... (A rota register-driver permanece a mesma) ...
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
        body('vehicle_plate', 'A placa é opcional').optional().trim()
    ],
    authController.registerDriver
);


// ... (A rota login permanece a mesma) ...
router.post(
    '/login',
    [
        body('email', 'O email é obrigatório').isEmail(),
        body('password', 'A senha é obrigatória').notEmpty(),
        body('role', 'O tipo de utilizador (role) é obrigatório').isIn(['admin', 'driver'])
    ],
    authController.login
);

// --- (NOVA ROTA ADICIONADA) ---
// @route   PUT api/auth/change-password
// @desc    Utilizador logado (admin ou motorista) muda a sua própria senha
// @access  Privado (Qualquer um logado)
router.put(
    '/change-password',
    protect, // Requer que o utilizador esteja logado
    [
        body('senhaAntiga', 'A senha antiga é obrigatória').notEmpty(),
        body('senhaNova', 'A nova senha deve ter pelo menos 6 caracteres')
            .isLength({ min: 6 })
    ],
    authController.changePassword // Nova função que vamos criar
);
// --- FIM DA NOVA ROTA ---

module.exports = router;