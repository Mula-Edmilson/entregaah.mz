/*
 * Ficheiro: backend/socketHandler.js
 *
 * (MELHORIA)
 *
 * Contém toda a lógica de gestão do Socket.IO,
 * removida do server.js para melhor organização.
 */

const jwt = require('jsonwebtoken');
const DriverProfile = require('./models/DriverProfile');
const { DRIVER_STATUS } = require('./utils/constants');

// Mapa para guardar o estado de cada socket conectado
// (socket.id -> { userId, userRole, userName, lastLocation })
const socketUserMap = new Map();

/**
 * Inicializa o gestor de Socket.IO
 * @param {object} io - A instância do Socket.IO vinda do server.js
 * @param {string} JWT_SECRET - O segredo JWT
 * @param {string} ADMIN_ROOM - O nome da sala de admin
 */
function initSocketHandler(io, JWT_SECRET, ADMIN_ROOM) {

    io.on('connection', (socket) => {
        console.log('Um utilizador conectou-se:', socket.id);
        let userId, userRole, userName; 

        // 1. Autenticação do Socket
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                throw new Error('Token não fornecido');
            }
            
            const decoded = jwt.verify(token, JWT_SECRET);
            userId = decoded.user.id;
            userRole = decoded.user.role;
            userName = decoded.user.nome; 

            // Guarda o estado deste utilizador
            socketUserMap.set(socket.id, { userId, userRole, userName, lastLocation: null });

            // 2. Gestão de Salas e Status
            if (userRole === 'admin') {
                socket.join(ADMIN_ROOM);
                console.log(`Admin ${userName} (${userId}) entrou na sala ${ADMIN_ROOM}`);

                // (LÓGICA DO REFRESH) Se um admin se conecta, envia-lhe
                // a última localização conhecida de todos os motoristas conectados.
                for (const [id, data] of socketUserMap.entries()) {
                    if (data.userRole === 'driver' && data.lastLocation) {
                        socket.emit('driver_location_broadcast', {
                            driverId: data.userId,
                            driverName: data.userName,
                            status: (data.lastLocation.status || DRIVER_STATUS.ONLINE_FREE),
                            lat: data.lastLocation.lat,
                            lng: data.lastLocation.lng
                        });
                    }
                }

            } else if (userRole === 'driver') {
                // Se um motorista se conecta, atualiza o seu status para 'online_livre'
                DriverProfile.findOneAndUpdate(
                    { user: userId }, 
                    { status: DRIVER_STATUS.ONLINE_FREE }
                )
                    .then(() => console.log(`Motorista ${userName} (${userId}) está agora ${DRIVER_STATUS.ONLINE_FREE}.`))
                    .catch(err => console.error('Erro ao atualizar status para online:', err));
            }

        } catch (error) {
            console.log(`Falha na autenticação do socket (${socket.id}):`, error.message);
            socket.disconnect(); 
            return; 
        }

        // --- Listeners de Eventos do Socket ---

        // 3. Admin pede atualização de mapa (ao navegar para a página)
        if (userRole === 'admin') {
            socket.on('admin_request_all_locations', () => {
                console.log(`Admin ${userName} (${socket.id}) pediu um refresh dos pins.`);
                for (const [id, data] of socketUserMap.entries()) {
                    if (data.userRole === 'driver' && data.lastLocation) {
                        socket.emit('driver_location_broadcast', {
                            driverId: data.userId,
                            driverName: data.userName,
                            status: (data.lastLocation.status || DRIVER_STATUS.ONLINE_FREE),
                            lat: data.lastLocation.lat,
                            lng: data.lastLocation.lng
                        });
                    }
                }
            });
        }

        // 4. Motorista envia atualização de localização
        if (userRole === 'driver') {
            socket.on('driver_location_update', async (data) => {
                const { lat, lng } = data;
                
                try {
                    // Busca o status atual no momento do update
                    const profile = await DriverProfile.findOne({ user: userId });
                    const currentStatus = profile ? profile.status : DRIVER_STATUS.ONLINE_FREE;

                    // Atualiza a 'lastLocation' no nosso mapa em memória
                    if (socketUserMap.has(socket.id)) {
                        socketUserMap.get(socket.id).lastLocation = { lat, lng, status: currentStatus };
                    }
                    
                    // Transmite a localização para todos os admins na sala
                    io.to(ADMIN_ROOM).emit('driver_location_broadcast', {
                        driverId: userId,
                        driverName: userName,
                        status: currentStatus,
                        lat: lat,
                        lng: lng
                    });
                } catch (error) {
                    console.error("Erro ao buscar perfil do motorista para update de localização:", error);
                }
            });
        }

        // 5. Utilizador desconecta-se
        socket.on('disconnect', () => {
            console.log('Utilizador desconectado:', socket.id);
            
            if (socketUserMap.has(socket.id)) {
                const { userId: disconnectedUserId, userRole: disconnectedUserRole, userName: disconnectedUserName } = socketUserMap.get(socket.id);

                // Se for um motorista, atualiza o status para 'offline'
                if (disconnectedUserRole === 'driver') {
                    DriverProfile.findOneAndUpdate(
                        { user: disconnectedUserId }, 
                        { status: DRIVER_STATUS.OFFLINE }
                    )
                        .then(() => {
                            console.log(`Motorista ${disconnectedUserName} (${disconnectedUserId}) está agora ${DRIVER_STATUS.OFFLINE}.`);
                            
                            // Avisa os admins que o motorista ficou offline
                            io.to(ADMIN_ROOM).emit('driver_status_changed', { 
                                driverId: disconnectedUserId, 
                                newStatus: DRIVER_STATUS.OFFLINE 
                            });

                            // (MELHORIA) Avisa os admins para remover o pin do mapa
                            io.to(ADMIN_ROOM).emit('driver_disconnected_broadcast', {
                                driverId: disconnectedUserId,
                                driverName: disconnectedUserName
                            });
                        })
                        .catch(err => console.error('Erro ao atualizar status para offline:', err));
                }
                
                // Remove o utilizador do nosso mapa em memória
                socketUserMap.delete(socket.id);
            }
        });
    });
}

module.exports = initSocketHandler;