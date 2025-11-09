// Ficheiro: javascript.js (Completo, Reconstruído e Corrigido)

// Variáveis globais para o mapa e marcador (para evitar recriação)
let map;
let marker;
let leafletIcon; // Ícone personalizado

// Função principal que é executada quando o HTML está pronto
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Verificação de Autenticação
    const token = localStorage.getItem('token');
    if (!token) {
        // Se não houver token, redireciona para a página de login
        window.location.href = 'login.html'; // Assumindo que a sua página de login é 'login.html'
        return;
    }

    // 2. Configurar Navegação Principal (Sidebar)
    setupNavigation();

    // 3. Configurar Todos os 'Event Listeners' (Formulários, Botões, etc.)
    setupEventListeners();

    // 4. Carregar Dados Iniciais
    // Carrega os clientes (para a tabela E para o dropdown)
    loadClients(); 
    // Carrega os motoristas
    loadDrivers();
    // Carrega os pedidos ativos
    loadActiveOrders();
    // Carrega o histórico
    loadHistory();
    // Carrega os dados do dashboard (Visão Geral)
    loadDashboardStats(); 
    
    // 5. Inicializar o Mapa (para a página "Nova Entrega")
    initMap();

    // 6. (A CORREÇÃO) Configura o "comportamento" do dropdown de seleção de cliente
    setupClientSelectionListener();
});

/**
 * Configura os cliques nos menus da sidebar
 */
function setupNavigation() {
    const navLinks = {
        'nav-visao-geral': 'visao-geral',
        'nav-entregas': 'entregas-activas',
        'nav-motoristas': 'gestao-motoristas',
        'nav-clientes': 'gestao-clientes',
        'nav-historico': 'historico',
        'nav-mapa': 'mapa-tempo-real',
    };

    Object.keys(navLinks).forEach(navId => {
        const navElement = document.getElementById(navId);
        if (navElement) {
            navElement.addEventListener('click', (e) => {
                e.preventDefault();
                showPage(navLinks[navId]);
                setActiveNav(navId);
            });
        }
    });

    // Link de Logout
    const logoutBtn = document.getElementById('admin-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
}

/**
 * Configura todos os outros listeners (formulários, modais, etc.)
 */
function setupEventListeners() {
    // Formulário de Nova Entrega
    const deliveryForm = document.getElementById('delivery-form');
    if (deliveryForm) {
        deliveryForm.addEventListener('submit', handleNewDelivery);
    }

    // Formulário de Adicionar Cliente
    const addClientForm = document.getElementById('form-add-cliente');
    if (addClientForm) {
        addClientForm.addEventListener('submit', handleNewClient);
    }

    // Formulário de Adicionar Motorista
    const addDriverForm = document.getElementById('form-add-motorista');
    if (addDriverForm) {
        addDriverForm.addEventListener('submit', handleNewDriver);
    }

    // Formulário de Editar Cliente
    const editClientForm = document.getElementById('form-edit-cliente');
    if (editClientForm) {
        editClientForm.addEventListener('submit', handleEditClient);
    }

    // Formulário de Editar Motorista
    const editDriverForm = document.getElementById('form-edit-motorista');
    if (editDriverForm) {
        editDriverForm.addEventListener('submit', handleEditDriver);
    }

    // Preview da Imagem da Encomenda
    const deliveryImageInput = document.getElementById('delivery-image');
    if (deliveryImageInput) {
        deliveryImageInput.addEventListener('change', setupImagePreview);
    }
}

// ===============================================
// FUNÇÕES DE NAVEGAÇÃO E UI
// ===============================================

/**
 * Mostra uma página de conteúdo e esconde as outras
 * @param {string} pageId O ID da página (ex: 'visao-geral')
 */
function showPage(pageId) {
    const pages = document.querySelectorAll('.content-page');
    pages.forEach(page => {
        page.classList.add('hidden');
    });

    const pageToShow = document.getElementById(pageId);
    if (pageToShow) {
        pageToShow.classList.remove('hidden');
    }

    // Atualiza o título principal
    const title = document.getElementById('main-title');
    if (title) {
        const navElement = document.querySelector(`.menu-item a[href*="${pageId}"]`) || document.querySelector(`.menu-item.active a`);
        title.textContent = pageId === 'form-nova-entrega' ? 'Nova Entrega' : (navElement ? navElement.textContent.trim() : 'Dashboard');
    }
}

/**
 * Define o item do menu da sidebar como "ativo"
 * @param {string} navId O ID do item de navegação (ex: 'nav-clientes')
 */
function setActiveNav(navId) {
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    menuItems.forEach(item => {
        item.classList.remove('active');
    });

    const navElement = document.getElementById(navId);
    if (navElement) {
        navElement.classList.add('active');
    }
}

/**
 * Mostra o formulário de Nova Entrega com o tipo de serviço correto
 * @param {string} serviceType O tipo de serviço (ex: 'doc', 'farma')
 */
function showServiceForm(serviceType) {
    if (serviceType === 'config') {
        showCustomAlert('Informação', 'A página de Configurações ainda está em desenvolvimento.');
        return;
    }

    // Limpa o formulário antes de mostrar
    const form = document.getElementById('delivery-form');
    if (form) form.reset();
    
    // Reseta o dropdown de cliente (para o estado manual)
    const clientSelect = document.getElementById('delivery-client-select');
    if (clientSelect) clientSelect.value = '';
    // Dispara o evento 'change' manualmente para limpar e desbloquear os campos
    clientSelect.dispatchEvent(new Event('change')); 
    
    // Limpa o preview da imagem
    removeImage();
    
    // Reseta o mapa
    if (marker) {
        marker.setLatLng([ -25.96553, 32.58322 ]); // Posição inicial (Maputo)
    }
    document.getElementById('delivery-lat').value = '';
    document.getElementById('delivery-lng').value = '';


    // Define o tipo de serviço no input escondido
    document.getElementById('service-type').value = serviceType;
    
    // Navega para a página do formulário
    showPage('form-nova-entrega');
    // Define o menu "Nova Entrega" como ativo
    setActiveNav('nav-visao-geral'); // Para remover o 'active' de outros
    const newDeliveryNav = document.querySelector('.menu-item.has-submenu');
    if (newDeliveryNav) newDeliveryNav.classList.add('active');

    // Atualiza o título
    const title = document.getElementById('main-title');
    if (title) {
        const serviceTitles = {
            'doc': 'Nova Entrega: Tramitação de Documentos',
            'farma': 'Nova Entrega: Produtos Farmacêuticos',
            'carga': 'Nova Entrega: Transporte de Cargas',
            'rapido': 'Nova Entrega: Delivery Rápido',
            'outros': 'Nova Entrega: Outros Serviços'
        };
        title.textContent = serviceTitles[serviceType] || 'Nova Entrega';
    }
}

/**
 * Mostra/Esconde o formulário de "Adicionar Novo Cliente"
 * @param {boolean} show Para mostrar (true) ou esconder (false)
 */
function showAddClientForm(show) {
    const form = document.getElementById('form-add-cliente');
    const button = document.getElementById('btn-show-client-form');
    if (show) {
        form.classList.remove('hidden');
        button.classList.add('hidden');
    } else {
        form.classList.add('hidden');
        button.classList.remove('hidden');
        form.reset();
    }
}

/**
 * Mostra/Esconde o formulário de "Adicionar Novo Motorista"
 * @param {boolean} show Para mostrar (true) ou esconder (false)
 */
function showAddDriverForm(show) {
    const form = document.getElementById('form-add-motorista');
    const button = document.getElementById('btn-show-driver-form');
    if (show) {
        form.classList.remove('hidden');
        button.classList.add('hidden');
    } else {
        form.classList.add('hidden');
        button.classList.remove('hidden');
        form.reset();
    }
}

// ===============================================
// FUNÇÕES DE (LOAD) CARREGAMENTO DE DADOS
// ===============================================

/**
 * Carrega estatísticas da Visão Geral (simulado)
 */
async function loadDashboardStats() {
    // Esta função deve buscar dados de /api/orders/stats ou similar
    // Como não tenho esse endpoint, vou simular:
    document.getElementById('stats-pendentes').textContent = '...';
    document.getElementById('stats-em-transito').textContent = '...';
    document.getElementById('stats-concluidas-hoje').textContent = '...';
    document.getElementById('stats-motoristas-online').textContent = '...';
    
    // TODO: Adicionar lógica do Gráfico (Chart.js)
}

/**
 * (CORRIGIDA)
 * Carrega TODOS os clientes da API e popula a tabela de gestão
 * E TAMBÉM o dropdown de seleção no formulário de nova entrega.
 */
async function loadClients() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/clients', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            throw new Error('Falha ao carregar clientes');
        }

        const data = await res.json();
        const clients = data.clients;

        // --- 1. Popular a Tabela de Clientes (na página "Clientes") ---
        const tableBody = document.getElementById('clients-table-body');
        if (tableBody) {
            tableBody.innerHTML = ''; // Limpa a tabela
            if (clients.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4">Nenhum cliente registado.</td></tr>';
            }
            clients.forEach(client => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${client.nome}</td>
                    <td>${client.telefone}</td>
                    <td>${client.empresa || 'N/A'}</td>
                    <td class="table-actions">
                        <button class="btn-action-small" onclick="openEditClientModal('${client._id}')"><i class="fas fa-edit"></i> Editar</button>
                        <button class="btn-action-small btn-info" onclick="openStatementModal('${client._id}', '${client.nome}')"><i class="fas fa-file-invoice-dollar"></i> Extrato</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        }

        // --- 2. (A CORREÇÃO) Popular o Dropdown (na página "Nova Entrega") ---
        const clientSelect = document.getElementById('delivery-client-select');
        if (clientSelect) {
            // Limpa o dropdown, mantendo a primeira opção
            clientSelect.innerHTML = '<option value="">-- Ou digite manualmente abaixo --</option>'; 
            
            clients.forEach(client => {
                const option = document.createElement('option');
                option.value = client._id; // O ID do cliente
                option.textContent = `${client.nome} (${client.telefone})`; // O texto visível
                
                // (Truque) Armazenamos os dados no próprio <option>
                // para usar depois no auto-preenchimento
                option.dataset.nome = client.nome;
                option.dataset.telefone = client.telefone;
                
                clientSelect.appendChild(option);
            });
        }

    } catch (error) {
        console.error('Erro em loadClients:', error);
        showCustomAlert('Erro', 'Não foi possível carregar a lista de clientes.');
    }
}

/**
 * Carrega os motoristas e popula a tabela
 */
async function loadDrivers() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/drivers', { // Assumindo que a rota é /api/drivers
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Falha ao carregar motoristas');

        const data = await res.json(); 
        const drivers = data.drivers; // Assumindo que a resposta é { drivers: [...] }

        const tableBody = document.getElementById('drivers-table-body');
        tableBody.innerHTML = '';
        if (drivers.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">Nenhum motorista registado.</td></tr>';
        }
        
        drivers.forEach(driver => {
            const statusMap = {
                'online_livre': '<span class="status status-online">Online (Livre)</span>',
                'online_ocupado': '<span class="status status-ocupado">Online (Ocupado)</span>',
                'offline': '<span class="status status-offline">Offline</span>'
            };
            const statusHTML = statusMap[driver.status] || `<span class="status status-offline">${driver.status}</span>`;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${driver.user.nome}</td>
                <td>${driver.user.telefone}</td>
                <td>${driver.vehicle_plate || 'N/A'}</td>
                <td>${statusHTML}</td>
                <td class="table-actions">
                    <button class="btn-action-small" onclick="openEditDriverModal('${driver._id}')"><i class="fas fa-edit"></i> Editar</button>
                    <button class="btn-action-small btn-info" onclick="openDriverReportModal('${driver._id}')"><i class="fas fa-chart-bar"></i> Relatório</button>
                </td>
            `;
            tableBody.appendChild(row);
        });

    } catch (error) {
        console.error('Erro em loadDrivers:', error);
        showCustomAlert('Erro', 'Não foi possível carregar a lista de motoristas.');
    }
}

/**
 * Carrega as encomendas ativas
 */
async function loadActiveOrders() {
     try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/orders/active', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Falha ao carregar encomendas ativas');

        const data = await res.json();
        const orders = data.orders;

        const tableBody = document.getElementById('active-orders-table-body');
        tableBody.innerHTML = '';
        if (orders.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6">Nenhuma encomenda ativa no momento.</td></tr>';
        }
        
        orders.forEach(order => {
            const statusMap = {
                'pendente': '<span class="status status-pendente">Pendente</span>',
                'atribuido': '<span class="status status-atribuido">Atribuído</span>',
                'em_progresso': '<span class="status status-ocupado">Em Progresso</span>'
            };
            const statusHTML = statusMap[order.status] || `<span class="status">${order.status}</span>`;
            
            let driverName = 'N/A';
            if (order.assigned_to_driver && order.assigned_to_driver.user) {
                driverName = order.assigned_to_driver.user.nome;
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>#${order._id.substring(order._id.length - 6).toUpperCase()}</td>
                <td>${order.client_name}</td>
                <td>${order.client_phone1}</td>
                <td>${statusHTML}</td>
                <td>${driverName}</td>
                <td class="table-actions">
                    ${order.status === 'pendente' ? 
                        `<button class="btn-action-small btn-submit" onclick="openAssignModal('${order._id}')"><i class="fas fa-user-plus"></i> Atribuir</button>` : 
                        `<button class="btn-action-small" onclick="openHistoryDetailModal('${order._id}')"><i class="fas fa-eye"></i> Ver</button>`
                    }
                </td>
            `;
            tableBody.appendChild(row);
        });

     } catch (error) {
        console.error('Erro em loadActiveOrders:', error);
        showCustomAlert('Erro', 'Não foi possível carregar as encomendas ativas.');
     }
}

/**
 * Carrega o histórico de encomendas
 */
async function loadHistory() {
     try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/orders/history', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Falha ao carregar histórico');

        const data = await res.json();
        const orders = data.orders;

        const tableBody = document.getElementById('history-orders-table-body');
        tableBody.innerHTML = '';
        if (orders.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6">Nenhum histórico encontrado.</td></tr>';
        }

        orders.forEach(order => {
            const driverName = (order.assigned_to_driver && order.assigned_to_driver.user) ? order.assigned_to_driver.user.nome : 'N/A';
            
            let duration = 'N/A';
            if (order.timestamp_started && order.timestamp_completed) {
                const start = new Date(order.timestamp_started);
                const end = new Date(order.timestamp_completed);
                const diffMs = end - start;
                const diffMins = Math.round(diffMs / 60000);
                duration = `${diffMins} min`;
            }
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>#${order._id.substring(order._id.length - 6).toUpperCase()}</td>
                <td>${order.client_name}</td>
                <td>${order.service_type}</td>
                <td>${driverName}</td>
                <td>${duration}</td>
                <td class="table-actions">
                    <button class="btn-action-small" onclick="openHistoryDetailModal('${order._id}')"><i class="fas fa-eye"></i> Detalhes</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
     } catch (error) {
        console.error('Erro em loadHistory:', error);
        showCustomAlert('Erro', 'Não foi possível carregar o histórico.');
     }
}

// ===============================================
// (CORREÇÃO) SETUP DO DROPDOWN DE CLIENTE
// ===============================================

/**
 * (NOVA FUNÇÃO - CORREÇÃO)
 * Configura o Event Listener para o dropdown de seleção de cliente.
 * Isto preenche automaticamente os campos de nome e telefone.
 */
function setupClientSelectionListener() {
    const clientSelect = document.getElementById('delivery-client-select');
    
    // Inputs do formulário
    const clientIdInput = document.getElementById('delivery-client-id');
    const clientNameInput = document.getElementById('client-name');
    const clientPhone1Input = document.getElementById('client-phone1');

    if (!clientSelect || !clientIdInput || !clientNameInput || !clientPhone1Input) {
        console.warn('Não foi possível encontrar todos os elementos do formulário de cliente.');
        return;
    }

    // Ouve pelo evento 'change' (quando o admin seleciona um cliente)
    clientSelect.addEventListener('change', (e) => {
        // Pega o <option> que foi selecionado
        const selectedOption = e.target.options[e.target.selectedIndex];

        if (selectedOption.value) {
            // Um cliente FOI selecionado
            
            // 1. Pega os dados que guardámos no <option>
            const clientId = selectedOption.value;
            const nome = selectedOption.dataset.nome;
            const telefone = selectedOption.dataset.telefone;

            // 2. Preenche os campos do formulário
            clientIdInput.value = clientId; // O MAIS IMPORTANTE!
            clientNameInput.value = nome;
            clientPhone1Input.value = telefone;

            // 3. Bloqueia os campos para evitar edição manual
            clientNameInput.readOnly = true;
            clientPhone1Input.readOnly = true;
            clientNameInput.style.backgroundColor = '#eee'; // Feedback visual
            clientPhone1Input.style.backgroundColor = '#eee'; // Feedback visual

        } else {
            // O admin selecionou "-- Ou digite manualmente abaixo --"
            
            // 1. Limpa os campos
            clientIdInput.value = ''; // MUITO IMPORTANTE!
            clientNameInput.value = '';
            clientPhone1Input.value = '';

            // 2. Desbloqueia os campos para permitir digitação manual
            clientNameInput.readOnly = false;
            clientPhone1Input.readOnly = false;
            clientNameInput.style.backgroundColor = '#fff';
            clientPhone1Input.style.backgroundColor = '#fff';
        }
    });
}

// ===============================================
// FUNÇÕES DE (HANDLE) SUBMISSÃO DE FORMULÁRIOS
// ===============================================

/**
 * Handle: Submissão do formulário de Nova Entrega
 */
async function handleNewDelivery(e) {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    
    try {
        submitButton.disabled = true;
        submitButton.textContent = 'A processar...';

        // Usamos FormData por causa do upload da imagem
        const formData = new FormData(form);
        
        // Os campos do mapa (lat/lng) e o ID do cliente são inputs 'hidden'
        // e já são apanhados pelo new FormData(form)
        // graças aos seus atributos 'name'

        const res = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                // NÃO definir 'Content-Type', o browser faz isso
                // automaticamente com FormData
            },
            body: formData
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || 'Erro ao criar encomenda');
        }

        showCustomAlert('Sucesso!', 'Encomenda criada com sucesso.');
        form.reset();
        removeImage(); // Limpa o preview da imagem
        loadActiveOrders(); // Atualiza a tabela de encomendas ativas
        showPage('entregas-activas'); // Muda para a página de encomendas ativas
        setActiveNav('nav-entregas');

    } catch (error) {
        console.error('Erro ao criar encomenda:', error);
        showCustomAlert('Erro', error.message || 'Não foi possível criar a encomenda.');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Gerar Pedido e Atribuir';
    }
}

/**
 * Handle: Submissão do formulário de Novo Cliente
 */
async function handleNewClient(e) {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    
    const clientData = {
        nome: document.getElementById('client-nome').value,
        telefone: document.getElementById('client-telefone').value,
        empresa: document.getElementById('client-empresa').value,
        email: document.getElementById('client-email').value,
        nuit: document.getElementById('client-nuit').value,
        endereco: document.getElementById('client-endereco').value,
    };

    try {
        submitButton.disabled = true;
        submitButton.textContent = 'A salvar...';

        const res = await fetch('/api/clients', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(clientData)
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || 'Erro ao criar cliente');
        }

        showCustomAlert('Sucesso!', 'Cliente criado com sucesso.');
        loadClients(); // Atualiza a tabela E o dropdown
        showAddClientForm(false); // Esconde o formulário

    } catch (error) {
        console.error('Erro ao criar cliente:', error);
        showCustomAlert('Erro', error.message || 'Não foi possível criar o cliente.');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Salvar Cliente';
    }
}

/**
 * Handle: Submissão do formulário de Novo Motorista
 */
async function handleNewDriver(e) {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');

    const driverData = {
        nome: document.getElementById('driver-name').value,
        telefone: document.getElementById('driver-phone').value,
        email: document.getElementById('driver-email').value,
        password: document.getElementById('driver-password').value,
        vehicle_plate: document.getElementById('driver-plate').value,
    };

    try {
        submitButton.disabled = true;
        submitButton.textContent = 'A salvar...';

        const res = await fetch('/api/users/register/driver', { // Assumindo esta rota para criar motorista
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(driverData)
        });
        
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || 'Erro ao registar motorista');
        }
        
        showCustomAlert('Sucesso!', 'Motorista registado com sucesso.');
        loadDrivers(); // Atualiza a tabela de motoristas
        showAddDriverForm(false); // Esconde o formulário

    } catch (error) {
        console.error('Erro ao registar motorista:', error);
        showCustomAlert('Erro', error.message || 'Não foi possível registar o motorista.');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Salvar Motorista';
    }
}

/**
 * Handle: Submissão do formulário de Editar Cliente
 */
async function handleEditClient(e) {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    
    const clientId = document.getElementById('edit-client-id').value;

    const clientData = {
        nome: document.getElementById('edit-client-nome').value,
        telefone: document.getElementById('edit-client-telefone').value,
        empresa: document.getElementById('edit-client-empresa').value,
        email: document.getElementById('edit-client-email').value,
        nuit: document.getElementById('edit-client-nuit').value,
        endereco: document.getElementById('edit-client-endereco').value,
    };

    try {
        submitButton.disabled = true;
        submitButton.textContent = 'A salvar...';

        const res = await fetch(`/api/clients/${clientId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(clientData)
        });
        
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || 'Erro ao atualizar cliente');
        }
        
        showCustomAlert('Sucesso!', 'Cliente atualizado com sucesso.');
        loadClients(); // Atualiza a tabela E o dropdown
        closeEditClientModal(); // Fecha o modal

    } catch (error) {
        console.error('Erro ao atualizar cliente:', error);
        showCustomAlert('Erro', error.message || 'Não foi possível atualizar o cliente.');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Salvar Alterações';
    }
}

/**
 * Handle: Submissão do formulário de Editar Motorista
 */
async function handleEditDriver(e) {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    
    const driverId = document.getElementById('edit-driver-id').value;

    const driverData = {
        nome: document.getElementById('edit-driver-name').value,
        telefone: document.getElementById('edit-driver-phone').value,
        vehicle_plate: document.getElementById('edit-driver-plate').value,
        status: document.getElementById('edit-driver-status').value,
    };

    try {
        submitButton.disabled = true;
        submitButton.textContent = 'A salvar...';

        // Assumindo a rota /api/drivers/:id para atualizar o perfil
        const res = await fetch(`/api/drivers/${driverId}`, { 
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(driverData)
        });
        
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || 'Erro ao atualizar motorista');
        }
        
        showCustomAlert('Sucesso!', 'Motorista atualizado com sucesso.');
        loadDrivers(); // Atualiza a tabela
        closeEditDriverModal(); // Fecha o modal

    } catch (error) {
        console.error('Erro ao atualizar motorista:', error);
        showCustomAlert('Erro', error.message || 'Não foi possível atualizar o motorista.');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Salvar Alterações';
    }
}

/**
 * Handle: Geração do Extrato do Cliente
 */
async function handleGenerateStatement() {
    const token = localStorage.getItem('token');
    const clientId = document.getElementById('statement-client-id').value;
    const startDate = document.getElementById('statement-start-date').value;
    const endDate = document.getElementById('statement-end-date').value;

    if (!startDate || !endDate) {
        showCustomAlert('Atenção', 'Por favor, selecione a data de início e a data de fim.');
        return;
    }

    try {
        const res = await fetch(`/api/clients/${clientId}/statement?startDate=${startDate}&endDate=${endDate}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || 'Erro ao gerar extrato');
        }

        // Exibir resultados
        document.getElementById('statement-total-value').textContent = `${data.totalValue.toFixed(2)} MZN`;
        document.getElementById('statement-total-orders').textContent = data.totalOrders;
        
        const tableBody = document.getElementById('statement-table-body');
        tableBody.innerHTML = '';
        
        if (data.ordersList.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4">Nenhum pedido concluído encontrado neste período.</td></tr>';
        } else {
            data.ordersList.forEach(order => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${new Date(order.timestamp_completed).toLocaleDateString('pt-MZ')}</td>
                    <td>#${order._id.substring(order._id.length - 6).toUpperCase()}</td>
                    <td>${order.service_type}</td>
                    <td>${order.price.toFixed(2)} MZN</td>
                `;
                tableBody.appendChild(row);
            });
        }
        
        // Formata o título do range
        const start = new Date(startDate);
        const end = new Date(endDate);
        document.getElementById('statement-date-range').textContent = `Pedidos Concluídos de ${start.toLocaleDateString('pt-MZ')} a ${end.toLocaleDateString('pt-MZ')}`;


        document.getElementById('statement-results').classList.remove('hidden');

    } catch (error) {
        console.error('Erro ao gerar extrato:', error);
        showCustomAlert('Erro', error.message);
    }
}

// ===============================================
// LÓGICA DOS MODAIS (ABRIR/FECHAR)
// ===============================================

/**
 * Abre o modal de Editar Cliente e preenche com os dados
 * @param {string} clientId O ID do cliente
 */
async function openEditClientModal(clientId) {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/clients/${clientId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Cliente não encontrado');
        
        const data = await res.json();
        const client = data.client;

        // Preenche o formulário
        document.getElementById('edit-client-id').value = client._id;
        document.getElementById('edit-client-nome').value = client.nome;
        document.getElementById('edit-client-telefone').value = client.telefone;
        document.getElementById('edit-client-empresa').value = client.empresa || '';
        document.getElementById('edit-client-email').value = client.email || '';
        document.getElementById('edit-client-nuit').value = client.nuit || '';
        document.getElementById('edit-client-endereco').value = client.endereco || '';
        
        // Abre o modal
        document.getElementById('edit-client-modal').classList.remove('hidden');

    } catch (error) {
        console.error('Erro ao buscar cliente:', error);
        showCustomAlert('Erro', 'Não foi possível carregar os dados do cliente.');
    }
}
function closeEditClientModal() {
    document.getElementById('edit-client-modal').classList.add('hidden');
}

/**
 * Abre o modal de Editar Motorista e preenche com os dados
 * @param {string} driverId O ID do Perfil de Motorista
 */
async function openEditDriverModal(driverId) {
     try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/drivers/${driverId}`, { // Assumindo rota /api/drivers/:id
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Motorista não encontrado');
        
        const data = await res.json();
        const driver = data.driver; // Assumindo { driver: {...} }

        // Preenche o formulário
        document.getElementById('edit-driver-id').value = driver._id;
        document.getElementById('edit-driver-name').value = driver.user.nome;
        document.getElementById('edit-driver-phone').value = driver.user.telefone;
        document.getElementById('edit-driver-plate').value = driver.vehicle_plate || '';
        document.getElementById('edit-driver-status').value = driver.status;
        
        // Abre o modal
        document.getElementById('edit-driver-modal').classList.remove('hidden');

    } catch (error) {
        console.error('Erro ao buscar motorista:', error);
        showCustomAlert('Erro', 'Não foi possível carregar os dados do motorista.');
    }
}
function closeEditDriverModal() {
    document.getElementById('edit-driver-modal').classList.add('hidden');
}

/**
 * Abre o modal de Extrato do Cliente
 * @param {string} clientId O ID do cliente
 * @param {string} clientName O Nome do cliente
 */
function openStatementModal(clientId, clientName) {
    document.getElementById('statement-client-id').value = clientId;
    document.getElementById('statement-client-name').textContent = `Extrato de: ${clientName}`;
    
    // Reseta o formulário
    document.getElementById('statement-start-date').value = '';
    document.getElementById('statement-end-date').value = '';
    document.getElementById('statement-results').classList.add('hidden');
    document.getElementById('statement-table-body').innerHTML = '';

    // Abre o modal
    document.getElementById('statement-modal').classList.remove('hidden');
}
function closeStatementModal() {
    document.getElementById('statement-modal').classList.add('hidden');
}

// ... (Adicione aqui as funções para ABRIR e FECHAR os outros modais) ...
// openAssignModal, closeAssignModal
// openHistoryDetailModal, closeHistoryDetailModal
// openDriverReportModal, closeDriverReportModal
// etc.

// Exemplo para o modal de Alerta Customizado
function showCustomAlert(title, message) {
    document.getElementById('custom-alert-title').textContent = title;
    document.getElementById('custom-alert-message').textContent = message;
    document.getElementById('custom-alert-modal').classList.remove('hidden');
}
function closeCustomAlert() {
    document.getElementById('custom-alert-modal').classList.add('hidden');
}


// ===============================================
// FUNÇÕES AUXILIARES (Mapa, Imagem, PDF, Logout)
// ===============================================

/**
 * Inicializa o mapa Leaflet no formulário de Nova Entrega
 */
function initMap() {
    try {
        // Posição inicial (Maputo)
        const mapCenter = [-25.96553, 32.58322];
        
        map = L.map('map').setView(mapCenter, 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        // Ícone personalizado (exemplo)
        leafletIcon = L.icon({
            iconUrl: 'https://i.postimg.cc/4xkWBYss/ISOTIPO.png', // URL do seu isotipo
            iconSize: [38, 38], 
            iconAnchor: [19, 38], 
            popupAnchor: [0, -38] 
        });

        marker = L.marker(mapCenter, { 
            draggable: true,
            icon: leafletIcon 
        }).addTo(map);

        // Atualiza os inputs hidden quando o marcador é movido
        marker.on('dragend', function(e) {
            const position = marker.getLatLng();
            document.getElementById('delivery-lat').value = position.lat;
            document.getElementById('delivery-lng').value = position.lng;
        });

    } catch (error) {
        console.error("Erro ao inicializar o mapa:", error);
        document.getElementById('map').innerHTML = "Não foi possível carregar o mapa. Verifique a sua conexão.";
    }
}

/**
 * Mostra o preview da imagem selecionada no formulário
 */
function setupImagePreview() {
    const input = document.getElementById('delivery-image');
    const previewContainer = document.getElementById('image-preview');
    const previewImg = previewContainer.querySelector('.preview-img');
    
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImg.src = e.target.result;
            previewContainer.classList.remove('hidden');
        }
        reader.readAsDataURL(file);
    }
}

/**
 * Remove o preview da imagem e limpa o input
 */
function removeImage() {
    const input = document.getElementById('delivery-image');
    const previewContainer = document.getElementById('image-preview');
    const previewImg = previewContainer.querySelector('.preview-img');
    
    input.value = null; // Limpa o ficheiro
    previewImg.src = '';
    previewContainer.classList.add('hidden');
}

/**
 * Define as datas de início e fim para o extrato
 * @param {string} range 'this_week' ou 'this_month'
 */
function setStatementDates(range) {
    const today = new Date();
    const startDateInput = document.getElementById('statement-start-date');
    const endDateInput = document.getElementById('statement-end-date');
    
    let startDate;
    const endDate = new Date(today);

    if (range === 'this_week') {
        const dayOfWeek = today.getDay();
        startDate = new Date(today);
        startDate.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)); // Assume Segunda como início
    } else if (range === 'this_month') {
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    }
    
    // Formata para 'YYYY-MM-DD'
    startDateInput.value = startDate.toISOString().split('T')[0];
    endDateInput.value = endDate.toISOString().split('T')[0];
}

/**
 * Handle: Download do Extrato em PDF
 */
function handleDownloadPDF() {
    showCustomAlert('Informação', 'A funcionalidade de download de PDF (jsPDF) ainda está em implementação.');
    
    // --- LÓGICA DO jspdf (Exemplo) ---
    // const { jsPDF } = window.jspdf;
    // const doc = new jsPDF();
    // 
    // const clientName = document.getElementById('statement-client-name').textContent;
    // const dateRange = document.getElementById('statement-date-range').textContent;
    // const totalValue = document.getElementById('statement-total-value').textContent;
    //
    // doc.text(clientName, 20, 20);
    // doc.text(dateRange, 20, 30);
    // doc.text(`Total: ${totalValue}`, 20, 40);
    //
    // // Pega os dados da tabela
    // const tableData = [];
    // const rows = document.querySelectorAll('#statement-table-body tr');
    // rows.forEach(row => {
    //     const rowData = [];
    //     row.querySelectorAll('td').forEach(cell => rowData.push(cell.textContent));
    //     tableData.push(rowData);
    // });
    //
    // doc.autoTable({
    //     head: [['Data', 'ID Pedido', 'Natureza', 'Valor (MZN)']],
    //     body: tableData,
    //     startY: 50
    // });
    //
    // doc.save(`Extrato_${clientName.split(': ')[1]}_${new Date().toISOString().split('T')[0]}.pdf`);
}

/**
 * Faz o logout do utilizador
 */
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user'); // Remove qualquer outra info de user
    window.location.href = 'login.html'; // Redireciona para o login
}
