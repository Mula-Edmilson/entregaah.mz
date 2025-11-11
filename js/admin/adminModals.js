/*
 * Ficheiro: js/admin/adminModals.js (VERSÃO COMPLETA E CORRIGIDA)
 *
 * Contém toda a lógica de ABERTURA e carregamento de dados
 * dos modais (pop-ups) do painel de admin.
 */

/**
 * Abre o modal genérico de confirmação (para ações destrutivas).
 * @param {object} options - { title, message, confirmText, onConfirm }
 */
function openConfirmationModal({ title, message, confirmText, onConfirm }) {
    const modal = document.getElementById('confirmation-modal');
    document.getElementById('confirmation-title').innerHTML = title;
    document.getElementById('confirmation-message').innerHTML = message;
    
    const input = document.getElementById('confirmation-input');
    const label = document.getElementById('confirmation-input-label');
    const confirmBtn = document.getElementById('btn-confirm-action');

    label.innerHTML = `Para confirmar, digite a palavra: <b>${confirmText}</b>`;
    input.value = '';
    confirmBtn.disabled = true;
    
    // Remove listeners antigos para evitar duplicação
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
        onConfirm(); // Chama a função de callback (ex: handleDeleteOldHistory)
    };

    modal.classList.remove('hidden');
}

/**
 * Abre o modal para atribuir/reatribuir uma encomenda.
 * @param {string} orderId - O ID da encomenda.
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
        
        // Atribui a função de clique ao botão (usando a função do adminApi.js)
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
 * Abre o modal para editar os dados de um motorista.
 * @param {string} driverUserId - O ID do *User* do motorista.
 */
async function openEditDriverModal(driverUserId) {
    const modal = document.getElementById('edit-driver-modal');
    modal.classList.remove('hidden');
    document.getElementById('edit-driver-id').value = driverUserId;
    
    // Limpa o formulário enquanto carrega
    document.getElementById('form-edit-motorista').reset();
    document.getElementById('edit-driver-name').value = 'A carregar...';
    document.getElementById('edit-driver-phone').value = 'A carregar...';
    
    try {
        const response = await fetch(`${API_URL}/api/drivers/${driverUserId}`, { headers: getAuthHeaders() });
        if (response.status === 401) { return handleLogout('admin'); }

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        
        const driver = data.driver;
        const profile = driver.profile || {};
        
        // Preenche o formulário
        document.getElementById('edit-driver-name').value = driver.nome;
        document.getElementById('edit-driver-phone').value = driver.telefone;
        document.getElementById('edit-driver-plate').value = profile.vehicle_plate || '';
        document.getElementById('edit-driver-status').value = profile.status || 'offline';
        document.getElementById('edit-driver-commission').value = profile.commissionRate || 20;
        
    } catch (error) { 
        console.error('Falha ao carregar dados do motorista:', error); 
        showCustomAlert('Erro', 'Erro ao carregar dados do motorista.', 'error'); 
        closeEditDriverModal(); 
    }
}

/**
 * Abre o modal com os detalhes de uma encomenda do histórico.
 * @param {string} orderId - O ID da encomenda.
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
 * Abre o modal de relatório de entregas de um motorista.
 * @param {string} driverUserId - O ID do *User* do motorista.
 * @param {string} driverName - O nome do motorista.
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
        document.getElementById('report-total-duracao').innerText = formatTotalDuration(totalMs);
        
        tableBody.innerHTML = '';
        if (orders.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">Nenhuma entrega concluída encontrada.</td></tr>';
            return;
        }
        
        orders.forEach(order => {
            const serviceName = SERVICE_NAMES[order.service_type] || order.service_type;
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
 * Abre o modal para editar os dados de um cliente.
 * @param {string} clientId - O ID do cliente.
 */
async function openEditClientModal(clientId) {
    const modal = document.getElementById('edit-client-modal');
    modal.classList.remove('hidden');
    
    // Limpa o formulário enquanto carrega
    document.getElementById('form-edit-cliente').reset();
    document.getElementById('edit-client-nome').value = 'A carregar...';
    document.getElementById('edit-client-telefone').value = 'A carregar...';

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
        closeEditClientModal();
    }
}

/**
 * Abre o modal de extrato (faturação) de um cliente.
 * @param {string} clientId - O ID do cliente.
 * @param {string} clientName - O nome do cliente.
 */
function openStatementModal(clientId, clientName) {
    const modal = document.getElementById('statement-modal');
    document.getElementById('statement-client-name').textContent = `Extrato de ${clientName}`;
    document.getElementById('statement-client-id').value = clientId;
    
    // Limpa o modal
    document.getElementById('statement-results').classList.add('hidden');
    document.getElementById('statement-table-body').innerHTML = '';
    document.getElementById('statement-start-date').value = '';
    document.getElementById('statement-end-date').value = '';
    
    modal.classList.remove('hidden');
}

/**
 * Preenche o modal de extrato com os resultados da API.
 * (Chamado por 'handleGenerateStatement' em adminApi.js)
 */
function populateStatementModal(data, startDate, endDate) {
    const { totalValue, totalOrders, ordersList } = data;
    
    const formattedTotal = new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(totalValue);
    document.getElementById('statement-total-value').textContent = formattedTotal;
    document.getElementById('statement-total-orders').textContent = `${totalOrders} Pedidos`;
    
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
 * Gera e baixa um PDF do extrato do cliente.
 * (Chamado pelo event listener em admin.js)
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

        doc.autoTable({
            html: '#statement-results .table-pedidos',
            startY: 65,
            theme: 'grid',
            styles: { fontSize: 9 },
            headStyles: { fillColor: [44, 62, 80] }
        });
        
        doc.save(`Extrato_${cleanClientName.replace(/ /g, '_')}.pdf`);

    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        showCustomAlert('Erro', 'Não foi possível gerar o PDF. Tente novamente.', 'error');
    }
}