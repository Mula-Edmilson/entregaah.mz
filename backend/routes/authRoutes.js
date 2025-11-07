const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// (NOVA ADIÇÃO) Importar os nossos middlewares
const { protect, admin } = require('../middleware/authMiddleware');

// @route   POST api/auth/register-driver
// @desc    Admin regista um novo motorista
// @access  Privado (Admin)
//
// O Express vai executar as funções na ordem:
// 1. protect (Verifica o token)
// 2. admin (Verifica se o cargo é 'admin')
// 3. authController.registerDriver (Se tudo passar, executa a lógica)
router.post('/register-driver', protect, admin, authController.registerDriver);


// @route   POST api/auth/login
// @desc    Login para Admin ou Motorista
// @access  Público
router.post('/login', authController.login); // Esta rota não tem middlewares, é pública

module.exports = router;