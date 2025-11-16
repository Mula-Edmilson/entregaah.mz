/*
 * Ficheiro: js/admin/adminMap.js
 *
 * (Dependência #5) - Precisa de 'api.js', 'auth.js', 'socket.io'
 *
 * Contém toda a lógica de gestão dos mapas Leaflet.js:
 * - O mapa do formulário de nova entrega.
 * - O mapa em tempo real de motoristas.
 * - ✅ NOVO: Integração com API REST para rastreamento de rotas.
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

// ✅ NOVO: Variáveis para polling via API REST
let liveMapPollingInterval = null;
const LIVE_MAP_REFRESH_MS = 15000; // 15 segundos

// ✅ NOVO: Ícones adicionais para novos estados
let collectingIcon = null;
let deliveringIcon = null;
let returningIcon = null;
let pauseIcon = null;

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
        iconUrl: 'https://i.postimg.cc/J0bJ0fJj/marker-busy.png',
        shadowUrl: iconShadowUrl,
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });

    // ✅ NOVO: Ícones para estados específicos de rota
    collectingIcon = L.icon({
        iconUrl: 'https://i.postimg.cc/9fZLJy3L/marker-collecting.png', // azul
        shadowUrl: iconShadowUrl,
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });

    deliveringIcon = L.icon({
        iconUrl: 'https://i.postimg.cc/L5xQJy8K/marker-delivering.png', // roxo
        shadowUrl: iconShadowUrl,
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });

    returningIcon = L.icon({
        iconUrl: 'https://i.postimg.cc/3RZLJy9M/marker-returning.png', // ciano
        shadowUrl: iconShadowUrl,
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });

    pauseIcon = L.icon({
        iconUrl: 'https://i.postimg.cc/7ZLJy4N1/marker-pause.png', // amarelo
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

        // ✅ NOVO: Inicia polling via API REST
        fetchDriversLocations();
        liveMapPollingInterval = setInterval(fetchDriversLocations, LIVE_MAP_REFRESH_MS);

        // Pede ao socket (em admin.js) que solicite as localizações atuais (mantém compatibilidade)
        if (socket && typeof socket.emit === 'function') {
            socket.emit('admin_request_all_locations'); 
            console.log('A pedir ao servidor as localizações ativas via Socket.IO...');
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
    // ✅ NOVO: Para o polling
    if (liveMapPollingInterval) {
        clearInterval(liveMapPollingInterval);
        liveMapPollingInterval = null;
    }

    if (liveMap) {
        liveMap.remove();
        liveMap = null;
        driverMarkers = {}; // Limpa o registo de marcadores
        console.log('Mapa em tempo real destruído.');
    }
}

/* --- ✅ NOVO: Funções de Integração com API REST --- */

/**
 * Busca localizações de todos os motoristas via API REST.
 * Atualiza os marcadores no mapa.
 */
async function fetchDriversLocations() {
    if (!liveMap) return; // Não faz nada se o mapa não estiver visível

    try {
        const response = await apiRequest('/admin/drivers/locations', 'GET');
        
        if (response && response.drivers) {
            updateDriverMarkersFromAPI(response.drivers);
        }
    } catch (error) {
        console.error('Erro ao buscar localizações dos motoristas:', error);
    }
}

/**
 * Atualiza marcadores no mapa com base nos dados da API.
 * @param {Array} drivers - Array de motoristas com currentLocation.
 */
function updateDriverMarkersFromAPI(drivers) {
    const seenIds = new Set();

    drivers.forEach(driver => {
        if (!driver.currentLocation || driver.currentLocation.lat == null || driver.currentLocation.lng == null) {
            return; // Sem localização válida
        }

        const driverId = driver._id;
        seenIds.add(driverId);

        const { lat, lng, speed, lastUpdated } = driver.currentLocation;
        const driverName = driver.user?.nome || 'Motorista';
        const telefone = driver.user?.telefone || '';
        const status = driver.status || 'desconhecido';
        const vehicle = driver.vehicle_plate || 'N/A';

        const newLatLng = [lat, lng];
        
        // ✅ NOVO: Popup mais rico com info de viagem
        let popupContent = `
            <div style="min-width: 200px;">
                <strong>${driverName}</strong><br/>
                <small>Telefone: ${telefone}</small><br/>
                <small>Viatura: ${vehicle}</small><br/>
                <hr style="margin: 5px 0;"/>
                <strong>Estado:</strong> ${translateStatus(status)}<br/>
                <strong>Velocidade:</strong> ${speed || 0} km/h<br/>
                <small>Atualizado: ${lastUpdated ? new Date(lastUpdated).toLocaleString('pt-PT') : '-'}</small>
        `;

        // Se tiver viagem ativa, adiciona botão para ver detalhes
        if (driver.currentTrip && driver.currentTrip._id) {
            const tripType = driver.currentTrip.type || 'desconhecido';
            const orderInfo = driver.currentTrip.order?.client_name || '';
            
            popupContent += `
                <hr style="margin: 5px 0;"/>
                <strong>Viagem ativa:</strong> ${translateTripType(tripType)}<br/>
                ${orderInfo ? `<small>Cliente: ${orderInfo}</small><br/>` : ''}
                <button 
                    class="btn btn-sm btn-primary" 
                    style="margin-top: 5px; width: 100%;"
                    onclick="openTripDetails('${driver.currentTrip._id}')">
                    Ver Rota
                </button>
            `;
        }

        popupContent += `</div>`;

        const iconToUse = getIconForStatus(status);

        if (driverMarkers[driverId]) {
            // Atualiza marcador existente
            driverMarkers[driverId].setLatLng(newLatLng);
            driverMarkers[driverId].setPopupContent(popupContent);
            driverMarkers[driverId].setIcon(iconToUse);
        } else {
            // Cria novo marcador
            driverMarkers[driverId] = L.marker(newLatLng, { icon: iconToUse }).addTo(liveMap);
            driverMarkers[driverId].bindPopup(popupContent);
            console.log(`Adicionado marcador para ${driverName}`);
        }
    });

    // Remove marcadores de motoristas que não vieram na resposta (offline)
    Object.keys(driverMarkers).forEach(driverId => {
        if (!seenIds.has(driverId)) {
            liveMap.removeLayer(driverMarkers[driverId]);
            delete driverMarkers[driverId];
            console.log(`Removido marcador para motorista ${driverId} (offline)`);
        }
    });
}

/**
 * ✅ NOVO: Retorna o ícone apropriado com base no status do motorista.
 */
function getIconForStatus(status) {
    switch (status) {
        case 'online_livre':
            return freeIcon;
        case 'online_ocupado':
            return busyIcon;
        case 'a_caminho_coleta':
        case 'coletando':
            return collectingIcon;
        case 'a_caminho_entrega':
        case 'entregando':
            return deliveringIcon;
        case 'retorno_central':
            return returningIcon;
        case 'pausa':
            return pauseIcon;
        default:
            return freeIcon;
    }
}

/**
 * ✅ NOVO: Traduz status do motorista para português.
 */
function translateStatus(status) {
    const translations = {
        'online_livre': 'Disponível',
        'online_ocupado': 'Ocupado',
        'a_caminho_coleta': 'A caminho da coleta',
        'coletando': 'No local da coleta',
        'a_caminho_entrega': 'A caminho da entrega',
        'entregando': 'No local da entrega',
        'retorno_central': 'Retornando à base',
        'pausa': 'Em pausa',
        'offline': 'Offline'
    };
    return translations[status] || status;
}

/**
 * ✅ NOVO: Traduz tipo de viagem para português.
 */
function translateTripType(type) {
    const translations = {
        'coleta': 'Coleta',
        'entrega': 'Entrega',
        'retorno_central': 'Retorno à base',
        'pausa': 'Pausa',
        'outro': 'Outro'
    };
    return translations[type] || type;
}

/**
 * ✅ NOVO: Abre modal com detalhes completos de uma viagem (replay de rota).
 * @param {string} tripId - ID da viagem.
 */
async function openTripDetails(tripId) {
    try {
        const response = await apiRequest(`/admin/trips/${tripId}`, 'GET');
        
        if (response && response.trip) {
            showTripModal(response.trip);
        } else {
            alert('Erro ao carregar detalhes da viagem.');
        }
    } catch (error) {
        console.error('Erro ao buscar detalhes da viagem:', error);
        alert('Erro ao carregar detalhes da viagem.');
    }
}

/**
 * ✅ NOVO: Exibe modal com detalhes da viagem e mapa de replay.
 * @param {object} trip - Dados completos da viagem.
 */
function showTripModal(trip) {
    const modalBody = document.getElementById('trip-details-body');
    if (!modalBody) {
        console.error('Elemento #trip-details-body não encontrado no DOM.');
        return;
    }

    const distanceKm = ((trip.metrics?.distance || 0) / 1000).toFixed(2);
    const durationMin = ((trip.metrics?.duration || 0) / 60).toFixed(1);
    const avgSpeed = (trip.metrics?.avgSpeed || 0).toFixed(1);
    const maxSpeed = (trip.metrics?.maxSpeed || 0).toFixed(1);

    const driverName = trip.driver?.user?.nome || 'Desconhecido';
    const orderInfo = trip.order ? `
        <p><strong>Cliente:</strong> ${trip.order.client_name || '-'}</p>
        <p><strong>Serviço:</strong> ${trip.order.service_type || '-'}</p>
        <p><strong>Preço:</strong> ${trip.order.price || 0} MT</p>
    ` : '<p><em>Sem pedido associado</em></p>';

    modalBody.innerHTML = `
        <div style="max-height: 500px; overflow-y: auto;">
            <h5>Informações da Viagem</h5>
            <p><strong>Motorista:</strong> ${driverName}</p>
            <p><strong>Tipo:</strong> ${translateTripType(trip.type)}</p>
            <p><strong>Status:</strong> ${trip.status}</p>
            <p><strong>Início:</strong> ${trip.startedAt ? new Date(trip.startedAt).toLocaleString('pt-PT') : '-'}</p>
            <p><strong>Fim:</strong> ${trip.finishedAt ? new Date(trip.finishedAt).toLocaleString('pt-PT') : 'Em andamento'}</p>
            
            <hr/>
            <h5>Métricas</h5>
            <p><strong>Distância:</strong> ${distanceKm} km</p>
            <p><strong>Duração:</strong> ${durationMin} min</p>
            <p><strong>Velocidade Média:</strong> ${avgSpeed} km/h</p>
            <p><strong>Velocidade Máxima:</strong> ${maxSpeed} km/h</p>
            
            <hr/>
            <h5>Pedido Relacionado</h5>
            ${orderInfo}
            
            ${trip.notes ? `<p><strong>Notas:</strong> ${trip.notes}</p>` : ''}
            
            <hr/>
            <h5>Rota Percorrida</h5>
            <div id="trip-replay-map" style="height: 350px; margin-top: 10px; border-radius: 8px;"></div>
        </div>
    `;

    // Inicializar mapa de replay após um pequeno delay (para garantir que o modal está visível)
    setTimeout(() => {
        initializeTripReplayMap(trip);
    }, 300);

    // Abrir modal (assumindo Bootstrap 5)
    const modalElement = document.getElementById('tripDetailsModal');
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    } else {
        console.error('Elemento #tripDetailsModal não encontrado no DOM.');
    }
}

/**
 * ✅ NOVO: Inicializa mapa de replay da rota dentro do modal.
 * @param {object} trip - Dados da viagem com array de positions.
 */
function initializeTripReplayMap(trip) {
    const mapElement = document.getElementById('trip-replay-map');
    if (!mapElement) return;

    // Remove mapa anterior se existir
    if (mapElement._leaflet_id) {
        mapElement._leaflet_id = null;
        mapElement.innerHTML = '';
    }

    const tripMap = L.map('trip-replay-map');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(tripMap);

    if (trip.positions && trip.positions.length > 0) {
        const latlngs = trip.positions.map(p => [p.lat, p.lng]);
        
        // Desenha polyline da rota
        const polyline = L.polyline(latlngs, { 
            color: '#007bff', 
            weight: 4,
            opacity: 0.7
        }).addTo(tripMap);

        // Marcador de início (verde)
        const startPos = trip.positions[0];
        L.marker([startPos.lat, startPos.lng], {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34]
            })
        }).addTo(tripMap).bindPopup('Início');

        // Marcador de fim (vermelho)
        const endPos = trip.positions[trip.positions.length - 1];
        L.marker([endPos.lat, endPos.lng], {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34]
            })
        }).addTo(tripMap).bindPopup('Fim');

        // Ajusta zoom para mostrar toda a rota
        tripMap.fitBounds(polyline.getBounds(), { padding: [20, 20] });
    } else {
        mapElement.innerHTML = '<p style="text-align: center; padding: 2rem;">Sem dados de rota disponíveis.</p>';
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
    const popupContent = `<strong>${driverName}</strong><br>Status: ${translateStatus(status)}`;
    const iconToUse = getIconForStatus(status);

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
