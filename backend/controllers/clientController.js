// Ficheiro: backend/controllers/clientController.js

const Client = require('../models/Client');

// @desc    Admin cria um novo cliente
exports.createClient = async (req, res) => {
    try {
        const { nome, telefone, email, empresa, nuit, endereco } = req.body;

        // Verifica se o telefone já está em uso
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
            created_by_admin: req.user._id // req.user vem do middleware 'protect'
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
        const clients = await Client.find().sort({ nome: 1 }); // Ordena por nome (A-Z)
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
        
        // Verifica se o telefone (se for novo) já pertence a OUTRO cliente
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

// (Opcional, mas recomendado)
// @desc    Admin apaga um cliente
exports.deleteClient = async (req, res) => {
    try {
        const client = await Client.findById(req.params.id);
        if (!client) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }

        // NOTA: Mais tarde, podemos querer verificar se este cliente tem encomendas
        // antes de o apagar. Por agora, vamos apagá-lo diretamente.
        await client.deleteOne();
        
        res.status(200).json({ message: 'Cliente apagado com sucesso' });
    } catch (error) {
        console.error('Erro ao apagar cliente:', error);
        res.status(500).json({ message: 'Erro do servidor' });
    }
};
