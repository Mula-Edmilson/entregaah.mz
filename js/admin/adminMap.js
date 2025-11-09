/*
 * Ficheiro: js/admin/adminMap.js
 *
 * (Dependência #5) - Precisa de 'api.js', 'auth.js', 'socket.io'
 *
 * Contém toda a lógica de gestão dos mapas Leaflet.js:
 * - O mapa do formulário de nova entrega.
 * - O mapa em tempo real de motoristas.
 */

// --- Variáveis de Estado para os Mapas ---

// 1. Mapa do Formulário
let map = null; 
let mapMarker = null; 

// 2. Mapa em Tempo Real
let liveMap = null; 
let driverMarkers = {}; // Objeto para guardar os marcadores por ID de motorista
let freeIcon = null; 
let busyIcon = null; 

/**
 * Inicializa os ícones customizados para o mapa em tempo real.
 * Esta função é chamada uma vez quando a página de admin é carregada.
 */
function initializeMapIcons() {
    const iconShadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
    
    // Ícone para motorista 'online_livre'
    freeIcon = L.icon({
        iconUrl: 'https://i.postimg.cc/MK8ty3PJ/car-pin-point.png',
        shadowUrl: iconShadowUrl,
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });
    
    // Ícone para motorista 'online_ocupado'
    busyIcon = L.icon({
        iconUrl: 'https://i.postimg.cc/J0bJ0fJj/marker-busy.png', // O seu ícone vermelho
        shadowUrl: iconShadowUrl,
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });
}

/**
 * Inicializa o mapa do formulário de "Nova Entrega".
 * É chamado pela função showServiceForm() em 'admin.js'.
 */
function initializeFormMap() {
    const maputoCoords = [-25.965, 32.589];
    
    // Destrói qualquer mapa anterior para evitar duplicação
    if (map) {
        destroyFormMap();
    }
    
    try {
        map = L.map('map').setView(maputoCoords, 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        // Marcador arrastável
        mapMarker = L.marker(maputoCoords, {
            draggable: true
        }).addTo(map);
        
        // Atualiza os inputs hidden quando o marcador é arrastado
        mapMarker.on('dragend', (event) => {
            const position = event.target.getLatLng();
            document.getElementById('delivery-lng').value = position.lng;
            document.getElementById('delivery-lat').value = position.lat;
        });
        
        // Define os valores iniciais dos inputs
        document.getElementById('delivery-lng').value = maputoCoords[1];
        document.getElementById('delivery-lat').value = maputoCoords[0];
        
    } catch (error) {
        console.error("Erro ao inicializar o mapa do formulário:", error);
        document.getElementById('map').innerHTML = '<p style="padding: 1rem; text-align: center; color: var(--danger-color);">Erro ao carregar o mapa.</p>';
    }
}

/**
 * Destrói a instância do mapa do formulário.
 * É chamado pela função showPage() sempre que se sai do formulário.
 */
function destroyFormMap() {
    if (map) {
        map.remove();
        map = null;
        mapMarker = null;
        console.log('Mapa do formulário destruído.');
    }
}

/**
 * Inicializa o mapa em tempo real.
 * É chamado pela função showPage() quando se entra na página do mapa.
 */
function initializeLiveMap() {
    if (liveMap) return; // Não inicializa se já estiver ativo

    try {
        const maputoCoords = [-25.965, 32.589];
        liveMap = L.map('live-map-container').setView(maputoCoords, 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(liveMap);
        
        console.log('Mapa em tempo real inicializado.');

        // Pede ao socket (em admin.js) que solicite as localizações atuais
        if (socket && typeof socket.emit === 'function') {
            socket.emit('admin_request_all_locations'); 
            console.log('A pedir ao servidor as localizações ativas...');
        }

    } catch (error) {
        console.error("Erro ao inicializar o mapa em tempo real:", error);
        document.getElementById('live-map-container').innerHTML = '<p>Erro ao carregar o mapa.</p>';
    }
}

/**
 * Destrói a instância do mapa em tempo real.
 * É chamado pela função showPage() sempre que se sai da página do mapa.
 */
function destroyLiveMap() {
    if (liveMap) {
        liveMap.remove();
        liveMap = null;
        driverMarkers = {}; // Limpa o registo de marcadores
        console.log('Mapa em tempo real destruído.');
    }
}


/* --- Funções de Atualização do Mapa em Tempo Real (Chamadas pelo Socket) --- */

/**
 * Atualiza ou cria o marcador de um motorista no mapa em tempo real.
 * @param {object} data - Dados do motorista (driverId, driverName, status, lat, lng).
 */
function updateDriverMarker(data) {
    const { driverId, driverName, status, lat, lng } = data;
    if (!liveMap) return; // Não faz nada se o mapa não estiver visível

    const newLatLng = [lat, lng];
    const popupContent = `<strong>${driverName}</strong><br>Status: ${status.replace('_', ' ')}`;
    const iconToUse = (status === 'online_ocupado') ? busyIcon : freeIcon;

    if (driverMarkers[driverId]) {
        // Se o marcador já existe, atualiza a posição, ícone e popup
        driverMarkers[driverId].setLatLng(newLatLng);
        driverMarkers[driverId].setPopupContent(popupContent);
        driverMarkers[driverId].setIcon(iconToUse);
    } else {
        // Se é um novo motorista, cria o marcador
        driverMarkers[driverId] = L.marker(newLatLng, { icon: iconToUse }).addTo(liveMap);
        driverMarkers[driverId].bindPopup(popupContent).openPopup();
        console.log(`Adicionando novo marcador para ${driverName}`);
    }
}

/**
 * Remove o marcador de um motorista que se desconectou.
 * @param {object} data - Dados do motorista (driverId, driverName).
 */
function removeDriverMarker(data) {
    const { driverId } = data;
    if (!liveMap) return;

    if (driverMarkers[driverId]) {
        liveMap.removeLayer(driverMarkers[driverId]); // Remove do mapa
        delete driverMarkers[driverId]; // Remove do nosso registo
        console.log(`Removido marcador para ${data.driverName} (desconectado)`);
    }
}