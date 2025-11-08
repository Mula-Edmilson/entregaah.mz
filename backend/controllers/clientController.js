// Ficheiro: backend/controllers/clientController.js (Completo e Corrigido)

const Client = require('../models/Client');
const Order = require('../models/Order'); 
const mongoose = require('mongoose');

// @desc    Admin cria um novo cliente
exports.createClient = async (req, res) => {
    try {
        const { nome, telefone, email, empresa, nuit, endereco } = req.body;

        const clientExists = await Client.findOne({ telefone });
        if (clientExists) {
            return res.status(400).json({ message: 'Um cliente com este número de telefone já existe.' });
        }

        const client = new Client({
            nome,
            telefone,
            email,
            empresa,
            nuit,
            endereco,
            created_by_admin: req.user._id 
        });

        await client.save();
        res.status(201).json({ message: 'Cliente criado com sucesso', client });

    } catch (error) {
        console.error('Erro ao criar cliente:', error);
        res.status(500).json({ message: 'Erro do servidor' });
    }
};

// @desc    Admin obtém todos os clientes
exports.getAllClients = async (req, res) => {
    try {
        const clients = await Client.find().sort({ nome: 1 }); 
        res.status(200).json({ clients });
    } catch (error) {
        console.error('Erro ao buscar clientes:', error);
        res.status(500).json({ message: 'Erro do servidor' });
    }
};

// @desc    Admin obtém um cliente por ID
exports.getClientById = async (req, res) => {
    try {
        const client = await Client.findById(req.params.id);
        if (!client) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }
        res.status(200).json({ client });
    } catch (error) {
        console.error('Erro ao buscar cliente por ID:', error);
        res.status(500).json({ message: 'Erro do servidor' });
    }
};

// @desc    Admin atualiza um cliente
exports.updateClient = async (req, res) => {
    try {
        const { nome, telefone, email, empresa, nuit, endereco } = req.body;
        
        const client = await Client.findById(req.params.id);
        if (!client) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }
        if (telefone !== client.telefone) {
            const clientExists = await Client.findOne({ telefone });
            if (clientExists) {
                return res.status(400).json({ message: 'Este novo número de telefone já está em uso por outro cliente.' });
            }
        }

        const updatedClient = await Client.findByIdAndUpdate(
            req.params.id,
            { nome, telefone, email, empresa, nuit, endereco },
            { new: true, runValidators: true }
        );

        res.status(200).json({ message: 'Cliente atualizado com sucesso', client: updatedClient });
    } catch (error) {
        console.error('Erro ao atualizar cliente:', error);
        res.status(500).json({ message: 'Erro do servidor' });
    }
};

// @desc    Admin apaga um cliente
exports.deleteClient = async (req, res) => {
    try {
        const client = await Client.findById(req.params.id);
        if (!client) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }
        await client.deleteOne();
        res.status(200).json({ message: 'Cliente apagado com sucesso' });
    } catch (error) {
        console.error('Erro ao apagar cliente:', error);
        res.status(500).json({ message: 'Erro do servidor' });
    }
};


// --- (FUNÇÃO DO EXTRATO CORRIGIDA) ---
// @desc    Admin obtém o extrato de um cliente
exports.getStatement = async (req, res) => {
    try {
        const { id } = req.params; // ID do Cliente
        const { startDate, endDate } = req.query; // Datas (ex: '2025-11-08')

        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'Datas de início e fim são obrigatórias' });
        }

        // --- (A CORREÇÃO ESTÁ AQUI) ---
        
        // 1. Cria a data de início (ex: '2025-11-08' -> 8 de Nov, 00:00:00)
        const start = new Date(startDate);
        start.setUTCHours(0, 0, 0, 0); // Define para a meia-noite UTC

        // 2. Cria a data de fim (ex: '2025-11-08' -> 8 de Nov, 23:59:59)
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999); // Define para o FIM do dia UTC
        
        // --- FIM DA CORREÇÃO ---

        const clientId = new mongoose.Types.ObjectId(id);

        const orders = await Order.find({
            client: clientId,
            status: 'concluido',
            timestamp_completed: { // Filtra pela data de conclusão
                $gte: start, // Usa a data de início (00:00:00)
                $lte: end    // Usa a data de fim (23:59:59)
            }
        }).sort({ timestamp_completed: 1 }); // Ordena pela mais antiga primeiro

        let totalValue = 0;
        orders.forEach(order => {
            totalValue += order.price; 
        });

        res.status(200).json({
            totalValue: totalValue,
            totalOrders: orders.length,
            ordersList: orders 
        });

    } catch (error) {
        console.error('Erro ao gerar extrato:', error);
        res.status(500).json({ message: 'Erro do servidor' });
    }
};
// --- FIM DA FUNÇÃO CORRIGIDA ---