/**
 * js/admin/admin.js
 * Arquivo "central" do painel admin — navegação, utilitários e pequenas funções globais.
 *
 * Observações:
 * - Este ficheiro tenta não sobrescrever funções já definidas em outros ficheiros (ex.: adminManagers.js).
 *   Antes de definir uma função verifica-se `typeof <fn> !== 'function'`.
 * - Espera que `API_URL` e funções de autenticação (ex.: `getAuthHeaders`) possam existir em `js/common/*`.
 *   Caso não existam, fornece implementações de fallback seguras.
 * - Liga a navegação lateral, carrega páginas e chama loaders específicos (se existirem):
 *     loadManagers, loadDrivers, loadClients, loadExpenses, loadOverviewStats, loadActiveOrders, loadHistory
 */

/* ======================
   Helpers de Autenticação
   ====================== */

// Fallback para obter headers de autenticação. Se já existir `getAuthHeaders` global, usa-a.
if (typeof getAuthHeaders !== 'function') {
  function getAuthHeaders() {
    const headers = {};
    try {
      const token = localStorage.getItem('token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch (err) {
      // ignore
    }
    return headers;
  }
}

/* ======================
   Helper fetch com auth
   ====================== */
async function apiFetch(path, options = {}) {
  const url = (typeof API_URL === 'string' && API_URL) ? `${API_URL}${path}` : path;
  const headers = {
    ...(options.headers || {}),
    ...getAuthHeaders()
  };

  const opts = {
    ...options,
    headers
  };

  try {
    const res = await fetch(url, opts);
    // tenta parsear JSON; se falhar, devolve blob/text conforme status
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await res.json();
      if (!res.ok) {
        const err = new Error(json.message || `Erro na requisição: ${res.status}`);
        err.status = res.status;
        err.payload = json;
        throw err;
      }
      return json;
    } else {
      // não-json (ex.: download excel)
      if (!res.ok) {
        const text = await res.text();
        const err = new Error(text || `Erro na requisição: ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return res;
    }
  } catch (err) {
    // se for 401, tenta fazer logout automático chamando handleLogout se existir
    if (err.status === 401) {
      if (typeof handleLogout === 'function') handleLogout('admin');
    }
    throw err;
  }
}

/* ======================
   UI: abrir/fechar modais e alertas
   ====================== */

// showCustomAlert / closeCustomAlert — define apenas se não existir
if (typeof showCustomAlert !== 'function') {
  function showCustomAlert(title, message, type = 'info') {
    const modal = document.getElementById('custom-alert-modal');
    const titleEl = document.getElementById('custom-alert-title');
    const messageEl = document.getElementById('custom-alert-message');
    if (!modal || !titleEl || !messageEl) {
      // fallback: alert browser
      alert(`${title}\n\n${message}`);
      return;
    }
    titleEl.textContent = title || '';
    messageEl.textContent = message || '';
    modal.classList.remove('hidden');
    modal.dataset.type = type;
    // optionally auto-close after X seconds for non-error
    if (type !== 'error') {
      clearTimeout(modal._autoCloseTimer);
      modal._autoCloseTimer = setTimeout(() => {
        closeCustomAlert();
      }, 4500);
    }
  }

  function closeCustomAlert() {
    const modal = document.getElementById('custom-alert-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    const titleEl = document.getElementById('custom-alert-title');
    const messageEl = document.getElementById('custom-alert-message');
    if (titleEl) titleEl.textContent = '';
    if (messageEl) messageEl.textContent = '';
  }
}

/* Funções de fechar modais genéricas — definidas somente se ainda não existirem */
function _toggleModalById(id, show) {
  const el = document.getElementById(id);
  if (!el) return;
  if (show) el.classList.remove('hidden');
  else el.classList.add('hidden');
}

if (typeof closeAssignModal !== 'function') {
  function closeAssignModal() { _toggleModalById('assign-modal', false); }
}
if (typeof openAssignModal !== 'function') {
  function openAssignModal() { _toggleModalById('assign-modal', true); }
}
if (typeof closeEditDriverModal !== 'function') {
  function closeEditDriverModal() { _toggleModalById('edit-driver-modal', false); const f = document.getElementById('form-edit-motorista'); if (f) f.reset(); }
}
if (typeof openEditDriverModal !== 'function') {
  function openEditDriverModal() { _toggleModalById('edit-driver-modal', true); }
}
if (typeof closeDriverReportModal !== 'function') {
  function closeDriverReportModal() { _toggleModalById('driver-report-modal', false); }
}
if (typeof closeEditClientModal !== 'function') {
  function closeEditClientModal() { _toggleModalById('edit-client-modal', false); const f = document.getElementById('form-edit-cliente'); if (f) f.reset(); }
}
if (typeof closeStatementModal !== 'function') {
  function closeStatementModal() { _toggleModalById('statement-modal', false); }
}
if (typeof closeHistoryDetailModal !== 'function') {
  function closeHistoryDetailModal() { _toggleModalById('history-detail-modal', false); }
}

/* ======================
   Form toggles (Add forms)
   ====================== */

function showAddManagerForm(show) {
  const form = document.getElementById('form-add-manager');
  const btn = document.getElementById('btn-show-manager-form');
  if (!form || !btn) return;
  if (show) {
    form.classList.remove('hidden');
    btn.classList.add('hidden');
  } else {
    form.classList.add('hidden');
    btn.classList.remove('hidden');
    form.reset();
  }
}

function showAddDriverForm(show) {
  const form = document.getElementById('form-add-motorista');
  const btn = document.getElementById('btn-show-driver-form');
  if (!form || !btn) return;
  if (show) {
    form.classList.remove('hidden');
    btn.classList.add('hidden');
  } else {
    form.classList.add('hidden');
    btn.classList.remove('hidden');
    form.reset();
  }
}

function showAddClientForm(show) {
  const form = document.getElementById('form-add-cliente');
  const btn = document.getElementById('btn-show-client-form');
  if (!form || !btn) return;
  if (show) {
    form.classList.remove('hidden');
    btn.classList.add('hidden');
  } else {
    form.classList.add('hidden');
    btn.classList.remove('hidden');
    form.reset();
  }
}

function showAddExpenseForm(show) {
  const form = document.getElementById('form-add-expense');
  const btn = document.getElementById('btn-show-expense-form');
  if (!form || !btn) return;
  if (show) {
    form.classList.remove('hidden');
    btn.classList.add('hidden');
  } else {
    form.classList.add('hidden');
    btn.classList.remove('hidden');
    form.reset();
  }
}

/* ======================
   Navegação lateral e roteamento simples das "content-pages"
   ====================== */

function _hideAllPages() {
  const pages = document.querySelectorAll('.content-page');
  pages.forEach(p => p.classList.add('hidden'));
}

function showPage(pageId) {
  const pageEl = document.getElementById(pageId);
  if (!pageEl) return;
  // esconder todas
  _hideAllPages();
  // mostrar a pedida
  pageEl.classList.remove('hidden');

  // marca menu activo
  document.querySelectorAll('.sidebar .menu-item').forEach(item => {
    item.classList.remove('active');
  });
  // tenta encontrar menu correspondente por id nav-<page>
  const menu = document.getElementById(`nav-${pageId.split('-')[0]}`) || Array.from(document.querySelectorAll('.sidebar .menu-item')).find(m => m.textContent && m.textContent.toLowerCase().includes(pageId.split('-')[0]));
  if (menu) menu.classList.add('active');

  // atualiza título principal
  const title = pageEl.querySelector('h3') || pageEl.querySelector('h1') || pageEl.querySelector('h2');
  const mainTitle = document.getElementById('main-title');
  if (mainTitle) {
    mainTitle.textContent = title ? title.textContent : (pageId.replace('-', ' ').toUpperCase());
  }

  // Dispara loaders específicos se existirem
  try {
    if (pageId === 'gestao-gestores' && typeof loadManagers === 'function') loadManagers();
    if (pageId === 'gestao-motoristas' && typeof loadDrivers === 'function') loadDrivers();
    if (pageId === 'gestao-clientes' && typeof loadClients === 'function') loadClients();
    if (pageId === 'gestao-custos' && typeof loadExpenses === 'function') loadExpenses();
    if (pageId === 'visao-geral' && typeof loadOverviewStats === 'function') loadOverviewStats();
    if (pageId === 'entregas-activas' && typeof loadActiveOrders === 'function') loadActiveOrders();
    if (pageId === 'historico' && typeof loadHistory === 'function') loadHistory();
  } catch (err) {
    console.error('Erro ao disparar loaders na mudança de página:', err);
  }
}

function _setupSidebarNav() {
  // liga cliques nos items da sidebar que tenham id "nav-..."
  document.querySelectorAll('.sidebar .menu-item').forEach(item => {
    if (!item.id) return;
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const id = item.id.replace('nav-', '');
      // mapeamento simples: nav-visao-geral -> visao-geral, nav-gestores -> gestao-gestores etc.
      const map = {
        'visao-geral': 'visao-geral',
        'entregas': 'entregas-activas',
        'motoristas': 'gestao-motoristas',
        'clientes': 'gestao-clientes',
        'gestores': 'gestao-gestores',
        'custos': 'gestao-custos',
        'historico': 'historico',
        'mapa': 'mapa-tempo-real',
        'config': 'configuracoes'
      };
      const pageId = map[id] || id;
      showPage(pageId);
      // fecha menu mobile se aberto
      const sidebar = document.querySelector('.sidebar');
      if (sidebar && sidebar.classList.contains('open')) sidebar.classList.remove('open');
    });
  });
}

/* ======================
   Utilitários (formatos)
   ====================== */

function formatCurrency(value, currency = 'MZN') {
  if (value === null || value === undefined || isNaN(Number(value))) return '-';
  return new Intl.NumberFormat('pt-MZ', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value));
}

function formatDateISO(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('pt-MZ');
}

/* ======================
   Exportar Relatório Financeiro (Excel)
   ====================== */

async function exportFinancialReport() {
  const start = document.getElementById('export-start-date').value;
  const end = document.getElementById('export-end-date').value;

  if (!start || !end) {
    showCustomAlert('Erro', 'Escolha as datas de início e fim para exportar.', 'error');
    return;
  }

  const query = `?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  const path = (typeof API_URL === 'string' && API_URL) ? `${API_URL}/api/expenses/export${query}` : `/api/expenses/export${query}`;

  try {
    const res = await fetch(path, {
      method: 'GET',
      headers: {
        ...getAuthHeaders()
      }
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Erro ${res.status}`);
    }

    // response is a file blob (xlsx)
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    // nome sugestão
    const filename = `relatorio_custos_${start}_a_${end}.xlsx`;
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    showCustomAlert('Sucesso', 'Relatório gerado. Ficheiro será transferido.', 'success');
  } catch (err) {
    console.error('Erro ao exportar relatório:', err);
    showCustomAlert('Erro', err.message || 'Erro ao exportar relatório', 'error');
  }
}

/* ======================
   Logout (fallback)
   ====================== */

if (typeof handleLogout !== 'function') {
  function handleLogout(role) {
    // remove token e redireciona
    try { localStorage.removeItem('token'); } catch (e) {}
    // optional: clear other session data
    try { localStorage.removeItem('user'); } catch (e) {}
    window.location.href = '/login.html';
  }
}

/* ======================
   Inicialização
   ====================== */

document.addEventListener('DOMContentLoaded', () => {
  _setupSidebarNav();

  // Default page: visão geral
  showPage('visao-geral');

  // Liga botões que existem no HTML para abrir forms/modals
  const btnShowManager = document.getElementById('btn-show-manager-form');
  if (btnShowManager) btnShowManager.addEventListener('click', () => showAddManagerForm(true));

  const btnShowDriver = document.getElementById('btn-show-driver-form');
  if (btnShowDriver) btnShowDriver.addEventListener('click', () => showAddDriverForm(true));

  const btnShowClient = document.getElementById('btn-show-client-form');
  if (btnShowClient) btnShowClient.addEventListener('click', () => showAddClientForm(true));

  const btnShowExpense = document.getElementById('btn-show-expense-form');
  if (btnShowExpense) btnShowExpense.addEventListener('click', () => showAddExpenseForm(true));

  // Export button
  const btnExport = document.querySelector('button[onclick="exportFinancialReport()"], button#btn-export-financial');
  if (btnExport) btnExport.addEventListener('click', exportFinancialReport);

  // Close custom alert button (if exists)
  const customAlertCloseBtns = document.querySelectorAll('#custom-alert-modal .modal-close-btn, #custom-alert-modal button');
  customAlertCloseBtns.forEach(b => b.addEventListener('click', closeCustomAlert));

  // Fechar modais com clique fora (opcional, minimal)
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        // tenta chamar um close específico, senão simplesmente esconde
        if (modal.id === 'assign-modal' && typeof closeAssignModal === 'function') return closeAssignModal();
        if (modal.id === 'custom-alert-modal' && typeof closeCustomAlert === 'function') return closeCustomAlert();
        modal.classList.add('hidden');
      }
    });
  });

  // Confirmação de ações: habilita botão quando input corresponde
  const confirmationInput = document.getElementById('confirmation-input');
  const confirmBtn = document.getElementById('btn-confirm-action');
  const confirmationLabel = document.getElementById('confirmation-input-label');
  if (confirmationInput && confirmBtn && confirmationLabel) {
    confirmationInput.addEventListener('input', () => {
      const expected = confirmationLabel.dataset.expected || confirmationLabel.textContent.trim();
      if (confirmationInput.value.trim().toUpperCase() === expected.trim().toUpperCase()) {
        confirmBtn.disabled = false;
      } else {
        confirmBtn.disabled = true;
      }
    });
  }
});
