/*
 * Ficheiro: js/driver/driver.js
 * ✅ NOVO: Integração com sistema de rastreamento de rotas (Trip)
 */

/* --- ✅ NOVO: Variáveis de Estado para Rastreamento --- */
let currentTripId = null; // ID da viagem ativa
let positionTrackingInterval = null; // Intervalo de envio de posição
const POSITION_INTERVAL_MS = 20000; // 20 segundos
let watchPositionId = null; // ID do watchPosition do navegador

/* --- PONTO DE ENTRADA (Entry Point) --- */
document.addEventListener('DOMContentLoaded', () => {
    checkAuth('driver');
    connectDriverSocket();
    startLocationTracking();
    attachDriverEventListeners();
    
    // ✅ NOVO: Carrega viagem atual (se houver)
    loadCurrentTrip();
    
    // Carrega a página inicial
    showDriverPage('lista-entregas');
});

/**
 * Anexa todos os event listeners do painel do motorista.
 */
function attachDriverEventListeners() {
    
    // --- Lógica do Menu Mobile ---
    const menuToggle = document.getElementById('mobile-driver-menu-toggle');
    const mobileMenu = document.getElementById('driver-mobile-nav');
    const mainContent = document.querySelector('.motorista-main');

    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation(); 
            mobileMenu.classList.toggle('open');
        });
        mainContent.addEventListener('click', () => {
            if (mobileMenu.classList.contains('open')) {
                mobileMenu.classList.remove('open');
            }
        });
    }
    
    // Links do menu mobile
    document.getElementById('mobile-nav-ganhos').addEventListener('click', (e) => {
        e.preventDefault();
        showDriverPage('meus-ganhos');
        mobileMenu.classList.remove('open');
    });
    document.getElementById('mobile-nav-config').addEventListener('click', (e) => {
        e.preventDefault();
        showDriverPage('configuracoes-motorista');
        mobileMenu.classList.remove('open');
    });
    document.getElementById('mobile-nav-logout').addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout('driver');
    });

    // Botão de Logout (Desktop)
    document.getElementById('driver-logout').addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout('driver');
    });
    
    // Botão de Configurações (Desktop)
    document.getElementById('driver-settings').addEventListener('click', () => {
        showDriverPage('configuracoes-motorista');
    });
    
    // Botão de Ganhos (Desktop)
    document.getElementById('driver-earnings').addEventListener('click', () => {
        showDriverPage('meus-ganhos');
    });
    
    // Botões "Voltar"
    document.getElementById('btn-voltar-lista').addEventListener('click', () => {
        showDriverPage('lista-entregas');
    });
    document.getElementById('btn-voltar-lista-config').addEventListener('click', () => {
        showDriverPage('lista-entregas');
    });
    document.getElementById('btn-voltar-lista-ganhos').addEventListener('click', () => {
        showDriverPage('lista-entregas');
    });

    // Botões do Modal de Alerta
    document.getElementById('btn-close-alert').addEventListener('click', closeCustomAlert);
    document.getElementById('btn-ok-alert').addEventListener('click', closeCustomAlert);
    
    // Listener de Notificação
    document.addEventListener('nova_entrega', () => {
        console.log('Evento "nova_entrega" recebido. A recarregar a lista...');
        const listaSection = document.getElementById('lista-entregas');
        if (!listaSection.classList.contains('hidden')) {
            loadMyDeliveries();
        }
    });

    // Listener do formulário de senha
    document.getElementById('form-change-password-driver').addEventListener('submit', handleChangePasswordDriver);
}


/* --- Lógica de Navegação do Motorista --- */

function showDriverPage(pageId) {
    // Esconde todas as secções
    document.getElementById('lista-entregas').classList.add('hidden');
    document.getElementById('detalhe-entrega').classList.add('hidden');
    document.getElementById('configuracoes-motorista').classList.add('hidden');
    document.getElementById('meus-ganhos').classList.add('hidden'); 

    // Mostra a secção pedida
    const pageToShow = document.getElementById(pageId);
    if (pageToShow) {
        pageToShow.classList.remove('hidden');
    }

    // Carrega os dados necessários para a página
    if (pageId === 'lista-entregas') {
        loadMyDeliveries();
    }
    if (pageId === 'configuracoes-motorista') {
        document.getElementById('form-change-password-driver').reset();
    }
    if (pageId === 'meus-ganhos') {
        loadMyEarnings(); 
    }
}


/* --- Lógica de API (GET) --- */

async function loadMyDeliveries() {
    const listaEntregas = document.getElementById('lista-entregas');
    if (!listaEntregas) return;
    listaEntregas.innerHTML = '<h2>Minhas Entregas Pendentes</h2><p>A carregar...</p>';
    try {
        const response = await fetch(`${API_URL}/api/orders/my-deliveries`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        listaEntregas.innerHTML = '<h2>Minhas Entregas Pendentes</h2>';
        if (data.orders.length === 0) {
            listaEntregas.innerHTML += '<p>Nenhuma entrega pendente.</p>';
            return;
        }
        data.orders.forEach(order => {
            const card = document.createElement('div');
            card.className = 'entrega-card';
            card.dataset.order = JSON.stringify(order); 
            card.innerHTML = `
                <div class="entrega-card-header">
                    <strong>Pedido #${order._id.slice(-6)}</strong>
                    <span><i class="fas fa-map-marker-alt"></i> ${order.address_text ? order.address_text.split(',')[0] || 'Destino' : 'Destino'}</span>
                </div>
                <p><strong>Cliente:</strong> ${order.client_name}</p>
                <p><strong>Serviço:</strong> ${SERVICE_NAMES[order.service_type] || order.service_type}</p>
                <span class="ver-detalhes-btn">${order.status === 'atribuido' ? 'Ver Detalhes' : 'Continuar Entrega'}</span>
            `;
            card.addEventListener('click', () => { 
                showDriverPage('detalhe-entrega');
                fillDetalheEntrega(order); 
            });
            listaEntregas.appendChild(card);
        });
    } catch (error) { 
        console.error('Falha ao carregar entregas:', error); 
        listaEntregas.innerHTML = '<h2>Minhas Entregas Pendentes</h2><p style="color: var(--danger-color);">Erro ao carregar entregas.</p>';
    }
}

async function loadMyEarnings() {
    const formatMZN = (value) => new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(value);

    const totalGanhosEl = document.getElementById('driver-total-ganhos');
    const totalOrdersEl = document.getElementById('driver-total-entregas');
    const commissionEl = document.getElementById('driver-commission-rate');
    const tableBody = document.getElementById('driver-earnings-table-body');
    
    totalGanhosEl.innerText = '...';
    totalOrdersEl.innerText = '...';
    commissionEl.innerText = '... %';
    tableBody.innerHTML = '<tr><td colspan="4">A carregar...</td></tr>';

    try {
        const response = await fetch(`${API_URL}/api/drivers/my-earnings`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (response.status === 401) {
            return handleLogout('driver');
        }
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        totalGanhosEl.innerText = formatMZN(data.totalGanhos);
        totalOrdersEl.innerText = data.totalOrders;
        commissionEl.innerText = `${data.commissionRate} %`;
        
        tableBody.innerHTML = ''; 
        if (data.ordersList.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4">Nenhuma entrega concluída este mês.</td></tr>';
            return;
        }
        
        data.ordersList.forEach(order => {
            tableBody.innerHTML += `
                <tr>
                    <td>${new Date(order.timestamp_completed).toLocaleDateString('pt-MZ')}</td>
                    <td>#${order._id.slice(-6)}</td>
                    <td>${formatMZN(order.price)}</td>
                    <td style="color: var(--success-color); font-weight: 600;">${formatMZN(order.valor_motorista)}</td>
                </tr>
            `;
        });
        
    } catch (error) { 
        console.error('Falha ao carregar ganhos:', error);
        tableBody.innerHTML = `<tr><td colspan="4" style="color: var(--danger-color);">Erro ao carregar extrato. Tente novamente.</td></tr>`;
    }
}

/* --- Lógica de UI (Mostrar/Esconder Secções) --- */

function fillDetalheEntrega(order) {
    const detalheSection = document.getElementById('detalhe-entrega');
    detalheSection.querySelector('#detalhe-entrega-title').innerText = `Detalhes do Pedido #${order._id.slice(-6)}`;
    const img = detalheSection.querySelector('#encomenda-imagem');
    const noImg = detalheSection.querySelector('#no-image-placeholder');
    if (order.image_url) {
        img.src = `${API_URL}${order.image_url}`;
        img.classList.remove('hidden');
        noImg.classList.add('hidden');
    } else {
        img.classList.add('hidden');
        noImg.classList.remove('hidden');
    }
    document.getElementById('detalhe-cliente-nome').innerHTML = `<strong>Nome:</strong> ${order.client_name}`;
    document.getElementById('detalhe-cliente-telefone').innerHTML = `<strong>Telefone:</strong> ${order.client_phone1}`;
    document.getElementById('detalhe-cliente-endereco').innerHTML = `<strong>Endereço:</strong> ${order.address_text || 'N/D'}`;
    const coordsP = document.getElementById('detalhe-cliente-coords');
    const mapButton = document.getElementById('btn-google-maps');
    if (order.address_coords && order.address_coords.lat) {
        coordsP.querySelector('span').innerText = `${order.address_coords.lat.toFixed(5)}, ${order.address_coords.lng.toFixed(5)}`;
        coordsP.classList.remove('hidden');
        mapButton.href = `https://www.google.com/maps?q=${order.address_coords.lat},${order.address_coords.lng}`;
        mapButton.classList.remove('hidden');
    } else {
        coordsP.classList.add('hidden');
        mapButton.classList.add('hidden');
    }
    const btnIniciar = detalheSection.querySelector('#btn-iniciar-entrega');
    const formFinalizacao = detalheSection.querySelector('#form-finalizacao');
    btnIniciar.onclick = null;
    formFinalizacao.onsubmit = null;
    if (order.status === 'em_progresso') {
        btnIniciar.classList.add('hidden');
        formFinalizacao.classList.remove('hidden');
        formFinalizacao.reset(); 
        formFinalizacao.onsubmit = (event) => handleCompleteDelivery(event, order._id);
    } else {
        btnIniciar.classList.remove('hidden');
        formFinalizacao.classList.add('hidden');
        btnIniciar.onclick = () => handleStartDelivery(order._id, order);
    }
}
function showListaEntregas() {
    showDriverPage('lista-entregas');
}


/* --- Lógica de API (POST/PUT) --- */

async function handleChangePasswordDriver(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');

    const senhaAntiga = document.getElementById('driver-pass-antiga').value;
    const senhaNova = document.getElementById('driver-pass-nova').value;
    const senhaConfirmar = document.getElementById('driver-pass-confirmar').value;
    if (senhaNova !== senhaConfirmar) {
        showCustomAlert('Erro', 'As novas senhas não coincidem.', 'error');
        return;
    }

    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A atualizar...';

    try {
        const response = await fetch(`${API_URL}/api/auth/change-password`, {
            method: 'PUT',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ senhaAntiga, senhaNova })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message);
        }
        showCustomAlert('Sucesso!', 'A sua senha foi alterada. Por favor, faça login novamente.', 'success');
        setTimeout(() => {
            handleLogout('driver');
        }, 2500);
    } catch (error) {
        console.error('Falha ao mudar a senha:', error);
        showCustomAlert('Erro', error.message, 'error');
        submitButton.disabled = false;
        submitButton.innerHTML = 'Atualizar Senha';
    }
}

async function handleStartDelivery(orderId, order) {
    const button = document.getElementById('btn-iniciar-entrega');
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A iniciar...';

    try {
        // 1. Inicia a entrega no backend (marca order como em_progresso)
        const response = await fetch(`${API_URL}/api/orders/${orderId}/start`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);

        // ✅ NOVO: 2. Inicia uma Trip de tipo 'entrega'
        await startTrip('entrega', orderId, order);

        showCustomAlert('Sucesso', 'Entrega Iniciada!', 'success');
        
        button.classList.add('hidden');
        const formFinalizacao = document.getElementById('form-finalizacao');
        formFinalizacao.classList.remove('hidden');
        formFinalizacao.onsubmit = (event) => handleCompleteDelivery(event, orderId);

    } catch (error) {
        console.error('Falha ao iniciar entrega:', error);
        showCustomAlert('Erro', error.message, 'error');
    } finally {
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-play-circle"></i> Iniciar Entrega';
    }
}

async function handleCompleteDelivery(event, orderId) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');

    const verification_code = form.querySelector('#codigo-finalizacao').value.toUpperCase();
    if (verification_code.length < 5) {
        showCustomAlert('Erro', 'O código deve ter 5 caracteres.', 'error');
        return;
    }

    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A finalizar...';

    try {
        // 1. Finaliza a entrega no backend
        const response = await fetch(`${API_URL}/api/orders/${orderId}/complete`, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ verification_code })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);

        // ✅ NOVO: 2. Finaliza a Trip
        await endTrip('Entrega concluída com sucesso');

        showCustomAlert('Sucesso', 'Entrega Finalizada com sucesso!', 'success');
        showListaEntregas();
    } catch (error) {
        console.error('Falha ao finalizar entrega:', error);
        showCustomAlert('Erro', error.message, 'error');
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-check-circle"></i> Finalizar Entrega';
    }
}

/* --- ✅ NOVO: Funções de Rastreamento de Rotas (Trip) --- */

/**
 * Carrega a viagem atual do motorista (se houver).
 * Chamado ao carregar a página.
 */
async function loadCurrentTrip() {
    try {
        const response = await fetch(`${API_URL}/api/drivers/trips/current`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            console.warn('Erro ao carregar viagem atual');
            return;
        }

        const data = await response.json();
        
        if (data.trip && data.trip._id) {
            currentTripId = data.trip._id;
            console.log('Viagem ativa encontrada:', currentTripId);
            
            // Inicia envio de posição
            startPositionTracking();
        } else {
            console.log('Nenhuma viagem ativa');
            currentTripId = null;
        }
    } catch (error) {
        console.error('Erro ao carregar viagem atual:', error);
    }
}

/**
 * Inicia uma nova viagem (Trip).
 * @param {string} type - Tipo de viagem ('coleta', 'entrega', 'retorno_central', 'pausa', 'outro')
 * @param {string} orderId - ID do pedido (opcional)
 * @param {object} order - Dados do pedido (opcional, para pegar coordenadas)
 */
async function startTrip(type, orderId = null, order = null) {
    try {
        const body = { type };
        
        if (orderId) {
            body.orderId = orderId;
        }

        // Se tiver coordenadas do pedido, adiciona como destino
        if (order && order.address_coords) {
            body.destination = {
                lat: order.address_coords.lat,
                lng: order.address_coords.lng,
                address: order.address_text || ''
            };
        }

        const response = await fetch(`${API_URL}/api/drivers/trips/start`, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Erro ao iniciar viagem');
        }

        currentTripId = data.trip._id;
        console.log('Viagem iniciada:', currentTripId);

        // Inicia envio periódico de posição
        startPositionTracking();

    } catch (error) {
        console.error('Erro ao iniciar viagem:', error);
        // Não bloqueia a entrega se falhar o Trip
    }
}

/**
 * Finaliza a viagem atual.
 * @param {string} notes - Notas opcionais sobre a viagem
 */
async function endTrip(notes = '') {
    if (!currentTripId) {
        console.warn('Nenhuma viagem ativa para finalizar');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/drivers/trips/end`, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Erro ao finalizar viagem');
        }

        console.log('Viagem finalizada:', currentTripId);
        currentTripId = null;

        // Para o envio de posição
        stopPositionTracking();

    } catch (error) {
        console.error('Erro ao finalizar viagem:', error);
        // Não bloqueia a finalização da entrega se falhar o Trip
    }
}

/**
 * Inicia o rastreamento periódico de posição GPS.
 */
function startPositionTracking() {
    if (positionTrackingInterval) {
        console.log('Rastreamento de posição já está ativo');
        return;
    }

    console.log('Iniciando rastreamento de posição GPS...');

    // Envia posição imediatamente
    sendCurrentPosition();

    // Configura intervalo para enviar posição periodicamente
    positionTrackingInterval = setInterval(() => {
        sendCurrentPosition();
    }, POSITION_INTERVAL_MS);

    // ✅ OPCIONAL: Usa watchPosition para atualizações mais frequentes
    if (navigator.geolocation) {
        watchPositionId = navigator.geolocation.watchPosition(
            (position) => {
                // Atualiza posição em tempo real (mais preciso que setInterval)
                sendPosition(
                    position.coords.latitude,
                    position.coords.longitude,
                    position.coords.speed ? position.coords.speed * 3.6 : 0, // m/s para km/h
                    position.coords.heading || 0,
                    position.coords.accuracy || 0
                );
            },
            (error) => {
                console.warn('Erro ao obter posição GPS:', error.message);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }
}

/**
 * Para o rastreamento de posição GPS.
 */
function stopPositionTracking() {
    if (positionTrackingInterval) {
        clearInterval(positionTrackingInterval);
        positionTrackingInterval = null;
        console.log('Rastreamento de posição parado');
    }

    if (watchPositionId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchPositionId);
        watchPositionId = null;
    }
}

/**
 * Obtém posição atual e envia para o backend.
 */
function sendCurrentPosition() {
    if (!navigator.geolocation) {
        console.warn('Geolocalização não suportada pelo navegador');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const speed = position.coords.speed ? position.coords.speed * 3.6 : 0; // m/s para km/h
            const heading = position.coords.heading || 0;
            const accuracy = position.coords.accuracy || 0;

            sendPosition(lat, lng, speed, heading, accuracy);
        },
        (error) => {
            console.warn('Erro ao obter posição GPS:', error.message);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000
        }
    );
}

/**
 * Envia posição GPS para o backend.
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} speed - Velocidade em km/h
 * @param {number} heading - Direção (0-360°)
 * @param {number} accuracy - Precisão em metros
 */
async function sendPosition(lat, lng, speed, heading, accuracy) {
    try {
        const response = await fetch(`${API_URL}/api/drivers/trips/position`, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lng, speed, heading, accuracy })
        });

        if (!response.ok) {
            console.warn('Erro ao enviar posição');
        } else {
            console.log(`Posição enviada: ${lat.toFixed(5)}, ${lng.toFixed(5)} | ${speed.toFixed(1)} km/h`);
        }
    } catch (error) {
        console.error('Erro ao enviar posição:', error);
    }
}
