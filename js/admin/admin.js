/*
 * Ficheiro: js/admin/admin.js
 * (O CÉREBRO PRINCIPAL)
 */

// ... (todo o código no topo permanece o mesmo) ...
// ... (attachEventListeners, showPage, showServiceForm, connectSocket) ...

/* --- Lógica de API (Carregamento de Dados - GET) --- */

/**
 * Carrega os 4 cartões de estatísticas e o gráfico de donut.
 */
async function loadOverviewStats() {
    try {
        const response = await fetch(`${API_URL}/api/stats/overview`, { headers: getAuthHeaders() });

        // --- (A CORREÇÃO DEFINITIVA ESTÁ AQUI) ---
        // Se o token for inválido, o backend envia um 401.
        if (response.status === 401) {
            console.error('Token inválido ou expirado. A forçar logout.');
            showCustomAlert('Sessão Expirada', 'A sua sessão é inválida ou expirou. Por favor, faça login novamente.', 'error');
            // Espera 2 segundos para o admin ler e depois faz logout.
            setTimeout(() => handleLogout('admin'), 2500);
            return; // Para a execução
        }
        // --- FIM DA CORREÇÃO ---
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        document.getElementById('stats-pendentes').innerText = data.pendentes;
        document.getElementById('stats-em-transito').innerText = data.emTransito;
        document.getElementById('stats-concluidas-hoje').innerText = data.concluidasHoje;
        document.getElementById('stats-motoristas-online').innerText = data.motoristasOnline;
        
        initDeliveriesStatusChart(data.pendentes, data.emTransito);

    } catch (error) { 
        console.error('Falha ao carregar estatísticas:', error); 
        initDeliveriesStatusChart(0, 0);
    }
}

// ... (O resto do ficheiro 'admin.js' permanece o mesmo) ...
// ... (loadDrivers, loadActiveDeliveries, loadHistory, loadClients, etc.) ...

/*
 * Ficheiro: js/admin/admin.js
 *
 * (Dependência #6) - O CÉREBRO PRINCIPAL
 *
 * Este é o ficheiro principal que orquestra todo o painel de admin.
 * - Conecta-se aos Sockets.
 * - Anexa todos os event listeners.
 * - Gere a navegação entre páginas.
 * - Contém toda a lógica de API (fetch, post, put).
 */

// --- Variáveis de Estado Globais do Admin ---

let socket = null;          // Instância do Socket.IO
let clientCache = [];     // Cache para o auto-fill de clientes no formulário

/* --- PONTO DE ENTRADA (Entry Point) --- */
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Verificar se o admin está logado
    checkAuth('admin'); 
    
    // 2. Inicializar ícones do mapa (só precisa de correr uma vez)
    initializeMapIcons();

    // 3. Conectar ao servidor Socket.IO
    connectSocket(); 

    // 4. Anexar todos os Event Listeners da página
    attachEventListeners();

    // 5. Carregar a página inicial (Visão Geral)
    showPage('visao-geral', 'nav-visao-geral', 'Visão Geral');
});

/**
 * Anexa todos os event listeners da aplicação.
 * (MUDANÇA PRINCIPAL AQUI)
 */
function attachEventListeners() {
    // --- Formulários ---
    document.getElementById('delivery-form').addEventListener('submit', handleNewDelivery);
    document.getElementById('form-add-motorista').addEventListener('submit', handleAddDriver);
    document.getElementById('form-edit-motorista').addEventListener('submit', handleUpdateDriver);
    document.getElementById('form-add-cliente').addEventListener('submit', handleAddClient);
    document.getElementById('form-edit-cliente').addEventListener('submit', handleUpdateClient);

    // --- Navegação Principal (Sidebar) ---
    document.getElementById('nav-visao-geral').addEventListener('click', (e) => { e.preventDefault(); showPage('visao-geral', 'nav-visao-geral', 'Visão Geral'); });
    document.getElementById('nav-entregas').addEventListener('click', (e) => { e.preventDefault(); showPage('entregas-activas', 'nav-entregas', 'Entregas Activas'); });
    document.getElementById('nav-motoristas').addEventListener('click', (e) => { e.preventDefault(); showPage('gestao-motoristas', 'nav-motoristas', 'Gestão de Motoristas'); });
    document.getElementById('nav-clientes').addEventListener('click', (e) => { e.preventDefault(); showPage('gestao-clientes', 'nav-clientes', 'Gestão de Clientes'); });
    document.getElementById('nav-historico').addEventListener('click', (e) => { e.preventDefault(); showPage('historico', 'nav-historico', 'Histórico'); });
    document.getElementById('nav-mapa').addEventListener('click', (e) => { e.preventDefault(); showPage('mapa-tempo-real', 'nav-mapa', 'Mapa em Tempo Real'); });

    // --- (MUDANÇA) Listeners para o Submenu "Nova Entrega" ---
    document.getElementById('nav-form-doc').addEventListener('click', (e) => { e.preventDefault(); showServiceForm('doc'); });
    document.getElementById('nav-form-farma').addEventListener('click', (e) => { e.preventDefault(); showServiceForm('farma'); });
    document.getElementById('nav-form-carga').addEventListener('click', (e) => { e.preventDefault(); showServiceForm('carga'); });
    document.getElementById('nav-form-rapido').addEventListener('click', (e) => { e.preventDefault(); showServiceForm('rapido'); });
    document.getElementById('nav-form-outros').addEventListener('click', (e) => { e.preventDefault(); showServiceForm('outros'); });
    
    // --- (MUDANÇA) Listener para "Configurações" ---
    document.getElementById('nav-config').addEventListener('click', (e) => { e.preventDefault(); showServiceForm('config'); });

    // --- Autenticação ---
    document.getElementById('admin-logout').addEventListener('click', (e) => { e.preventDefault(); handleLogout('admin'); });

    // --- Modais e Botões ---
    document.getElementById('btn-reset-chart').addEventListener('click', openChartResetModal);
    document.getElementById('btn-confirm-chart-reset').addEventListener('click', handleChartReset);
    document.getElementById('btn-close-chart-reset').addEventListener('click', closeChartResetModal); // <-- ADICIONADO
    document.getElementById('btn-cancel-chart-reset').addEventListener('click', closeChartResetModal); // <-- ADICIONADO
    document.getElementById('history-search-input').addEventListener('input', filterHistoryTable);
    document.getElementById('delivery-image').addEventListener('change', handleImageUpload);
    document.getElementById('delivery-client-select').addEventListener('change', handleClientSelect);

    // --- (MUDANÇA) Listeners do Modal de Extrato (Movidos para cá para melhor organização) ---
    document.getElementById('btn-generate-statement').addEventListener('click', handleGenerateStatement);
    document.getElementById('btn-download-pdf').addEventListener('click', handleDownloadPDF);
    document.querySelectorAll('.btn-set-date').forEach(btn => {
        btn.addEventListener('click', () => setStatementDates(btn.dataset.range));
    });

    // --- Lógica do Menu Mobile ---
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const mainContent = document.querySelector('.main-content');
    
    if (menuToggle) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            document.body.classList.toggle('mobile-menu-open');
        });
    }
    
    if (mainContent) {
        mainContent.addEventListener('click', () => {
            if (document.body.classList.contains('mobile-menu-open')) {
                document.body.classList.remove('mobile-menu-open');
            }
        });
    }

    document.querySelectorAll('.sidebar-menu .menu-item a').forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth < 992 && !item.parentElement.classList.contains('has-submenu')) {
                document.body.classList.remove('mobile-menu-open');
            }
        });
    });
}


/* --- Lógica de Navegação (Router) --- */

/**
 * O router principal da aplicação. Mostra uma página e esconde as outras.
 * Também gere a inicialização e destruição de recursos (mapas, gráficos).
 * @param {string} pageId - O ID do elemento da página (ex: 'visao-geral')
 * @param {string} navId - O ID do link de navegação (ex: 'nav-visao-geral')
 * @param {string} title - O título a ser exibido no cabeçalho
 */
function showPage(pageId, navId, title) {
    // --- (MELHORIA) Limpeza de Recursos ---
    // Destrói recursos de páginas anteriores para evitar bugs/memory leaks
    destroyFormMap();      // Destrói o mapa do formulário
    destroyLiveMap();      // Destrói o mapa em tempo real
    destroyCharts();       // Destrói os gráficos
    
    // Esconder todas as páginas
    document.querySelectorAll('.content-page').forEach(page => page.classList.add('hidden'));
    
    // Remover 'active' de todos os links de navegação
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => item.classList.remove('active'));
    
    // Mostrar a página correta
    const pageToShow = document.getElementById(pageId);
    if (pageToShow) pageToShow.classList.remove('hidden');
    
    // Ativar o link de navegação correto
    const navLink = document.getElementById(navId);
    if (navLink) navLink.classList.add('active');
    
    // Atualizar o título principal
    document.getElementById('main-title').innerText = title;

    // --- (MELHORIA) Carregamento de Dados Específico da Página ---
    // Carrega os dados necessários para a página que está a ser aberta
    switch (pageId) {
        case 'visao-geral':
            loadOverviewStats();
            initServicesChart(false);
            break;
        case 'gestao-motoristas':
            loadDrivers();
            break;
        case 'entregas-activas':
            loadActiveDeliveries();
            break;
        case 'historico':
            loadHistory();
            break;
        case 'gestao-clientes':
            loadClients();
            break;
        case 'mapa-tempo-real':
            initializeLiveMap(); // Inicializa o mapa em tempo real
            break;
    }
}

/**
 * Função de navegação especial para o formulário de "Nova Entrega".
 * @param {string} serviceType - 'doc', 'farma', 'carga', 'rapido', 'outros'
 */
function showServiceForm(serviceType) {
    if (serviceType === 'config') {
        // Lógica futura para a página de configurações
        showCustomAlert('Info', 'A página de configurações ainda está em desenvolvimento.', 'info');
        return;
    }

    const titles = {
        'doc': 'Nova Tramitação de Documentos',
        'farma': 'Novo Pedido Farmacêutico',
        'carga': 'Novo Transporte de Carga',
        'rapido': 'Novo Delivery Rápido',
        'outros': 'Outros Serviços'
    };
    
    // Navega para a página do formulário
    showPage('form-nova-entrega', null, titles[serviceType] || 'Nova Entrega');
    
    // Prepara o formulário
    document.getElementById('service-type').value = serviceType;
    removeImage(); // Limpa a pré-visualização de imagem (de ui.js)
    resetDeliveryForm(); // Limpa os campos do cliente
    loadClientsIntoDropdown(); // Carrega clientes para o <select>
    
    // Inicializa o mapa do formulário (de adminMap.js)
    // (Com um pequeno atraso para garantir que a DOM está visível)
    setTimeout(initializeFormMap, 100);
}


/* --- Lógica de Socket.IO --- */

/**
 * Conecta-se ao servidor Socket.IO e define os listeners.
 */
function connectSocket() {
    const token = getAuthToken();
    if (!token) return;
    
    socket = io(API_URL, { auth: { token: token } });
    
    socket.on('connect', () => {
        console.log('Conectado ao servidor Socket.io com ID:', socket.id);
        socket.emit('admin_join_room'); // Junta-se à sala de admin
    });

    // --- Listeners do Socket ---

    const activePage = () => {
        const page = document.querySelector('.content-page:not(.hidden)');
        return page ? page.id : null;
    };
    
    // (MELHORIA) Atualiza a UI em tempo real com base no socket
    socket.on('delivery_started', (order) => {
        if (activePage() === 'entregas-activas') loadActiveDeliveries();
        if (activePage() === 'visao-geral') loadOverviewStats();
    });
    
    socket.on('delivery_completed', (order) => {
        if (activePage() === 'entregas-activas') loadActiveDeliveries();
        if (activePage() === 'historico') loadHistory();
        if (activePage() === 'visao-geral') loadOverviewStats();
    });
    
    socket.on('driver_status_changed', (data) => {
         if (activePage() === 'gestao-motoristas') loadDrivers();
         if (activePage() === 'visao-geral') loadOverviewStats();
    });

    // (MELHORIA) Liga os sockets ao módulo de mapa
    socket.on('driver_location_broadcast', (data) => {
        updateDriverMarker(data); // Chama a função em adminMap.js
    });
    
    socket.on('driver_disconnected_broadcast', (data) => {
        removeDriverMarker(data); // Chama a função em adminMap.js
    });
}


/* --- Lógica de API (Carregamento de Dados - GET) --- */

/**
 * Carrega os 4 cartões de estatísticas e o gráfico de donut.
 */
async function loadOverviewStats() {
    try {
        const response = await fetch(`${API_URL}/api/stats/overview`, { headers: getAuthHeaders() });
        
        // --- (A CORREÇÃO DEFINITIVA ESTÁ AQUI) ---
        // Se o token for inválido, o backend envia um 401.
        if (response.status === 401) {
            console.error('Token inválido ou expirado. A forçar logout.');
            showCustomAlert('Sessão Expirada', 'A sua sessão é inválida ou expirou. Por favor, faça login novamente.', 'error');
            // Espera 2.5 segundos para o admin ler e depois faz logout.
            setTimeout(() => handleLogout('admin'), 2500);
            return; // Para a execução
        }
        // --- FIM DA CORREÇÃO ---
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        document.getElementById('stats-pendentes').innerText = data.pendentes;
        document.getElementById('stats-em-transito').innerText = data.emTransito;
        document.getElementById('stats-concluidas-hoje').innerText = data.concluidasHoje;
        document.getElementById('stats-motoristas-online').innerText = data.motoristasOnline;
        
        // (MELHORIA) Passa os dados para o módulo de gráficos
        initDeliveriesStatusChart(data.pendentes, data.emTransito);

    } catch (error) { 
        console.error('Falha ao carregar estatísticas:', error); 
        initDeliveriesStatusChart(0, 0); // Desenha o gráfico com zeros em caso de erro
    }
}

/**
 * Carrega a tabela de motoristas.
 */
async function loadDrivers() {
    const tableBody = document.getElementById('drivers-table-body');
    tableBody.innerHTML = '<tr><td colspan="5">A carregar...</td></tr>'; // (MELHORIA) Feedback de carregamento

    try {
        const response = await fetch(`${API_URL}/api/drivers`, { method: 'GET', headers: getAuthHeaders() });
        // (MELHORIA) Adiciona verificação de 401 também aqui
        if (response.status === 401) { return handleLogout('admin'); }
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        tableBody.innerHTML = ''; // Limpa o "A carregar..."
        
        if (data.drivers.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">Nenhum motorista registado.</td></tr>';
            return;
        }
        
        data.drivers.forEach(driver => {
            const profile = driver.profile || { vehicle_plate: '(N/D)', status: 'offline' };
            const statusClass = `status-${profile.status.replace('_', '-')}`;
            const statusText = profile.status.replace('_', ' ');
            tableBody.innerHTML += `
                <tr>
                    <td>${driver.nome}</td>
                    <td>${driver.telefone}</td>
                    <td>${profile.vehicle_plate}</td>
                    <td><span class="status ${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="btn-action btn-action-small" onclick="openEditDriverModal('${driver._id}')" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn-action-small btn-action-report" onclick="openDriverReportModal('${driver._id}', '${driver.nome}')" title="Ver Relatório"><i class="fas fa-chart-bar"></i></button>
                    </td>
                </tr>
            `;
        });
    } catch (error) { 
        console.error('Falha ao carregar motoristas:', error); 
        tableBody.innerHTML = '<tr><td colspan="5">Erro ao carregar motoristas.</td></tr>';
    }
}

/**
 * Carrega a tabela de entregas ativas.
 */
async function loadActiveDeliveries() {
    const tableBody = document.getElementById('active-orders-table-body');
    tableBody.innerHTML = '<tr><td colspan="7">A carregar...</td></tr>';

    try {
        const response = await fetch(`${API_URL}/api/orders/active`, { headers: getAuthHeaders() });
        if (response.status === 401) { return handleLogout('admin'); }

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        tableBody.innerHTML = '';
        if (data.orders.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7">Nenhuma encomenda ativa.</td></tr>';
            return;
        }
        
        data.orders.forEach(order => {
            const motoristaNome = order.assigned_to_driver ? order.assigned_to_driver.user.nome : 'N/D';
            const statusClass = `status-${order.status.replace('_', '-')}`;
            let acaoBotao = (order.status === 'pendente') ? `<button class="btn-action-assign" onclick="openAssignModal('${order._id}')">Atribuir</button>` : 'Em Curso';
            
            tableBody.innerHTML += `
                <tr>
                    <td>#${order._id.slice(-6)}</td>
                    <td>${order.client_name}</td>
                    <td>${order.client_phone1}</td>
                    <td><span class="status ${statusClass}">${order.status}</span></td>
                    <td>${motoristaNome}</td>
                    <td class="verification-code">${order.verification_code}</td> 
                    <td>${acaoBotao}</td>
                </tr>
            `;
        });
    } catch (error) { 
        console.error('Falha ao carregar encomendas ativas:', error); 
        tableBody.innerHTML = '<tr><td colspan="7">Erro ao carregar encomendas.</td></tr>';
    }
}

/**
 * Carrega a tabela de histórico de entregas.
 */
async function loadHistory() {
    const tableBody = document.getElementById('history-orders-table-body');
    tableBody.innerHTML = '<tr><td colspan="7">A carregar...</td></tr>';

    try {
        const response = await fetch(`${API_URL}/api/orders/history`, { headers: getAuthHeaders() });
        if (response.status === 401) { return handleLogout('admin'); }

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        tableBody.innerHTML = '';
        if (data.orders.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7">Nenhum histórico encontrado.</td></tr>';
            return;
        }
        
        data.orders.forEach(order => {
            const motoristaNome = order.assigned_to_driver ? order.assigned_to_driver.user.nome : 'N/D';
            const duracao = formatDuration(order.timestamp_started, order.timestamp_completed); // De ui.js
            const serviceName = SERVICE_NAMES[order.service_type] || order.service_type; // De ui.js
            
            tableBody.innerHTML += `
                <tr class="history-row">
                    <td>#${order._id.slice(-6)}</td>
                    <td>${order.client_name}</td>
                    <td>${serviceName}</td>
                    <td>${motoristaNome}</td>
                    <td>${duracao}</td>
                    <td class="verification-code">${order.verification_code}</td> 
                    <td><button class="btn-action-small" onclick="openHistoryDetailModal('${order._id}')"><i class="fas fa-eye"></i></button></td>
                </tr>
            `;
        });
    } catch (error) { 
        console.error('Falha ao carregar histórico:', error);
        tableBody.innerHTML = '<tr><td colspan="7">Erro ao carregar histórico.</td></tr>';
    }
}

/**
 * Carrega a tabela de clientes.
 */
async function loadClients() {
    const tableBody = document.getElementById('clients-table-body');
    tableBody.innerHTML = '<tr><td colspan="4">A carregar...</td></tr>';

    try {
        const response = await fetch(`${API_URL}/api/clients`, { method: 'GET', headers: getAuthHeaders() });
        if (response.status === 401) { return handleLogout('admin'); }

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        tableBody.innerHTML = '';
        if (data.clients.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4">Nenhum cliente registado.</td></tr>';
            return;
        }
        
        data.clients.forEach(client => {
            tableBody.innerHTML += `
                <tr>
                    <td>${client.nome}</td>
                    <td>${client.telefone}</td>
                    <td>${client.empresa || 'N/D'}</td>
                    <td>
                        <button class="btn-action btn-action-small" onclick="openEditClientModal('${client._id}')" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="btn-action-small btn-action-report" onclick="openStatementModal('${client._id}', '${client.nome}')" title="Ver Extrato"><i class="fas fa-file-invoice-dollar"></i></button>
                        <button class="btn-action-small btn-danger" onclick="handleDeleteClient('${client._id}', '${client.nome}')" title="Apagar"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    } catch (error) { 
        console.error('Falha ao carregar clientes:', error);
        tableBody.innerHTML = '<tr><td colspan="4">Erro ao carregar clientes.</td></tr>';
    }
}

/**
 * Carrega os clientes para o <select> do formulário de nova entrega.
 */
async function loadClientsIntoDropdown() {
    const select = document.getElementById('delivery-client-select');
    select.innerHTML = '<option value="">A carregar clientes...</option>';
    
    try {
        const response = await fetch(`${API_URL}/api/clients`, { headers: getAuthHeaders() });
        // (MELHORIA) Adiciona verificação de 401
        if (response.status === 401) { 
            select.innerHTML = '<option value="">-- Erro de Sessão --</option>';
            return handleLogout('admin');
        }

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        clientCache = data.clients; // Guarda os clientes na cache global
        
        select.innerHTML = '<option value="">-- Selecione um cliente ou digite manualmente --</option>';
        if (clientCache.length === 0) {
            select.innerHTML = '<option value="">-- Nenhum cliente registado --</option>';
            return;
        }
        
        clientCache.forEach(client => {
            const option = document.createElement('option');
            option.value = client._id;
            option.textContent = `${client.nome} (${client.empresa || client.telefone})`;
            select.appendChild(option);
        });
        
    } catch (error) {
        console.error('Falha ao carregar clientes para o dropdown:', error);
        select.innerHTML = '<option value="">-- Erro ao carregar clientes --</option>';
    }
}


/* --- Lógica de API (Envio de Dados - POST/PUT/DELETE) --- */

/**
 * Submete o formulário de nova entrega.
 * @param {Event} e - O evento de 'submit' do formulário.
 */
async function handleNewDelivery(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    try {
        const response = await fetch(`${API_URL}/api/orders`, {
            method: 'POST',
            headers: getAuthHeaders(), // Não define 'Content-Type', o FormData faz isso
            body: formData
        });
        
        const data = await response.json(); 
        if (!response.ok) {
            throw new Error(data.message || 'Erro do servidor');
        }

        showCustomAlert('Sucesso!', `Pedido Criado! \nCódigo do Destinatário: ${data.order.verification_code}`, 'success');
        form.reset();
        removeImage();    // De ui.js
        destroyFormMap(); // De adminMap.js
        showPage('entregas-activas', 'nav-entregas', 'Entregas Activas');

    } catch (error) {
        console.error('Falha ao criar entrega:', error);
        showCustomAlert('Erro', error.message, 'error'); 
    }
}

/**
 * Submete o formulário de adicionar motorista.
 * @param {Event} e - O evento de 'submit' do formulário.
 */
async function handleAddDriver(e) {
    e.preventDefault();
    const name = document.getElementById('driver-name').value;
    const phone = document.getElementById('driver-phone').value;
    const email = document.getElementById('driver-email').value;
    const plate = document.getElementById('driver-plate').value;
    const password = document.getElementById('driver-password').value;
    
    if (password.length < 6) {
        showCustomAlert('Atenção', 'A senha do motorista deve ter pelo menos 6 caracteres.');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/auth/register-driver`, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: name, email, telefone: phone, password, vehicle_plate: plate })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        showCustomAlert('Sucesso', 'Motorista adicionado com sucesso!', 'success');
        e.target.reset();
        showAddDriverForm(false); // De ui.js
        loadDrivers(); // Atualiza a tabela
        
    } catch (error) {
        console.error('Falha ao adicionar motorista:', error);
        showCustomAlert('Erro', error.message, 'error');
    }
}

/**
 * Submete o formulário de atualização de motorista (do modal).
 * @param {Event} event - O evento de 'submit' do formulário.
 */
async function handleUpdateDriver(event) {
    event.preventDefault();
    const userId = document.getElementById('edit-driver-id').value;
    const updatedData = {
        nome: document.getElementById('edit-driver-name').value,
        telefone: document.getElementById('edit-driver-phone').value,
        vehicle_plate: document.getElementById('edit-driver-plate').value,
        status: document.getElementById('edit-driver-status').value
    };
    
    try {
        const response = await fetch(`${API_URL}/api/drivers/${userId}`, { 
            method: 'PUT', 
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, 
            body: JSON.stringify(updatedData) 
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        showCustomAlert('Sucesso', 'Motorista atualizado com sucesso!', 'success');
        closeEditDriverModal(); // De ui.js
        loadDrivers(); // Atualiza a tabela
        
    } catch (error) {
        console.error('Falha ao atualizar motorista:', error);
        showCustomAlert('Erro', error.message, 'error');
    }
}

/**
 * Submete o formulário de adicionar cliente.
 * @param {Event} e - O evento de 'submit' do formulário.
 */
async function handleAddClient(e) {
    e.preventDefault();
    const clientData = {
        nome: document.getElementById('client-nome').value,
        telefone: document.getElementById('client-telefone').value,
        empresa: document.getElementById('client-empresa').value,
        email: document.getElementById('client-email').value,
        nuit: document.getElementById('client-nuit').value,
        endereco: document.getElementById('client-endereco').value
    };

    if (!clientData.nome || !clientData.telefone) {
        showCustomAlert('Atenção', 'Nome e Telefone são obrigatórios.', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/clients`, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(clientData)
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        showCustomAlert('Sucesso', 'Cliente adicionado com sucesso!', 'success');
        showAddClientForm(false); // De ui.js
        loadClients(); // Atualiza a tabela
        
    } catch (error) {
        console.error('Falha ao adicionar cliente:', error);
        showCustomAlert('Erro', error.message, 'error');
    }
}

/**
 * Submete o formulário de atualização de cliente (do modal).
 * @param {Event} e - O evento de 'submit' do formulário.
 */
async function handleUpdateClient(e) {
    e.preventDefault();
    const clientId = document.getElementById('edit-client-id').value;
    const updatedData = {
        nome: document.getElementById('edit-client-nome').value,
        telefone: document.getElementById('edit-client-telefone').value,
        empresa: document.getElementById('edit-client-empresa').value,
        email: document.getElementById('edit-client-email').value,
        nuit: document.getElementById('edit-client-nuit').value,
        endereco: document.getElementById('edit-client-endereco').value
    };

    if (!updatedData.nome || !updatedData.telefone) {
        showCustomAlert('Atenção', 'Nome e Telefone são obrigatórios.', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/clients/${clientId}`, {
            method: 'PUT',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        showCustomAlert('Sucesso', 'Cliente atualizado com sucesso!', 'success');
        closeEditClientModal(); // De ui.js
        loadClients(); // Atualiza a tabela
        
    } catch (error) {
        console.error('Falha ao atualizar cliente:', error);
        showCustomAlert('Erro', error.message, 'error');
    }
}

/**
 * Apaga um cliente.
 * @param {string} clientId - ID do cliente a apagar.
 * @param {string} clientName - Nome do cliente (para o pop-up de confirmação).
 */
async function handleDeleteClient(clientId, clientName) {
    if (!confirm(`Tem a certeza que quer apagar o cliente "${clientName}"?\nEsta ação não pode ser revertida.`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/clients/${clientId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        showCustomAlert('Sucesso', data.message, 'success');
        loadClients(); // Atualiza a tabela
        
    } catch (error) {
        console.error('Falha ao apagar cliente:', error);
        showCustomAlert('Erro', error.message, 'error');
    }
}

/**
 * Confirma a atribuição de uma encomenda a um motorista.
 * @param {string} orderId - ID da encomenda.
 * @param {string} driverId - ID do motorista (DriverProfile).
 */
async function confirmAssign(orderId, driverId) {
    try {
        const response = await fetch(`${API_URL}/api/orders/${orderId}/assign`, { 
            method: 'PUT', 
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ driverId }) 
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        showCustomAlert('Sucesso', 'Encomenda atribuída com sucesso!', 'success');
        closeAssignModal(); // De ui.js
        loadActiveDeliveries(); // Atualiza a tabela
        
    } catch (error) {
        console.error('Falha ao atribuir encomenda:', error);
        showCustomAlert('Erro', error.message, 'error');
    }
}

/**
 * Processa o reset das estatísticas (simulação).
 */
function handleChartReset() {
    const password = document.getElementById('chart-reset-password').value;
    if (password === 'Entregaah.wipe') {
        console.log('SIMULAÇÃO: A chamar API para resetar estatísticas...');
        // TODO: Adicionar a chamada de API real aqui
        showCustomAlert('Sucesso', 'As estatísticas foram resetadas! (Simulação)', 'success');
        closeChartResetModal(); // De ui.js
        initServicesChart(true); // De adminCharts.js
    } else { 
        showCustomAlert('Erro', 'Senha de reset incorreta.', 'error'); 
    }
}

/**
 * Busca os dados para o extrato do cliente.
 */
async function handleGenerateStatement() {
    const clientId = document.getElementById('statement-client-id').value;
    const startDate = document.getElementById('statement-start-date').value;
    const endDate = document.getElementById('statement-end-date').value;

    if (!startDate || !endDate) {
        showCustomAlert('Erro', 'Por favor, selecione uma data de início e uma data de fim.', 'error');
        return;
    }

    const resultsDiv = document.getElementById('statement-results');
    resultsDiv.classList.add('hidden'); // Esconde resultados antigos
    
    try {
        // (MELHORIA) Feedback de carregamento
        showCustomAlert('A Gerar...', 'A buscar os dados do extrato.', 'info');

        const response = await fetch(`${API_URL}/api/clients/${clientId}/statement?startDate=${startDate}&endDate=${endDate}`, {
            headers: getAuthHeaders()
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        closeCustomAlert(); // Fecha o alerta "A Gerar..."
        populateStatementModal(data, startDate, endDate); // Preenche o modal com os dados

    } catch (error) {
        console.error('Falha ao gerar extrato:', error);
        showCustomAlert('Erro', error.message, 'error');
    }
}


/* --- Lógica de Abertura de Modais (Carregamento de Dados) --- */

/**
 * Abre o modal de atribuição e carrega os motoristas disponíveis.
 * @param {string} orderId - ID da encomenda.
 */
async function openAssignModal(orderId) {
    const modal = document.getElementById('assign-modal');
    modal.classList.remove('hidden');
    document.getElementById('modal-order-id').innerText = `#${orderId.slice(-6)}`;
    
    const select = document.getElementById('driver-select-dropdown');
    select.innerHTML = '<option value="">A carregar...</option>';
    
    try {
        const response = await fetch(`${API_URL}/api/drivers/available`, { headers: getAuthHeaders() });
        if (response.status === 401) { return handleLogout('admin'); }

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        if (data.drivers.length === 0) { 
            select.innerHTML = '<option value="">Nenhum motorista disponível</option>'; 
            return; 
        }
        
        select.innerHTML = '<option value="">-- Selecione um motorista --</option>';
        data.drivers.forEach(driver => { 
            select.innerHTML += `<option value="${driver.profile._id}">${driver.nome} (${driver.profile.vehicle_plate})</option>`; 
        });
        
        // Anexa o listener de clique ao botão de confirmação
        document.getElementById('btn-confirm-assign').onclick = async () => {
            const driverId = select.value;
            if (!driverId) { 
                showCustomAlert('Atenção', 'Por favor, selecione um motorista.'); 
                return; 
            }
            await confirmAssign(orderId, driverId);
        };
        
    } catch (error) { 
        console.error('Falha ao carregar motoristas disponíveis:', error); 
        select.innerHTML = '<option value="">Erro ao carregar</option>'; 
    }
}

/**
 * Abre o modal de edição de motorista e carrega os seus dados.
 * @param {string} driverUserId - ID do *User* do motorista.
 */
async function openEditDriverModal(driverUserId) {
    const modal = document.getElementById('edit-driver-modal');
    modal.classList.remove('hidden');
    document.getElementById('edit-driver-id').value = driverUserId;
    
    // Mostra feedback de carregamento nos campos
    document.getElementById('edit-driver-name').value = 'A carregar...';
    document.getElementById('edit-driver-phone').value = 'A carregar...';
    
    try {
        const response = await fetch(`${API_URL}/api/drivers/${driverUserId}`, { headers: getAuthHeaders() });
        if (response.status === 401) { return handleLogout('admin'); }

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        const driver = data.driver;
        const profile = driver.profile || {};
        
        document.getElementById('edit-driver-name').value = driver.nome;
        document.getElementById('edit-driver-phone').value = driver.telefone;
        document.getElementById('edit-driver-plate').value = profile.vehicle_plate || '';
        document.getElementById('edit-driver-status').value = profile.status || 'offline';
        
    } catch (error) { 
        console.error('Falha ao carregar dados do motorista:', error); 
        showCustomAlert('Erro', 'Erro ao carregar dados do motorista.', 'error'); 
        closeEditDriverModal(); 
    }
}

/**
 * Abre o modal de detalhes do histórico e carrega os dados da encomenda.
 * @param {string} orderId - ID da encomenda.
 */
async function openHistoryDetailModal(orderId) {
    const modal = document.getElementById('history-detail-modal');
    const body = document.getElementById('history-modal-body');
    modal.classList.remove('hidden');
    document.getElementById('history-modal-id').innerText = `#${orderId.slice(-6)}`;
    body.innerHTML = '<p>A carregar detalhes...</p>';
    
    try {
        const response = await fetch(`${API_URL}/api/orders/${orderId}`, { headers: getAuthHeaders() });
        if (response.status === 401) { return handleLogout('admin'); }

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        const order = data.order;
        const motorista = order.assigned_to_driver ? order.assigned_to_driver.user.nome : 'N/D';
        const admin = order.created_by_admin ? order.created_by_admin.nome : 'N/D';
        
        let coordsHtml = '<p><strong>Pin do Mapa:</strong> N/D</p>';
        if (order.address_coords && order.address_coords.lat) {
            coordsHtml = `<p><strong>Pin do Mapa:</strong> ${order.address_coords.lat.toFixed(5)}, ${order.address_coords.lng.toFixed(5)}</p>`;
        }
        
        body.innerHTML = `
            <p><strong>Cliente:</strong> ${order.client_name}</p>
            <p><strong>Telefone:</strong> ${order.client_phone1}</p>
            <p><strong>Endereço:</strong> ${order.address_text || 'N/D'}</p>
            ${coordsHtml}
            <p><strong>Valor:</strong> ${order.price ? order.price.toFixed(2) + ' MZN' : 'N/D'}</p>
            <p><strong>Natureza:</strong> ${SERVICE_NAMES[order.service_type] || order.service_type}</p>
            <p><strong>Status:</strong> ${order.status}</p>
            <p><strong>Código:</strong> ${order.verification_code}</p>
            <p><strong>Motorista:</strong> ${motorista}</p>
            <p><strong>Admin:</strong> ${admin}</p>
            <p><strong>Criado em:</strong> ${new Date(order.timestamp_created).toLocaleString('pt-MZ')}</p>
            <p><strong>Iniciado em:</strong> ${order.timestamp_started ? new Date(order.timestamp_started).toLocaleString('pt-MZ') : 'N/D'}</p>
            <p><strong>Concluído em:</strong> ${order.timestamp_completed ? new Date(order.timestamp_completed).toLocaleString('pt-MZ') : 'N/D'}</p>
            <p><strong>Duração:</strong> ${formatDuration(order.timestamp_started, order.timestamp_completed)}</p>
        `;
    } catch (error) { 
        console.error('Falha ao carregar detalhes do histórico:', error); 
        body.innerHTML = '<p>Erro ao carregar detalhes.</p>'; 
    }
}

/**
 * Abre o modal de relatório do motorista e carrega os seus dados.
 * @param {string} driverUserId - ID do *User* do motorista.
 * @param {string} driverName - Nome do motorista.
 */
async function openDriverReportModal(driverUserId, driverName) {
    const modal = document.getElementById('driver-report-modal');
    modal.classList.remove('hidden');
    document.getElementById('driver-report-title').innerText = `Relatório de ${driverName}`;
    document.getElementById('report-total-entregas').innerText = '...';
    document.getElementById('report-total-duracao').innerText = '...';
    
    const tableBody = document.getElementById('driver-report-table-body');
    tableBody.innerHTML = '<tr><td colspan="5">A carregar relatório...</td></tr>';
    
    try {
        const response = await fetch(`${API_URL}/api/drivers/${driverUserId}/report`, { headers: getAuthHeaders() });
        if (response.status === 401) { return handleLogout('admin'); }

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        const orders = data.orders;
        let totalMs = 0;
        orders.forEach(order => {
            if (order.timestamp_started && order.timestamp_completed) {
                totalMs += (new Date(order.timestamp_completed) - new Date(order.timestamp_started));
            }
        });
        
        document.getElementById('report-total-entregas').innerText = orders.length;
        document.getElementById('report-total-duracao').innerText = formatTotalDuration(totalMs); // De ui.js
        
        tableBody.innerHTML = '';
        if (orders.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">Nenhuma entrega concluída encontrada.</td></tr>';
            return;
        }
        
        orders.forEach(order => {
            const serviceName = SERVICE_NAMES[order.service_type] || order.service_type; // De ui.js
            tableBody.innerHTML += `
                <tr>
                    <td>#${order._id.slice(-6)}</td>
                    <td>${order.client_name}</td>
                    <td>${serviceName}</td>
                    <td>${new Date(order.timestamp_completed).toLocaleDateString('pt-MZ')}</td>
                    <td>${formatDuration(order.timestamp_started, order.timestamp_completed)}</td>
                </tr>
            `;
        });
    } catch (error) { 
        console.error('Falha ao carregar relatório do motorista:', error); 
        tableBody.innerHTML = '<tr><td colspan="5">Erro ao carregar relatório.</td></tr>'; 
    }
}

/**
 * Abre o modal de edição de cliente e carrega os seus dados.
 * @param {string} clientId - ID do cliente.
 */
async function openEditClientModal(clientId) {
    const modal = document.getElementById('edit-client-modal');
    modal.classList.remove('hidden');
    
    try {
        const response = await fetch(`${API_URL}/api/clients/${clientId}`, { headers: getAuthHeaders() });
        if (response.status === 401) { return handleLogout('admin'); }

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        const client = data.client;
        document.getElementById('edit-client-id').value = client._id;
        document.getElementById('edit-client-nome').value = client.nome;
        document.getElementById('edit-client-telefone').value = client.telefone;
        document.getElementById('edit-client-empresa').value = client.empresa || '';
        document.getElementById('edit-client-email').value = client.email || '';
        document.getElementById('edit-client-nuit').value = client.nuit || '';
        document.getElementById('edit-client-endereco').value = client.endereco || '';
        
    } catch (error) {
        console.error('Falha ao carregar dados do cliente:', error);
        showCustomAlert('Erro', 'Erro ao carregar dados do cliente.', 'error');
        closeEditClientModal(); // De ui.js
    }
}

/**
 * Abre o modal de extrato.
 * @param {string} clientId - ID do cliente.
 * @param {string} clientName - Nome do cliente.
 */
function openStatementModal(clientId, clientName) {
    const modal = document.getElementById('statement-modal');
    document.getElementById('statement-client-name').textContent = `Extrato de ${clientName}`;
    document.getElementById('statement-client-id').value = clientId;
    
    // Limpa resultados anteriores
    document.getElementById('statement-results').classList.add('hidden');
    document.getElementById('statement-table-body').innerHTML = '';
    document.getElementById('statement-start-date').value = '';
    document.getElementById('statement-end-date').value = '';
    
    modal.classList.remove('hidden');
}


/* --- Lógica Auxiliar do Formulário --- */

/**
 * Preenche o formulário de entrega com dados de um cliente da cache.
 * @param {Event} e - O evento 'change' do <select>.
 */
function handleClientSelect(e) {
    const selectedClientId = e.target.value;
    const client = clientCache.find(c => c._id === selectedClientId); // Usa a cache global
    
    if (client) {
        document.getElementById('client-name').value = client.nome;
        document.getElementById('client-phone1').value = client.telefone;
        document.getElementById('client-phone2').value = ''; 
        document.getElementById('delivery-client-id').value = client._id;
        
        // (MELHORIA) Bloqueia os campos para evitar edição acidental
        document.getElementById('client-name').readOnly = true;
        document.getElementById('client-phone1').readOnly = true;
        
    } else {
        // Se o admin selecionar "-- Selecione --", limpa e desbloqueia
        resetDeliveryForm();
    }
}

/**
 * Limpa o formulário de entrega e desbloqueia os campos do cliente.
 */
function resetDeliveryForm() {
    document.getElementById('delivery-form').reset();
    document.getElementById('delivery-client-id').value = ''; 
    
    // Garante que os campos estão editáveis
    document.getElementById('client-name').readOnly = false;
    document.getElementById('client-phone1').readOnly = false;
}

/**
 * Preenche o modal de extrato com os dados da API.
 * @param {object} data - Os dados do extrato (totalValue, totalOrders, ordersList).
 * @param {string} startDate - Data de início (para o título).
 * @param {string} endDate - Data de fim (para o título).
 */
function populateStatementModal(data, startDate, endDate) {
    const { totalValue, totalOrders, ordersList } = data;
    
    const formattedTotal = new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(totalValue);
    document.getElementById('statement-total-value').textContent = formattedTotal;
    document.getElementById('statement-total-orders').textContent = `${totalOrders} Pedidos`;
    
    // (CORREÇÃO) Garante que as datas são tratadas como UTC antes de formatar
    const start = new Date(startDate + 'T00:00:00Z').toLocaleDateString('pt-MZ', { timeZone: 'UTC' });
    const end = new Date(endDate + 'T00:00:00Z').toLocaleDateString('pt-MZ', { timeZone: 'UTC' });
    document.getElementById('statement-date-range').textContent = `Pedidos Concluídos de ${start} a ${end}`;

    const tableBody = document.getElementById('statement-table-body');
    tableBody.innerHTML = '';
    
    if (ordersList.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4">Nenhum pedido concluído neste período.</td></tr>';
    } else {
        ordersList.forEach(order => {
            tableBody.innerHTML += `
                <tr>
                    <td>${new Date(order.timestamp_completed).toLocaleDateString('pt-MZ')}</td>
                    <td>#${order._id.slice(-6)}</td>
                    <td>${SERVICE_NAMES[order.service_type] || order.service_type}</td>
                    <td>${order.price.toFixed(2)} MZN</td>
                </tr>
            `;
        });
    }
    
    document.getElementById('statement-results').classList.remove('hidden');
}

/**
 * Gera e baixa o PDF do extrato usando jsPDF.
 */
function handleDownloadPDF() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const clientName = document.getElementById('statement-client-name').textContent;
        const cleanClientName = clientName.replace('Extrato de ', '');
        const dateRange = document.getElementById('statement-date-range').textContent;
        const totalValue = document.getElementById('statement-total-value').textContent;
        const totalOrders = document.getElementById('statement-total-orders').textContent;

        doc.setFontSize(18);
        doc.text('Extrato de Conta de Cliente', 14, 22);
        
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Cliente: ${cleanClientName}`, 14, 32);
        doc.text(`Período: ${dateRange}`, 14, 38);
        
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(`Total de Pedidos: ${totalOrders}`, 14, 50);
        doc.text(`Valor Total Gasto: ${totalValue}`, 14, 56);

        // A função autoTable lê a tabela que já está no HTML
        doc.autoTable({
            html: '#statement-results .table-pedidos',
            startY: 65,
            theme: 'grid',
            styles: { fontSize: 9 },
            headStyles: { fillColor: [44, 62, 80] } // Cor --dark-color
        });
        
        doc.save(`Extrato_${cleanClientName.replace(/ /g, '_')}.pdf`);

    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        showCustomAlert('Erro', 'Não foi possível gerar o PDF. Tente novamente.', 'error');
    }
}