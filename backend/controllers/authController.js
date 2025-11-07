// Ficheiro: backend/controllers/authController.js (CORRIGIDO)
const User = require('../models/User');
const DriverProfile = require('../models/DriverProfile');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'a-minha-chave-secreta-para-a-entregaah-mz-2024';

/**
 * Regista um novo motorista.
 */
exports.registerDriver = async (req, res) => {
    try {
        const { nome, email, telefone, password, vehicle_plate } = req.body;

        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'Email já está em uso' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({
            nome,
            email,
            telefone,
            password: hashedPassword,
            role: 'driver'
        });
        await user.save();

        const driverProfile = new DriverProfile({
            user: user._id,
            vehicle_plate: vehicle_plate
        });
        await driverProfile.save();

        res.status(201).json({ message: 'Motorista registado com sucesso', user: user });

    } catch (error) {
        console.error('Erro ao registar motorista:', error);
        res.status(500).json({ message: 'Erro do servidor' });
    }
};

/**
 * Faz o login de um Admin ou Motorista
 */
exports.login = async (req, res) => {
    try {
        const { email, password, role } = req.body;

        const user = await User.findOne({ email: email, role: role });
        if (!user) {
            return res.status(400).json({ message: `Utilizador ${role} não encontrado com este email` });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Senha incorreta' });
        }

        // --- (CORREÇÃO IMPORTANTE) ---
        // O 'nome' foi adicionado ao payload do token.
        const payload = {
            user: {
                id: user._id,
                role: user.role,
                nome: user.nome // <-- ESTA LINHA É A CORREÇÃO
            }
        };
        // --- FIM DA CORREÇÃO ---

        jwt.sign(
            payload,
            JWT_SECRET,
            { expiresIn: '30d' },
            (err, token) => {
                if (err) throw err;
                res.status(200).json({
                    token: token,
                    user: {
                        id: user._id,
                        nome: user.nome,
                        email: user.email,
                        role: user.role
                    }
                });
            }
        );

    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ message: 'Erro do servidor' });
    }
};