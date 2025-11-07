const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Esta é a mesma chave secreta que usou no authController
const JWT_SECRET = 'a-minha-chave-secreta-para-a-entregaah-mz-2024';

/**
 * Middleware 'protect': Verifica se o utilizador está logado (se tem um token válido)
 */
exports.protect = async (req, res, next) => {
    let token;

    // O token vem no cabeçalho 'Authorization' como 'Bearer <token>'
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // 1. Obter o token (remover a palavra 'Bearer')
            token = req.headers.authorization.split(' ')[1];

            // 2. Verificar o token
            const decoded = jwt.verify(token, JWT_SECRET);

            // 3. Encontrar o utilizador pelo ID do token e anexá-lo ao 'req'
            // O '.select('-password')' impede que a senha seja trazida do banco
            req.user = await User.findById(decoded.user.id).select('-password');

            if (!req.user) {
                return res.status(401).json({ message: 'Utilizador não encontrado' });
            }

            // 4. Continuar para a próxima função (o controller)
            next();

        } catch (error) {
            console.error('Erro de token:', error.message);
            res.status(401).json({ message: 'Token não é válido' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Não autorizado, sem token' });
    }
};

/**
 * Middleware 'admin': Verifica se o utilizador é um administrador
 */
exports.admin = (req, res, next) => {
    // Esta função DEVE correr DEPOIS do 'protect',
    // porque 'protect' é quem anexa 'req.user'
    
    if (req.user && req.user.role === 'admin') {
        next(); // É admin, pode continuar
    } else {
        res.status(403).json({ message: 'Não autorizado. Acesso restrito a administradores.' });
    }
};

/**
 * Middleware 'driver': Verifica se o utilizador é um motorista
 */
exports.driver = (req, res, next) => {
    if (req.user && req.user.role === 'driver') {
        next(); // É motorista, pode continuar
    } else {
        res.status(403).json({ message: 'Não autorizado. Acesso restrito a motoristas.' });
    }
};