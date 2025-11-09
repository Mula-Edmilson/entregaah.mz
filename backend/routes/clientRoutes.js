// Ficheiro: backend/routes/clientRoutes.js (Melhorado com Validação)

const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { protect, admin } = require('../middleware/authMiddleware');

// --- (MELHORIA) Importar o 'body' para criar regras de validação ---
const { body } = require('express-validator');
// ------------------------------------------------------------------

// @route   POST /api/clients
// @desc    Admin cria um novo cliente
router.post('/', 
    protect, 
    admin, 
    // --- (MELHORIA) Array de regras de validação ---
    // Estas regras correm ANTES do controller
    [
        body('nome', 'O nome do cliente é obrigatório')
            .notEmpty() // Não pode estar vazio
            .trim(),    // Remove espaços em branco
        
        body('telefone', 'O telefone é obrigatório (mín. 9 dígitos)')
            .notEmpty()
            .trim()
            .isLength({ min: 9 }),

        body('email', 'Por favor, insira um email válido')
            .optional({ checkFalsy: true }) // Permite que seja nulo ou ""
            .isEmail(), // Mas se for preenchido, DEVE ser um email
        
        body('empresa').optional().trim(),
        body('nuit').optional().trim(),
        body('endereco').optional().trim()
    ],
    // ----------------------------------------------------
    clientController.createClient
);

// @route   GET /api/clients
// @desc    Admin obtém a lista de TODOS os clientes
router.get('/', protect, admin, clientController.getAllClients);

// @route   GET /api/clients/:id
// @desc    Admin obtém um cliente por ID
router.get('/:id', protect, admin, clientController.getClientById);

// @route   PUT /api/clients/:id
// @desc    Admin atualiza um cliente
router.put('/:id', 
    protect, 
    admin, 
    // --- (MELHORIA) Mesmas regras de validação para a atualização ---
    [
        body('nome', 'O nome do cliente é obrigatório').notEmpty().trim(),
        
        body('telefone', 'O telefone é obrigatório (mín. 9 dígitos)')
            .notEmpty()
            .trim()
            .isLength({ min: 9 }),

        body('email', 'Por favor, insira um email válido')
            .optional({ checkFalsy: true })
            .isEmail()
    ],
    // --------------------------------------------------------------
    clientController.updateClient
);

// @route   DELETE /api/clients/:id
// @desc    Admin apaga um cliente
router.delete('/:id', protect, admin, clientController.deleteClient);

// @route   GET /api/clients/:id/statement
// @desc    Admin obtém o extrato de um cliente
router.get('/:id/statement', protect, admin, clientController.getStatement);

module.exports = router;