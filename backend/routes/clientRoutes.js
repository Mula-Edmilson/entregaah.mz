// Ficheiro: backend/routes/clientRoutes.js (Completo e Corrigido)

const express = require('express'); // <-- Declarado APENAS UMA VEZ
const router = express.Router();
const clientController = require('../controllers/clientController');
const { protect, admin } = require('../middleware/authMiddleware');

// Todas as rotas de clientes são protegidas e só para Admins

// @route   POST /api/clients
// @desc    Admin cria um novo cliente
router.post('/', protect, admin, clientController.createClient);

// @route   GET /api/clients
// @desc    Admin obtém a lista de TODOS os clientes
router.get('/', protect, admin, clientController.getAllClients);

// @route   GET /api/clients/:id
// @desc    Admin obtém um cliente por ID
router.get('/:id', protect, admin, clientController.getClientById);

// @route   PUT /api/clients/:id
// @desc    Admin atualiza um cliente
router.put('/:id', protect, admin, clientController.updateClient);

// @route   DELETE /api/clients/:id
// @desc    Admin apaga um cliente
router.delete('/:id', protect, admin, clientController.deleteClient);

// @route   GET /api/clients/:id/statement
// @desc    Admin obtém o extrato de um cliente
router.get('/:id/statement', protect, admin, clientController.getStatement);

module.exports = router;