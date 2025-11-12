const jwt = require('jsonwebtoken');
const DriverProfile = require('./models/DriverProfile');
const { DRIVER_STATUS, ADMIN_ROOM } = require('./utils/constants');

const socketUserMap = new Map();

const initSocketHandler = (io) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET não definido para Socket.IO.');
  }

  io.on('connection', (socket) => {
    let userId;
    let userRole;
    let userName;

    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        throw new Error('Token não fornecido');
      }

      const decoded = jwt.verify(token, jwtSecret);
      userId = decoded.user.id;
      userRole = decoded.user.role;
      userName = decoded.user.nome;

      socketUserMap.set(socket.id, {
        userId,
        userRole,
        userName,
        lastLocation: null
      });

      if (userRole === 'admin') {
        socket.join(ADMIN_ROOM);

        socketUserMap.forEach((data) => {
          if (data.userRole === 'driver' && data.lastLocation) {
            socket.emit('driver_location_broadcast', {
              driverId: data.userId,
              driverName: data.userName,
              status: data.lastLocation.status || DRIVER_STATUS.ONLINE_FREE,
              lat: data.lastLocation.lat,
              lng: data.lastLocation.lng
            });
          }
        });
      }

      if (userRole === 'driver') {
        socket.join(userId);

        DriverProfile.findOneAndUpdate(
          { user: userId },
          { status: DRIVER_STATUS.ONLINE_FREE },
          { new: true }
        ).catch((err) => console.error('Erro ao atualizar status para online:', err));
      }
    } catch (error) {
      console.log(`Falha na autenticação do socket (${socket.id}):`, error.message);
      socket.disconnect();
      return;
    }

    socket.on('admin_request_all_locations', () => {
      if (userRole !== 'admin') return;

      socketUserMap.forEach((data) => {
        if (data.userRole === 'driver' && data.lastLocation) {
          socket.emit('driver_location_broadcast', {
            driverId: data.userId,
            driverName: data.userName,
            status: data.lastLocation.status || DRIVER_STATUS.ONLINE_FREE,
            lat: data.lastLocation.lat,
            lng: data.lastLocation.lng
          });
        }
      });
    });

    socket.on('driver_location_update', async (payload) => {
      if (userRole !== 'driver') return;

      const { lat, lng } = payload || {};
      if (Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) return;

      try {
        const profile = await DriverProfile.findOne({ user: userId });
        const status = profile ? profile.status : DRIVER_STATUS.ONLINE_FREE;

        if (socketUserMap.has(socket.id)) {
          socketUserMap.get(socket.id).lastLocation = { lat, lng, status };
        }

        io.to(ADMIN_ROOM).emit('driver_location_broadcast', {
          driverId: userId,
          driverName: userName,
          status,
          lat,
          lng
        });
      } catch (error) {
        console.error('Erro ao atualizar localização do motorista:', error);
      }
    });

    socket.on('disconnect', async () => {
      const userData = socketUserMap.get(socket.id);

      if (userData?.userRole === 'driver') {
        try {
          await DriverProfile.findOneAndUpdate(
            { user: userData.userId },
            { status: DRIVER_STATUS.OFFLINE }
          );
          io.to(ADMIN_ROOM).emit('driver_status_changed', {
            driverId: userData.userId,
            newStatus: DRIVER_STATUS.OFFLINE
          });
          io.to(ADMIN_ROOM).emit('driver_disconnected_broadcast', {
            driverId: userData.userId,
            driverName: userData.userName
          });
        } catch (err) {
          console.error('Erro ao atualizar status para offline:', err);
        }
      }

      socketUserMap.delete(socket.id);
    });
  });
};

const getSocketUserMap = () => socketUserMap;

module.exports = {
  initSocketHandler,
  getSocketUserMap
};