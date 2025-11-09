/*
 * Ficheiro: js/driver/driver.js
 *
 * (Dependência #5 do Motorista) - O CÉREBRO PRINCIPAL
 *
 * Este é o ficheiro principal que orquestra todo o painel do motorista.
 */

/* --- PONTO DE ENTRADA (Entry Point) --- */
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Verificar se o motorista está logado
    checkAuth('driver'); // De auth.js
    
    // 2. Conectar ao Socket.IO
    connectDriverSocket(); // De driverTracking.js
    
    // 3. Carregar as entregas pendentes
    loadMyDeliveries();
    
    // 4. Iniciar o rastreamento GPS
    startLocationTracking(); // De driverTracking.js
    
    // 5. (MUDANÇA) Anexar todos os listeners da página
    attachDriverEventListeners();
});

/**
 * (NOVA FUNÇÃO) Anexa todos os event listeners do painel do motorista.
 */
function attachDriverEventListeners() {
    // Botão de Logout
    document.getElementById('driver-logout').addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout('driver'); // De auth.js
    });
    
    // Botão "Voltar à Lista"
    document.getElementById('btn-voltar-lista').addEventListener('click', showListaEntregas);
    
    // Botões do Modal de Alerta
    document.getElementById('btn-close-alert').addEventListener('click', closeCustomAlert);
    document.getElementById('btn-ok-alert').addEventListener('click', closeCustomAlert);
}


/* --- Lógica de API (Carregamento de Dados - GET) --- */

/**
 * Carrega e exibe a lista de entregas pendentes do motorista.
 */
async function loadMyDeliveries() {
    const listaEntregas = document.getElementById('lista-entregas');
    if (!listaEntregas) return;
    
    listaEntregas.innerHTML = '<h2>Minhas Entregas Pendentes</h2><p>A carregar...</p>';

    try {
        const response = await fetch(`${API_URL}/api/orders/my-deliveries`, {
            method: 'GET',
            headers: getAuthHeaders() // De auth.js
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
                <p><strong>Serviço:</strong> ${SERVICE_NAMES[order.service_type] || order.service_type}</p> <span class="ver-detalhes-btn">${order.status === 'atribuido' ? 'Ver Detalhes' : 'Continuar Entrega'}</span>
            `;
            
            card.addEventListener('click', () => { 
                showDetalheEntrega(order); 
            });
            
            listaEntregas.appendChild(card);
        });
        
    } catch (error) { 
        console.error('Falha ao carregar entregas:', error); 
        listaEntregas.innerHTML = '<h2>Minhas Entregas Pendentes</h2><p style="color: var(--danger-color);">Erro ao carregar entregas.</p>';
    }
}


/* --- Lógica de UI (Mostrar/Esconder Secções) --- */

/**
 * Mostra a secção de detalhes da entrega e preenche-a com dados.
 * @param {object} order - O objeto da encomenda (vindo da cache do card).
 */
function showDetalheEntrega(order) {
    document.getElementById('lista-entregas').classList.add('hidden');
    
    const detalheSection = document.getElementById('detalhe-entrega');
    detalheSection.querySelector('#detalhe-entrega-title').innerText = `Detalhes do Pedido #${order._id.slice(-6)}`;
    
    const img = detalheSection.querySelector('#encomenda-imagem');
    const noImg = detalheSection.querySelector('#no-image-placeholder');
    if (order.image_url) {
        img.src = `${API_URL}${order.image_url}`; // De api.js
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
        
        mapButton.href = `https://www.google.com/maps/search/?api=1&query=${order.address_coords.lat},${order.address_coords.lng}`;
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
        
    } else { // Status é 'atribuido'
        btnIniciar.classList.remove('hidden');
        formFinalizacao.classList.add('hidden');
        
        btnIniciar.onclick = () => handleStartDelivery(order._id);
    }
    
    detalheSection.classList.remove('hidden');
}

/**
 * Mostra a secção da lista de entregas e esconde os detalhes.
 */
function showListaEntregas() {
    document.getElementById('lista-entregas').classList.remove('hidden');
    document.getElementById('detalhe-entrega').classList.add('hidden');
    loadMyDeliveries(); // Recarrega a lista
}


/* --- Lógica de API (Envio de Dados - POST) --- */

/**
 * Envia o pedido para "Iniciar Entrega" (POST /:id/start).
 * @param {string} orderId - O ID da encomenda a iniciar.
 */
async function handleStartDelivery(orderId) {
    try {
        const response = await fetch(`${API_URL}/api/orders/${orderId}/start`, {
            method: 'POST',
            headers: getAuthHeaders() // De auth.js
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        showCustomAlert('Sucesso', 'Entrega Iniciada!', 'success'); // De ui.js
        
        document.getElementById('btn-iniciar-entrega').classList.add('hidden');
        const formFinalizacao = document.getElementById('form-finalizacao');
        formFinalizacao.classList.remove('hidden');
        
        formFinalizacao.onsubmit = (event) => handleCompleteDelivery(event, orderId);

    } catch (error) {
        console.error('Falha ao iniciar entrega:', error);
        showCustomAlert('Erro', error.message, 'error'); // De ui.js
    }
}

/**
 * Envia o pedido para "Finalizar Entrega" com o código (POST /:id/complete).
 * @param {Event} event - O evento de 'submit' do formulário.
 * @param {string} orderId - O ID da encomenda a finalizar.
 */
async function handleCompleteDelivery(event, orderId) {
    event.preventDefault();
    const form = event.target;
    const verification_code = form.querySelector('#codigo-finalizacao').value.toUpperCase();
    
    if (verification_code.length < 5) {
        showCustomAlert('Erro', 'O código deve ter 5 caracteres.', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/orders/${orderId}/complete`, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ verification_code })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        showCustomAlert('Sucesso', 'Entrega Finalizada com sucesso!', 'success');
        showListaEntregas(); // Volta para a lista de entregas
        
    } catch (error) {
        console.error('Falha ao finalizar entrega:', error);
        showCustomAlert('Erro', error.message, 'error');
    }
}