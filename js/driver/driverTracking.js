/*
 * Ficheiro: js/driver/driverTracking.js
 * (MELHORIA: Notificações em Tempo Real)
 */

let socket = null;

// (MELHORIA) Criamos o objeto de Áudio uma vez
const notificationSound = new Audio('https://www.myinstants.com/media/sounds/notification-sound.mp3');
notificationSound.volume = 0.5; // Define o volume


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
        
        // --- (A CORREÇÃO ESTÁ AQUI) ---
        // Fica a "ouvir" por novas entregas
        socket.on('nova_entrega_atribuida', (data) => {
            console.log('Nova entrega recebida:', data);
            
            // 1. Toca o som
            notificationSound.play().catch(e => console.warn("Não foi possível tocar o som:", e));
            
            // 2. Mostra um alerta (de ui.js)
            showCustomAlert(
                'Nova Entrega!', 
                `Novo pedido de ${data.clientName} (${SERVICE_NAMES[data.serviceType] || 'Serviço'}).`, 
                'success'
            );
            
            // 3. (MELHORIA) Envia um evento para o 'driver.js' recarregar a lista.
            // Esta é a forma correta de comunicar entre ficheiros JS.
            document.dispatchEvent(new Event('nova_entrega'));
        });
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