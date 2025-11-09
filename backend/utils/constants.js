/*
 * Ficheiro: backend/utils/constants.js
 *
 * (MELHORIA)
 *
 * Centraliza todas as constantes "mágicas" do backend.
 * Isto previne erros de digitação e torna a manutenção mais fácil.
 */

const ADMIN_ROOM = 'admin_room';

const DRIVER_STATUS = {
    ONLINE_FREE: 'online_livre',
    ONLINE_BUSY: 'online_ocupado',
    OFFLINE: 'offline'
};

const ORDER_STATUS = {
    PENDING: 'pendente',
    ASSIGNED: 'atribuido',
    IN_PROGRESS: 'em_progresso',
    COMPLETED: 'concluido',
    CANCELED: 'cancelado'
};

module.exports = {
    ADMIN_ROOM,
    DRIVER_STATUS,
    ORDER_STATUS
};