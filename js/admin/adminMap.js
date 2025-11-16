/*
 * Ficheiro: js/admin/adminMap.js
 *
 * ✅ CORRIGIDO:
 * - Adicionada verificação de segurança 'if (!liveMap) return;'
 * para prevenir o crash 'addLayer' (race condition).
 */

// --- Variáveis de Estado para os Mapas ---
let map = null; 
let mapMarker = null; 
let liveMap = null; 
let driverMarkers = {};
let freeIcon = null; 
let busyIcon = null; 
let liveMapPollingInterval = null;
const LIVE_MAP_REFRESH_MS = 15000;
let collectingIcon = null;
let deliveringIcon = null;
let returningIcon = null;
let pauseIcon = null;

function initializeMapIcons() {
    const iconShadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
    const iconProps = {
        shadowUrl: iconShadowUrl,
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    };
    
    freeIcon = L.icon({ iconUrl: 'https://i.postimg.cc/MK8ty3PJ/car-pin-point.png', ...iconProps });
    busyIcon = L.icon({ iconUrl: 'https://i.postimg.cc/J0bJ0fJj/marker-busy.png', ...iconProps });
    collectingIcon = L.icon({ iconUrl: 'https://i.postimg.cc/9fZLJy3L/marker-collecting.png', ...iconProps });
    deliveringIcon = L.icon({ iconUrl: 'https://i.postimg.cc/L5xQJy8K/marker-delivering.png', ...iconProps });
    returningIcon = L.icon({ iconUrl: 'https://i.postimg.cc/3RZLJy9M/marker-returning.png', ...iconProps });
    pauseIcon = L.icon({ iconUrl: 'https://i.postimg.cc/7ZLJy4N1/marker-pause.png', ...iconProps });
}

function initializeFormMap() {
    const maputoCoords = [-25.965, 32.589];
    if (map) destroyFormMap();
    
    try {
        map = L.map('map').setView(maputoCoords, 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        mapMarker = L.marker(maputoCoords, { draggable: true }).addTo(map);
        
        mapMarker.on('dragend', (event) => {
            const position = event.target.getLatLng();
            document.getElementById('delivery-lng').value = position.lng;
            document.getElementById('delivery-lat').value = position.lat;
        });
        
        document.getElementById('delivery-lng').value = maputoCoords[1];
        document.getElementById('delivery-lat').value = maputoCoords[0];
        
    } catch (error) {
        console.error("Erro ao inicializar o mapa do formulário:", error);
        document.getElementById('map').innerHTML = '<p style="padding: 1rem; text-align: center; color: var(--danger-color);">Erro ao carregar o mapa.</p>';
    }
}

function destroyFormMap() {
    if (map) {
        map.remove();
        map = null;
        mapMarker = null;
        console.log('Mapa do formulário destruído.');
    }
}

function initializeLiveMap() {
    if (liveMap) return; 
    try {
        const maputoCoords = [-25.965, 32.589];
        liveMap = L.map('live-map-container').setView(maputoCoords, 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(liveMap);
        
        console.log('Mapa em tempo real inicializado.');

        fetchDriversLocations();
        liveMapPollingInterval = setInterval(fetchDriversLocations, LIVE_MAP_REFRESH_MS);

        if (socket && typeof socket.emit === 'function') {
            socket.emit('admin_request_all_locations'); 
            console.log('A pedir ao servidor as localizações ativas via Socket.IO...');
        }
    } catch (error) {
        console.error("Erro ao inicializar o mapa em tempo real:", error);
        document.getElementById('live-map-container').innerHTML = '<p>Erro ao carregar o mapa.</p>';
    }
}

function destroyLiveMap() {
    if (liveMapPollingInterval) {
        clearInterval(liveMapPollingInterval);
        liveMapPollingInterval = null;
    }
    if (liveMap) {
        liveMap.remove();
        liveMap = null;
        driverMarkers = {}; 
        console.log('Mapa em tempo real destruído.');
    }
}

/* --- Funções de Integração com API REST --- */

async function fetchDriversLocations() {
    if (!liveMap) return; 
    try {
        const response = await apiRequest('/api/admin/drivers/locations', 'GET');
        if (response && response.drivers) {
            updateDriverMarkersFromAPI(response.drivers);
        }
    } catch (error) {
        console.error('Erro ao buscar localizações dos motoristas:', error);
    }
}

function updateDriverMarkersFromAPI(drivers) {
    // ✅ INÍCIO DA CORREÇÃO
    // Se o mapa foi destruído (liveMap = null) enquanto os dados
    // carregavam, esta função aborta para evitar o crash.
    if (!liveMap) {
        console.log('Mapa em tempo real foi destruído, a atualização de marcadores foi abortada.');
        return; 
    }
    // ✅ FIM DA CORREÇÃO

    const seenIds = new Set();
    drivers.forEach(driver => {
        if (!driver.currentLocation || driver.currentLocation.lat == null || driver.currentLocation.lng == null) {
            return;
        }
        const driverId = driver._id;
        seenIds.add(driverId);
        const { lat, lng, speed, lastUpdated } = driver.currentLocation;
        const driverName = driver.user?.nome || 'Motorista';
        const telefone = driver.user?.telefone || '';
        const status = driver.status || 'desconhecido';
        const vehicle = driver.vehicle_plate || 'N/A';
        const newLatLng = [lat, lng];
        
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

        if (driver.currentTrip && driver.currentTrip._id) {
            const tripType = driver.currentTrip.type || 'desconhecido';
            const orderInfo = driver.currentTrip.order?.client_name || '';
            popupContent += `
                <hr style="margin: 5px 0;"/>
                <strong>Viagem ativa:</strong> ${translateTripType(tripType)}<br/>
                ${orderInfo ? `<small>Cliente: ${orderInfo}</small><br/>` : ''}
                <button class="btn btn-sm btn-primary" style="margin-top: 5px; width: 100%;"
                    onclick="openTripDetails('${driver.currentTrip._id}')">
                    Ver Rota
                </button>
            `;
        }
        popupContent += `</div>`;

        const iconToUse = getIconForStatus(status);

        if (driverMarkers[driverId]) {
            driverMarkers[driverId].setLatLng(newLatLng);
            driverMarkers[driverId].setPopupContent(popupContent);
            driverMarkers[driverId].setIcon(iconToUse);
        } else {
            // Adiciona verificação extra
            if (liveMap) {
                driverMarkers[driverId] = L.marker(newLatLng, { icon: iconToUse }).addTo(liveMap);
                driverMarkers[driverId].bindPopup(popupContent);
            }
        }
    });

    Object.keys(driverMarkers).forEach(driverId => {
        if (!seenIds.has(driverId)) {
            if (driverMarkers[driverId] && liveMap) {
                liveMap.removeLayer(driverMarkers[driverId]);
                delete driverMarkers[driverId];
            }
        }
    });
}

function getIconForStatus(status) {
    switch (status) {
        case 'online_livre': return freeIcon;
        case 'online_ocupado': return busyIcon;
        case 'a_caminho_coleta': case 'coletando': return collectingIcon;
        case 'a_caminho_entrega': case 'entregando': return deliveringIcon;
        case 'retorno_central': return returningIcon;
        case 'pausa': return pauseIcon;
        default: return freeIcon;
    }
}

function translateStatus(status) {
    const translations = {
        'online_livre': 'Disponível', 'online_ocupado': 'Ocupado',
        'a_caminho_coleta': 'A caminho da coleta', 'coletando': 'No local da coleta',
        'a_caminho_entrega': 'A caminho da entrega', 'entregando': 'No local da entrega',
        'retorno_central': 'Retornando à base', 'pausa': 'Em pausa', 'offline': 'Offline'
    };
    return translations[status] || status;
}

function translateTripType(type) {
    const translations = {
        'coleta': 'Coleta', 'entrega': 'Entrega',
        'retorno_central': 'Retorno à base', 'pausa': 'Pausa', 'outro': 'Outro'
    };
    return translations[type] || type;
}

async function openTripDetails(tripId) {
    try {
        const response = await apiRequest(`/api/admin/trips/${tripId}`, 'GET');
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

function showTripModal(trip) {
    const modalBody = document.getElementById('trip-details-body');
    if (!modalBody) {
        console.error('Elemento #trip-details-body não encontrado no DOM. Verifique o index (1).html');
        if (trip.order && trip.order._id && typeof openHistoryDetailModal === 'function') {
            openHistoryDetailModal(trip.order._id);
        } else {
            alert('Erro: Modal de replay não encontrado (#trip-details-body).');
        }
        return;
    }

    const distanceKm = ((trip.metrics?.distance || 0) / 1000).toFixed(2);
    const durationMin = ((trip.metrics?.duration || 0) / 60).toFixed(1);
    const avgSpeed = (trip.metrics?.avgSpeed || 0).toFixed(1);
    const maxSpeed = (trip.metrics?.maxSpeed || 0).toFixed(1);
    const driverName = trip.driver?.user?.nome || 'Desconhecido';
    const orderInfo = trip.order ? `
        <p><strong>Cliente:</strong> ${trip.order.client_name || '-'}</p>
        <p><strong>Serviço:</strong> ${SERVICE_NAMES[trip.order.service_type] || '-'}</p>
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

    setTimeout(() => { initializeTripReplayMap(trip); }, 300);

    const modalElement = document.getElementById('tripDetailsModal');
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    } else {
        console.error('Elemento #tripDetailsModal não encontrado no DOM.');
    }
}

function initializeTripReplayMap(trip) {
    const mapElement = document.getElementById('trip-replay-map');
    if (!mapElement) return;

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
        const polyline = L.polyline(latlngs, { color: '#007bff', weight: 4, opacity: 0.7 }).addTo(tripMap);
        const startPos = trip.positions[0];
        L.marker([startPos.lat, startPos.lng], {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
            })
        }).addTo(tripMap).bindPopup('Início');
        const endPos = trip.positions[trip.positions.length - 1];
        L.marker([endPos.lat, endPos.lng], {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
            })
        }).addTo(tripMap).bindPopup('Fim');
        tripMap.fitBounds(polyline.getBounds(), { padding: [20, 20] });
    } else {
        mapElement.innerHTML = '<p style="text-align: center; padding: 2rem;">Sem dados de rota disponíveis.</p>';
    }
}

/* --- Funções de Atualização do Mapa em Tempo Real (Socket) --- */

function updateDriverMarker(data) {
    const { driverId, driverName, status, lat, lng } = data;
    if (!liveMap) return; 

    const newLatLng = [lat, lng];
    const popupContent = `<strong>${driverName}</strong><br>Status: ${translateStatus(status)}`;
    const iconToUse = getIconForStatus(status);

    if (driverMarkers[driverId]) {
        driverMarkers[driverId].setLatLng(newLatLng);
        driverMarkers[driverId].setPopupContent(popupContent);
        driverMarkers[driverId].setIcon(iconToUse);
    } else {
        // Adiciona verificação extra
        if (liveMap) {
            driverMarkers[driverId] = L.marker(newLatLng, { icon: iconToUse }).addTo(liveMap);
            driverMarkers[driverId].bindPopup(popupContent).openPopup();
        }
    }
}

function removeDriverMarker(data) {
    const { driverId } = data;
    if (!liveMap) return;
    if (driverMarkers[driverId]) {
        liveMap.removeLayer(driverMarkers[driverId]); 
        delete driverMarkers[driverId]; 
    }
}
