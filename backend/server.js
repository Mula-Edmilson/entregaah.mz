// Ficheiro: backend/server.js (Corrigido)

require('dotenv').config();

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');

const initSocketHandler = require('./socketHandler');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { ADMIN_ROOM } = require('./utils/constants');

// --- Configuração Inicial ---
const app = express();
const server = http.createServer(app);

// --- Configuração de CORS (Sem alterações) ---
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
    methods: ["GET", "POST", "PUT", "DELETE"]
};
const io = new Server(server, {
    cors: corsOptions
});
app.set('socketio', io);

// --- Declarações ---
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;

// --- Middlewares ---
app.use(helmet());
app.use(cors(corsOptions)); // (MELHORIA) Aplica CORS a todas as rotas (incluindo API)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- (A CORREÇÃO ESTÁ AQUI) ---
// Aplicamos o middleware CORS (corsOptions) explicitamente
// à rota /uploads, ANTES de servir os ficheiros estáticos.
app.use('/uploads', cors(corsOptions), express.static(path.join(__dirname, 'uploads')));
// --- FIM DA CORREÇÃO ---


// --- Conexão ao MongoDB (Sem alterações) ---
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

// --- Rotas da API (Sem alterações) ---
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/drivers', require('./routes/driverRoutes'));
app.use('/api/stats', require('./routes/statsRoutes'));
app.use('/api/clients', require('./routes/clientRoutes'));

app.get('/', (req, res) => {
    res.send('<h1>Servidor Backend da Entregaah Mz está no ar! (v2.1 - CORS Fix)</h1>');
});

// --- Lógica de Socket e Erros (Sem alterações) ---
initSocketHandler(io, JWT_SECRET, ADMIN_ROOM);
app.use(notFound);
app.use(errorHandler);

// --- Iniciar o Servidor ---
server.listen(PORT, () => {
    console.log(`Servidor a correr na porta ${PORT}`);
});