/*
 * Ficheiro: js/admin/adminApi.js
 * Substituição directa — PARTE 1
 *
 * Conteúdo:
 * - Controlo global de sessão / rate limit
 * - safeFetch()
 * - Overview (estatísticas gerais)
 * - Financeiro
 */

/* =====================================================
   CONTROLO GLOBAL DE SESSÃO / RATE LIMIT
===================================================== */
let authLocked = false;

/**
 * Fetch protegido contra:
 * - token ausente
 * - 401 (sessão expirada)
 * - 429 (rate limit)
 * Força logout UMA única vez
 */
async function safeFetch(url, options = {}) {
    if (authLocked) return null;

    const headers = {
        ...(options.headers || {}),
        ...getAuthHeaders()
    };

    // Token inexistente → abortar tudo
    if (!headers.Authorization) {
        authLocked = true;
        handleLogout('admin');
        return null;
    }

    const response = await fetch(url, { ...options, headers });

    // Sessão inválida ou bloqueada
    if (response.status === 401 || response.status === 429) {
        authLocked = true;

        showCustomAlert(
            'Sessão encerrada',
            response.status === 429
                ? 'Demasiados pedidos. Aguarde alguns minutos e volte a entrar.'
                : 'Sessão expirada. Faça login novamente.',
            'error'
        );

        setTimeout(() => handleLogout('admin'), 2000);
        return null;
    }

    return response;
}

/* =====================================================
   OVERVIEW / VISÃO GERAL
===================================================== */
async function loadOverviewStats() {
    try {
        const response = await safeFetch(`${API_URL}/api/stats/overview`);
        if (!response) return;

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);

        document.getElementById('stats-pendentes').innerText = data.pendentes;
        document.getElementById('stats-em-transito').innerText = data.emTransito;
        document.getElementById('stats-concluidas-hoje').innerText = data.concluidasHoje;
        document.getElementById('stats-motoristas-online').innerText = data.motoristasOnline;

        initDeliveriesStatusChart(
            data.pendentes || 0,
            data.emTransito || 0
        );

    } catch (error) {
        console.error('Falha ao carregar estatísticas gerais:', error);
        initDeliveriesStatusChart(0, 0);
    }
}

/* =====================================================
   FINANCEIRO
===================================================== */
async function loadFinancialStats() {
    const formatMZN = (value) =>
        new Intl.NumberFormat('pt-MZ', {
            style: 'currency',
            currency: 'MZN'
        }).format(value || 0);

    try {
        const response = await safeFetch(`${API_URL}/api/stats/financials`);
        if (!response) return;

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);

        document.getElementById('stats-receita-total').innerText =
            formatMZN(data.totalReceita);

        document.getElementById('stats-lucro-empresa').innerText =
            formatMZN(data.totalLucroEmpresa);

        document.getElementById('stats-ganhos-motorista').innerText =
            formatMZN(data.totalGanhosMotorista);

        const topDriverEl = document.getElementById('stats-top-driver');

        if (data.topDriver && data.topDriver.nome && data.topDriver.nome !== 'N/A') {
            topDriverEl.innerHTML = `
                ${data.topDriver.nome}
                <br>
                <small style="font-weight:500;">
                    ${formatMZN(data.topDriver.totalGanhos)}
                </small>
            `;
        } else {
            topDriverEl.innerText = 'N/A';
        }

        initFinancialPieChart(
            data.totalLucroEmpresa || 0,
            data.totalGanhosMotorista || 0
        );

    } catch (error) {
        console.error('Falha ao carregar dados financeiros:', error);

        document.getElementById('stats-receita-total').innerText = formatMZN(0);
        document.getElementById('stats-lucro-empresa').innerText = formatMZN(0);
        document.getElementById('stats-ganhos-motorista').innerText = formatMZN(0);
        document.getElementById('stats-top-driver').innerText = 'Erro';

        initFinancialPieChart(0, 0);
    }
}

/* =====================================================
   CUSTOS — DASHBOARD / RESUMO
===================================================== */
async function loadCostsDashboardSummary() {
    const formatMZN = (value) =>
        new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(value || 0);

    const despesasEl = document.getElementById('stats-despesas-mes');
    const saldoEl = document.getElementById('stats-saldo-mes');
    const tableBody = document.getElementById('costs-latest-table-body');

    // Se a secção não existir, sai silenciosamente
    if (!despesasEl || !saldoEl) return;

    despesasEl.innerText = '.';
    saldoEl.innerText = '.';
    if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="5">A carregar...</td></tr>';
    }

    try {
        const response = await safeFetch(
            `${API_URL}/api/costs/dashboard-summary?months=6`
        );
        if (!response) return;

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);

        const current = data.currentMonth || { totalCosts: 0, costsByCategory: {} };
        const history = data.history || { labels: [], revenue: [], costs: [] };

        // Card: despesas do mês
        despesasEl.innerText = formatMZN(current.totalCosts);

        // Card: saldo (receita - despesas)
        let saldo = 0;
        if (Array.isArray(history.labels) && history.labels.length > 0) {
            const lastIndex = history.labels.length - 1;
            const receitaMesAtual = history.revenue[lastIndex] || 0;
            saldo = receitaMesAtual - (current.totalCosts || 0);
        }
        saldoEl.innerText = formatMZN(saldo);

        // Gráficos
        initCostsByCategoryChart(current.costsByCategory || {});
        initRevenueVsCostsChart(
            history.labels || [],
            history.revenue || [],
            history.costs || []
        );

        // Tabela: últimos custos
        if (tableBody) {
            let monthParam = null;
            if (current.label && current.label.includes('/')) {
                const [mm, yyyy] = current.label.split('/');
                monthParam = `${yyyy}-${mm}`;
            }
            await loadLatestCosts(tableBody, monthParam);
        }

    } catch (error) {
        console.error('Falha ao carregar resumo de custos:', error);
        despesasEl.innerText = formatMZN(0);
        saldoEl.innerText = formatMZN(0);

        if (tableBody) {
            tableBody.innerHTML =
                '<tr><td colspan="5">Erro ao carregar custos.</td></tr>';
        }

        initCostsByCategoryChart({});
        initRevenueVsCostsChart([], [], []);
    }
}

/* =====================================================
   GRÁFICOS DE CUSTOS
===================================================== */
function initCostsByCategoryChart(costsByCategory) {
    const canvas = document.getElementById('costsByCategoryChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (costsByCategoryChart) {
        costsByCategoryChart.destroy();
        costsByCategoryChart = null;
    }

    const keys = Object.keys(COST_CATEGORY_LABELS);
    const labels = keys.map(k => COST_CATEGORY_LABELS[k]);
    const values = keys.map(k =>
        typeof costsByCategory[k] === 'number' ? costsByCategory[k] : 0
    );

    costsByCategoryChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Despesas (MZN)',
                data: values,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function initRevenueVsCostsChart(labels, revenueData, costsData) {
    const canvas = document.getElementById('revenueVsCostsChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (revenueVsCostsChart) {
        revenueVsCostsChart.destroy();
        revenueVsCostsChart = null;
    }

    revenueVsCostsChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: Array.isArray(labels) ? labels : [],
            datasets: [
                {
                    label: 'Receita (MZN)',
                    data: Array.isArray(revenueData) ? revenueData : [],
                    tension: 0.3
                },
                {
                    label: 'Custos (MZN)',
                    data: Array.isArray(costsData) ? costsData : [],
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

/* =====================================================
   DROPDOWN DE ATRIBUIÇÃO DE CUSTOS
===================================================== */
async function loadCostAssignmentOptions() {
    const select = document.getElementById('cost-assigned-entity');
    if (!select) return;

    select.innerHTML = '<option value="">-- Não atribuir --</option>';

    try {
        // Motoristas
        const driversResp = await safeFetch(`${API_URL}/api/drivers`);
        if (!driversResp) return;

        const driversData = await driversResp.json();

        // Clientes
        const clientsResp = await safeFetch(`${API_URL}/api/clients`);
        if (!clientsResp) return;

        const clientsData = await clientsResp.json();

        if (driversData.drivers && driversData.drivers.length > 0) {
            const optGroupStaff = document.createElement('optgroup');
            optGroupStaff.label = 'Funcionários (Motoristas)';

            driversData.drivers.forEach(d => {
                const opt = document.createElement('option');
                opt.value = `driver:${d._id}`;
                opt.textContent = d.nome || d.name || 'Motorista';
                optGroupStaff.appendChild(opt);
            });

            select.appendChild(optGroupStaff);
        }

        if (clientsData.clients && clientsData.clients.length > 0) {
            const optGroupClients = document.createElement('optgroup');
            optGroupClients.label = 'Clientes';

            clientsData.clients.forEach(c => {
                const opt = document.createElement('option');
                opt.value = `client:${c._id}`;
                opt.textContent = c.nome || c.name || 'Cliente';
                optGroupClients.appendChild(opt);
            });

            select.appendChild(optGroupClients);
        }

    } catch (error) {
        console.error(
            'Falha ao carregar opções de atribuição de custos:',
            error
        );
    }
}

/* =====================================================
   TABELA: ÚLTIMOS CUSTOS
===================================================== */
async function loadLatestCosts(tableBody, monthParam) {
    try {
        const params = new URLSearchParams();
        params.set('limit', '10');
        if (monthParam) params.set('month', monthParam);

        const response = await safeFetch(
            `${API_URL}/api/costs?${params.toString()}`
        );
        if (!response) return;

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);

        const formatMZN = (value) =>
            new Intl.NumberFormat('pt-MZ', {
                style: 'currency',
                currency: 'MZN'
            }).format(value || 0);

        tableBody.innerHTML = '';

        if (!data.costs || data.costs.length === 0) {
            tableBody.innerHTML =
                '<tr><td colspan="5">Sem registos de custos.</td></tr>';
            return;
        }

        data.costs.forEach(cost => {
            const dateStr = cost.date
                ? new Date(cost.date).toLocaleDateString('pt-MZ')
                : '';

            let assignedStr = '-';
            if (cost.assignedUser?.nome) {
                assignedStr = `Funcionário: ${cost.assignedUser.nome}`;
            } else if (cost.assignedClient?.nome) {
                assignedStr = `Cliente: ${cost.assignedClient.nome}`;
            }

            tableBody.innerHTML += `
                <tr>
                    <td>${dateStr}</td>
                    <td>${COST_CATEGORY_LABELS[cost.category] || cost.category}</td>
                    <td>${assignedStr}</td>
                    <td>${cost.description || ''}</td>
                    <td>${formatMZN(cost.amount)}</td>
                </tr>
            `;
        });

    } catch (error) {
        console.error('Falha ao carregar últimos custos:', error);
        tableBody.innerHTML =
            '<tr><td colspan="5">Erro ao carregar custos.</td></tr>';
    }
}

/* =====================================================
   MOTORISTAS
===================================================== */
async function loadDrivers() {
    const tableBody = document.getElementById('drivers-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="5">A carregar...</td></tr>';

    try {
        const response = await safeFetch(`${API_URL}/api/drivers`);
        if (!response) return;

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);

        tableBody.innerHTML = '';

        if (!data.drivers || data.drivers.length === 0) {
            tableBody.innerHTML =
                '<tr><td colspan="5">Nenhum motorista registado.</td></tr>';
            return;
        }

        data.drivers.forEach(driver => {
            const profile = driver.profile || {};
            const status = profile.status || 'offline';
            const statusClass = `status-${status.replace('_', '-')}`;

            tableBody.innerHTML += `
                <tr>
                    <td>${driver.nome}</td>
                    <td>${driver.telefone}</td>
                    <td>${profile.vehicle_plate || '(N/D)'}</td>
                    <td>
                        <span class="status ${statusClass}">
                            ${status.replace('_', ' ')}
                        </span>
                    </td>
                    <td>
                        <button class="btn-action btn-action-small"
                            onclick="openEditDriverModal('${driver._id}')"
                            title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action-small btn-action-report"
                            onclick="openDriverReportModal('${driver._id}', '${driver.nome}')"
                            title="Ver Relatório">
                            <i class="fas fa-chart-bar"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

    } catch (error) {
        console.error('Falha ao carregar motoristas:', error);
        tableBody.innerHTML =
            '<tr><td colspan="5">Erro ao carregar motoristas.</td></tr>';
    }
}

/* =====================================================
   CLIENTES
===================================================== */
async function loadClients() {
    const tableBody = document.getElementById('clients-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="4">A carregar...</td></tr>';

    try {
        const response = await safeFetch(`${API_URL}/api/clients`);
        if (!response) return;

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);

        tableBody.innerHTML = '';

        if (!data.clients || data.clients.length === 0) {
            tableBody.innerHTML =
                '<tr><td colspan="4">Nenhum cliente registado.</td></tr>';
            return;
        }

        data.clients.forEach(client => {
            tableBody.innerHTML += `
                <tr>
                    <td>${client.nome}</td>
                    <td>${client.telefone}</td>
                    <td>${client.empresa || 'N/D'}</td>
                    <td>
                        <button class="btn-action btn-action-small"
                            onclick="openEditClientModal('${client._id}')"
                            title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action-small btn-action-report"
                            onclick="openStatementModal('${client._id}', '${client.nome}')"
                            title="Ver Extrato">
                            <i class="fas fa-file-invoice-dollar"></i>
                        </button>
                        <button class="btn-action-small btn-danger"
                            onclick="handleDeleteClient('${client._id}', '${client.nome}')"
                            title="Apagar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

    } catch (error) {
        console.error('Falha ao carregar clientes:', error);
        tableBody.innerHTML =
            '<tr><td colspan="4">Erro ao carregar clientes.</td></tr>';
    }
}

/* =====================================================
   ENCOMENDAS ATIVAS
===================================================== */
async function loadActiveDeliveries() {
    const tableBody = document.getElementById('active-orders-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="7">A carregar...</td></tr>';

    try {
        const response = await safeFetch(`${API_URL}/api/orders/active`);
        if (!response) return;

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);

        tableBody.innerHTML = '';

        if (!data.orders || data.orders.length === 0) {
            tableBody.innerHTML =
                '<tr><td colspan="7">Nenhuma encomenda ativa.</td></tr>';
            return;
        }

        data.orders.forEach(order => {
            const motoristaNome =
                order.assigned_to_driver?.user?.nome || 'N/D';

            let acaoBotao = 'Em Curso';

            if (order.status === 'pendente') {
                acaoBotao = `
                    <button class="btn-action-assign"
                        onclick="openAssignModal('${order._id}')">
                        Atribuir
                    </button>
                `;
            } else if (order.status === 'atribuido') {
                acaoBotao = `
                    <button class="btn-action-small btn-action-report"
                        onclick="openAssignModal('${order._id}')"
                        title="Reatribuir">
                        <i class="fas fa-exchange-alt"></i> Reatribuir
                    </button>
                `;
            }

            tableBody.innerHTML += `
                <tr>
                    <td>#${order._id.slice(-6)}</td>
                    <td>${order.client_name}</td>
                    <td>${order.client_phone1}</td>
                    <td>
                        <span class="status status-${order.status.replace('_', '-')}">
                            ${order.status}
                        </span>
                    </td>
                    <td>${motoristaNome}</td>
                    <td class="verification-code">
                        ${order.verification_code}
                    </td>
                    <td>${acaoBotao}</td>
                </tr>
            `;
        });

    } catch (error) {
        console.error('Falha ao carregar encomendas ativas:', error);
        tableBody.innerHTML =
            '<tr><td colspan="7">Erro ao carregar encomendas.</td></tr>';
    }
}

/* =====================================================
   HISTÓRICO DE ENCOMENDAS
===================================================== */
async function loadHistory() {
    const tableBody = document.getElementById('history-orders-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="7">A carregar...</td></tr>';

    try {
        const response = await safeFetch(`${API_URL}/api/orders/history`);
        if (!response) return;

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);

        tableBody.innerHTML = '';

        if (!data.orders || data.orders.length === 0) {
            tableBody.innerHTML =
                '<tr><td colspan="7">Nenhum histórico encontrado.</td></tr>';
            return;
        }

        data.orders.forEach(order => {
            const motoristaNome =
                order.assigned_to_driver?.user?.nome || 'N/D';

            const serviceName =
                SERVICE_NAMES?.[order.service_type] || order.service_type;

            let duracaoHtml = '';
            if (typeof getPhaseDurations === 'function') {
                const phases = getPhaseDurations(order);
                duracaoHtml =
                    `<div><strong>C → R:</strong> ${phases.pickupLabel}</div>` +
                    `<div><strong>R → E:</strong> ${phases.deliveryLabel}</div>`;
            } else {
                duracaoHtml =
                    formatDuration(
                        order.timestamp_started,
                        order.timestamp_completed
                    );
            }

            tableBody.innerHTML += `
                <tr class="history-row">
                    <td>#${order._id.slice(-6)}</td>
                    <td>${order.client_name}</td>
                    <td>${serviceName}</td>
                    <td>${motoristaNome}</td>
                    <td>${duracaoHtml}</td>
                    <td class="verification-code">
                        ${order.verification_code}
                    </td>
                    <td>
                        <button class="btn-action-small"
                            onclick="openHistoryDetailModal('${order._id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

    } catch (error) {
        console.error('Falha ao carregar histórico:', error);
        tableBody.innerHTML =
            '<tr><td colspan="7">Erro ao carregar histórico.</td></tr>';
    }
}

/* =====================================================
   ALTERAR SENHA ADMIN
===================================================== */
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
        const response = await safeFetch(`${API_URL}/api/auth/change-password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senhaAntiga, senhaNova })
        });
        if (!response) return;

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);

        showCustomAlert(
            'Sucesso',
            'Senha alterada com sucesso. Faça login novamente.',
            'success'
        );

        setTimeout(() => handleLogout('admin'), 2500);

    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        showCustomAlert('Erro', error.message, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = 'Atualizar Senha';
    }
}

/* =====================================================
   ADICIONAR CUSTO
===================================================== */
async function handleAddCost(e) {
    e.preventDefault();

    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');

    const category = document.getElementById('cost-category').value;
    const amountStr = document.getElementById('cost-amount').value;
    const date = document.getElementById('cost-date').value;
    const description = document.getElementById('cost-description').value.trim();
    const assignedRaw = document.getElementById('cost-assigned-entity').value;

    if (!category) {
        showCustomAlert('Erro', 'Selecione uma categoria.', 'error');
        return;
    }

    const amount = Number(amountStr);
    if (Number.isNaN(amount) || amount <= 0) {
        showCustomAlert('Erro', 'Valor inválido.', 'error');
        return;
    }

    let assignedUserId;
    let assignedClientId;

    if (assignedRaw) {
        const [type, id] = assignedRaw.split(':');
        if (type === 'driver') assignedUserId = id;
        if (type === 'client') assignedClientId = id;
    }

    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A guardar...';

    try {
        const response = await safeFetch(`${API_URL}/api/costs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category,
                amount,
                description: description || undefined,
                date: date || undefined,
                assignedUserId,
                assignedClientId
            })
        });
        if (!response) return;

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);

        showCustomAlert('Sucesso', 'Custo registado com sucesso.', 'success');
        form.reset();
        loadCostsDashboardSummary();
        loadCostAssignmentOptions();

    } catch (error) {
        console.error('Erro ao registar custo:', error);
        showCustomAlert('Erro', error.message, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-save"></i> Guardar Custo';
    }
}

/* =====================================================
   EXPORTAR CUSTOS (CSV)
===================================================== */
async function handleExportCostsExcel() {
    try {
        const params = new URLSearchParams();
        params.set('limit', '500');

        const response = await safeFetch(`${API_URL}/api/costs?${params.toString()}`);
        if (!response) return;

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);

        const rows = [];
        rows.push(['Data', 'Categoria', 'Atribuído a', 'Descrição', 'Valor']);

        const formatDate = d =>
            d ? new Date(d).toLocaleDateString('pt-MZ') : '';

        (data.costs || []).forEach(cost => {
            let assigned = '';
            if (cost.assignedUser?.nome) {
                assigned = `Funcionário: ${cost.assignedUser.nome}`;
            } else if (cost.assignedClient?.nome) {
                assigned = `Cliente: ${cost.assignedClient.nome}`;
            }

            rows.push([
                formatDate(cost.date),
                COST_CATEGORY_LABELS[cost.category] || cost.category,
                assigned,
                cost.description || '',
                cost.amount
            ]);
        });

        const csv = rows
            .map(r =>
                r.map(f => `"${String(f).replace(/"/g, '""')}"`).join(';')
            )
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio_custos_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error('Erro ao exportar custos:', error);
        showCustomAlert('Erro', error.message, 'error');
    }
}

/* =====================================================
   CONSTANTES E ESTADO GLOBAL
===================================================== */
const COST_CATEGORY_LABELS = {
    salarios: 'Salários',
    renda: 'Renda',
    manutencao: 'Manutenção',
    comunicacao: 'Comunicação',
    marketing: 'Marketing',
    combustivel: 'Combustível',
    diversos: 'Diversos'
};

let costsByCategoryChart = null;
let revenueVsCostsChart = null;
