/*
 * Ficheiro: js/driver/driverTracking.js
 * (Correção de Áudio Autoplay)
 */

let socket = null;

// Criamos o objeto de Áudio uma vez
const notificationSound = new Audio('https://www.myinstants.com/media/sounds/notification-sound.mp3');
notificationSound.volume = 0.5; // Define o volume

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
            
            // 1. (MUDANÇA) Chama a nossa nova função
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

        // --- (A CORREÇÃO DO ÁUDIO ESTÁ AQUI) ---
        // Adiciona o listener para "acordar" o áudio no primeiro clique.
        // O { once: true } faz com que este listener se auto-remova após o primeiro clique.
        document.body.addEventListener('click', unlockAudio, { once: true });
        document.body.addEventListener('touchstart', unlockAudio, { once: true });
        // --- FIM DA CORREÇÃO ---
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
            console.error("Erro ao obter localização:", error.message);
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Erro de GPS', `Não foi possível obter a sua localização: ${error.message}. Verifique as permissões.`, 'error');
            }
        },
        {
            enableHighAccuracy: true, 
            timeout: 10000,           
            maximumAge: 0,            
            distanceFilter: 10
        }
    );
}