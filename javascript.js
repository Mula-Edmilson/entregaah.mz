/* --- Configuração Global --- */
const API_URL = 'http://localhost:3000';

let socket = null;
let myServicesChart = null;
let map = null; // Variável global para o mapa do formulário
let mapMarker = null; // Variável global para o pin do formulário

// (NOVO) Variáveis para o mapa de rastreamento em tempo real
let liveMap = null; // Variável global para o mapa em tempo real
let driverMarkers = {}; // Objeto para guardar os marcadores dos motoristas { driverId: marker }

const serviceNames = {
    'doc': 'Doc.',
    'farma': 'Farmácia',
    'carga': 'Cargas',
    'rapido': 'Delivery Rápido',
    'outros': 'Outros'
};

/* --- Funções Auxiliares de Autenticação --- */
function getAuthToken() {
    if (document.body.classList.contains('dashboard-body')) return localStorage.getItem('adminToken');
    else if (document.body.classList.contains('motorista-body')) return localStorage.getItem('driverToken');
    return null;
}
function getAuthHeaders() { return { 'Authorization': `Bearer ${getAuthToken()}` }; }
function checkAuth(role) {
    let token = (role === 'admin') ? localStorage.getItem('adminToken') : localStorage.getItem('driverToken');
    if (!token) window.location.href = (role === 'admin') ? 'login.html' : 'login-motorista.html';
}

/* --- Roteador Principal (DOM Content Loaded) --- */
document.addEventListener('DOMContentLoaded', () => {
    // --- Lógica de LOGIN ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', (e) => { e.preventDefault(); handleLogin('admin'); });
    
    const driverLoginForm = document.getElementById('driver-login-form');
    if (driverLoginForm) driverLoginForm.addEventListener('submit', (e) => { e.preventDefault(); handleLogin('driver'); });

    // --- Lógica do PAINEL DO ADMIN ---
    const adminDashboard = document.body.classList.contains('dashboard-body');
    if (adminDashboard) {
        checkAuth('admin');
        connectSocket();
        showPage('visao-geral', 'nav-visao-geral', 'Visão Geral');
        
        document.getElementById('delivery-form').addEventListener('submit', handleNewDelivery);
        document.getElementById('form-add-motorista').addEventListener('submit', handleAddDriver);
        document.getElementById('form-edit-motorista').addEventListener('submit', handleUpdateDriver);
        document.getElementById('delivery-image').addEventListener('change', handleImageUpload);

        document.getElementById('nav-visao-geral').addEventListener('click', (e) => { e.preventDefault(); showPage('visao-geral', 'nav-visao-geral', 'Visão Geral'); });
        document.getElementById('nav-motoristas').addEventListener('click', (e) => { e.preventDefault(); showPage('gestao-motoristas', 'nav-motoristas', 'Gestão de Motoristas'); });
        document.getElementById('nav-entregas').addEventListener('click', (e) => { e.preventDefault(); showPage('entregas-activas', 'nav-entregas', 'Entregas Activas'); });
        document.getElementById('nav-historico').addEventListener('click', (e) => { e.preventDefault(); showPage('historico', 'nav-historico', 'Histórico'); });
        
        // (NOVO) Event listener para o novo item de menu
        document.getElementById('nav-mapa').addEventListener('click', (e) => { e.preventDefault(); showPage('mapa-tempo-real', 'nav-mapa', 'Mapa em Tempo Real'); });

        document.getElementById('admin-logout').addEventListener('click', (e) => { e.preventDefault(); handleLogout('admin'); });
        document.getElementById('btn-reset-chart').addEventListener('click', openChartResetModal);
        document.getElementById('btn-confirm-chart-reset').addEventListener('click', handleChartReset);
        document.getElementById('history-search-input').addEventListener('input', filterHistoryTable);
    }

    // --- Lógica do PAINEL DO MOTORISTA ---
    const driverPanel = document.body.classList.contains('motorista-body');
    if (driverPanel) {
        checkAuth('driver');
        connectSocket();
        loadMyDeliveries();
        
        // (NOVO) Inicia o rastreamento de geolocalização
        startLocationTracking(); 
        
        document.getElementById('driver-logout').addEventListener('click', (e) => { e.preventDefault(); handleLogout('driver'); });
    }
});


/* --- Funções de Login e Logout --- */
async function handleLogin(role) {
    const form = role === 'admin' ? document.getElementById('login-form') : document.getElementById('driver-login-form');
    const email = form.querySelector('#email').value;
    const password = form.querySelector('#password').value;
    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, role })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        if (role === 'admin') localStorage.setItem('adminToken', data.token);
        else localStorage.setItem('driverToken', data.token);

        window.location.href = role === 'admin' ? 'index.html' : 'painel-de-entrega.html';
    } catch (error) {
        console.error('Falha no login:', error);
        showCustomAlert('Erro de Login', error.message, 'error');
    }
}

function handleLogout(role) {
    if (role === 'admin') localStorage.removeItem('adminToken');
    else localStorage.removeItem('driverToken');
    window.location.href = (role === 'admin') ? 'login.html' : 'login-motorista.html';
}

/* --- Funções de Alerta Customizado --- */
function showCustomAlert(title, message, type = 'info') { // type = 'info', 'success', 'error'
    const modal = document.getElementById('custom-alert-modal');
    if (!modal) { alert(`${title}: ${message}`); return; }
    
    const modalContent = modal.querySelector('.modal-content');
    modalContent.classList.remove('success', 'error');
    if (type === 'success') modalContent.classList.add('success');
    if (type === 'error') modalContent.classList.add('error');
    
    document.getElementById('custom-alert-title').innerText = title;
    document.getElementById('custom-alert-message').innerText = message;
    modal.classList.remove('hidden');
}
function closeCustomAlert() {
    const modal = document.getElementById('custom-alert-modal');
    if (modal) modal.classList.add('hidden');
}

/* --- Funções do Painel do Admin (Chamadas pela API) --- */

function connectSocket() {
    const token = getAuthToken();
    if (!token) return;
    socket = io(API_URL, { auth: { token: token } });
    
    socket.on('connect', () => {
        console.log('Conectado ao servidor Socket.io com ID:', socket.id);
        if (document.body.classList.contains('dashboard-body')) {
            socket.emit('admin_join_room');
        }
    });

    if (document.body.classList.contains('dashboard-body')) {
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

        // (NOVO) Começa a ouvir os eventos de localização para o mapa
        listenForDriverUpdates();
    }
}

async function handleNewDelivery(e) {
    // ... (Função original sem alterações) ...
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    try {
        const response = await fetch(`${API_URL}/api/orders`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        showCustomAlert('Sucesso!', `Pedido Criado! \nCódigo do Destinatário: ${data.order.verification_code}`, 'success');
        form.reset();
        removeImage();
        destroyMap();
        showPage('entregas-activas', 'nav-entregas', 'Entregas Activas');
    } catch (error) {
        console.error('Falha ao criar entrega:', error);
        showCustomAlert('Erro', error.message, 'error');
    }
}

async function handleAddDriver(e) {
    // ... (Função original sem alterações) ...
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
        showAddDriverForm(false);
        loadDrivers();
    } catch (error) {
        console.error('Falha ao adicionar motorista:', error);
        showCustomAlert('Erro', error.message, 'error');
    }
}

async function loadDrivers() {
    // ... (Função original sem alterações) ...
    try {
        const response = await fetch(`${API_URL}/api/drivers`, { method: 'GET', headers: getAuthHeaders() });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        const tableBody = document.getElementById('drivers-table-body');
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
    } catch (error) { console.error('Falha ao carregar motoristas:', error); }
}

async function loadActiveDeliveries() {
    // ... (Função original sem alterações) ...
    try {
        const response = await fetch(`${API_URL}/api/orders/active`, { headers: getAuthHeaders() });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        const tableBody = document.getElementById('active-orders-table-body');
        tableBody.innerHTML = '';
        if (data.orders.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6">Nenhuma encomenda ativa.</td></tr>';
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
                    <td>${acaoBotao}</td>
                </tr>
            `;
        });
    } catch (error) { console.error('Falha ao carregar encomendas ativas:', error); }
}

async function loadHistory() {
    // ... (Função original sem alterações) ...
    try {
        const response = await fetch(`${API_URL}/api/orders/history`, { headers: getAuthHeaders() });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        const tableBody = document.getElementById('history-orders-table-body');
        tableBody.innerHTML = '';
        if (data.orders.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6">Nenhum histórico encontrado.</td></tr>';
            return;
        }
        data.orders.forEach(order => {
            const motoristaNome = order.assigned_to_driver ? order.assigned_to_driver.user.nome : 'N/D';
            const duracao = formatDuration(order.timestamp_started, order.timestamp_completed);
            const serviceName = serviceNames[order.service_type] || order.service_type;
            tableBody.innerHTML += `
                <tr class="history-row">
                    <td>#${order._id.slice(-6)}</td>
                    <td>${order.client_name}</td>
                    <td>${serviceName}</td>
                    <td>${motoristaNome}</td>
                    <td>${duracao}</td>
                    <td><button class="btn-action-small" onclick="openHistoryDetailModal('${order._id}')"><i class="fas fa-eye"></i></button></td>
                </tr>
            `;
        });
    } catch (error) { console.error('Falha ao carregar histórico:', error); }
}

function filterHistoryTable(event) {
    // ... (Função original sem alterações) ...
    const searchTerm = event.target.value.toLowerCase();
    const tableBody = document.getElementById('history-orders-table-body');
    const rows = tableBody.getElementsByTagName('tr');
    for (const row of rows) {
        if (row.getElementsByTagName('td').length > 1) {
            const rowText = row.textContent.toLowerCase();
            row.style.display = rowText.includes(searchTerm) ? '' : 'none';
        }
    }
}
function formatDuration(start, end) { 
    // ... (Função original sem alterações) ...
    if (!start || !end) return 'N/D'; const diffMs = new Date(end) - new Date(start); if (diffMs < 0) return 'N/D'; const minutes = Math.floor(diffMs / 60000); const seconds = Math.floor((diffMs % 60000) / 1000); return `${minutes} min ${seconds} s`; 
}
function formatTotalDuration(totalMs) { 
    // ... (Função original sem alterações) ...
    if (totalMs < 0) return 'N/D'; const totalMinutes = Math.floor(totalMs / 60000); const hours = Math.floor(totalMinutes / 60); const minutes = totalMinutes % 60; return `${hours} h ${minutes} min`; 
}

async function loadOverviewStats() {
    // ... (Função original sem alterações) ...
    try {
        const response = await fetch(`${API_URL}/api/stats/overview`, { headers: getAuthHeaders() });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        document.getElementById('stats-pendentes').innerText = data.pendentes;
        document.getElementById('stats-em-transito').innerText = data.emTransito;
        document.getElementById('stats-concluidas-hoje').innerText = data.concluidasHoje;
        document.getElementById('stats-motoristas-online').innerText = data.motoristasOnline;
    } catch (error) { console.error('Falha ao carregar estatísticas:', error); }
}

async function openAssignModal(orderId) {
    // ... (Função original sem alterações) ...
    const modal = document.getElementById('assign-modal');
    modal.classList.remove('hidden');
    document.getElementById('modal-order-id').innerText = `#${orderId.slice(-6)}`;
    const select = document.getElementById('driver-select-dropdown');
    select.innerHTML = '<option value="">A carregar...</option>';
    try {
        const response = await fetch(`${API_URL}/api/drivers/available`, { headers: getAuthHeaders() });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        if (data.drivers.length === 0) { select.innerHTML = '<option value="">Nenhum motorista disponível</option>'; return; }
        select.innerHTML = '<option value="">-- Selecione um motorista --</option>';
        data.drivers.forEach(driver => { select.innerHTML += `<option value="${driver.profile._id}">${driver.nome} (${driver.profile.vehicle_plate})</option>`; });
        document.getElementById('btn-confirm-assign').onclick = async () => {
            const driverId = select.value;
            if (!driverId) { showCustomAlert('Atenção', 'Por favor, selecione um motorista.'); return; }
            await confirmAssign(orderId, driverId);
        };
    } catch (error) { console.error('Falha ao carregar motoristas disponíveis:', error); select.innerHTML = '<option value="">Erro ao carregar</option>'; }
}
async function confirmAssign(orderId, driverId) {
    // ... (Função original sem alterações) ...
    try {
        const response = await fetch(`${API_URL}/api/orders/${orderId}/assign`, { method: 'PUT', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ driverId }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        showCustomAlert('Sucesso', 'Encomenda atribuída com sucesso!', 'success');
        closeAssignModal();
        loadActiveDeliveries();
    } catch (error) { console.error('Falha ao atribuir encomenda:', error); showCustomAlert('Erro', error.message, 'error'); }
}
function closeAssignModal() { 
    // ... (Função original sem alterações) ...
    document.getElementById('assign-modal').classList.add('hidden'); 
}
function showAddDriverForm(show) {
    // ... (Função original sem alterações) ...
    const form = document.getElementById('form-add-motorista');
    const button = document.getElementById('btn-show-driver-form');
    if (!form || !button) return;
    if (show) { form.classList.remove('hidden'); button.classList.add('hidden'); }
    else { form.classList.add('hidden'); button.classList.remove('hidden'); form.reset(); }
}
async function openEditDriverModal(driverUserId) {
    // ... (Função original sem alterações) ...
    const modal = document.getElementById('edit-driver-modal');
    modal.classList.remove('hidden');
    document.getElementById('edit-driver-id').value = driverUserId;
    try {
        const response = await fetch(`${API_URL}/api/drivers/${driverUserId}`, { headers: getAuthHeaders() });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        const driver = data.driver;
        const profile = driver.profile || {};
        document.getElementById('edit-driver-name').value = driver.nome;
        document.getElementById('edit-driver-phone').value = driver.telefone;
        document.getElementById('edit-driver-plate').value = profile.vehicle_plate || '';
        document.getElementById('edit-driver-status').value = profile.status || 'offline';
    } catch (error) { console.error('Falha ao carregar dados do motorista:', error); showCustomAlert('Erro', 'Erro ao carregar dados do motorista.', 'error'); closeEditDriverModal(); }
}
function closeEditDriverModal() { 
    // ... (Função original sem alterações) ...
    document.getElementById('edit-driver-modal').classList.add('hidden'); document.getElementById('form-edit-motorista').reset(); 
}
async function handleUpdateDriver(event) {
    // ... (Função original sem alterações) ...
    event.preventDefault();
    const userId = document.getElementById('edit-driver-id').value;
    const updatedData = {
        nome: document.getElementById('edit-driver-name').value,
        telefone: document.getElementById('edit-driver-phone').value,
        vehicle_plate: document.getElementById('edit-driver-plate').value,
        status: document.getElementById('edit-driver-status').value
    };
    try {
        const response = await fetch(`${API_URL}/api/drivers/${userId}`, { method: 'PUT', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(updatedData) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        showCustomAlert('Sucesso', 'Motorista atualizado com sucesso!', 'success');
        closeEditDriverModal();
        loadDrivers();
    } catch (error) { console.error('Falha ao atualizar motorista:', error); showCustomAlert('Erro', error.message, 'error'); }
}
async function openHistoryDetailModal(orderId) {
    // ... (Função original sem alterações) ...
    const modal = document.getElementById('history-detail-modal');
    const body = document.getElementById('history-modal-body');
    modal.classList.remove('hidden');
    document.getElementById('history-modal-id').innerText = `#${orderId.slice(-6)}`;
    body.innerHTML = '<p>A carregar detalhes...</p>';
    try {
        const response = await fetch(`${API_URL}/api/orders/${orderId}`, { headers: getAuthHeaders() });
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
            <p><strong>Natureza:</strong> ${serviceNames[order.service_type] || order.service_type}</p>
            <p><strong>Status:</strong> ${order.status}</p>
            <p><strong>Código:</strong> ${order.verification_code}</p>
            <p><strong>Motorista:</strong> ${motorista}</p>
            <p><strong>Admin:</strong> ${admin}</p>
            <p><strong>Criado em:</strong> ${new Date(order.timestamp_created).toLocaleString('pt-MZ')}</p>
            <p><strong>Iniciado em:</strong> ${order.timestamp_started ? new Date(order.timestamp_started).toLocaleString('pt-MZ') : 'N/D'}</p>
            <p><strong>Concluído em:</strong> ${order.timestamp_completed ? new Date(order.timestamp_completed).toLocaleString('pt-MZ') : 'N/D'}</p>
            <p><strong>Duração:</strong> ${formatDuration(order.timestamp_started, order.timestamp_completed)}</p>
        `;
    } catch (error) { console.error('Falha ao carregar detalhes do histórico:', error); body.innerHTML = '<p>Erro ao carregar detalhes.</p>'; }
}
function closeHistoryDetailModal() { 
    // ... (Função original sem alterações) ...
    document.getElementById('history-detail-modal').classList.add('hidden'); 
}
function openChartResetModal() { 
    // ... (Função original sem alterações) ...
    document.getElementById('chart-reset-modal').classList.remove('hidden'); 
}
function closeChartResetModal() { 
    // ... (Função original sem alterações) ...
    document.getElementById('chart-reset-modal').classList.add('hidden'); document.getElementById('chart-reset-password').value = ''; 
}
function handleChartReset() {
    // ... (Função original sem alterações) ...
    const password = document.getElementById('chart-reset-password').value;
    if (password === 'Entregaah.wipe') {
        console.log('SIMULAÇÃO: A chamar API para resetar estatísticas...');
        showCustomAlert('Sucesso', 'As estatísticas foram resetadas! (Simulação)', 'success');
        closeChartResetModal();
        initServicesChart(true);
    } else { showCustomAlert('Erro', 'Senha de reset incorreta.', 'error'); }
}
async function openDriverReportModal(driverUserId, driverName) {
    // ... (Função original sem alterações) ...
    const modal = document.getElementById('driver-report-modal');
    modal.classList.remove('hidden');
    document.getElementById('driver-report-title').innerText = `Relatório de ${driverName}`;
    document.getElementById('report-total-entregas').innerText = '...';
    document.getElementById('report-total-duracao').innerText = '...';
    const tableBody = document.getElementById('driver-report-table-body');
    tableBody.innerHTML = '<tr><td colspan="5">A carregar relatório...</td></tr>';
    try {
        const response = await fetch(`${API_URL}/api/drivers/${driverUserId}/report`, { headers: getAuthHeaders() });
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
        document.getElementById('report-total-duracao').innerText = formatTotalDuration(totalMs);
        tableBody.innerHTML = '';
        if (orders.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">Nenhuma entrega concluída encontrada.</td></tr>';
            return;
        }
        orders.forEach(order => {
            const serviceName = serviceNames[order.service_type] || order.service_type;
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
    } catch (error) { console.error('Falha ao carregar relatório do motorista:', error); tableBody.innerHTML = '<tr><td colspan="5">Erro ao carregar relatório.</td></tr>'; }
}
function closeDriverReportModal() { 
    // ... (Função original sem alterações) ...
    document.getElementById('driver-report-modal').classList.add('hidden'); 
}

/* --- Funções de Navegação e UI --- */
function showPage(pageId, navId, title) {
    // (ATUALIZADO) Destrói o mapa do formulário E o mapa em tempo real ao navegar
    if (map) destroyMap();
    if (liveMap && pageId !== 'mapa-tempo-real') {
        liveMap.remove();
        liveMap = null;
        driverMarkers = {}; // Limpa os marcadores
        console.log('Mapa em tempo real destruído.');
    }

    document.querySelectorAll('.content-page').forEach(page => page.classList.add('hidden'));
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => item.classList.remove('active'));
    const pageToShow = document.getElementById(pageId);
    if (pageToShow) pageToShow.classList.remove('hidden');
    const navLink = document.getElementById(navId);
    if (navLink) navLink.classList.add('active');
    document.getElementById('main-title').innerText = title;

    if (pageId === 'gestao-motoristas') loadDrivers();
    if (pageId === 'entregas-activas') loadActiveDeliveries();
    if (pageId === 'historico') loadHistory();
    if (pageId === 'visao-geral') {
        loadOverviewStats();
        initServicesChart(false);
    }
    // (NOVO) Inicializa o mapa em tempo real se for a página correta
    if (pageId === 'mapa-tempo-real') {
        if (!liveMap) { // Só inicializa se não existir
            initializeLiveMap();
        }
    }
}
function showServiceForm(serviceType) {
    // ... (Função original sem alterações) ...
    const titles = { 'doc': 'Nova Tramitação de Documentos', 'farma': 'Novo Pedido Farmacêutico', 'carga': 'Novo Transporte de Carga', 'rapido': 'Novo Delivery Rápido', 'outros': 'Outros Serviços', 'config': 'Configurações' };
    document.querySelectorAll('.content-page').forEach(page => page.classList.add('hidden'));
    document.getElementById('form-nova-entrega').classList.remove('hidden');
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => item.classList.remove('active'));
    document.getElementById('main-title').innerText = titles[serviceType] || 'Nova Entrega';
    document.getElementById('service-type').value = serviceType;
    removeImage();
    setTimeout(initializeMap, 100);
}
function handleImageUpload(event) { 
    // ... (Função original sem alterações) ...
    const file = event.target.files[0]; if (!file) return; const previewContainer = document.getElementById('image-preview'); const previewImg = previewContainer.querySelector('.preview-img'); const reader = new FileReader(); reader.onload = function(e) { previewImg.src = e.target.result; }; reader.readAsDataURL(file); previewContainer.classList.remove('hidden'); 
}
function removeImage() { 
    // ... (Função original sem alterações) ...
    const previewContainer = document.getElementById('image-preview'); if (!previewContainer) return; previewContainer.querySelector('.preview-img').src = ''; previewContainer.classList.add('hidden'); document.getElementById('delivery-image').value = ''; 
}
async function initServicesChart(reset = false) {
    // ... (Função original sem alterações) ...
    const ctx = document.getElementById('servicesChart');
    if (!ctx) return;
    if (myServicesChart) myServicesChart.destroy();
    let dataValues = [0], adesaoValues = [0], labels = ['A carregar...'];
    if (reset) {
        labels = ['N/D'];
    } else {
        try {
            const response = await fetch(`${API_URL}/api/stats/services`, { headers: getAuthHeaders() });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            if (data.labels.length > 0) {
                labels = data.labels;
                dataValues = data.dataValues;
                adesaoValues = data.adesaoValues;
            } else {
                labels = ['Nenhum dado'];
            }
        } catch (error) {
            console.error('Falha ao carregar estatísticas do gráfico:', error);
            labels = ['Erro ao carregar'];
        }
    }
    const chartData = {
        labels: labels,
        datasets: [
            { label: 'Valor Rendido (MZN)', data: dataValues, backgroundColor: 'rgba(255, 102, 0, 0.7)', borderWidth: 1 },
            { label: 'Nº de Pedidos (Adesão)', data: adesaoValues, backgroundColor: 'rgba(44, 62, 80, 0.7)', borderWidth: 1 }
        ]
    };
    myServicesChart = new Chart(ctx, { 
        type: 'bar', data: chartData, 
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { callback: function(value) { if (value >= 1000) return value / 1000 + 'k'; return value; } } } },
            plugins: {
                title: { display: true, text: 'Receita vs. Número de Pedidos por Serviço' },
                tooltip: { callbacks: { label: function(context) { let l = context.dataset.label || ''; if (l) l += ': '; if (context.parsed.y !== null) { if (context.dataset.label.includes('MZN')) l += new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(context.parsed.y); else l += context.parsed.y + ' pedidos'; } return l; } } }
            }
        }
    });
}


/* --- Funções do Mapa (Leaflet.js) --- */
function initializeMap() {
    // ... (Função original sem alterações - este é o mapa do formulário) ...
    const maputoCoords = [-25.965, 32.589];
    if (map) destroyMap();
    try {
        map = L.map('map').setView(maputoCoords, 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        mapMarker = L.marker(maputoCoords, {
            draggable: true
        }).addTo(map);
        mapMarker.on('dragend', (event) => {
            const position = event.target.getLatLng();
            document.getElementById('delivery-lng').value = position.lng;
            document.getElementById('delivery-lat').value = position.lat;
        });
        document.getElementById('delivery-lng').value = maputoCoords[1];
        document.getElementById('delivery-lat').value = maputoCoords[0];
    } catch (error) {
        console.error("Erro ao inicializar o mapa Leaflet:", error);
        document.getElementById('map').innerHTML = '<p style="padding: 1rem; text-align: center; color: var(--danger-color);">Erro ao carregar o mapa.</p>';
    }
}
function destroyMap() {
    // ... (Função original sem alterações - este é o mapa do formulário) ...
    if (map) {
        map.remove();
        map = null;
        mapMarker = null;
        console.log('Mapa do formulário destruído.');
    }
}


/* --- Funções do Painel do Motorista --- */
async function loadMyDeliveries() {
    // ... (Função original sem alterações) ...
    try {
        const response = await fetch(`${API_URL}/api/orders/my-deliveries`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        const listaEntregas = document.getElementById('lista-entregas');
        if (!listaEntregas) return;
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
                <p><strong>Serviço:</strong> ${serviceNames[order.service_type] || order.service_type}</p>
                <span class="ver-detalhes-btn">${order.status === 'atribuido' ? 'Ver Detalhes' : 'Continuar Entrega'}</span>
            `;
            card.addEventListener('click', () => { showDetalheEntrega(order); });
            listaEntregas.appendChild(card);
        });
    } catch (error) { console.error('Falha ao carregar entregas:', error); }
}

function showDetalheEntrega(order) {
    // ... (Função original com a correção do bug do Google Maps) ...
    document.getElementById('lista-entregas').classList.add('hidden');
    const detalheSection = document.getElementById('detalhe-entrega');
    detalheSection.querySelector('#detalhe-entrega-title').innerText = `Detalhes do Pedido #${order._id.slice(-6)}`;
    
    // Imagem
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

    // Detalhes do Cliente
    document.getElementById('detalhe-cliente-nome').innerHTML = `<strong>Nome:</strong> ${order.client_name}`;
    document.getElementById('detalhe-cliente-telefone').innerHTML = `<strong>Telefone:</strong> ${order.client_phone1}`;
    
    // Detalhes do Endereço (Corrigido)
    document.getElementById('detalhe-cliente-endereco').innerHTML = `<strong>Endereço:</strong> ${order.address_text || 'N/D'}`;
    const coordsP = document.getElementById('detalhe-cliente-coords');
    const mapButton = document.getElementById('btn-google-maps');
    
    // (CORRIGIDO) Verifica as coordenadas e mostra-as
    if (order.address_coords && order.address_coords.lat) {
        // 1. Mostra as coordenadas em texto
        coordsP.querySelector('span').innerText = `${order.address_coords.lat.toFixed(5)}, ${order.address_coords.lng.toFixed(5)}`;
        coordsP.classList.remove('hidden');
        
        // 2. (CORRIGIDO) Cria o link correto do Google Maps e mostra o botão
        mapButton.href = `https://maps.google.com/?q=${order.address_coords.lat},${order.address_coords.lng}`;
        mapButton.classList.remove('hidden');
    } else {
        // Esconde as coordenadas e o botão se não existirem
        coordsP.classList.add('hidden');
        mapButton.classList.add('hidden');
    }

    // Lógica dos botões Iniciar/Finalizar
    const btnIniciar = detalheSection.querySelector('#btn-iniciar-entrega');
    const formFinalizacao = detalheSection.querySelector('#form-finalizacao');
    btnIniciar.dataset.orderId = order._id;
    formFinalizacao.dataset.orderId = order._id;
    if (order.status === 'em_progresso') {
        btnIniciar.classList.add('hidden');
        formFinalizacao.classList.remove('hidden');
    } else {
        btnIniciar.classList.remove('hidden');
        formFinalizacao.classList.add('hidden');
    }
    btnIniciar.onclick = () => handleStartDelivery(order._id);
    formFinalizacao.onsubmit = (event) => handleCompleteDelivery(event, order._id);
    detalheSection.classList.remove('hidden');
}

function showListaEntregas() {
    // ... (Função original sem alterações) ...
    document.getElementById('lista-entregas').classList.remove('hidden');
    document.getElementById('detalhe-entrega').classList.add('hidden');
    loadMyDeliveries();
}
async function handleStartDelivery(orderId) {
    // ... (Função original sem alterações) ...
    try {
        const response = await fetch(`${API_URL}/api/orders/${orderId}/start`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        showCustomAlert('Sucesso', 'Entrega Iniciada!', 'success');
        document.getElementById('btn-iniciar-entrega').classList.add('hidden');
        document.getElementById('form-finalizacao').classList.remove('hidden');
    } catch (error) {
        console.error('Falha ao iniciar entrega:', error);
        showCustomAlert('Erro', error.message, 'error');
    }
}
async function handleCompleteDelivery(event, orderId) {
    // ... (Função original sem alterações) ...
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
        showListaEntregas();
    } catch (error) {
        console.error('Falha ao finalizar entrega:', error);
        showCustomAlert('Erro', error.message, 'error');
    }
}


/* --- (NOVAS FUNÇÕES) Rastreamento em Tempo Real --- */

/**
 * (NOVO) Inicializa o mapa principal de rastreamento no painel do admin.
 */
function initializeLiveMap() {
    try {
        const maputoCoords = [-25.965, 32.589];
        liveMap = L.map('live-map-container').setView(maputoCoords, 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(liveMap);
        
        console.log('Mapa em tempo real inicializado.');

        // --- (CORREÇÃO DO BUG DE NAVEGAÇÃO) ---
        // Pede ao servidor as localizações de todos os motoristas ATIVOS
        // AGORA MESMO, porque acabámos de (re)criar o mapa ao navegar para esta página.
        if (socket) {
            socket.emit('admin_request_all_locations'); 
            console.log('A pedir ao servidor as localizações ativas...');
        }
        // --- FIM DA CORREÇÃO ---

    } catch (error) {
        console.error("Erro ao inicializar o mapa em tempo real:", error);
        document.getElementById('live-map-container').innerHTML = '<p>Erro ao carregar o mapa.</p>';
    }
}

/**
 * (NOVO) Ouve os eventos do socket para atualizar as localizações dos motoristas.
 * Esta função é chamada uma vez quando o admin conecta o socket.
 */
function listenForDriverUpdates() {
    if (!socket) return;

    console.log('Admin a ouvir atualizações de localização...');

    socket.on('driver_location_broadcast', (data) => {
        const { driverId, driverName, status, lat, lng } = data;
        
        // Se o mapa não estiver visível (nulo), não faz nada
        if (!liveMap) return;

        const newLatLng = [lat, lng];
        const popupContent = `<strong>${driverName}</strong><br>Status: ${status.replace('_', ' ')}`;

        if (driverMarkers[driverId]) {
            // Se o marcador já existe, atualiza a posição e o popup
            driverMarkers[driverId].setLatLng(newLatLng);
            driverMarkers[driverId].setPopupContent(popupContent);
        } else {
            // Se é um novo motorista, cria o marcador
            driverMarkers[driverId] = L.marker(newLatLng).addTo(liveMap);
            driverMarkers[driverId].bindPopup(popupContent).openPopup();
            console.log(`Adicionando novo marcador para ${driverName}`);
        }
    });

    // (NOVO) Ouve quando um motorista desconecta para removê-lo do mapa
    socket.on('driver_disconnected_broadcast', (data) => {
        const { driverId, driverName } = data;
        
        if (!liveMap) return;

        if (driverMarkers[driverId]) {
            liveMap.removeLayer(driverMarkers[driverId]);
            delete driverMarkers[driverId];
            console.log(`Removido marcador para ${driverName} (desconectado)`);
        }
    });
}

/**
 * (NOVO) Inicia o rastreamento de geolocalização no painel do motorista.
 */
function startLocationTracking() {
    if (!navigator.geolocation) {
        console.error('Geolocalização não é suportada neste browser.');
        // Opcional: mostrar um alerta ao motorista
        // showCustomAlert('Erro', 'Geolocalização não é suportada.', 'error');
        return;
    }

    console.log('Iniciando rastreamento de localização...');

    navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            
            // Envia a localização para o servidor via socket
            if (socket) {
                // console.log(`Enviando localização: ${latitude}, ${longitude}`); // (Descomente para depurar)
                socket.emit('driver_location_update', { 
                    lat: latitude, 
                    lng: longitude 
                });
            }
        },
        (error) => {
            console.error("Erro ao obter localização:", error.message);
            // Opcional: alertar o motorista que o rastreamento falhou
            // if (error.code === 1) showCustomAlert('Atenção', 'Precisa de ativar a permissão de localização.', 'error');
        },
        {
            enableHighAccuracy: true, // Mais preciso, gasta mais bateria
            timeout: 10000,           // 10 segundos para obter a localização
            maximumAge: 0,            // Não usar localizações em cache
            distanceFilter: 10        // (NOVO) Atualiza apenas se mover 10 metros
        }
    );
}