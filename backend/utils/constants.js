const ADMIN_ROOM = 'admin_room';

/**
 * Status do motorista
 *
 * Mantive os existentes para não quebrar código:
 *  - ONLINE_FREE  -> online_livre
 *  - ONLINE_BUSY  -> online_ocupado
 *  - OFFLINE      -> offline
 *
 * E adicionei estados mais específicos para controlo de rota:
 *  - A_CAMINHO_COLETA
 *  - COLETANDO
 *  - A_CAMINHO_ENTREGA
 *  - ENTREGANDO
 *  - RETORNO_CENTRAL
 *  - PAUSA
 */
const DRIVER_STATUS = Object.freeze({
  ONLINE_FREE: 'online_livre',
  ONLINE_BUSY: 'online_ocupado',
  OFFLINE: 'offline',

  // ✅ Novos estados de rota
  A_CAMINHO_COLETA: 'a_caminho_coleta',       // indo buscar encomenda
  COLETANDO: 'coletando',                     // no local de coleta / carregando
  A_CAMINHO_ENTREGA: 'a_caminho_entrega',     // levando até o cliente
  ENTREGANDO: 'entregando',                   // no local do cliente / aguardando código
  RETORNO_CENTRAL: 'retorno_central',         // voltando para a base
  PAUSA: 'pausa'                              // parou para almoço, combustível, etc.
});

/**
 * Status do pedido (encomenda)
 *
 * Mantive:
 *  - PENDING    -> pendente
 *  - ASSIGNED   -> atribuido
 *  - IN_PROGRESS-> em_progresso
 *  - COMPLETED  -> concluido
 *  - CANCELED   -> cancelado
 *
 * E adicionei estados intermediários de coleta/entrega:
 *  - COLETA_INICIADA
 *  - COLETADO
 */
const ORDER_STATUS = Object.freeze({
  PENDING: 'pendente',
  ASSIGNED: 'atribuido',
  IN_PROGRESS: 'em_progresso',
  COMPLETED: 'concluido',
  CANCELED: 'cancelado',

  // ✅ Novos estados mais detalhados
  COLETA_INICIADA: 'coleta_iniciada',  // motorista a caminho da coleta
  COLETADO: 'coletado'                 // encomenda já nas mãos do motorista
});

/**
 * Configurações financeiras
 */
const FINANCIAL = Object.freeze({
  DEFAULT_COMMISSION_RATE: 20
});

module.exports = {
  ADMIN_ROOM,
  DRIVER_STATUS,
  ORDER_STATUS,
  FINANCIAL
};
