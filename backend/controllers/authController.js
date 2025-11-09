// Ficheiro: backend/controllers/authController.js (Melhorado com Validação e Async Handler)

const User = require('../models/User');
const DriverProfile = require('../models/DriverProfile');

// --- (MELHORIA) Importar ferramentas e constantes ---
const asyncHandler = require('express-async-handler');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs'); // Para encriptar palavras-passe
const jwt = require('jsonwebtoken'); // Para criar tokens
const { DRIVER_STATUS } = require('../utils/constants');
// --------------------------------------------------

// (MELHORIA) Mova o seu JWT_SECRET para o ficheiro .env
// O seu authMiddleware.js estava a usar uma string "hardcoded"
// Mova-a para .env e leia-a com process.env.JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET || 'a-minha-chave-secreta-para-a-entregaah-mz-2024';

/**
 * Função auxiliar para gerar um Token JWT
 * @param {string} id - O ID do utilizador
 * @param {string} role - O cargo (admin ou driver)
 * @param {string} nome - O nome do utilizador
 */
const generateToken = (id, role, nome) => {
    return jwt.sign(
        { user: { id, role, nome } }, // (MELHORIA) Payload mais informativo
        JWT_SECRET,
        { expiresIn: '30d' } // Token expira em 30 dias
    );
};


// @desc    Admin regista um novo motorista
// @route   POST /api/auth/register-driver
// @access  Privado (Admin)
exports.registerDriver = asyncHandler(async (req, res) => {
    // --- (MELHORIA) Bloco de Validação ---
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400); // Bad Request
        throw new Error(errors.array()[0].msg);
    }
    // ------------------------------------

    const { nome, email, telefone, password, vehicle_plate } = req.body;

    // 1. Verificar se o motorista (User) já existe
    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('Já existe um utilizador com este email');
    }

    // 2. Encriptar a palavra-passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Criar o novo 'User' (Motorista)
    const user = await User.create({
        nome,
        email: email.toLowerCase(),
        telefone,
        password: hashedPassword,
        role: 'driver' // Fixo como 'driver'
    });

    if (!user) {
        res.status(500);
        throw new Error('Falha ao criar o utilizador motorista');
    }

    // 4. Criar o 'DriverProfile' associado
    const driverProfile = await DriverProfile.create({
        user: user._id, // Associa ao 'User' acabado de criar
        vehicle_plate: vehicle_plate || '',
        status: DRIVER_STATUS.OFFLINE // (MELHORIA) Usa constante
    });

    if (!driverProfile) {
        // (MELHORIA) Se a criação do perfil falhar, apaga o User para evitar dados "órfãos"
        await user.deleteOne(); 
        res.status(500);
        throw new Error('Falha ao criar o perfil do motorista');
    }

    // 5. Devolver o motorista criado (sem a palavra-passe)
    res.status(201).json({
        message: 'Motorista registado com sucesso',
        _id: user._id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        profile: driverProfile
    });
});


// @desc    Login para Admin ou Motorista
// @route   POST /api/auth/login
// @access  Público
exports.login = asyncHandler(async (req, res) => {
    // --- (MELHORIA) Bloco de Validação ---
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400); // Bad Request
        throw new Error(errors.array()[0].msg);
    }
    // ------------------------------------

    const { email, password, role } = req.body;

    // 1. Encontrar o utilizador pelo email E pelo cargo (role)
    const user = await User.findOne({ email: email.toLowerCase(), role });

    if (!user) {
        res.status(401); // Unauthorized
        throw new Error('Credenciais inválidas (email, senha ou cargo incorretos)');
    }

    // 2. Comparar a palavra-passe
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        res.status(401); // Unauthorized
        throw new Error('Credenciais inválidas (email, senha ou cargo incorretos)');
    }

    // 3. Gerar o token e enviar a resposta
    res.status(200).json({
        message: 'Login bem-sucedido!',
        token: generateToken(user._id, user.role, user.nome)
    });
});