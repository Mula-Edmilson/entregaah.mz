// Ficheiro: backend/controllers/authController.js (Adicionada nova função)

const User = require('../models/User');
const DriverProfile = require('../models/DriverProfile');
const asyncHandler = require('express-async-handler');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { DRIVER_STATUS } = require('../utils/constants');

const JWT_SECRET = process.env.JWT_SECRET || 'a-minha-chave-secreta-para-a-entregaah-mz-2024';

// ... (A função generateToken permanece a mesma) ...
const generateToken = (id, role, nome) => {
    return jwt.sign(
        { user: { id, role, nome } },
        JWT_SECRET,
        { expiresIn: '30d' }
    );
};

// ... (A função registerDriver permanece a mesma) ...
exports.registerDriver = asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }
    const { nome, email, telefone, password, vehicle_plate } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('Já existe um utilizador com este email');
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = await User.create({
        nome,
        email: email.toLowerCase(),
        telefone,
        password: hashedPassword,
        role: 'driver'
    });
    if (!user) {
        res.status(500);
        throw new Error('Falha ao criar o utilizador motorista');
    }
    const driverProfile = await DriverProfile.create({
        user: user._id,
        vehicle_plate: vehicle_plate || '',
        status: DRIVER_STATUS.OFFLINE
    });
    if (!driverProfile) {
        await user.deleteOne(); 
        res.status(500);
        throw new Error('Falha ao criar o perfil do motorista');
    }
    res.status(201).json({
        message: 'Motorista registado com sucesso',
        _id: user._id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        profile: driverProfile
    });
});


// ... (A função login permanece a mesma) ...
exports.login = asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }
    const { email, password, role } = req.body;
    const user = await User.findOne({ email: email.toLowerCase(), role });
    if (!user) {
        res.status(401);
        throw new Error('Credenciais inválidas (email, senha ou cargo incorretos)');
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        res.status(401);
        throw new Error('Credenciais inválidas (email, senha ou cargo incorretos)');
    }
    res.status(200).json({
        message: 'Login bem-sucedido!',
        token: generateToken(user._id, user.role, user.nome)
    });
});


// --- (NOVA FUNÇÃO ADICIONADA) ---
// @desc    Utilizador logado muda a sua própria senha
// @route   PUT /api/auth/change-password
// @access  Privado (Qualquer um logado)
exports.changePassword = asyncHandler(async (req, res) => {
    // 1. Validar os dados
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }

    const { senhaAntiga, senhaNova } = req.body;

    // 2. Encontrar o utilizador (o ID vem do token, via middleware 'protect')
    // (Precisamos de .select('+password') porque o modelo o esconde por defeito)
    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
        res.status(404);
        throw new Error('Utilizador não encontrado');
    }

    // 3. Verificar se a senha antiga está correta
    const isMatch = await bcrypt.compare(senhaAntiga, user.password);
    if (!isMatch) {
        res.status(401); // Unauthorized
        throw new Error('A senha antiga está incorreta');
    }

    // 4. Encriptar e salvar a nova senha
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(senhaNova, salt);
    await user.save();

    res.status(200).json({ message: 'Senha atualizada com sucesso!' });
});
// --- FIM DA NOVA FUNÇÃO ---