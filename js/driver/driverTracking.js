/*
 * Ficheiro: js/driver/driverTracking.js
 * (Correção de Áudio Autoplay)
 * (MELHORIA: Adicionado listener para reatribuição)
 * (MELHORIA 5: Aumentado o timeout do GPS para 30s)
 */

let socket = null;

// Criamos o objeto de Áudio uma vez
const notificationSound = new Audio('https://www.myinstants.com/en/instant/oplata-27021/?utm_source=copy&utm_medium=share');
notificationSound.volume = 0; // Define o volume

// Esta variável controla se o browser nos deu permissão de áudio
let audioUnblocked = false;

/**
 * Função dedicada para tocar o som.
 * Tenta tocar; se falhar, regista que precisamos de interação.
 */
function playNotificationSound() {
    // Tenta tocar o som
    const playPromise = notificationSound.play();
    
    if (playPromise !== undefined) {
        playPromise.then(() => {
            // Sucesso! O áudio está desbloqueado.
            audioUnblocked = true;
        }).catch(error => {
            // Falha (provavelmente bloqueado).
            console.warn("Áudio bloqueado pelo browser. Esperando interação do utilizador.");
            audioUnblocked = false;
        });
    }
}

/**
 * Esta função é chamada no PRIMEIRO clique do utilizador
 * em qualquer sítio, para "acordar" o áudio.
 */
function unlockAudio() {
    if (!audioUnblocked) {
        console.log("Tentativa de desbloquear o áudio com interação...");
        // Toca o som sem volume (muted) para "acordar"
        notificationSound.muted = true;
        notificationSound.play().then(() => {
            // Sucesso!
            notificationSound.muted = false;
            audioUnblocked = true;
            console.log("Áudio desbloqueado com sucesso.");
        }).catch(e => console.error("Desbloqueio de áudio falhou:", e));
    }
}


function connectDriverSocket() {
    const token = getAuthToken();
    if (!token) {
        console.error("Não foi possível conectar o socket: Token do motorista não encontrado.");
        return;
    }
    
    socket = io(API_URL, {
        auth: { token: token } 
    });

    socket.on('connect', () => {
        console.log('Motorista conectado ao Socket.IO com ID:', socket.id);
        
        socket.on('nova_entrega_atribuida', (data) => {
            console.log('Nova entrega recebida:', data);
            
            // 1. Toca o som
            playNotificationSound();
            
            // 2. Mostra o alerta visual
            showCustomAlert(
                'Nova Entrega!', 
                `Novo pedido de ${data.clientName} (${SERVICE_NAMES[data.serviceType] || 'Serviço'}).`, 
                'success'
            );
            
            // 3. Envia o evento para o 'driver.js' recarregar a lista
            document.dispatchEvent(new Event('nova_entrega'));
        });

        // Listener para quando o admin remove a entrega
        socket.on('entrega_cancelada', (data) => {
            console.log('Entrega foi reatribuída/cancelada:', data);
            
            // 1. Mostra um alerta informativo
            showCustomAlert(
                'Entrega Reatribuída', 
                `O pedido #${data.orderId.slice(-6)} foi reatribuído a outro motorista pelo admin.`, 
                'info' // Tipo 'info' (azul)
            );
            
            // 2. Envia o evento para o 'driver.js' recarregar a lista
            document.dispatchEvent(new Event('nova_entrega'));
        });

        // Adiciona o listener para "acordar" o áudio no primeiro clique.
        document.body.addEventListener('click', unlockAudio, { once: true });
        document.body.addEventListener('touchstart', unlockAudio, { once: true });
    });
    
    socket.on('disconnect', () => {
        console.log('Motorista desconectado do Socket.IO.');
    });
}

function startLocationTracking() {
    if (!navigator.geolocation) {
        console.error('Geolocalização não é suportada neste browser.');
        showCustomAlert('Erro de GPS', 'O seu dispositivo não suporta geolocalização.', 'error');
        return;
    }

    console.log('Iniciando rastreamento de localização do motorista...');

    navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            
            if (socket && socket.connected) {
                socket.emit('driver_location_update', { 
                    lat: latitude, 
                    lng: longitude 
                });
            } else {
                console.warn('Socket não está conectado. Posição não enviada.');
            }
        },
        (error) => {
            // Esta é a função que está a dar o erro
            console.error("Erro ao obter localização:", error.message);
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Erro de GPS', `Não foi possível obter a sua localização: ${error.message}. Verifique as permissões.`, 'error');
            }
        },
        { // --- (A CORREÇÃO ESTÁ AQUI) ---
            enableHighAccuracy: true, 
            timeout: 30000,           // Aumentado de 10000 para 30000 (30 segundos)
            maximumAge: 5000,         // Permite usar uma localização com 5s (em vez de 0)
            distanceFilter: 10
        }
    );
}