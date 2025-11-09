// Ficheiro: backend/server.js (Melhorado com Segurança e Refatoração)

// Carrega as variáveis do .env (deve ser a primeira linha)
require('dotenv').config();

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path'); // <-- (MELHORIA) Para caminhos de ficheiros
const helmet = require('helmet'); // <-- (MELHORIA) Para segurança HTTP

// --- (MELHORIA) Lógica de Sockets, Erros e Constantes Refatorada ---
// Vamos importar estes ficheiros que iremos criar a seguir
const initSocketHandler = require('./socketHandler');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { ADMIN_ROOM } = require('./utils/constants');
// ----------------------------------------------------

// --- Configuração Inicial ---
const app = express();
const server = http.createServer(app);

// --- Configuração de CORS (O seu código original, está bom) ---
const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL_DEV,
    "null"
];
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.error(`CORS Bloqueado para a origem: ${origin}`);
            callback(new Error('Não permitido pela política de CORS'));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE"] // (MELHORIA) Adicionado DELETE
};
const io = new Server(server, {
    cors: corsOptions
});
app.set('socketio', io); // Disponibiliza o 'io' para os controllers

// --- Declarações ---
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET; // Será passado para o socket handler

// --- Middlewares ---
app.use(helmet()); // (MELHORIA) Adiciona 11 headers de segurança
app.use(cors(corsOptions)); // (O seu código)
app.use(express.json()); // (O seu código)
app.use(express.urlencoded({ extended: true })); // (O seu código)

// (MELHORIA) Servir a pasta 'uploads' de forma estática e segura
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Conexão ao MongoDB ---
// (MELHORIA) Adicionada verificação de segurança para JWT_SECRET
if (!MONGO_URI) {
    console.error("ERRO FATAL: MONGO_URI não foi definido. Verifique o seu ficheiro .env.");
    process.exit(1);
}
if (!JWT_SECRET) {
    console.error("ERRO FATAL: JWT_SECRET não foi definido. Verifique o seu ficheiro .env.");
    process.exit(1);
}
mongoose.connect(MONGO_URI)
    .then(() => console.log("Conectado ao MongoDB com sucesso!"))
    .catch(err => console.error("Erro ao conectar ao MongoDB:", err));

// --- Rotas da API ---
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/drivers', require('./routes/driverRoutes'));
app.use('/api/stats', require('./routes/statsRoutes'));
app.use('/api/clients', require('./routes/clientRoutes'));

app.get('/', (req, res) => {
    res.send('<h1>Servidor Backend da Entregaah Mz está no ar! (v2 - Segurança Ativa)</h1>');
});

// --- (MELHORIA) LÓGICA DO SOCKET.IO REFATORADA ---
// A lógica de 100+ linhas foi movida para 'socketHandler.js'
// Passamos o JWT_SECRET e ADMIN_ROOM para ele
initSocketHandler(io, JWT_SECRET, ADMIN_ROOM);
// ------------------------------------------------

// --- (MELHORIA) Middlewares de Erro ---
// Devem ser os ÚLTIMOS 'app.use()' a ser declarados
app.use(notFound); // Trata rotas 404 (que não existem)
app.use(errorHandler); // Trata todos os outros erros (500)

// --- Iniciar o Servidor ---
server.listen(PORT, () => {
    console.log(`Servidor a correr na porta ${PORT}`);
});