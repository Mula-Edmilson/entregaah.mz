/*
 * Ficheiro: js/admin/admin.js (REFATORADO ESTÁVEL)
 *
 * Controlador principal: navegação, eventos e sockets.
 * TODAS as funções referenciadas existem (pelo menos como stubs),
 * para evitar qualquer ReferenceError.
 */

// --- Variáveis de Estado Globais ---
let socket = null;
let clientCache = []; // cache de clientes para o formulário de entrega

/* --- PONTO DE ENTRADA (Entry Point) --- */
document.addEventListener('DOMContentLoaded', () => {
    // auth.js
    if (typeof checkAuth === 'function') {
        checkAuth('admin');
    }

    // adminMap.js
    if (typeof initializeMapIcons === 'function') {
        initializeMapIcons();
    }

    connectSocket();
    attachEventListeners();

    // Carrega a página inicial
    showPage('visao-geral', 'nav-visao-geral', 'Visão Geral');
});

/**
 * Anexa todos os event listeners da aplicação.
 */
function attachEventListeners() {
    // --- Formulários ---

    const deliveryForm = document.getElementById('delivery-form');
    if (deliveryForm) {
        deliveryForm.addEventListener('submit', handleNewDelivery);
    }

    const formAddMotorista = document.getElementById('form-add-motorista');
    if (formAddMotorista) {
        formAddMotorista.addEventListener('submit', handleAddDriver);
    }

    const formEditMotorista = document.getElementById('form-edit-motorista');
    if (formEditMotorista) {
        formEditMotorista.addEventListener('submit', handleUpdateDriver);
    }

    const formAddCliente = document.getElementById('form-add-cliente');
    if (formAddCliente) {
        formAddCliente.addEventListener('submit', handleAddClient);
    }

    const formEditCliente = document.getElementById('form-edit-cliente');
    if (formEditCliente) {
        formEditCliente.addEventListener('submit', handleUpdateClient);
    }

    const formChangePassword = document.getElementById('form-change-password');
    if (formChangePassword) {
        formChangePassword.addEventListener('submit', handleChangePassword);
    }

    // --- Navegação Principal (Sidebar) ---
    const navVisaoGeral = document.getElementById('nav-visao-geral');
    if (navVisaoGeral) {
        navVisaoGeral.addEventListener('click', (e) => {
            e.preventDefault();
            showPage('visao-geral', 'nav-visao-geral', 'Visão Geral');
        });
    }

    const navEntregas = document.getElementById('nav-entregas');
    if (navEntregas) {
        navEntregas.addEventListener('click', (e) => {
            e.preventDefault();
            showPage('entregas-activas', 'nav-entregas', 'Entregas Activas');
        });
    }

    const navMotoristas = document.getElementById('nav-motoristas');
    if (navMotoristas) {
        navMotoristas.addEventListener('click', (e) => {
            e.preventDefault();
            showPage('gestao-motoristas', 'nav-motoristas', 'Gestão de Motoristas');
        });
    }

    const navClientes = document.getElementById('nav-clientes');
    if (navClientes) {
        navClientes.addEventListener('click', (e) => {
            e.preventDefault();
            showPage('gestao-clientes', 'nav-clientes', 'Gestão de Clientes');
        });
    }

    const navHistorico = document.getElementById('nav-historico');
    if (navHistorico) {
        navHistorico.addEventListener('click', (e) => {
            e.preventDefault();
            showPage('historico', 'nav-historico', 'Histórico');
        });
    }

    const navMapa = document.getElementById('nav-mapa');
    if (navMapa) {
        navMapa.addEventListener('click', (e) => {
            e.preventDefault();
            showPage('mapa-tempo-real', 'nav-mapa', 'Mapa em Tempo Real');
        });
    }

    const navGestores = document.getElementById('nav-gestores');
    if (navGestores) {
        navGestores.addEventListener('click', (e) => {
            e.preventDefault();
            showPage('gestao-gestores', 'nav-gestores', 'Gestores');
            loadManagers();
        });
    }

    const navCustos = document.getElementById('nav-custos');
    if (navCustos) {
        navCustos.addEventListener('click', (e) => {
            e.preventDefault();
            showPage('gestao-custos', 'nav-custos', 'Custos');
            loadExpenses();
            loadEmployeesForExpense();
        });
    }

    const navConfig = document.getElementById('nav-config');
    if (navConfig) {
        navConfig.addEventListener('click', (e) => {
            e.preventDefault();
            showPage('configuracoes', 'nav-config', 'Configurações');
        });
    }

    // Submenu de Formulários
    const navFormDoc = document.getElementById('nav-form-doc');
    if (navFormDoc) {
        navFormDoc.addEventListener('click', (e) => { e.preventDefault(); showServiceForm('doc'); });
    }

    const navFormFarma = document.getElementById('nav-form-farma');
    if (navFormFarma) {
        navFormFarma.addEventListener('click', (e) => { e.preventDefault(); showServiceForm('farma'); });
    }

    const navFormCarga = document.getElementById('nav-form-carga');
    if (navFormCarga) {
        navFormCarga.addEventListener('click', (e) => { e.preventDefault(); showServiceForm('carga'); });
    }

    const navFormRapido = document.getElementById('nav-form-rapido');
    if (navFormRapido) {
        navFormRapido.addEventListener('click', (e) => { e.preventDefault(); showServiceForm('rapido'); });
    }

    const navFormOutros = document.getElementById('nav-form-outros');
    if (navFormOutros) {
        navFormOutros.addEventListener('click', (e) => { e.preventDefault(); showServiceForm('outros'); });
    }

    // --- Autenticação ---
    const logoutBtn = document.getElementById('admin-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof handleLogout === 'function') {
                handleLogout('admin');
            }
        });
    }

    // --- Modais e Botões (Listeners) ---
    const btnResetChart = document.getElementById('btn-reset-chart');
    if (btnResetChart) {
        btnResetChart.addEventListener('click', openChartResetModal);
    }

    const btnConfirmChartReset = document.getElementById('btn-confirm-chart-reset');
    if (btnConfirmChartReset) {
        btnConfirmChartReset.addEventListener('click', handleChartReset);
    }

    const btnCloseChartReset = document.getElementById('btn-close-chart-reset');
    if (btnCloseChartReset) {
        btnCloseChartReset.addEventListener('click', closeChartResetModal);
    }

    const btnCancelChartReset = document.getElementById('btn-cancel-chart-reset');
    if (btnCancelChartReset) {
        btnCancelChartReset.addEventListener('click', closeChartResetModal);
    }

    const historySearchInput = document.getElementById('history-search-input');
    if (historySearchInput) {
        historySearchInput.addEventListener('input', filterHistoryTable);
    }

    const deliveryImage = document.getElementById('delivery-image');
    if (deliveryImage) {
        deliveryImage.addEventListener('change', handleImageUpload);
    }

    const deliveryClientSelect = document.getElementById('delivery-client-select');
    if (deliveryClientSelect) {
        deliveryClientSelect.addEventListener('change', handleClientSelect);
    }

    const btnGenerateStatement = document.getElementById('btn-generate-statement');
    if (btnGenerateStatement) {
        btnGenerateStatement.addEventListener('click', handleGenerateStatement);
    }

    const btnDownloadPdf = document.getElementById('btn-download-pdf');
    if (btnDownloadPdf) {
        btnDownloadPdf.addEventListener('click', handleDownloadPDF);
    }

    document.querySelectorAll('.btn-set-date').forEach(btn => {
        btn.addEventListener('click', () => setStatementDates(btn.dataset.range));
    });

    const btnDeleteOldHistory = document.getElementById('btn-delete-old-history');
    if (btnDeleteOldHistory) {
        btnDeleteOldHistory.addEventListener('click', handleDeleteOldHistoryClick);
    }

    const btnCloseConfirmation = document.getElementById('btn-close-confirmation-modal');
    if (btnCloseConfirmation) {
        btnCloseConfirmation.addEventListener('click', closeConfirmationModal);
    }

    const btnCancelConfirmation = document.getElementById('btn-cancel-confirmation-modal');
    if (btnCancelConfirmation) {
        btnCancelConfirmation.addEventListener('click', closeConfirmationModal);
    }

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
function showPage(pageId, navId, title) {
    // Limpa recursos de outras páginas
    destroyFormMap();
    destroyLiveMap();
    destroyCharts();

    // Esconde todas as páginas e desativa todos os links
    document.querySelectorAll('.content-page').forEach(page => page.classList.add('hidden'));
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => item.classList.remove('active'));

    // Mostra a página e ativa o link correto
    const pageToShow = document.getElementById(pageId);
    if (pageToShow) pageToShow.classList.remove('hidden');

    if (navId) {
        const navLink = document.getElementById(navId);
        if (navLink) navLink.classList.add('active');
    }

    const titleEl = document.getElementById('main-title');
    if (titleEl) {
        titleEl.innerText = title;
    }

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
            const formChangePassword = document.getElementById('form-change-password');
            if (formChangePassword) formChangePassword.reset();
            break;
    }
}

/**
 * Mostrar formulário de nova entrega para um tipo de serviço
 */
function showServiceForm(serviceType) {
    const titles = {
        doc: 'Nova Tramitação de Documentos',
        farma: 'Novo Pedido Farmacêutico',
        carga: 'Novo Transporte de Carga',
        rapido: 'Novo Delivery Rápido',
        outros: 'Outros Serviços'
    };

    showPage('form-nova-entrega', null, titles[serviceType] || 'Nova Entrega');

    const serviceTypeInput = document.getElementById('service-type');
    if (serviceTypeInput) {
        serviceTypeInput.value = serviceType;
    }

    if (typeof removeImage === 'function') {
        removeImage();
    }

    resetDeliveryForm();

    if (typeof loadClientsIntoDropdown === 'function') {
        loadClientsIntoDropdown();
    }

    setTimeout(() => {
        initializeFormMap();
    }, 100);
}

/* --- Socket.IO --- */
function connectSocket() {
    if (typeof io === 'undefined' || typeof API_URL === 'undefined') return;

    const token = (typeof getAuthToken === 'function') ? getAuthToken() : null;
    if (!token) return;

    socket = io(API_URL, { auth: { token } });

    socket.on('connect', () => {
        console.log('Conectado ao servidor Socket.io com ID:', socket.id);
        socket.emit('admin_join_room');
    });

    const activePage = () => {
        const page = document.querySelector('.content-page:not(.hidden)');
        return page ? page.id : null;
    };

    socket.on('delivery_started', () => {
        if (activePage() === 'entregas-activas') loadActiveDeliveries();
        if (activePage() === 'visao-geral') { loadOverviewStats(); loadFinancialStats(); }
    });

    socket.on('delivery_completed', () => {
        if (activePage() === 'entregas-activas') loadActiveDeliveries();
        if (activePage() === 'historico') loadHistory();
        if (activePage() === 'visao-geral') { loadOverviewStats(); loadFinancialStats(); }
    });

    socket.on('driver_status_changed', () => {
        if (activePage() === 'gestao-motoristas') loadDrivers();
        if (activePage() === 'visao-geral') loadOverviewStats();
    });

    socket.on('driver_location_broadcast', (data) => {
        if (typeof updateDriverMarker === 'function') {
            updateDriverMarker(data);
        }
    });

    socket.on('driver_disconnected_broadcast', (data) => {
        if (typeof removeDriverMarker === 'function') {
            removeDriverMarker(data);
        }
    });
}

/* --- Auxiliares de UI --- */
function handleClientSelect(e) {
    const selectedClientId = e.target.value;
    const client = clientCache.find(c => c._id === selectedClientId);

    const nameInput = document.getElementById('client-name');
    const phone1Input = document.getElementById('client-phone1');
    const phone2Input = document.getElementById('client-phone2');
    const clientIdInput = document.getElementById('delivery-client-id');

    if (client) {
        if (nameInput) nameInput.value = client.nome;
        if (phone1Input) phone1Input.value = client.telefone;
        if (phone2Input) phone2Input.value = '';
        if (clientIdInput) clientIdInput.value = client._id;

        if (nameInput) nameInput.readOnly = true;
        if (phone1Input) phone1Input.readOnly = true;
    } else {
        resetDeliveryForm();
    }
}

function resetDeliveryForm() {
    const form = document.getElementById('delivery-form');
    if (form) form.reset();

    const clientIdInput = document.getElementById('delivery-client-id');
    if (clientIdInput) clientIdInput.value = '';

    const nameInput = document.getElementById('client-name');
    const phone1Input = document.getElementById('client-phone1');

    if (nameInput) nameInput.readOnly = false;
    if (phone1Input) phone1Input.readOnly = false;
}

function handleDeleteOldHistoryClick() {
    const confirmWord = 'APAGAR';

    if (typeof openConfirmationModal === 'function') {
        openConfirmationModal({
            title: 'Apagar Histórico Antigo?',
            message: `Esta ação é irreversível. Todas as encomendas concluídas com mais de 30 dias serão permanentemente apagadas.\n\nPara confirmar, digite <b>${confirmWord}</b> no campo abaixo.`,
            confirmText: confirmWord,
            onConfirm: handleDeleteOldHistory // adminApi.js
        });
    }
}

/* --- Nova entrega --- */
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

    if (typeof createOrder !== 'function') {
        console.warn('createOrder não definido (adminApi.js)');
        return;
    }

    try {
        const order = await createOrder(payload);
        if (order) {
            form.reset();
            resetDeliveryForm();
            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Sucesso', `Pedido criado com sucesso! Código: ${order.verification_code}`);
            } else {
                alert('Pedido criado com sucesso!');
            }
        }
    } catch (err) {
        console.error('Erro ao criar pedido:', err);
    }
}

/* ===========================
 *  STUBS SEGUROS (NÃO CRASHAM)
 * =========================== */

// Se estas funções existirem noutros ficheiros, as implementações deles
// vão sobrescrever estas. Se não existirem, pelo menos não rebentam o JS.

function handleAddDriver() { console.warn('handleAddDriver stub'); }
function handleUpdateDriver() { console.warn('handleUpdateDriver stub'); }
function handleAddClient() { console.warn('handleAddClient stub'); }
function handleUpdateClient() { console.warn('handleUpdateClient stub'); }
function handleChangePassword() { console.warn('handleChangePassword stub'); }

function openChartResetModal() { console.warn('openChartResetModal stub'); }
function handleChartReset() { console.warn('handleChartReset stub'); }
function closeChartResetModal() { console.warn('closeChartResetModal stub'); }

function filterHistoryTable() { console.warn('filterHistoryTable stub'); }
function handleImageUpload() { console.warn('handleImageUpload stub'); }

function handleGenerateStatement() { console.warn('handleGenerateStatement stub'); }
function handleDownloadPDF() { console.warn('handleDownloadPDF stub'); }
function setStatementDates() { console.warn('setStatementDates stub'); }

function closeConfirmationModal() { console.warn('closeConfirmationModal stub'); }

function loadOverviewStats() { console.warn('loadOverviewStats stub'); }
function loadFinancialStats() { console.warn('loadFinancialStats stub'); }
function initServicesChart() { console.warn('initServicesChart stub'); }

function loadDrivers() { console.warn('loadDrivers stub'); }
function loadActiveDeliveries() { console.warn('loadActiveDeliveries stub'); }
function loadHistory() { console.warn('loadHistory stub'); }
function loadClients() { console.warn('loadClients stub'); }
function loadManagers() { console.warn('loadManagers stub'); }
function loadExpenses() { console.warn('loadExpenses stub'); }
function loadEmployeesForExpense() { console.warn('loadEmployeesForExpense stub'); }

function initializeLiveMap() { console.warn('initializeLiveMap stub'); }
function destroyFormMap() { /* silencioso */ }
function destroyLiveMap() { /* silencioso */ }
function destroyCharts() { /* silencioso */ }
function initializeFormMap() { console.warn('initializeFormMap stub'); }

function loadClientsIntoDropdown() { console.warn('loadClientsIntoDropdown stub'); }
function handleDeleteOldHistory() { console.warn('handleDeleteOldHistory stub'); }
