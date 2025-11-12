const ADMIN_ROOM = 'admin_room';

const DRIVER_STATUS = Object.freeze({
  ONLINE_FREE: 'online_livre',
  ONLINE_BUSY: 'online_ocupado',
  OFFLINE: 'offline'
});

const ORDER_STATUS = Object.freeze({
  PENDING: 'pendente',
  ASSIGNED: 'atribuido',
  IN_PROGRESS: 'em_progresso',
  COMPLETED: 'concluido',
  CANCELED: 'cancelado'
});

const FINANCIAL = Object.freeze({
  DEFAULT_COMMISSION_RATE: 20
});

module.exports = {
  ADMIN_ROOM,
  DRIVER_STATUS,
  ORDER_STATUS,
  FINANCIAL
};