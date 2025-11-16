/*
 * Ficheiro: js/admin/admin.js (REFATORADO E CORRIGIDO)
 *
 * Este é o ficheiro "controlador" principal.
 * Ele gere a navegação, os event listeners e os sockets.
 *
 * ESTA VERSÃO CONTÉM AS FUNÇÕES "HANDLER" QUE FALTAVAM
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
        // A função loadManagers() não foi fornecida, pode causar erro
        // loadManagers(); 
    });

    document.getElementById('nav-custos').addEventListener('click', (e) => {
        e.preventDefault();
        showPage('gestao-custos', 'nav-custos', 'Custos');
        // As funções loadExpenses() e loadEmployeesForExpense() não foram fornecidas
        // loadExpenses();
        // loadEmployeesForExpense();
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
    
    // A função filterHistoryTable não foi fornecida. Se existir, ótimo. Senão, pode ser um erro futuro.
    // document.getElementById('history-search-input').addEventListener('input', filterHistoryTable); 
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
            // CORRIGIDO: usa fetchStats() de adminApi.js
            fetchStats(); 
            // Assumindo que fetchStats() também carrega os dados financeiros
            initServicesChart(false);
            break;
        case 'gestao-motoristas':
            // CORRIGIDO: de loadDrivers() para fetchDrivers()
            fetchDrivers();
            break;
        case 'entregas-activas':
            // CORRIGIDO: de loadActiveDeliveries() para fetchActiveOrders()
            fetchActiveOrders();
            break;
        case 'historico':
            // CORRIGIDO: de loadHistory() para fetchOrderHistory()
            fetchOrderHistory();
            break;
        case 'gestao-clientes':
            // CORRIGIDO: de loadClients() para fetchClients()
            fetchClients();
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
    
    // CORRIGIDO: Esta função chama fetchClients() e depois preenche o dropdown
    loadClientsIntoDropdown(); 
    
    // Atraso para garantir que o elemento #map está visível antes de inicializar
    setTimeout(initializeFormMap, 100); // (adminMap.js)
}

/**
 * Carrega clientes e preenche o dropdown do formulário.
 */
async function loadClientsIntoDropdown() {
    try {
        const response = await apiRequest('/admin/clients', 'GET'); //
        
        if (response && response.clients) {
            clientCache = response.clients; // Armazena o cache
            
            const select = document.getElementById('delivery-client-select');
            if (!select) return;

            select.innerHTML = '<option value="">-- Ou digite manualmente abaixo --</option>';

            response.clients.forEach(client => { //
                const option = document.createElement('option');
                option.value = client._id;
                option.textContent = `${client.nome} - ${client.telefone}`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erro ao buscar clientes para dropdown:', error);
    }
}


/* --- Lógica de Socket.IO --- */
function connectSocket() {
    const token = getAuthToken(); // (auth.js)
    if (!token) return;
    
    // Assegure que API_URL está definida (provavelmente noutro ficheiro como api.js)
    if (typeof API_URL === 'undefined') {
        console.error("API_URL não está definida. A conexão socket falhará.");
        return;
    }
    
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
        if (activePage() === 'entregas-activas') fetchActiveOrders(); // Corrigido
        if (activePage() === 'visao-geral') { fetchStats(); } // Corrigido
    });
    
    socket.on('delivery_completed', (order) => {
        if (activePage() === 'entregas-activas') fetchActiveOrders(); // Corrigido
        if (activePage() === 'historico') fetchOrderHistory(); // Corrigido
        if (activePage() === 'visao-geral') { fetchStats(); } // Corrigido
    });
    
    socket.on('driver_status_changed', (data) => {
         if (activePage() === 'gestao-motoristas') fetchDrivers(); // Corrigido
         if (activePage() === 'visao-geral') fetchStats(); // Corrigido
    });

    // Listeners do Mapa em Tempo Real (chamam funções do adminMap.js)
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
        onConfirm: () => {
             // Esta função 'handleDeleteOldHistory' não estava no seu adminApi.js.
             // Adicionei uma chamada genérica 'apiRequest' baseada no seu adminController.js
             
             apiRequest('/admin/orders/history/old', 'DELETE')
                .then(response => {
                    showCustomAlert('Sucesso', response.message || 'Histórico antigo apagado.');
                })
                .catch(err => {
                    showCustomAlert('Erro', err.message || 'Não foi possível apagar o histórico.');
                });
        }
    });
}

/************************************************************************
 * NOVAS FUNÇÕES HANDLER (para corrigir erros '... is not defined')
 ************************************************************************/

/**
 * Handler para submissão do formulário de nova entrega.
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
            
            // Após criar, volta para a página de entregas activas
            showPage('entregas-activas', 'nav-entregas', 'Entregas Activas');
        }
    } catch (err) {
        console.error('Erro ao criar pedido:', err);
        // showCustomAlert já é chamado dentro de createOrder em caso de erro
    }
}

/**
 * Handler para adicionar novo motorista.
 */
async function handleAddDriver(event) {
    event.preventDefault();
    const driverData = {
        nome: document.getElementById('driver-name').value,
        telefone: document.getElementById('driver-phone').value,
        email: document.getElementById('driver-email').value,
        password: document.getElementById('driver-password').value,
        vehicle_plate: document.getElementById('driver-plate').value,
        commission_rate: document.getElementById('driver-commission').value,
    };
    await addDriver(driverData); // Chama a função de adminApi.js
    document.getElementById('form-add-motorista').reset();
}

/**
 * Handler para atualizar motorista.
 */
async function handleUpdateDriver(event) {
    event.preventDefault();
    const driverId = document.getElementById('edit-driver-id').value;
    const driverData = {
        nome: document.getElementById('edit-driver-name').value,
        telefone: document.getElementById('edit-driver-phone').value,
        vehicle_plate: document.getElementById('edit-driver-plate').value,
        commission_rate: document.getElementById('edit-driver-commission').value,
        status: document.getElementById('edit-driver-status').value,
    };
    await updateDriver(driverId, driverData); // Chama a função de adminApi.js
}

/**
 * Handler para adicionar novo cliente.
 */
async function handleAddClient(event) {
    event.preventDefault();
    const clientData = {
        nome: document.getElementById('client-nome').value,
        telefone: document.getElementById('client-telefone').value,
        empresa: document.getElementById('client-empresa').value,
        email: document.getElementById('client-email').value,
        nuit: document.getElementById('client-nuit').value,
        endereco: document.getElementById('client-endereco').value,
    };
    await addClient(clientData); // Chama a função de adminApi.js
    document.getElementById('form-add-cliente').reset();
}

/**
 * Handler para atualizar cliente.
 */
async function handleUpdateClient(event) {
    event.preventDefault();
    const clientId = document.getElementById('edit-client-id').value;
    const clientData = {
        nome: document.getElementById('edit-client-nome').value,
        telefone: document.getElementById('edit-client-telefone').value,
        empresa: document.getElementById('edit-client-empresa').value,
        email: document.getElementById('edit-client-email').value,
        nuit: document.getElementById('edit-client-nuit').value,
        endereco: document.getElementById('edit-client-endereco').value,
    };
    await updateClient(clientId, clientData); // Chama a função de adminApi.js
}

/* --- Handlers Placeholder (para evitar erros de 'not defined') --- */
// Estas funções não farão nada, mas evitarão que o script falhe
// Você precisará carregar os ficheiros (adminManagers.js, etc.) ou implementar a lógica

function handleChangePassword(event) {
    event.preventDefault();
    console.warn("Handler 'handleChangePassword' não implementado.");
    showCustomAlert("Função não implementada", "A alteração de senha ainda não foi implementada.");
}

function handleAddManager(event) {
    event.preventDefault();
    console.warn("Handler 'handleAddManager' não implementado. Verifique se adminManagers.js está carregado.");
    showCustomAlert("Função não implementada", "A adição de gestores ainda não foi implementada.");
}

function handleEditManager(event) {
    event.preventDefault();
    console.warn("Handler 'handleEditManager' não implementado. Verifique se adminManagers.js está carregado.");
}

function handleAddExpense(event) {
    event.preventDefault();
    console.warn("Handler 'handleAddExpense' não implementado. Verifique se adminExpenses.js está carregado.");
    showCustomAlert("Função não implementada", "A adição de despesas ainda não foi implementada.");
}

// Funções que faltam de outros ficheiros, mas são chamadas no HTML/JS
// Adicionar placeholders para que não falhem
function openChartResetModal() { console.warn('openChartResetModal não definida'); }
function handleChartReset() { console.warn('handleChartReset não definida'); }
function closeChartResetModal() { console.warn('closeChartResetModal não definida'); }
function handleImageUpload() { console.warn('handleImageUpload não definida'); }
function handleGenerateStatement() { console.warn('handleGenerateStatement não definida'); }
function handleDownloadPDF() { console.warn('handleDownloadPDF não definida'); }
function setStatementDates() { console.warn('setStatementDates não definida'); }
function closeConfirmationModal() { console.warn('closeConfirmationModal não definida'); }
function handleLogout() { console.warn('handleLogout não definida'); }

/**
 * ✅ NOVA FUNÇÃO
 * Define as datas de início e fim no modal de extrato.
 * @param {string} range - 'this_week' ou 'this_month'
 */
function setStatementDates(range) {
    const startDateInput = document.getElementById('statement-start-date');
    const endDateInput = document.getElementById('statement-end-date');
    const today = new Date();
    let startDate = new Date();

    if (range === 'this_week') {
        const dayOfWeek = today.getDay(); // 0=Domingo, 1=Segunda...
        // Define o início da semana como Segunda-feira (1)
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        startDate = new Date(today.setDate(diff));
    } else if (range === 'this_month') {
        startDate = new Date(today.getFullYear(), today.getMonth(), 1); // Primeiro dia do mês
    }

    startDateInput.value = toISODate(startDate);
    endDateInput.value = toISODate(today);
}

/**
 * ✅ NOVA FUNÇÃO AUXILIAR
 * Converte um objeto Date para o formato YYYY-MM-DD.
 * @param {Date} date - O objeto de data.
 * @returns {string} - A data formatada.
 */
function toISODate(date) {
    return date.toISOString().split('T')[0];
}
