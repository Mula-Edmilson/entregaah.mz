/*
 * Ficheiro: backend/socketHandler.js
 * (MELHORIA: Notificações em Tempo Real)
 */

const jwt = require('jsonwebtoken');
const DriverProfile = require('./models/DriverProfile');
const { DRIVER_STATUS } = require('./utils/constants');

const socketUserMap = new Map();

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

            socketUserMap.set(socket.id, { userId, userRole, userName, lastLocation: null });

            // 2. Gestão de Salas e Status
            if (userRole === 'admin') {
                socket.join(ADMIN_ROOM);
                console.log(`Admin ${userName} (${userId}) entrou na sala ${ADMIN_ROOM}`);

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
                
                // --- (A CORREÇÃO ESTÁ AQUI) ---
                // O motorista junta-se a uma sala privada com o seu próprio ID.
                // Isto permite-nos enviar-lhe mensagens diretas.
                socket.join(userId);
                console.log(`Motorista ${userName} (${userId}) juntou-se à sua sala privada.`);
                // --- FIM DA CORREÇÃO ---

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

        // 3. Admin pede atualização de mapa
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
                    const profile = await DriverProfile.findOne({ user: userId });
                    const currentStatus = profile ? profile.status : DRIVER_STATUS.ONLINE_FREE;

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

                if (disconnectedUserRole === 'driver') {
                    DriverProfile.findOneAndUpdate(
                        { user: disconnectedUserId }, 
                        { status: DRIVER_STATUS.OFFLINE }
                    )
                        .then(() => {
                            console.log(`Motorista ${disconnectedUserName} (${disconnectedUserId}) está agora ${DRIVER_STATUS.OFFLINE}.`);
                            
                            io.to(ADMIN_ROOM).emit('driver_status_changed', { 
                                driverId: disconnectedUserId, 
                                newStatus: DRIVER_STATUS.OFFLINE 
                            });

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
}

module.exports = initSocketHandler;