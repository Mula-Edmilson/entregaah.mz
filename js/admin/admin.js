/*
 * Ficheiro: js/admin/admin.js
 * (Atualizado para incluir 'commissionRate' nos formulários)
 */

// ... (Variáveis Globais, DOMContentLoaded - sem alterações) ...
let socket = null;
let clientCache = [];

document.addEventListener('DOMContentLoaded', () => {
    checkAuth('admin'); 
    initializeMapIcons();
    connectSocket(); 
    attachEventListeners();
    showPage('visao-geral', 'nav-visao-geral', 'Visão Geral');
});


function attachEventListeners() {
    // ... (Todos os outros listeners permanecem os mesmos) ...
    document.getElementById('delivery-form').addEventListener('submit', handleNewDelivery);
    document.getElementById('form-add-motorista').addEventListener('submit', handleAddDriver);
    document.getElementById('form-edit-motorista').addEventListener('submit', handleUpdateDriver);
    document.getElementById('form-add-cliente').addEventListener('submit', handleAddClient);
    document.getElementById('form-edit-cliente').addEventListener('submit', handleUpdateClient);
    document.getElementById('form-change-password').addEventListener('submit', handleChangePassword);
    document.getElementById('nav-visao-geral').addEventListener('click', (e) => { e.preventDefault(); showPage('visao-geral', 'nav-visao-geral', 'Visão Geral'); });
    document.getElementById('nav-entregas').addEventListener('click', (e) => { e.preventDefault(); showPage('entregas-activas', 'nav-entregas', 'Entregas Activas'); });
    document.getElementById('nav-motoristas').addEventListener('click', (e) => { e.preventDefault(); showPage('gestao-motoristas', 'nav-motoristas', 'Gestão de Motoristas'); });
    document.getElementById('nav-clientes').addEventListener('click', (e) => { e.preventDefault(); showPage('gestao-clientes', 'nav-clientes', 'Gestão de Clientes'); });
    document.getElementById('nav-historico').addEventListener('click', (e) => { e.preventDefault(); showPage('historico', 'nav-historico', 'Histórico'); });
    document.getElementById('nav-mapa').addEventListener('click', (e) => { e.preventDefault(); showPage('mapa-tempo-real', 'nav-mapa', 'Mapa em Tempo Real'); });
    document.getElementById('nav-form-doc').addEventListener('click', (e) => { e.preventDefault(); showServiceForm('doc'); });
    document.getElementById('nav-form-farma').addEventListener('click', (e) => { e.preventDefault(); showServiceForm('farma'); });
    document.getElementById('nav-form-carga').addEventListener('click', (e) => { e.preventDefault(); showServiceForm('carga'); });
    document.getElementById('nav-form-rapido').addEventListener('click', (e) => { e.preventDefault(); showServiceForm('rapido'); });
    document.getElementById('nav-form-outros').addEventListener('click', (e) => { e.preventDefault(); showServiceForm('outros'); });
    document.getElementById('nav-config').addEventListener('click', (e) => { e.preventDefault(); showPage('configuracoes', 'nav-config', 'Configurações'); });
    document.getElementById('admin-logout').addEventListener('click', (e) => { e.preventDefault(); handleLogout('admin'); });
    document.getElementById('btn-reset-chart').addEventListener('click', openChartResetModal);
    document.getElementById('btn-confirm-chart-reset').addEventListener('click', handleChartReset);
    document.getElementById('btn-close-chart-reset').addEventListener('click', closeChartResetModal);
    document.getElementById('btn-cancel-chart-reset').addEventListener('click', closeChartResetModal);
    document.getElementById('history-search-input').addEventListener('input', filterHistoryTable);
    document.getElementById('delivery-image').addEventListener('change', handleImageUpload);
    document.getElementById('delivery-client-select').addEventListener('change', handleClientSelect);
    document.getElementById('btn-generate-statement').addEventListener('click', handleGenerateStatement);
    document.getElementById('btn-download-pdf').addEventListener('click', handleDownloadPDF);
    document.querySelectorAll('.btn-set-date').forEach(btn => {
        btn.addEventListener('click', () => setStatementDates(btn.dataset.range));
    });
    document.getElementById('btn-delete-old-history').addEventListener('click', handleDeleteOldHistoryClick);
    document.getElementById('btn-close-confirmation-modal').addEventListener('click', closeConfirmationModal);
    document.getElementById('btn-cancel-confirmation-modal').addEventListener('click', closeConfirmationModal);
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


// ... (showPage, showServiceForm, connectSocket, API GET Functions - sem alterações) ...
function showPage(pageId, navId, title) {
    destroyFormMap();
    destroyLiveMap();
    destroyCharts();       
    document.querySelectorAll('.content-page').forEach(page => page.classList.add('hidden'));
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => item.classList.remove('active'));
    const pageToShow = document.getElementById(pageId);
    if (pageToShow) pageToShow.classList.remove('hidden');
    const navLink = document.getElementById(navId);
    if (navLink) navLink.classList.add('active');
    document.getElementById('main-title').innerText = title;
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
            initializeLiveMap();
            break;
        case 'configuracoes':
            document.getElementById('form-change-password').reset();
            break;
    }
}
function showServiceForm(serviceType) {
    const titles = {
        'doc': 'Nova Tramitação de Documentos',
        'farma': 'Novo Pedido Farmacêutico',
        'carga': 'Novo Transporte de Carga',
        'rapido': 'Novo Delivery Rápido',
        'outros': 'Outros Serviços'
    };
    showPage('form-nova-entrega', null, titles[serviceType] || 'Nova Entrega');
    document.getElementById('service-type').value = serviceType;
    removeImage();
    resetDeliveryForm();
    loadClientsIntoDropdown();
    setTimeout(initializeFormMap, 100);
}
function connectSocket() {
    const token = getAuthToken();
    if (!token) return;
    socket = io(API_URL, { auth: { token: token } });
    socket.on('connect', () => {
        console.log('Conectado ao servidor Socket.io com ID:', socket.id);
        socket.emit('admin_join_room');
    });
    const activePage = () => {
        const page = document.querySelector('.content-page:not(.hidden)');
        return page ? page.id : null;
    };
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
    socket.on('driver_location_broadcast', (data) => {
        updateDriverMarker(data);
    });
    socket.on('driver_disconnected_broadcast', (data) => {
        removeDriverMarker(data);
    });
}
async function loadOverviewStats() {
    try {
        const response = await fetch(`${API_URL}/api/stats/overview`, { headers: getAuthHeaders() });
        if (response.status === 401) {
            console.error('Token inválido ou expirado. A forçar logout.');
            showCustomAlert('Sessão Expirada', 'A sua sessão é inválida ou expirou. Por favor, faça login novamente.', 'error');
            setTimeout(() => handleLogout('admin'), 2500);
            return;
        }
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
async function loadDrivers() {
    const tableBody = document.getElementById('drivers-table-body');
    tableBody.innerHTML = '<tr><td colspan="5">A carregar...</td></tr>';
    try {
        const response = await fetch(`${API_URL}/api/drivers`, { method: 'GET', headers: getAuthHeaders() });
        if (response.status === 401) { return handleLogout('admin'); }
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        tableBody.innerHTML = '';
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
            const duracao = formatDuration(order.timestamp_started, order.timestamp_completed);
            const serviceName = SERVICE_NAMES[order.service_type] || order.service_type;
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
async function loadClientsIntoDropdown() {
    const select = document.getElementById('delivery-client-select');
    select.innerHTML = '<option value="">A carregar clientes...</option>';
    try {
        const response = await fetch(`${API_URL}/api/clients`, { headers: getAuthHeaders() });
        if (response.status === 401) { 
            select.innerHTML = '<option value="">-- Erro de Sessão --</option>';
            return handleLogout('admin');
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        clientCache = data.clients;
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


/* --- Lógica de API (POST/PUT/DELETE) --- */

async function handleChangePassword(e) {
    // ... (Esta função permanece a mesma) ...
    e.preventDefault();
    const form = e.target;
    const senhaAntiga = document.getElementById('admin-pass-antiga').value;
    const senhaNova = document.getElementById('admin-pass-nova').value;
    const senhaConfirmar = document.getElementById('admin-pass-confirmar').value;
    if (senhaNova !== senhaConfirmar) {
        showCustomAlert('Erro', 'As novas senhas não coincidem.', 'error');
        return;
    }
    if (senhaNova.length < 6) {
        showCustomAlert('Erro', 'A nova senha deve ter pelo menos 6 caracteres.', 'error');
        return;
    }
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
            handleLogout('admin');
        }, 2500);
    } catch (error) {
        console.error('Falha ao mudar a senha:', error);
        showCustomAlert('Erro', error.message, 'error');
    }
}

function handleDeleteOldHistoryClick() {
    // ... (Esta função permanece a mesma) ...
    const confirmWord = 'APAGAR';
    openConfirmationModal({
        title: "Apagar Histórico Antigo?",
        message: `Esta ação é irreversível. Todas as encomendas concluídas com mais de 30 dias serão permanentemente apagadas.\n\nPara confirmar, digite <b>${confirmWord}</b> no campo abaixo.`,
        confirmText: confirmWord,
        onConfirm: handleDeleteOldHistory
    });
}

async function handleDeleteOldHistory() {
    // ... (Esta função permanece a mesma) ...
    const btn = document.getElementById('btn-confirm-action');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A apagar...';
    try {
        const response = await fetch(`${API_URL}/api/admin/orders/history`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message);
        }
        closeConfirmationModal();
        showCustomAlert('Sucesso', data.message, 'success');
        if(document.getElementById('historico').classList.contains('hidden') === false) {
            loadHistory();
        }
    } catch (error) {
        console.error('Falha ao apagar histórico:', error);
        showCustomAlert('Erro', error.message, 'error');
        btn.disabled = false;
        btn.innerHTML = 'Confirmar e Apagar';
    }
}


async function handleNewDelivery(e) {
    // ... (Esta função permanece a mesma) ...
    e.preventDefault(); const form = e.target; const formData = new FormData(form); try { const response = await fetch(`${API_URL}/api/orders`, { method: 'POST', headers: getAuthHeaders(), body: formData }); const data = await response.json(); if (!response.ok) { throw new Error(data.message || 'Erro do servidor'); } showCustomAlert('Sucesso!', `Pedido Criado! \nCódigo do Destinatário: ${data.order.verification_code}`, 'success'); form.reset(); removeImage(); destroyFormMap(); showPage('entregas-activas', 'nav-entregas', 'Entregas Activas'); } catch (error) { console.error('Falha ao criar entrega:', error); showCustomAlert('Erro', error.message, 'error'); } 
}

/**
 * Submete o formulário de adicionar motorista.
 * (MUDANÇA AQUI)
 */
async function handleAddDriver(e) {
    e.preventDefault();
    const name = document.getElementById('driver-name').value;
    const phone = document.getElementById('driver-phone').value;
    const email = document.getElementById('driver-email').value;
    const plate = document.getElementById('driver-plate').value;
    const password = document.getElementById('driver-password').value;
    
    // (MUDANÇA) Ler o novo campo de comissão
    const commissionRate = document.getElementById('driver-commission').value;
    
    if (password.length < 6) {
        showCustomAlert('Atenção', 'A senha do motorista deve ter pelo menos 6 caracteres.');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/auth/register-driver`, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            // (MUDANÇA) Enviar 'commissionRate' para a API
            body: JSON.stringify({ 
                nome: name, 
                email, 
                telefone: phone, 
                password, 
                vehicle_plate: plate,
                commissionRate: commissionRate // <-- NOVO
            })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        showCustomAlert('Sucesso', 'Motorista adicionado com sucesso!', 'success');
        e.target.reset();
        showAddDriverForm(false);
        loadDrivers();
        
    } catch (error) {
        console.error('Falha ao adicionar motorista:', error);
        showCustomAlert('Erro', error.message, 'error');
    }
}

/**
 * Submete o formulário de atualização de motorista (do modal).
 * (MUDANÇA AQUI)
 */
async function handleUpdateDriver(event) {
    event.preventDefault();
    const userId = document.getElementById('edit-driver-id').value;
    
    // (MUDANÇA) Ler o novo campo de comissão
    const updatedData = {
        nome: document.getElementById('edit-driver-name').value,
        telefone: document.getElementById('edit-driver-phone').value,
        vehicle_plate: document.getElementById('edit-driver-plate').value,
        status: document.getElementById('edit-driver-status').value,
        commissionRate: document.getElementById('edit-driver-commission').value // <-- NOVO
    };
    
    try {
        const response = await fetch(`${API_URL}/api/drivers/${userId}`, { 
            method: 'PUT', 
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, 
            body: JSON.stringify(updatedData) // (MUDANÇA) Enviar 'updatedData'
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        showCustomAlert('Sucesso', 'Motorista atualizado com sucesso!', 'success');
        closeEditDriverModal();
        loadDrivers();
        
    } catch (error) {
        console.error('Falha ao atualizar motorista:', error);
        showCustomAlert('Erro', error.message, 'error');
    }
}

// ... (handleAddClient, handleUpdateClient, handleDeleteClient, confirmAssign, handleChartReset, handleGenerateStatement - sem alterações) ...
async function handleAddClient(e) { e.preventDefault(); const clientData = { nome: document.getElementById('client-nome').value, telefone: document.getElementById('client-telefone').value, empresa: document.getElementById('client-empresa').value, email: document.getElementById('client-email').value, nuit: document.getElementById('client-nuit').value, endereco: document.getElementById('client-endereco').value }; if (!clientData.nome || !clientData.telefone) { showCustomAlert('Atenção', 'Nome e Telefone são obrigatórios.', 'error'); return; } try { const response = await fetch(`${API_URL}/api/clients`, { method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(clientData) }); const data = await response.json(); if (!response.ok) throw new Error(data.message); showCustomAlert('Sucesso', 'Cliente adicionado com sucesso!', 'success'); showAddClientForm(false); loadClients(); } catch (error) { console.error('Falha ao adicionar cliente:', error); showCustomAlert('Erro', error.message, 'error'); } }
async function handleUpdateClient(e) { e.preventDefault(); const clientId = document.getElementById('edit-client-id').value; const updatedData = { nome: document.getElementById('edit-client-nome').value, telefone: document.getElementById('edit-client-telefone').value, empresa: document.getElementById('edit-client-empresa').value, email: document.getElementById('edit-client-email').value, nuit: document.getElementById('edit-client-nuit').value, endereco: document.getElementById('edit-client-endereco').value }; if (!updatedData.nome || !updatedData.telefone) { showCustomAlert('Atenção', 'Nome e Telefone são obrigatórios.', 'error'); return; } try { const response = await fetch(`${API_URL}/api/clients/${clientId}`, { method: 'PUT', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(updatedData) }); const data = await response.json(); if (!response.ok) throw new Error(data.message); showCustomAlert('Sucesso', 'Cliente atualizado com sucesso!', 'success'); closeEditClientModal(); loadClients(); } catch (error) { console.error('Falha ao atualizar cliente:', error); showCustomAlert('Erro', error.message, 'error'); } }
async function handleDeleteClient(clientId, clientName) { if (!confirm(`Tem a certeza que quer apagar o cliente "${clientName}"?\nEsta ação não pode ser revertida.`)) { return; } try { const response = await fetch(`${API_URL}/api/clients/${clientId}`, { method: 'DELETE', headers: getAuthHeaders() }); const data = await response.json(); if (!response.ok) throw new Error(data.message); showCustomAlert('Sucesso', data.message, 'success'); loadClients(); } catch (error) { console.error('Falha ao apagar cliente:', error); showCustomAlert('Erro', error.message, 'error'); } }
async function confirmAssign(orderId, driverId) { try { const response = await fetch(`${API_URL}/api/orders/${orderId}/assign`, { method: 'PUT', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ driverId }) }); const data = await response.json(); if (!response.ok) throw new Error(data.message); showCustomAlert('Sucesso', 'Encomenda atribuída com sucesso!', 'success'); closeAssignModal(); loadActiveDeliveries(); } catch (error) { console.error('Falha ao atribuir encomenda:', error); showCustomAlert('Erro', error.message, 'error'); } }
function handleChartReset() { const password = document.getElementById('chart-reset-password').value; if (password === 'Entregaah.wipe') { console.log('SIMULAÇÃO: A chamar API para resetar estatísticas...'); showCustomAlert('Sucesso', 'As estatísticas foram resetadas! (Simulação)', 'success'); closeChartResetModal(); initServicesChart(true); } else { showCustomAlert('Erro', 'Senha de reset incorreta.', 'error'); } }
async function handleGenerateStatement() { const clientId = document.getElementById('statement-client-id').value; const startDate = document.getElementById('statement-start-date').value; const endDate = document.getElementById('statement-end-date').value; if (!startDate || !endDate) { showCustomAlert('Erro', 'Por favor, selecione uma data de início e uma data de fim.', 'error'); return; } const resultsDiv = document.getElementById('statement-results'); resultsDiv.classList.add('hidden'); try { showCustomAlert('A Gerar...', 'A buscar os dados do extrato.', 'info'); const response = await fetch(`${API_URL}/api/clients/${clientId}/statement?startDate=${startDate}&endDate=${endDate}`, { headers: getAuthHeaders() }); const data = await response.json(); if (!response.ok) throw new Error(data.message); closeCustomAlert(); populateStatementModal(data, startDate, endDate); } catch (error) { console.error('Falha ao gerar extrato:', error); showCustomAlert('Erro', error.message, 'error'); } }


/* --- Lógica de Abertura de Modais --- */

function openConfirmationModal({ title, message, confirmText, onConfirm }) {
    // ... (Esta função permanece a mesma) ...
    const modal = document.getElementById('confirmation-modal');
    document.getElementById('confirmation-title').innerHTML = title;
    document.getElementById('confirmation-message').innerHTML = message;
    const input = document.getElementById('confirmation-input');
    const label = document.getElementById('confirmation-input-label');
    const confirmBtn = document.getElementById('btn-confirm-action');
    label.innerHTML = `Para confirmar, digite a palavra: <b>${confirmText}</b>`;
    input.value = '';
    confirmBtn.disabled = true;
    input.oninput = null;
    confirmBtn.onclick = null;
    input.oninput = () => {
        if (input.value.toUpperCase() === confirmText) {
            confirmBtn.disabled = false;
        } else {
            confirmBtn.disabled = true;
        }
    };
    confirmBtn.onclick = () => {
        onConfirm();
    };
    modal.classList.remove('hidden');
}

async function openAssignModal(orderId) { 
    // ... (Esta função permanece a mesma) ...
    const modal = document.getElementById('assign-modal'); modal.classList.remove('hidden'); document.getElementById('modal-order-id').innerText = `#${orderId.slice(-6)}`; const select = document.getElementById('driver-select-dropdown'); select.innerHTML = '<option value="">A carregar...</option>'; try { const response = await fetch(`${API_URL}/api/drivers/available`, { headers: getAuthHeaders() }); if (response.status === 401) { return handleLogout('admin'); } const data = await response.json(); if (!response.ok) throw new Error(data.message); if (data.drivers.length === 0) { select.innerHTML = '<option value="">Nenhum motorista disponível</option>'; return; } select.innerHTML = '<option value="">-- Selecione um motorista --</option>'; data.drivers.forEach(driver => { select.innerHTML += `<option value="${driver.profile._id}">${driver.nome} (${driver.profile.vehicle_plate})</option>`; }); document.getElementById('btn-confirm-assign').onclick = async () => { const driverId = select.value; if (!driverId) { showCustomAlert('Atenção', 'Por favor, selecione um motorista.'); return; } await confirmAssign(orderId, driverId); }; } catch (error) { console.error('Falha ao carregar motoristas disponíveis:', error); select.innerHTML = '<option value="">Erro ao carregar</option>'; } 
}

/**
 * Abre o modal de edição de motorista e carrega os seus dados.
 * (MUDANÇA AQUI)
 */
async function openEditDriverModal(driverUserId) {
    const modal = document.getElementById('edit-driver-modal');
    modal.classList.remove('hidden');
    document.getElementById('edit-driver-id').value = driverUserId;
    
    // Mostra feedback de carregamento
    document.getElementById('edit-driver-name').value = 'A carregar...';
    document.getElementById('edit-driver-phone').value = 'A carregar...';
    
    try {
        const response = await fetch(`${API_URL}/api/drivers/${driverUserId}`, { headers: getAuthHeaders() });
        if (response.status === 401) { return handleLogout('admin'); }

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        const driver = data.driver;
        const profile = driver.profile || {};
        
        // (MUDANÇA) Preenche o novo campo de comissão
        document.getElementById('edit-driver-name').value = driver.nome;
        document.getElementById('edit-driver-phone').value = driver.telefone;
        document.getElementById('edit-driver-plate').value = profile.vehicle_plate || '';
        document.getElementById('edit-driver-status').value = profile.status || 'offline';
        document.getElementById('edit-driver-commission').value = profile.commissionRate || 20; // <-- NOVO
        
    } catch (error) { 
        console.error('Falha ao carregar dados do motorista:', error); 
        showCustomAlert('Erro', 'Erro ao carregar dados do motorista.', 'error'); 
        closeEditDriverModal(); 
    }
}

// ... (openHistoryDetailModal, openDriverReportModal, openEditClientModal, openStatementModal - sem alterações) ...
async function openHistoryDetailModal(orderId) { const modal = document.getElementById('history-detail-modal'); const body = document.getElementById('history-modal-body'); modal.classList.remove('hidden'); document.getElementById('history-modal-id').innerText = `#${orderId.slice(-6)}`; body.innerHTML = '<p>A carregar detalhes...</p>'; try { const response = await fetch(`${API_URL}/api/orders/${orderId}`, { headers: getAuthHeaders() }); if (response.status === 401) { return handleLogout('admin'); } const data = await response.json(); if (!response.ok) throw new Error(data.message); const order = data.order; const motorista = order.assigned_to_driver ? order.assigned_to_driver.user.nome : 'N/D'; const admin = order.created_by_admin ? order.created_by_admin.nome : 'N/D'; let coordsHtml = '<p><strong>Pin do Mapa:</strong> N/D</p>'; if (order.address_coords && order.address_coords.lat) { coordsHtml = `<p><strong>Pin do Mapa:</strong> ${order.address_coords.lat.toFixed(5)}, ${order.address_coords.lng.toFixed(5)}</p>`; } body.innerHTML = ` <p><strong>Cliente:</strong> ${order.client_name}</p> <p><strong>Telefone:</strong> ${order.client_phone1}</p> <p><strong>Endereço:</strong> ${order.address_text || 'N/D'}</p> ${coordsHtml} <p><strong>Valor:</strong> ${order.price ? order.price.toFixed(2) + ' MZN' : 'N/D'}</p> <p><strong>Natureza:</strong> ${SERVICE_NAMES[order.service_type] || order.service_type}</p> <p><strong>Status:</strong> ${order.status}</p> <p><strong>Código:</strong> ${order.verification_code}</p> <p><strong>Motorista:</strong> ${motorista}</p> <p><strong>Admin:</strong> ${admin}</p> <p><strong>Criado em:</strong> ${new Date(order.timestamp_created).toLocaleString('pt-MZ')}</p> <p><strong>Iniciado em:</strong> ${order.timestamp_started ? new Date(order.timestamp_started).toLocaleString('pt-MZ') : 'N/D'}</p> <p><strong>Concluído em:</strong> ${order.timestamp_completed ? new Date(order.timestamp_completed).toLocaleString('pt-MZ') : 'N/D'}</p> <p><strong>Duração:</strong> ${formatDuration(order.timestamp_started, order.timestamp_completed)}</p> `; } catch (error) { console.error('Falha ao carregar detalhes do histórico:', error); body.innerHTML = '<p>Erro ao carregar detalhes.</p>'; } }
async function openDriverReportModal(driverUserId, driverName) { const modal = document.getElementById('driver-report-modal'); modal.classList.remove('hidden'); document.getElementById('driver-report-title').innerText = `Relatório de ${driverName}`; document.getElementById('report-total-entregas').innerText = '...'; document.getElementById('report-total-duracao').innerText = '...'; const tableBody = document.getElementById('driver-report-table-body'); tableBody.innerHTML = '<tr><td colspan="5">A carregar relatório...</td></tr>'; try { const response = await fetch(`${API_URL}/api/drivers/${driverUserId}/report`, { headers: getAuthHeaders() }); if (response.status === 401) { return handleLogout('admin'); } const data = await response.json(); if (!response.ok) throw new Error(data.message); const orders = data.orders; let totalMs = 0; orders.forEach(order => { if (order.timestamp_started && order.timestamp_completed) { totalMs += (new Date(order.timestamp_completed) - new Date(order.timestamp_started)); } }); document.getElementById('report-total-entregas').innerText = orders.length; document.getElementById('report-total-duracao').innerText = formatTotalDuration(totalMs); tableBody.innerHTML = ''; if (orders.length === 0) { tableBody.innerHTML = '<tr><td colspan="5">Nenhuma entrega concluída encontrada.</td></tr>'; return; } orders.forEach(order => { const serviceName = SERVICE_NAMES[order.service_type] || order.service_type; tableBody.innerHTML += ` <tr> <td>#${order._id.slice(-6)}</td> <td>${order.client_name}</td> <td>${serviceName}</td> <td>${new Date(order.timestamp_completed).toLocaleDateString('pt-MZ')}</td> <td>${formatDuration(order.timestamp_started, order.timestamp_completed)}</td> </tr> `; }); } catch (error) { console.error('Falha ao carregar relatório do motorista:', error); tableBody.innerHTML = '<tr><td colspan="5">Erro ao carregar relatório.</td></tr>'; } }
async function openEditClientModal(clientId) { const modal = document.getElementById('edit-client-modal'); modal.classList.remove('hidden'); try { const response = await fetch(`${API_URL}/api/clients/${clientId}`, { headers: getAuthHeaders() }); if (response.status === 401) { return handleLogout('admin'); } const data = await response.json(); if (!response.ok) throw new Error(data.message); const client = data.client; document.getElementById('edit-client-id').value = client._id; document.getElementById('edit-client-nome').value = client.nome; document.getElementById('edit-client-telefone').value = client.telefone; document.getElementById('edit-client-empresa').value = client.empresa || ''; document.getElementById('edit-client-email').value = client.email || ''; document.getElementById('edit-client-nuit').value = client.nuit || ''; document.getElementById('edit-client-endereco').value = client.endereco || ''; } catch (error) { console.error('Falha ao carregar dados do cliente:', error); showCustomAlert('Erro', 'Erro ao carregar dados do cliente.', 'error'); closeEditClientModal(); } }
function openStatementModal(clientId, clientName) { const modal = document.getElementById('statement-modal'); document.getElementById('statement-client-name').textContent = `Extrato de ${clientName}`; document.getElementById('statement-client-id').value = clientId; document.getElementById('statement-results').classList.add('hidden'); document.getElementById('statement-table-body').innerHTML = ''; document.getElementById('statement-start-date').value = ''; document.getElementById('statement-end-date').value = ''; modal.classList.remove('hidden'); }

// ... (handleClientSelect, resetDeliveryForm, populateStatementModal, handleDownloadPDF - sem alterações) ...
function handleClientSelect(e) { const selectedClientId = e.target.value; const client = clientCache.find(c => c._id === selectedClientId); if (client) { document.getElementById('client-name').value = client.nome; document.getElementById('client-phone1').value = client.telefone; document.getElementById('client-phone2').value = ''; document.getElementById('delivery-client-id').value = client._id; document.getElementById('client-name').readOnly = true; document.getElementById('client-phone1').readOnly = true; } else { resetDeliveryForm(); } }
function resetDeliveryForm() { document.getElementById('delivery-form').reset(); document.getElementById('delivery-client-id').value = ''; document.getElementById('client-name').readOnly = false; document.getElementById('client-phone1').readOnly = false; }
function populateStatementModal(data, startDate, endDate) { const { totalValue, totalOrders, ordersList } = data; const formattedTotal = new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(totalValue); document.getElementById('statement-total-value').textContent = formattedTotal; document.getElementById('statement-total-orders').textContent = `${totalOrders} Pedidos`; const start = new Date(startDate + 'T00:00:00Z').toLocaleDateString('pt-MZ', { timeZone: 'UTC' }); const end = new Date(endDate + 'T00:00:00Z').toLocaleDateString('pt-MZ', { timeZone: 'UTC' }); document.getElementById('statement-date-range').textContent = `Pedidos Concluídos de ${start} a ${end}`; const tableBody = document.getElementById('statement-table-body'); tableBody.innerHTML = ''; if (ordersList.length === 0) { tableBody.innerHTML = '<tr><td colspan="4">Nenhum pedido concluído neste período.</td></tr>'; } else { ordersList.forEach(order => { tableBody.innerHTML += ` <tr> <td>${new Date(order.timestamp_completed).toLocaleDateString('pt-MZ')}</td> <td>#${order._id.slice(-6)}</td> <td>${SERVICE_NAMES[order.service_type] || order.service_type}</td> <td>${order.price.toFixed(2)} MZN</td> </tr> `; }); } document.getElementById('statement-results').classList.remove('hidden'); }
function handleDownloadPDF() { try { const { jsPDF } = window.jspdf; const doc = new jsPDF(); const clientName = document.getElementById('statement-client-name').textContent; const cleanClientName = clientName.replace('Extrato de ', ''); const dateRange = document.getElementById('statement-date-range').textContent; const totalValue = document.getElementById('statement-total-value').textContent; const totalOrders = document.getElementById('statement-total-orders').textContent; doc.setFontSize(18); doc.text('Extrato de Conta de Cliente', 14, 22); doc.setFontSize(11); doc.setTextColor(100); doc.text(`Cliente: ${cleanClientName}`, 14, 32); doc.text(`Período: ${dateRange}`, 14, 38); doc.setFontSize(12); doc.setTextColor(0); doc.text(`Total de Pedidos: ${totalOrders}`, 14, 50); doc.text(`Valor Total Gasto: ${totalValue}`, 14, 56); doc.autoTable({ html: '#statement-results .table-pedidos', startY: 65, theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [44, 62, 80] } }); doc.save(`Extrato_${cleanClientName.replace(/ /g, '_')}.pdf`); } catch (error) { console.error('Erro ao gerar PDF:', error); showCustomAlert('Erro', 'Não foi possível gerar o PDF. Tente novamente.', 'error'); } }