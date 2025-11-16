/*
 * Ficheiro: js/admin/adminApi.js
 *
 * (Dependência #6) - Precisa de 'api.js', 'auth.js', 'adminMap.js'
 *
 * ✅ CORRIGIDO: Rotas alinhadas com o server.js (ex: /api/stats, /api/clients).
 */

/* --- Funções de Gestão de Motoristas --- */

/**
 * Busca todos os motoristas registados e preenche a tabela.
 */
async function fetchDrivers() {
    try {
        // CORRIGIDO: Rota mudada para /api/drivers
        const response = await apiRequest('/api/drivers', 'GET');
        
        if (response && response.drivers) {
            populateDriversTable(response.drivers);
        }
    } catch (error) {
        console.error('Erro ao buscar motoristas:', error);
        showCustomAlert('Erro', 'Não foi possível carregar a lista de motoristas.');
    }
}

/**
 * Preenche a tabela de motoristas com os dados recebidos.
 * @param {Array} drivers - Array de motoristas.
 */
function populateDriversTable(drivers) {
    const tbody = document.getElementById('drivers-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (drivers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Nenhum motorista registado.</td></tr>';
        return;
    }

    drivers.forEach(driver => {
        const row = document.createElement('tr');
        
        const nome = driver.user?.nome || 'N/A';
        const telefone = driver.user?.telefone || 'N/A';
        const vehicle = driver.vehicle_plate || 'N/A';
        const status = driver.status || 'offline';
        const statusText = translateDriverStatus(status);
        const statusClass = getStatusClass(status);

        row.innerHTML = `
            <td>${nome}</td>
            <td>${telefone}</td>
            <td>${vehicle}</td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
            <td>
                <button class="btn-action-small" onclick="openEditDriverModal('${driver._id}')">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn-action-small btn-info" onclick="openDriverReport('${driver._id}')">
                    <i class="fas fa-chart-line"></i> Relatório
                </button>
                <button class="btn-action-small btn-primary" onclick="openDriverTripsModal('${driver._id}')">
                    <i class="fas fa-route"></i> Ver Rotas
                </button>
                <button class="btn-action-small btn-danger" onclick="confirmDeleteDriver('${driver._id}', '${nome}')">
                    <i class="fas fa-trash"></i> Apagar
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

/**
 * Traduz o status do motorista para português.
 */
function translateDriverStatus(status) {
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
 * Retorna a classe CSS apropriada para o badge de status.
 */
function getStatusClass(status) {
    if (status === 'online_livre') return 'badge-success';
    if (status === 'online_ocupado' || status.includes('caminho') || status.includes('entregando') || status.includes('coletando')) return 'badge-warning';
    if (status === 'offline') return 'badge-secondary';
    return 'badge-info';
}

/**
 * Adiciona um novo motorista.
 */
async function addDriver(driverData) {
    try {
        // CORRIGIDO: Rota mudada para /api/drivers
        const response = await apiRequest('/api/drivers', 'POST', driverData);
        
        if (response && response.driver) {
            showCustomAlert('Sucesso', 'Motorista adicionado com sucesso!');
            fetchDrivers(); // Atualiza a tabela
            showAddDriverForm(false); // Fecha o formulário
        }
    } catch (error) {
        console.error('Erro ao adicionar motorista:', error);
        showCustomAlert('Erro', error.message || 'Não foi possível adicionar o motorista.');
    }
}

/**
 * Atualiza os dados de um motorista.
 */
async function updateDriver(driverId, driverData) {
    try {
        // CORRIGIDO: Rota mudada para /api/drivers
        const response = await apiRequest(`/api/drivers/${driverId}`, 'PUT', driverData);
        
        if (response && response.driver) {
            showCustomAlert('Sucesso', 'Motorista atualizado com sucesso!');
            fetchDrivers(); // Atualiza a tabela
            closeEditDriverModal();
        }
    } catch (error) {
        console.error('Erro ao atualizar motorista:', error);
        showCustomAlert('Erro', error.message || 'Não foi possível atualizar o motorista.');
    }
}

/**
 * Apaga um motorista.
 */
async function deleteDriver(driverId) {
    try {
        // CORRIGIDO: Rota mudada para /api/drivers
        const response = await apiRequest(`/api/drivers/${driverId}`, 'DELETE');
        
        if (response && response.message) {
            showCustomAlert('Sucesso', 'Motorista apagado com sucesso!');
            fetchDrivers(); // Atualiza a tabela
        }
    } catch (error) {
        console.error('Erro ao apagar motorista:', error);
        showCustomAlert('Erro', error.message || 'Não foi possível apagar o motorista.');
    }
}

/* --- ✅ Funções de Histórico de Rotas (adminRoutes.js) --- */

/**
 * Abre modal com histórico de rotas de um motorista.
 * @param {string} driverId - ID do motorista.
 */
async function openDriverTripsModal(driverId) {
    try {
        // CORRETO: Esta rota ESTÁ em /api/admin/
        const response = await apiRequest(`/api/admin/drivers/${driverId}/trips`, 'GET');
        
        if (response && response.trips) {
            showDriverTripsModal(response.trips, response.driverName || 'Motorista');
        } else {
            showCustomAlert('Erro', 'Não foi possível carregar o histórico de rotas.');
        }
    } catch (error) {
        console.error('Erro ao buscar histórico de rotas:', error);
        showCustomAlert('Erro', 'Não foi possível carregar o histórico de rotas.');
    }
}

/**
 * Exibe modal com lista de rotas do motorista.
 * @param {Array} trips - Array de viagens.
 * @param {string} driverName - Nome do motorista.
 */
function showDriverTripsModal(trips, driverName) {
    const modalTitle = document.getElementById('driver-trips-modal-title');
    const modalBody = document.getElementById('driver-trips-modal-body');
    
    if (!modalTitle || !modalBody) {
        console.error('Elementos do modal de rotas não encontrados.');
        return;
    }

    modalTitle.textContent = `Rotas de ${driverName}`;

    if (trips.length === 0) {
        modalBody.innerHTML = '<p style="text-align: center; padding: 2rem;">Nenhuma rota registada.</p>';
    } else {
        let tableHTML = `
            <div class="table-responsive">
                <table class="table table-striped table-hover">
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Tipo</th>
                            <th>Status</th>
                            <th>Distância</th>
                            <th>Duração</th>
                            <th>Cliente</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        trips.forEach(trip => {
            const startDate = trip.startedAt ? new Date(trip.startedAt).toLocaleString('pt-PT') : '-';
            const type = translateTripType(trip.type);
            const status = trip.status || '-';
            const distance = trip.metrics?.distance ? `${(trip.metrics.distance / 1000).toFixed(2)} km` : '-';
            const duration = trip.metrics?.duration ? `${(trip.metrics.duration / 60).toFixed(1)} min` : '-';
            const clientName = trip.order?.client_name || '-';

            tableHTML += `
                <tr>
                    <td>${startDate}</td>
                    <td>${type}</td>
                    <td><span class="badge badge-info">${status}</span></td>
                    <td>${distance}</td>
                    <td>${duration}</td>
                    <td>${clientName}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="openTripDetailsOnMap('${trip._id}')">
                            <i class="fas fa-map"></i> Ver no Mapa
                        </button>
                    </td>
                </tr>
            `;
        });

        tableHTML += `
                    </tbody>
                </table>
            </div>
        `;

        modalBody.innerHTML = tableHTML;
    }

    // Abre o modal (Bootstrap 5)
    const modalElement = document.getElementById('driverTripsModal');
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
}

/**
 * Traduz tipo de viagem para português.
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
 * Abre detalhes de uma viagem específica no mapa (chama função em adminMap.js).
 * @param {string} tripId - ID da viagem.
 */
function openTripDetailsOnMap(tripId) {
    // Fecha o modal de lista de rotas
    const modalElement = document.getElementById('driverTripsModal');
    if (modalElement) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) modal.hide();
    }

    // Chama função do adminMap.js para abrir modal de detalhes
    if (typeof openTripDetails === 'function') {
        openTripDetails(tripId);
    } else {
        console.error('Função openTripDetails não encontrada em adminMap.js');
    }
}

/* --- Funções de Gestão de Clientes --- */

async function fetchClients() {
    try {
        // CORRIGIDO: Rota mudada para /api/clients
        const response = await apiRequest('/api/clients', 'GET');
        
        if (response && response.clients) {
            populateClientsTable(response.clients);
            populateClientDropdown(response.clients);
        }
    } catch (error) {
        console.error('Erro ao buscar clientes:', error);
        showCustomAlert('Erro', 'Não foi possível carregar a lista de clientes.');
    }
}

function populateClientsTable(clients) {
    const tbody = document.getElementById('clients-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhum cliente registado.</td></tr>';
        return;
    }

    clients.forEach(client => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${client.nome || 'N/A'}</td>
            <td>${client.telefone || 'N/A'}</td>
            <td>${client.empresa || '-'}</td>
            <td>
                <button class="btn-action-small" onclick="openEditClientModal('${client._id}')">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn-action-small btn-info" onclick="openClientStatement('${client._id}')">
                    <i class="fas fa-file-invoice"></i> Extrato
                </button>
                <button class="btn-action-small btn-danger" onclick="confirmDeleteClient('${client._id}', '${client.nome}')">
                    <i class="fas fa-trash"></i> Apagar
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

function populateClientDropdown(clients) {
    const select = document.getElementById('delivery-client-select');
    if (!select) return;

    select.innerHTML = '<option value="">-- Ou digite manualmente abaixo --</option>';

    clients.forEach(client => {
        const option = document.createElement('option');
        option.value = client._id;
        option.textContent = `${client.nome} - ${client.telefone}`;
        option.dataset.nome = client.nome;
        option.dataset.telefone = client.telefone;
        option.dataset.empresa = client.empresa || '';
        select.appendChild(option);
    });
}

async function addClient(clientData) {
    try {
        // CORRIGIDO: Rota mudada para /api/clients
        const response = await apiRequest('/api/clients', 'POST', clientData);
        
        if (response && response.client) {
            showCustomAlert('Sucesso', 'Cliente adicionado com sucesso!');
            fetchClients();
            showAddClientForm(false);
        }
    } catch (error) {
        console.error('Erro ao adicionar cliente:', error);
        showCustomAlert('Erro', error.message || 'Não foi possível adicionar o cliente.');
    }
}

async function updateClient(clientId, clientData) {
    try {
        // CORRIGIDO: Rota mudada para /api/clients
        const response = await apiRequest(`/api/clients/${clientId}`, 'PUT', clientData);
        
        if (response && response.client) {
            showCustomAlert('Sucesso', 'Cliente atualizado com sucesso!');
            fetchClients();
            closeEditClientModal();
        }
    } catch (error) {
        console.error('Erro ao atualizar cliente:', error);
        showCustomAlert('Erro', error.message || 'Não foi possível atualizar o cliente.');
    }
}

async function deleteClient(clientId) {
    try {
        // CORRIGIDO: Rota mudada para /api/clients
        const response = await apiRequest(`/api/clients/${clientId}`, 'DELETE');
        
        if (response && response.message) {
            showCustomAlert('Sucesso', 'Cliente apagado com sucesso!');
            fetchClients();
        }
    } catch (error) {
        console.error('Erro ao apagar cliente:', error);
        showCustomAlert('Erro', error.message || 'Não foi possível apagar o cliente.');
    }
}

/* --- Funções de Gestão de Pedidos --- */

async function fetchActiveOrders() {
    try {
        // CORRIGIDO: Rota mudada para /api/orders
        const response = await apiRequest('/api/orders/active', 'GET');
        
        if (response && response.orders) {
            populateActiveOrdersTable(response.orders);
        }
    } catch (error) {
        console.error('Erro ao buscar pedidos ativos:', error);
    }
}

function populateActiveOrdersTable(orders) {
    const tbody = document.getElementById('active-orders-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Nenhuma encomenda ativa.</td></tr>';
        return;
    }

    orders.forEach(order => {
        const row = document.createElement('tr');
        
        const statusClass = order.status === 'pendente' ? 'badge-warning' : 'badge-info';
        const driverName = order.driver?.user?.nome || 'Não atribuído';
        
        row.innerHTML = `
            <td>#${order._id.slice(-6)}</td>
            <td>${order.client_name}</td>
            <td>${order.client_phone1}</td>
            <td><span class="badge ${statusClass}">${order.status}</span></td>
            <td>${driverName}</td>
            <td>${order.verification_code || '-'}</td>
            <td>
                ${order.status === 'pendente' ? `
                    <button class="btn-action-small" onclick="openAssignModal('${order._id}')">
                        <i class="fas fa-user-plus"></i> Atribuir
                    </button>
                ` : ''}
                <button class="btn-action-small btn-danger" onclick="confirmCancelOrder('${order._id}')">
                    <i class="fas fa-times"></i> Cancelar
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

async function createOrder(orderData) {
    try {
        // CORRIGIDO: Rota mudada para /api/orders
        const response = await apiRequest('/api/orders', 'POST', orderData);
        
        if (response && response.order) {
            fetchActiveOrders();
            fetchStats();
            return response.order;
        }
    } catch (error) {
        console.error('Erro ao criar pedido:', error);
        showCustomAlert('Erro', error.message || 'Não foi possível criar o pedido.');
        throw error;
    }
}

async function assignOrder(orderId, driverId) {
    try {
        // CORRIGIDO: Rota mudada para /api/orders
        const response = await apiRequest(`/api/orders/${orderId}/assign`, 'POST', { driverId });
        
        if (response && response.order) {
            showCustomAlert('Sucesso', 'Pedido atribuído com sucesso!');
            fetchActiveOrders();
            closeAssignModal();
        }
    } catch (error) {
        console.error('Erro ao atribuir pedido:', error);
        showCustomAlert('Erro', error.message || 'Não foi possível atribuir o pedido.');
    }
}

async function cancelOrder(orderId) {
    try {
        // CORRIGIDO: Rota mudada para /api/orders
        const response = await apiRequest(`/api/orders/${orderId}/cancel`, 'POST');
        
        if (response && response.order) {
            showCustomAlert('Sucesso', 'Pedido cancelado com sucesso!');
            fetchActiveOrders();
            fetchStats();
        }
    } catch (error) {
        console.error('Erro ao cancelar pedido:', error);
        showCustomAlert('Erro', error.message || 'Não foi possível cancelar o pedido.');
    }
}

/* --- Funções de Histórico --- */

async function fetchOrderHistory(searchTerm = '') {
    try {
        // CORRIGIDO: Rota mudada para /api/orders
        const url = searchTerm ? `/api/orders/history?search=${encodeURIComponent(searchTerm)}` : '/api/orders/history';
        const response = await apiRequest(url, 'GET');
        
        if (response && response.orders) {
            populateHistoryTable(response.orders);
        }
    } catch (error) {
        console.error('Erro ao buscar histórico:', error);
    }
}

function populateHistoryTable(orders) {
    const tbody = document.getElementById('history-orders-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Nenhum pedido no histórico.</td></tr>';
        return;
    }

    orders.forEach(order => {
        const row = document.createElement('tr');
        
        const driverName = order.driver?.user?.nome || 'N/A';
        const duration = order.completed_at && order.created_at 
            ? calculateDuration(order.created_at, order.completed_at) 
            : '-';
        
        row.innerHTML = `
            <td>#${order._id.slice(-6)}</td>
            <td>${order.client_name}</td>
            <td>${order.service_type || 'N/A'}</td>
            <td>${driverName}</td>
            <td>${duration}</td>
            <td>${order.verification_code || '-'}</td>
            <td>
                <button class="btn-action-small btn-info" onclick="openHistoryDetail('${order._id}')">
                    <i class="fas fa-eye"></i> Ver
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

function calculateDuration(start, end) {
    const diff = new Date(end) - new Date(start);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
        return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
}

/* --- Funções de Estatísticas --- */

async function fetchStats() {
    try {
        // CORRIGIDO: Rota mudada para /api/stats
        const response = await apiRequest('/api/stats', 'GET');
        
        if (response) {
            updateStatsCards(response);
        }
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
    }
}

function updateStatsCards(stats) {
    document.getElementById('stats-pendentes').textContent = stats.pendentes || 0;
    document.getElementById('stats-em-transito').textContent = stats.emTransito || 0;
    document.getElementById('stats-concluidas-hoje').textContent = stats.concluidasHoje || 0;
    document.getElementById('stats-motoristas-online').textContent = stats.motoristasOnline || 0;
    
    document.getElementById('stats-receita-total').textContent = `${(stats.receitaTotal || 0).toFixed(2)} MT`;
    document.getElementById('stats-lucro-empresa').textContent = `${(stats.lucroEmpresa || 0).toFixed(2)} MT`;
    document.getElementById('stats-ganhos-motorista').textContent = `${(stats.ganhosMotorista || 0).toFixed(2)} MT`;
    document.getElementById('stats-top-driver').textContent = stats.topDriver || '-';
}
