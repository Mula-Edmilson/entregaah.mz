/*
 * Ficheiro: js/admin/admin.js (REFATORADO)
 *
 * Este é o ficheiro "controlador" principal.
 * Ele apenas gere a navegação, os event listeners e os sockets.
 *
 * Depende de:
 * - adminApi.js (para chamadas fetch)
 * - adminModals.js (para abrir modais)
 * - adminMap.js (para lógica de mapas)
 * - adminCharts.js (para gráficos)
 */

// --- Variáveis de Estado Globais ---
let socket = null;
let clientCache = []; // O cache de clientes ainda é útil aqui

/* --- PONTO DE ENTRADA (Entry Point) --- */
document.addEventListener('DOMContentLoaded', () => {
    checkAuth('admin'); 
    initializeMapIcons(); // (Vem do adminMap.js)
    connectSocket(); 
    attachEventListeners();
    
    // Carrega a página inicial
    showPage('visao-geral', 'nav-visao-geral', 'Visão Geral');
});

/**
 * Anexa todos os event listeners da aplicação.
 * As funções 'handle...' e 'open...' vêm dos ficheiros importados.
 */
function attachEventListeners() {
    // --- Formulários ---
    document.getElementById('delivery-form').addEventListener('submit', handleNewDelivery);
    document.getElementById('form-add-motorista').addEventListener('submit', handleAddDriver);
    document.getElementById('form-edit-motorista').addEventListener('submit', handleUpdateDriver);
    document.getElementById('form-add-cliente').addEventListener('submit', handleAddClient);
    document.getElementById('form-edit-cliente').addEventListener('submit', handleUpdateClient);
    document.getElementById('form-change-password').addEventListener('submit', handleChangePassword);

    // --- Navegação Principal (Sidebar) ---
    document.getElementById('nav-visao-geral').addEventListener('click', (e) => { e.preventDefault(); showPage('visao-geral', 'nav-visao-geral', 'Visão Geral'); });
    document.getElementById('nav-entregas').addEventListener('click', (e) => { e.preventDefault(); showPage('entregas-activas', 'nav-entregas', 'Entregas Activas'); });
    document.getElementById('nav-motoristas').addEventListener('click', (e) => { e.preventDefault(); showPage('gestao-motoristas', 'nav-motoristas', 'Gestão de Motoristas'); });
    document.getElementById('nav-clientes').addEventListener('click', (e) => { e.preventDefault(); showPage('gestao-clientes', 'nav-clientes', 'Gestão de Clientes'); });
    document.getElementById('nav-historico').addEventListener('click', (e) => { e.preventDefault(); showPage('historico', 'nav-historico', 'Histórico'); });
    document.getElementById('nav-mapa').addEventListener('click', (e) => { e.preventDefault(); showPage('mapa-tempo-real', 'nav-mapa', 'Mapa em Tempo Real'); });
    document.getElementById('nav-gestores').addEventListener('click', (e) => {
        e.preventDefault();
        showPage('gestao-gestores', 'nav-gestores', 'Gestores');
        loadManagers();
    });

    document.getElementById('nav-custos').addEventListener('click', (e) => {
        e.preventDefault();
        showPage('gestao-custos', 'nav-custos', 'Custos');
        loadExpenses();
        loadEmployeesForExpense();
    });

    document.getElementById('form-add-manager').addEventListener('submit', handleAddManager);
    document.getElementById('form-edit-manager').addEventListener('submit', handleEditManager);
    document.getElementById('form-add-expense').addEventListener('submit', handleAddExpense);

    // Submenu de Formulários
    document.getElementById('nav-form-doc').addEventListener('click', (e) => { e.preventDefault(); showServiceForm('doc'); });
    document.getElementById('nav-form-farma').addEventListener('click', (e) => { e.preventDefault(); showServiceForm('farma'); });
    document.getElementById('nav-form-carga').addEventListener('click', (e) => { e.preventDefault(); showServiceForm('carga'); });
    document.getElementById('nav-form-rapido').addEventListener('click', (e) => { e.preventDefault(); showServiceForm('rapido'); });
    document.getElementById('nav-form-outros').addEventListener('click', (e) => { e.preventDefault(); showServiceForm('outros'); });
    
    document.getElementById('nav-config').addEventListener('click', (e) => { e.preventDefault(); showPage('configuracoes', 'nav-config', 'Configurações'); });

    // --- Autenticação ---
    document.getElementById('admin-logout').addEventListener('click', (e) => { e.preventDefault(); handleLogout('admin'); });

    // --- Modais e Botões (Listeners) ---
    document.getElementById('btn-reset-chart').addEventListener('click', openChartResetModal);
    document.getElementById('btn-confirm-chart-reset').addEventListener('click', handleChartReset);
    document.getElementById('btn-close-chart-reset').addEventListener('click', closeChartResetModal);
    document.getElementById('btn-cancel-chart-reset').addEventListener('click', closeChartResetModal);
    
    document.getElementById('history-search-input').addEventListener('input', filterHistoryTable);
    document.getElementById('delivery-image').addEventListener('change', handleImageUpload);
    document.getElementById('delivery-client-select').addEventListener('change', handleClientSelect);

    // Listeners do Modal de Extrato (Statement)
    document.getElementById('btn-generate-statement').addEventListener('click', handleGenerateStatement);
    document.getElementById('btn-download-pdf').addEventListener('click', handleDownloadPDF);
    document.querySelectorAll('.btn-set-date').forEach(btn => {
        btn.addEventListener('click', () => setStatementDates(btn.dataset.range));
    });

    // Zona de Perigo
    document.getElementById('btn-delete-old-history').addEventListener('click', handleDeleteOldHistoryClick);
    document.getElementById('btn-close-confirmation-modal').addEventListener('click', closeConfirmationModal);
    document.getElementById('btn-cancel-confirmation-modal').addEventListener('click', closeConfirmationModal);
    
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
    // Fecha o menu mobile ao clicar num item (em ecrãs pequenos)
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
 * Mostra uma página de conteúdo e esconde as outras.
 * Chama as funções de carregamento de dados necessárias.
 * @param {string} pageId - ID do elemento da página (ex: 'visao-geral')
 * @param {string} navId - ID do link da sidebar (ex: 'nav-visao-geral')
 * @param {string} title - O título a mostrar no header
 */
function showPage(pageId, navId, title) {
    // Limpa recursos de outras páginas
    destroyFormMap(); // (adminMap.js)
    destroyLiveMap(); // (adminMap.js)
    destroyCharts();  // (adminCharts.js)     
    
    // Esconde todas as páginas e desativa todos os links
    document.querySelectorAll('.content-page').forEach(page => page.classList.add('hidden'));
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => item.classList.remove('active'));
    
    // Mostra a página e ativa o link corretos
    const pageToShow = document.getElementById(pageId);
    if (pageToShow) pageToShow.classList.remove('hidden');
    
    const navLink = document.getElementById(navId);
    if (navLink) navLink.classList.add('active');
    
    document.getElementById('main-title').innerText = title;
    
    // Carrega os dados específicos da página
    switch (pageId) {
        case 'visao-geral':
            loadOverviewStats();
            loadFinancialStats();
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
            initializeLiveMap();
            break;
        case 'configuracoes':
            document.getElementById('form-change-password').reset();
            break;
    }
}

/**
 * Controlador para mostrar o formulário de nova entrega.
 * @param {string} serviceType - O tipo de serviço (ex: 'doc', 'farma')
 */
function showServiceForm(serviceType) {
    const titles = {
        'doc': 'Nova Tramitação de Documentos',
        'farma': 'Novo Pedido Farmacêutico',
        'carga': 'Novo Transporte de Carga',
        'rapido': 'Novo Delivery Rápido',
        'outros': 'Outros Serviços'
    };
    showPage('form-nova-entrega', null, titles[serviceType] || 'Nova Entrega');
    
    // Prepara o formulário
    document.getElementById('service-type').value = serviceType;
    removeImage(); // (ui.js)
    resetDeliveryForm();
    loadClientsIntoDropdown(); // (adminApi.js)
    
    // Atraso para garantir que o elemento #map está visível antes de inicializar
    setTimeout(initializeFormMap, 100); // (adminMap.js)
}


/* --- Lógica de Socket.IO --- */
function connectSocket() {
    const token = getAuthToken(); // (auth.js)
    if (!token) return;
    
    socket = io(API_URL, { auth: { token: token } }); // (api.js)
    
    socket.on('connect', () => {
        console.log('Conectado ao servidor Socket.io com ID:', socket.id);
        socket.emit('admin_join_room');
    });

    // Função auxiliar para saber qual página está ativa
    const activePage = () => {
        const page = document.querySelector('.content-page:not(.hidden)');
        return page ? page.id : null;
    };
    
    // Listeners de Socket que atualizam a UI
    socket.on('delivery_started', (order) => {
        if (activePage() === 'entregas-activas') loadActiveDeliveries();
        if (activePage() === 'visao-geral') { loadOverviewStats(); loadFinancialStats(); }
    });
    
    socket.on('delivery_completed', (order) => {
        if (activePage() === 'entregas-activas') loadActiveDeliveries();
        if (activePage() === 'historico') loadHistory();
        if (activePage() === 'visao-geral') { loadOverviewStats(); loadFinancialStats(); }
    });
    
    socket.on('driver_status_changed', (data) => {
         if (activePage() === 'gestao-motoristas') loadDrivers();
         if (activePage() === 'visao-geral') loadOverviewStats();
    });

    // Listeners do Mapa em Tempo Real (chamam funções do adminMap.js)
    socket.on('driver_location_broadcast', (data) => {
        updateDriverMarker(data);
    });
    
    socket.on('driver_disconnected_broadcast', (data) => {
        removeDriverMarker(data);
    });
}


/* --- Lógica Auxiliar (UI Helpers) --- */

/**
 * Preenche o formulário de entrega quando um cliente registado é selecionado.
 */
function handleClientSelect(e) {
    const selectedClientId = e.target.value;
    const client = clientCache.find(c => c._id === selectedClientId);
    
    if (client) {
        document.getElementById('client-name').value = client.nome;
        document.getElementById('client-phone1').value = client.telefone;
        document.getElementById('client-phone2').value = ''; // Limpa o tel. alternativo
        document.getElementById('delivery-client-id').value = client._id;
        
        // Torna os campos read-only
        document.getElementById('client-name').readOnly = true;
        document.getElementById('client-phone1').readOnly = true;
        
    } else {
        // Se selecionar "-- Selecione --", limpa e reativa os campos
        resetDeliveryForm();
    }
}

/**
 * Limpa o formulário de entrega e reativa os campos.
 */
function resetDeliveryForm() {
    document.getElementById('delivery-form').reset();
    document.getElementById('delivery-client-id').value = ''; 
    
    document.getElementById('client-name').readOnly = false;
    document.getElementById('client-phone1').readOnly = false;
}

/**
 * Callback para a zona de perigo (Apagar Histórico).
 */
function handleDeleteOldHistoryClick() {
    const confirmWord = 'APAGAR';
    
    openConfirmationModal({ // (adminModals.js)
        title: "Apagar Histórico Antigo?",
        message: `Esta ação é irreversível. Todas as encomendas concluídas com mais de 30 dias serão permanentemente apagadas.\n\nPara confirmar, digite <b>${confirmWord}</b> no campo abaixo.`,
        confirmText: confirmWord,
        onConfirm: handleDeleteOldHistory // (adminApi.js)
    });
}

/**
 * ✅ NOVA FUNÇÃO: Submissão do formulário de nova entrega.
 * @param {Event} event - O evento de submit do formulário.
 */
async function handleNewDelivery(event) {
    event.preventDefault();

    const form = document.getElementById('delivery-form');
    if (!form) return;

    const formData = new FormData(form);

    const payload = {
        service_type: formData.get('service_type') || 'outros',
        client_name: formData.get('client_name'),
        client_phone1: formData.get('client_phone1'),
        client_phone2: formData.get('client_phone2') || null,
        price: Number(formData.get('price') || 0),
        address_text: formData.get('address_text'),
        lng: Number(formData.get('lng')),
        lat: Number(formData.get('lat')),
        clientId: formData.get('clientId') || null,
        autoAssign: formData.get('autoAssign') === 'true' || formData.get('autoAssign') === 'on'
    };

    try {
        const order = await createOrder(payload); // usa createOrder de adminApi.js
        if (order) {
            form.reset();
            resetDeliveryForm();
            showCustomAlert('Sucesso', `Pedido criado com sucesso! Código: ${order.verification_code}`);
        }
    } catch (err) {
        console.error('Erro ao criar pedido:', err);
        // showCustomAlert já é chamado dentro de createOrder em caso de erro
    }
}
/**
 * ===========================
 *  HANDLERS PARA MOTORISTAS
 * ===========================
 */

// Adicionar motorista
async function handleAddDriver(event) {
    event.preventDefault();

    const form = document.getElementById('form-add-motorista');
    if (!form) return;

    const formData = new FormData(form);

    const payload = {
        nome: formData.get('nome'),
        telefone: formData.get('telefone'),
        email: formData.get('email'),
        vehicle_plate: formData.get('vehicle_plate'),
        vehicle_model: formData.get('vehicle_model'),
        password: formData.get('password')
    };

    try {
        await createDriver(payload); // adminApi.js
        showCustomAlert('Sucesso', 'Motorista adicionado com sucesso.');
        form.reset();
        loadDrivers();
    } catch (err) {
        console.error('Erro ao adicionar motorista:', err);
    }
}

// Editar motorista
async function handleUpdateDriver(event) {
    event.preventDefault();

    const form = document.getElementById('form-edit-motorista');
    if (!form) return;

    const formData = new FormData(form);
    const driverId = formData.get('driverId');

    const payload = {
        nome: formData.get('nome'),
        telefone: formData.get('telefone'),
        email: formData.get('email'),
        vehicle_plate: formData.get('vehicle_plate'),
        vehicle_model: formData.get('vehicle_model'),
        status: formData.get('status')
    };

    try {
        await updateDriver(driverId, payload); // adminApi.js
        showCustomAlert('Sucesso', 'Motorista atualizado com sucesso.');
        loadDrivers();
    } catch (err) {
        console.error('Erro ao atualizar motorista:', err);
    }
}

/**
 * ===========================
 *  HANDLERS PARA CLIENTES
 * ===========================
 */

async function handleAddClient(event) {
    event.preventDefault();

    const form = document.getElementById('form-add-cliente');
    if (!form) return;

    const formData = new FormData(form);

    const payload = {
        nome: formData.get('nome'),
        telefone: formData.get('telefone'),
        email: formData.get('email'),
        endereco: formData.get('endereco')
    };

    try {
        const client = await createClient(payload); // adminApi.js
        showCustomAlert('Sucesso', 'Cliente adicionado com sucesso.');
        form.reset();
        loadClients();
        // Atualiza cache para o formulário de entrega
        clientCache.push(client);
    } catch (err) {
        console.error('Erro ao adicionar cliente:', err);
    }
}

async function handleUpdateClient(event) {
    event.preventDefault();

    const form = document.getElementById('form-edit-cliente');
    if (!form) return;

    const formData = new FormData(form);
    const clientId = formData.get('clientId');

    const payload = {
        nome: formData.get('nome'),
        telefone: formData.get('telefone'),
        email: formData.get('email'),
        endereco: formData.get('endereco')
    };

    try {
        await updateClient(clientId, payload); // adminApi.js
        showCustomAlert('Sucesso', 'Cliente atualizado com sucesso.');
        loadClients();
    } catch (err) {
        console.error('Erro ao atualizar cliente:', err);
    }
}

/**
 * ===========================
 *  HANDLER PARA ALTERAÇÃO DE SENHA
 * ===========================
 */

async function handleChangePassword(event) {
    event.preventDefault();

    const form = document.getElementById('form-change-password');
    if (!form) return;

    const formData = new FormData(form);

    const payload = {
        currentPassword: formData.get('currentPassword'),
        newPassword: formData.get('newPassword'),
        confirmPassword: formData.get('confirmPassword')
    };

    try {
        await changeAdminPassword(payload); // adminApi.js
        showCustomAlert('Sucesso', 'Palavra-passe alterada com sucesso.');
        form.reset();
    } catch (err) {
        console.error('Erro ao alterar palavra-passe:', err);
    }
}

/**
 * ===========================
 *  HANDLERS PARA GESTORES
 * ===========================
 */

async function handleAddManager(event) {
    event.preventDefault();

    const form = document.getElementById('form-add-manager');
    if (!form) return;

    const formData = new FormData(form);

    const payload = {
        nome: formData.get('nome'),
        telefone: formData.get('telefone'),
        email: formData.get('email'),
        password: formData.get('password')
    };

    try {
        await createManager(payload); // adminApi.js
        showCustomAlert('Sucesso', 'Gestor adicionado com sucesso.');
        form.reset();
        loadManagers();
    } catch (err) {
        console.error('Erro ao adicionar gestor:', err);
    }
}

async function handleEditManager(event) {
    event.preventDefault();

    const form = document.getElementById('form-edit-manager');
    if (!form) return;

    const formData = new FormData(form);
    const managerId = formData.get('managerId');

    const payload = {
        nome: formData.get('nome'),
        telefone: formData.get('telefone'),
        email: formData.get('email')
    };

    try {
        await updateManager(managerId, payload); // adminApi.js
        showCustomAlert('Sucesso', 'Gestor atualizado com sucesso.');
        loadManagers();
    } catch (err) {
        console.error('Erro ao atualizar gestor:', err);
    }
}

/**
 * ===========================
 *  HANDLERS PARA CUSTOS / DESPESAS
 * ===========================
 */

async function handleAddExpense(event) {
    event.preventDefault();

    const form = document.getElementById('form-add-expense');
    if (!form) return;

    const formData = new FormData(form);

    const payload = {
        description: formData.get('description'),
        amount: Number(formData.get('amount') || 0),
        date: formData.get('date'),
        employeeId: formData.get('employeeId'),
        category: formData.get('category')
    };

    try {
        await createExpense(payload); // adminApi.js
        showCustomAlert('Sucesso', 'Despesa registada com sucesso.');
        form.reset();
        loadExpenses();
    } catch (err) {
        console.error('Erro ao adicionar despesa:', err);
    }
}
/**
 * ===========================
 *  STUBS / FUNÇÕES BÁSICAS PARA EVITAR CRASH
 *  (substituiremos depois por versões completas, se necessário)
 * ===========================
 */

// ---------- CHARTS / ESTATÍSTICAS ----------

// Estatísticas de visão geral (topo do painel)
function loadOverviewStats() {
    // TODO: implementar com adminApi.js/adminCharts.js
    console.warn('loadOverviewStats() não implementado – stub a correr.');
}

// Estatísticas financeiras
function loadFinancialStats() {
    // TODO: implementar com adminApi.js/adminCharts.js
    console.warn('loadFinancialStats() não implementado – stub a correr.');
}

// Inicializar gráfico de serviços
function initServicesChart(_reset = false) {
    // TODO: implementar com adminCharts.js
    console.warn('initServicesChart() não implementado – stub a correr.');
}

// Resetar gráfico (botão "Reset" no dashboard)
function handleChartReset() {
    console.warn('handleChartReset() não implementado – stub a correr.');
    // Exemplo simples: só reinicializa o gráfico se já tiveres algo
    if (typeof initServicesChart === 'function') {
        initServicesChart(true);
    }
}

// ---------- LISTAGENS (TABELAS) ----------

// Carregar motoristas
function loadDrivers() {
    // TODO: implementar com adminApi.js
    console.warn('loadDrivers() não implementado – stub a correr.');
}

// Carregar entregas ativas
function loadActiveDeliveries() {
    // TODO: implementar com adminApi.js
    console.warn('loadActiveDeliveries() não implementado – stub a correr.');
}

// Carregar histórico de encomendas
function loadHistory() {
    // TODO: implementar com adminApi.js
    console.warn('loadHistory() não implementado – stub a correr.');
}

// Carregar clientes
function loadClients() {
    // TODO: implementar com adminApi.js
    console.warn('loadClients() não implementado – stub a correr.');
}

// Carregar lista de gestores
function loadManagers() {
    // TODO: implementar com adminApi.js
    console.warn('loadManagers() não implementado – stub a correr.');
}

// Carregar despesas
function loadExpenses() {
    // TODO: implementar com adminApi.js
    console.warn('loadExpenses() não implementado – stub a correr.');
}

// Carregar funcionários elegíveis para despesas
function loadEmployeesForExpense() {
    // TODO: implementar com adminApi.js
    console.warn('loadEmployeesForExpense() não implementado – stub a correr.');
}

// ---------- MAPAS ----------

// Inicializar mapa em tempo real
function initializeLiveMap() {
    // TODO: implementar com adminMap.js
    console.warn('initializeLiveMap() não implementado – stub a correr.');
}

// Destruir mapa do formulário (quando muda de página)
function destroyFormMap() {
    // TODO: implementar com adminMap.js
    console.warn('destroyFormMap() não implementado – stub a correr.');
}

// Destruir mapa em tempo real (quando muda de página)
function destroyLiveMap() {
    // TODO: implementar com adminMap.js
    console.warn('destroyLiveMap() não implementado – stub a correr.');
}

// Inicializar mapa do formulário de nova entrega
function initializeFormMap() {
    // TODO: implementar com adminMap.js
    console.warn('initializeFormMap() não implementado – stub a correr.');
}

// ---------- CHARTS CLEANUP ----------

function destroyCharts() {
    // TODO: implementar com adminCharts.js
    console.warn('destroyCharts() não implementado – stub a correr.');
}

// ---------- HISTÓRICO / FILTRO ----------

function filterHistoryTable() {
    // TODO: implementar com lógica de filtro
    console.warn('filterHistoryTable() não implementado – stub a correr.');
}

// ---------- EXTRATO / RELATÓRIOS ----------

function handleGenerateStatement() {
    // TODO: implementar com adminApi.js
    console.warn('handleGenerateStatement() não implementado – stub a correr.');
}

function handleDownloadPDF() {
    // TODO: implementar – provavelmente gera/download PDF
    console.warn('handleDownloadPDF() não implementado – stub a correr.');
}

function setStatementDates(_range) {
    // TODO: implementar alteração rápida de datas
    console.warn('setStatementDates() não implementado – stub a correr.');
}

// ---------- MODAIS / CONFIRMAÇÃO ----------

function closeConfirmationModal() {
    // TODO: implementar com adminModals.js
    console.warn('closeConfirmationModal() não implementado – stub a correr.');
}
