// Ficheiro: backend/server.js (PRONTO PARA PRODUÇÃO com .env e CORS CORRIGIDO)

require('dotenv').config();

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const cors = require('cors'); // <--- Importamos o CORS
const jwt = require('jsonwebtoken'); 

const DriverProfile = require('./models/DriverProfile');

// --- Configuração Inicial ---
const app = express();
const server = http.createServer(app);


// --- (ALTERAÇÃO PRINCIPAL: Regras de CORS) ---
// 1. Defina as suas origens (lidas do .env)
const allowedOrigins = [
    process.env.FRONTEND_URL,       // O seu GitHub Pages
    process.env.FRONTEND_URL_DEV, // O seu teste local (http://127.0.0.1:5500)
    "null"                          // Para testes locais (file://)
];

// 2. Crie as opções de CORS
const corsOptions = {
    origin: function (origin, callback) {
        // Permite pedidos sem 'origin' (como Postman) ou que estejam na lista
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            // Se a origem não estiver na lista, rejeita o pedido
            console.error(`CORS Bloqueado para a origem: ${origin}`);
            callback(new Error('Não permitido pela política de CORS'));
        }
    },
    methods: ["GET", "POST", "PUT"] // Métodos que o seu frontend usa
};

// 3. Configure o Socket.io com as opções
const io = new Server(server, {
    cors: corsOptions // <--- Usamos as opções aqui
});
// --- FIM DA ALTERAÇÃO ---


app.set('socketio', io);

// --- Declarações ÚNICAS ---
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_ROOM = 'admin_room';

// --- Middlewares ---

// --- (A CORREÇÃO PRINCIPAL ESTÁ AQUI) ---
// 4. Use as MESMAS opções de CORS para o Express (API)
app.use(cors(corsOptions));
// --- FIM DA CORREÇÃO ---

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// --- Conexão ao MongoDB ---
if (!MONGO_URI) {
    console.error("ERRO: MONGO_URI não foi definido. Verifique o seu ficheiro .env ou as Environment Variables no Render.");
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

// Rota de teste
app.get('/', (req, res) => {
    res.send('<h1>Servidor Backend da Entregaah Mz está no ar!</h1>');
});


// --- LÓGICA DO SOCKET.IO (Completa) ---
const socketUserMap = new Map();
io.on('connection', (socket) => {
    console.log('Um utilizador conectou-se:', socket.id);
    let userId, userRole, userName; 

    try {
        const token = socket.handshake.auth.token;
        if (token) {
            if (!JWT_SECRET) {
                throw new Error("JWT_SECRET não está configurado no servidor.");
            }
            const decoded = jwt.verify(token, JWT_SECRET);
            userId = decoded.user.id;
            userRole = decoded.user.role;
            userName = decoded.user.nome; 

            socketUserMap.set(socket.id, { userId, userRole, userName, lastLocation: null });

            if (userRole === 'admin') {
                socket.join(ADMIN_ROOM);
                console.log(`Admin ${userName} (${userId}) entrou na sala ${ADMIN_ROOM}`);

                for (const [id, data] of socketUserMap.entries()) {
                    if (data.userRole === 'driver' && data.lastLocation) {
                        socket.emit('driver_location_broadcast', {
                            driverId: data.userId,
                            driverName: data.userName,
                            status: (data.lastLocation.status || 'online_livre'),
                            lat: data.lastLocation.lat,
                            lng: data.lastLocation.lng
                        });
                    }
                }

                socket.on('admin_request_all_locations', () => {
                    console.log(`Admin ${userName} (${socket.id}) pediu um refresh dos pins.`);
                    for (const [id, data] of socketUserMap.entries()) {
                        if (data.userRole === 'driver' && data.lastLocation) {
                            socket.emit('driver_location_broadcast', {
                                driverId: data.userId,
                                driverName: data.userName,
                                status: (data.lastLocation.status || 'online_livre'),
                                lat: data.lastLocation.lat,
                                lng: data.lastLocation.lng
                            });
                        }
                    }
                });

            } 
            else if (userRole === 'driver') {
                DriverProfile.findOneAndUpdate({ user: userId }, { status: 'online_livre' })
                    .then(() => console.log(`Motorista ${userName} (${userId}) está agora online_livre.`))
                    .catch(err => console.error('Erro ao atualizar status para online:', err));
            }
        } else {
             throw new Error('Token não fornecido');
        }
    } catch (error) {
        console.log(`Falha na autenticação do socket (${socket.id}):`, error.message);
        socket.disconnect(); 
        return; 
    }

    if (userRole === 'driver') {
        socket.on('driver_location_update', async (data) => {
            const { lat, lng } = data;
            
            const profile = await DriverProfile.findOne({ user: userId });
            const currentStatus = profile ? profile.status : 'online_livre';

            if (socketUserMap.has(socket.id)) {
                socketUserMap.get(socket.id).lastLocation = { lat, lng, status: currentStatus };
            }
            
            io.to(ADMIN_ROOM).emit('driver_location_broadcast', {
                driverId: userId,
                driverName: userName,
                status: currentStatus,
                lat: lat,
                lng: lng
            });
        });
    }

    socket.on('disconnect', () => {
        console.log('Utilizador desconectado:', socket.id);
        
        if (socketUserMap.has(socket.id)) {
            const { userId: disconnectedUserId, userRole: disconnectedUserRole, userName: disconnectedUserName } = socketUserMap.get(socket.id);

            if (disconnectedUserRole === 'driver') {
                DriverProfile.findOneAndUpdate({ user: disconnectedUserId }, { status: 'offline' })
                    .then(() => {
                        console.log(`Motorista ${disconnectedUserName} (${disconnectedUserId}) está agora offline.`);
                        
                        io.to(ADMIN_ROOM).emit('driver_disconnected_broadcast', {
                            driverId: disconnectedUserId,
                            driverName: disconnectedUserName
                        });
                    })
                    .catch(err => console.error('Erro ao atualizar status para offline:', err));
            }
            
            socketUserMap.delete(socket.id);
        }
    });
});
// --- FIM DA LÓGICA DO SOCKET.IO ---


// --- Iniciar o Servidor ---
server.listen(PORT, () => {
    console.log(`Servidor a correr na porta ${PORT}`);
});
