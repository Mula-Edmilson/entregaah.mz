/*
 * Ficheiro: js/driver/driverTracking.js
 *
 * (Dependência #4 do Motorista)
 *
 * Contém toda a lógica de tempo-real do motorista:
 * - Conexão ao Socket.IO
 * - Rastreamento e envio de geolocalização (GPS)
 */

// Variável global de módulo para guardar a instância do socket
let socket = null;

/**
 * Conecta o motorista ao servidor Socket.IO.
 * Esta função é chamada uma vez pelo 'driver.js' quando o painel é carregado.
 */
function connectDriverSocket() {
    const token = getAuthToken(); // De auth.js
    if (!token) {
        console.error("Não foi possível conectar o socket: Token do motorista não encontrado.");
        return;
    }
    
    // Conecta ao servidor, passando o token para o 'socketHandler.js' no backend
    socket = io(API_URL, { // De api.js
        auth: { token: token } 
    });

    socket.on('connect', () => {
        console.log('Motorista conectado ao Socket.IO com ID:', socket.id);
        // (MELHORIA) Informa o utilizador que a conexão está ativa
        const statusEl = document.getElementById('driver-connection-status');
        if (statusEl) {
            statusEl.textContent = 'Estado: Online (Conectado)';
            statusEl.className = 'status-online';
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Motorista desconectado do Socket.IO.');
        // (MELHORIA) Informa o utilizador que a conexão caiu
        const statusEl = document.getElementById('driver-connection-status');
        if (statusEl) {
            statusEl.textContent = 'Estado: Offline (Reconectando...)';
            statusEl.className = 'status-offline';
        }
    });
    
    // (MELHORIA FUTURA) Pode adicionar listeners aqui
    // ex: socket.on('nova_entrega_atribuida', (order) => { ... });
}

/**
 * Inicia o rastreamento de geolocalização (GPS) do motorista.
 * Esta função é chamada uma vez pelo 'driver.js'.
 */
function startLocationTracking() {
    if (!navigator.geolocation) {
        console.error('Geolocalização não é suportada neste browser.');
        // (MELHORIA) Mostra um alerta amigável para o motorista
        showCustomAlert('Erro de GPS', 'O seu dispositivo não suporta geolocalização. Não é possível partilhar a sua localização.', 'error'); // De ui.js
        return;
    }

    console.log('Iniciando rastreamento de localização do motorista...');

    navigator.geolocation.watchPosition(
        // Callback de Sucesso (quando a posição é obtida)
        (position) => {
            const { latitude, longitude } = position.coords;
            
            // Envia a localização para o backend (socketHandler.js)
            if (socket && socket.connected) {
                socket.emit('driver_location_update', { 
                    lat: latitude, 
                    lng: longitude 
                });
            } else {
                // Não envia, apenas avisa no console
                console.warn('Socket não está conectado. Posição não enviada.');
            }
        },
        // Callback de Erro (se o GPS falhar)
        (error) => {
            console.error("Erro ao obter localização:", error.message);
            // (MELHORIA) Mostra um alerta amigável para o motorista
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Erro de GPS', `Não foi possível obter a sua localização: ${error.message}. Verifique as permissões.`, 'error');
            }
        },
        // Opções de Rastreamento
        {
            enableHighAccuracy: true, // (MELHORIA) Pede a localização mais precisa
            timeout: 10000,           // 10 segundos de timeout
            maximumAge: 0,            // Não usa posições em cache
            distanceFilter: 10        // (MELHORIA) Só envia update se o motorista se mover 10 metros
        }
    );
}