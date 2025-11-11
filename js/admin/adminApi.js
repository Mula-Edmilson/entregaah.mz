/*
 * Ficheiro: js/admin/adminApi.js (NOVO)
 *
 * Contém toda a lógica de API (fetch) para o painel de admin.
 * (Movido de admin.js)
 */

/* --- Lógica de API (Carregamento de Dados - GET) --- */

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

async function loadFinancialStats() {
    const formatMZN = (value) => new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(value);
    try {
        const response = await fetch(`${API_URL}/api/stats/financials`, { headers: getAuthHeaders() });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        document.getElementById('stats-receita-total').innerText = formatMZN(data.totalReceita);
        document.getElementById('stats-lucro-empresa').innerText = formatMZN(data.totalLucroEmpresa);
        document.getElementById('stats-ganhos-motorista').innerText = formatMZN(data.totalGanhosMotorista);
        
        const topDriverEl = document.getElementById('stats-top-driver');
        if (data.topDriver.nome !== 'N/A') {
            topDriverEl.innerHTML = `${data.topDriver.nome} <br><small style="font-weight: 500; color: var(--text-color-light);">${formatMZN(data.topDriver.totalGanhos)}</small>`;
        } else {
            topDriverEl.innerText = 'N/A';
        }
        initFinancialPieChart(data.totalLucroEmpresa, data.totalGanhosMotorista);
    } catch (error) { 
        console.error('Falha ao carregar estatísticas financeiras:', error); 
        document.getElementById('stats-receita-total').innerText = formatMZN(0);
        document.getElementById('stats-lucro-empresa').innerText = formatMZN(0);
        document.getElementById('stats-ganhos-motorista').innerText = formatMZN(0);
        document.getElementById('stats-top-driver').innerText = 'Erro';
        initFinancialPieChart(0, 0);
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
            
            let acaoBotao = '';
            if (order.status === 'pendente') {
                acaoBotao = `<button class="btn-action-assign" onclick="openAssignModal('${order._id}')">Atribuir</button>`;
            } else if (order.status === 'atribuido') {
                acaoBotao = `<button class="btn-action-small btn-action-report" onclick="openAssignModal('${order._id}')" title="Reatribuir">
                                <i class="fas fa-exchange-alt"></i> Reatribuir
                             </button>`;
            } else { // em_progresso
                acaoBotao = 'Em Curso';
            }

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
        clientCache = data.clients; // Preenche o cache global
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
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    
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
            handleLogout('admin');
        }, 2500);

    } catch (error) {
        console.error('Falha ao mudar a senha:', error);
        showCustomAlert('Erro', error.message, 'error');
        submitButton.disabled = false;
        submitButton.innerHTML = 'Atualizar Senha';
    }
}

async function handleDeleteOldHistory() {
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
    } finally {
        // Garante que o botão do modal é reativado
        btn.disabled = false;
        btn.innerHTML = 'Confirmar e Apagar';
    }
}

async function handleNewDelivery(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    
    const autoAssign = document.getElementById('autoAssignCheckbox').checked;
    
    if (autoAssign) {
        const lat = document.getElementById('delivery-lat').value;
        const lng = document.getElementById('delivery-lng').value;
        
        if (!lat || !lng) {
            showCustomAlert('Erro de Atribuição', 'A atribuição automática requer que um PIN seja definido no mapa.', 'error');
            return;
        }
    }
    
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A gerar...';

    try {
        const response = await fetch(`${API_URL}/api/orders`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData
        });
        
        const data = await response.json(); 
        if (!response.ok) {
            throw new Error(data.message || 'Erro do servidor');
        }

        showCustomAlert('Sucesso!', `Pedido Criado! \nCódigo do Destinatário: ${data.order.verification_code}`, 'success');
        form.reset();
        removeImage();
        destroyFormMap();
        showPage('entregas-activas', 'nav-entregas', 'Entregas Activas');

    } catch (error) {
        console.error('Falha ao criar entrega:', error);
        showCustomAlert('Erro', error.message, 'error'); 
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = 'Gerar Pedido';
    }
}

async function handleAddDriver(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');

    const name = document.getElementById('driver-name').value;
    const phone = document.getElementById('driver-phone').value;
    const email = document.getElementById('driver-email').value;
    const plate = document.getElementById('driver-plate').value;
    const password = document.getElementById('driver-password').value;
    const commissionRate = document.getElementById('driver-commission').value;
    
    if (password.length < 6) {
        showCustomAlert('Atenção', 'A senha do motorista deve ter pelo menos 6 caracteres.');
        return;
    }
    
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A salvar...';

    try {
        const response = await fetch(`${API_URL}/api/auth/register-driver`, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                nome: name, 
                email, 
                telefone: phone, 
                password, 
                vehicle_plate: plate,
                commissionRate: commissionRate
            })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        showCustomAlert('Sucesso', 'Motorista adicionado com sucesso!', 'success');
        form.reset();
        showAddDriverForm(false);
        loadDrivers();
        
    } catch (error) {
        console.error('Falha ao adicionar motorista:', error);
        showCustomAlert('Erro', error.message, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = 'Salvar Motorista';
    }
}

async function handleUpdateDriver(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const userId = document.getElementById('edit-driver-id').value;
    
    const updatedData = {
        nome: document.getElementById('edit-driver-name').value,
        telefone: document.getElementById('edit-driver-phone').value,
        vehicle_plate: document.getElementById('edit-driver-plate').value,
        status: document.getElementById('edit-driver-status').value,
        commissionRate: document.getElementById('edit-driver-commission').value
    };
    
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A salvar...';

    try {
        const response = await fetch(`${API_URL}/api/drivers/${userId}`, { 
            method: 'PUT', 
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, 
            body: JSON.stringify(updatedData)
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        showCustomAlert('Sucesso', 'Motorista atualizado com sucesso!', 'success');
        closeEditDriverModal();
        loadDrivers();
        
    } catch (error) {
        console.error('Falha ao atualizar motorista:', error);
        showCustomAlert('Erro', error.message, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = 'Salvar Alterações';
    }
}

async function handleAddClient(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');

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

    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A salvar...';

    try {
        const response = await fetch(`${API_URL}/api/clients`, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(clientData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        showCustomAlert('Sucesso', 'Cliente adicionado com sucesso!', 'success');
        form.reset();
        showAddClientForm(false);
        loadClients();
    } catch (error) {
        console.error('Falha ao adicionar cliente:', error);
        showCustomAlert('Erro', error.message, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = 'Salvar Cliente';
    }
}

async function handleUpdateClient(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
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

    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A salvar...';

    try {
        const response = await fetch(`${API_URL}/api/clients/${clientId}`, {
            method: 'PUT',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        showCustomAlert('Sucesso', 'Cliente atualizado com sucesso!', 'success');
        closeEditClientModal();
        loadClients();
    } catch (error) {
        console.error('Falha ao atualizar cliente:', error);
        showCustomAlert('Erro', error.message, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = 'Salvar Alterações';
    }
}

async function handleDeleteClient(clientId, clientName) {
    // A confirmação é 'confirm', não um modal, por isso não há botão para desativar.
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
        loadClients();
    } catch (error) {
        console.error('Falha ao apagar cliente:', error);
        showCustomAlert('Erro', error.message, 'error');
    }
}

async function confirmAssign(orderId, driverId) {
    const button = document.getElementById('btn-confirm-assign');
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A atribuir...';

    try {
        const response = await fetch(`${API_URL}/api/orders/${orderId}/assign`, { 
            method: 'PUT', 
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ driverId }) 
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        showCustomAlert('Sucesso', 'Encomenda atribuída com sucesso!', 'success');
        closeAssignModal();
        loadActiveDeliveries();
    } catch (error) {
        console.error('Falha ao atribuir encomenda:', error);
        showCustomAlert('Erro', error.message, 'error');
    } finally {
        button.disabled = false;
        button.innerHTML = 'Confirmar';
    }
}

function handleChartReset() {
    // (Esta função é uma simulação, não faz chamada de API, mas adicionamos
    // feedback ao botão de confirmação)
    const password = document.getElementById('chart-reset-password').value;
    const button = document.getElementById('btn-confirm-chart-reset');
    
    if (password === 'Entregaah.wipe') {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A resetar...';

        console.log('SIMULAÇÃO: A chamar API para resetar estatísticas...');
        
        setTimeout(() => { // Simula a demora da API
            showCustomAlert('Sucesso', 'As estatísticas foram resetadas! (Simulação)', 'success');
            closeChartResetModal();
            initServicesChart(true);
            button.disabled = false;
            button.innerHTML = 'Confirmar Reset';
        }, 1000);

    } else { 
        showCustomAlert('Erro', 'Senha de reset incorreta.', 'error'); 
    }
}

async function handleGenerateStatement() {
    const button = document.getElementById('btn-generate-statement');
    const clientId = document.getElementById('statement-client-id').value;
    const startDate = document.getElementById('statement-start-date').value;
    const endDate = document.getElementById('statement-end-date').value;
    
    if (!startDate || !endDate) {
        showCustomAlert('Erro', 'Por favor, selecione uma data de início e uma data de fim.', 'error');
        return;
    }
    
    const resultsDiv = document.getElementById('statement-results');
    resultsDiv.classList.add('hidden');
    
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A gerar...';

    try {
        // showCustomAlert('A Gerar...', 'A buscar os dados do extrato.', 'info'); // (Removido para não sobrepor)
        const response = await fetch(`${API_URL}/api/clients/${clientId}/statement?startDate=${startDate}&endDate=${endDate}`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        // closeCustomAlert();
        populateStatementModal(data, startDate, endDate);
    } catch (error) {
        console.error('Falha ao gerar extrato:', error);
        showCustomAlert('Erro', error.message, 'error');
    } finally {
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-search"></i> Gerar Extrato';
    }
}