/*
 * Ficheiro: js/common/ui.js
 *
 * (Dependência #3) - Precisa de 'api.js' e 'auth.js'
 *
 * Contém funções auxiliares genéricas para manipular a interface:
 * - Alertas, fecho de modais, formatação de texto/data,
 * - Toggles de formulários e pré-visualização de imagem.
 */

// --- (MELHORIA) Constantes de Nomes de Serviço ---
// Centraliza os nomes dos serviços para consistência
const SERVICE_NAMES = {
    'doc': 'Tram. Documentos',
    'farma': 'Farmácia',
    'carga': 'Cargas',
    'rapido': 'Delivery Rápido',
    'outros': 'Outros'
};

/* --- Funções de Alerta Customizado --- */

/**
 * Mostra um pop-up de alerta customizado.
 * @param {string} title - O título do alerta.
 * @param {string} message - A mensagem principal.
 * @param {string} type - 'info' (default), 'success', ou 'error'.
 */
function showCustomAlert(title, message, type = 'info') {
    const modal = document.getElementById('custom-alert-modal');
    if (!modal) { 
        alert(`${title}: ${message}`); // Fallback
        return; 
    }
    
    const modalContent = modal.querySelector('.modal-content');
    modalContent.classList.remove('success', 'error');
    if (type === 'success') modalContent.classList.add('success');
    if (type === 'error') modalContent.classList.add('error');
    
    document.getElementById('custom-alert-title').innerText = title;
    document.getElementById('custom-alert-message').innerText = message;
    modal.classList.remove('hidden');
}

/**
 * Fecha o pop-up de alerta customizado.
 */
function closeCustomAlert() {
    const modal = document.getElementById('custom-alert-modal');
    if (modal) modal.classList.add('hidden');
}


/* --- Funções de Fecho de Modais --- */
// (As funções de 'abrir' ficam no admin.js, pois precisam de carregar dados)

function closeAssignModal() { 
    document.getElementById('assign-modal').classList.add('hidden'); 
}

function closeEditDriverModal() { 
    document.getElementById('edit-driver-modal').classList.add('hidden'); 
    document.getElementById('form-edit-motorista').reset();
}

function closeHistoryDetailModal() { 
    document.getElementById('history-detail-modal').classList.add('hidden'); 
}

function closeChartResetModal() { 
    document.getElementById('chart-reset-modal').classList.add('hidden'); 
    document.getElementById('chart-reset-password').value = ''; 
}

function openChartResetModal() { 
    document.getElementById('chart-reset-modal').classList.remove('hidden'); 
}

function closeDriverReportModal() { 
    document.getElementById('driver-report-modal').classList.add('hidden'); 
}

function closeEditClientModal() {
    document.getElementById('edit-client-modal').classList.add('hidden');
    document.getElementById('form-edit-cliente').reset();
}

function closeStatementModal() {
    document.getElementById('statement-modal').classList.add('hidden');
}


/* --- Funções de Toggle de Formulários --- */

/**
 * Mostra ou esconde o formulário de adicionar motorista.
 * @param {boolean} show - True para mostrar, false para esconder.
 */
function showAddDriverForm(show) {
    const form = document.getElementById('form-add-motorista');
    const button = document.getElementById('btn-show-driver-form');
    if (!form || !button) return;
    
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
 * Mostra ou esconde o formulário de adicionar cliente.
 * @param {boolean} show - True para mostrar, false para esconder.
 */
function showAddClientForm(show) {
    const form = document.getElementById('form-add-cliente');
    const button = document.getElementById('btn-show-client-form');
    if (!form || !button) return;
    
    if (show) { 
        form.classList.remove('hidden'); 
        button.classList.add('hidden'); 
    } else { 
        form.classList.add('hidden'); 
        button.classList.remove('hidden'); 
        form.reset(); 
    }
}


/* --- Funções Auxiliares de Formulários (Upload de Imagem) --- */

/**
 * Processa o upload da imagem da encomenda e mostra o preview.
 * @param {Event} event - O evento 'change' do input[type=file].
 */
function handleImageUpload(event) { 
    const file = event.target.files[0]; 
    if (!file) return; 
    
    const previewContainer = document.getElementById('image-preview'); 
    const previewImg = previewContainer.querySelector('.preview-img'); 
    const reader = new FileReader(); 
    
    reader.onload = function(e) { 
        previewImg.src = e.target.result; 
    }; 
    reader.readAsDataURL(file); 
    previewContainer.classList.remove('hidden'); 
}

/**
 * Remove a imagem do preview e limpa o input.
 */
function removeImage() { 
    const previewContainer = document.getElementById('image-preview'); 
    if (!previewContainer) return; 
    
    previewContainer.querySelector('.preview-img').src = ''; 
    previewContainer.classList.add('hidden'); 
    document.getElementById('delivery-image').value = ''; 
}


/* --- Funções Auxiliares de Formatação --- */

/**
 * Formata a duração entre duas datas para "X min Y s".
 * @param {string} start - Timestamp de início (ISO string).
 * @param {string} end - Timestamp de fim (ISO string).
 * @returns {string} - A duração formatada.
 */
function formatDuration(start, end) { 
    if (!start || !end) return 'N/D'; 
    const diffMs = new Date(end) - new Date(start); 
    if (diffMs < 0) return 'N/D'; 
    
    const minutes = Math.floor(diffMs / 60000); 
    const seconds = Math.floor((diffMs % 60000) / 1000); 
    return `${minutes} min ${seconds} s`; 
}

/**
 * Formata um total de milissegundos para "X h Y min".
 * @param {number} totalMs - Total de milissegundos.
 * @returns {string} - A duração total formatada.
 */
function formatTotalDuration(totalMs) { 
    if (totalMs < 0) return 'N/D'; 
    
    const totalMinutes = Math.floor(totalMs / 60000); 
    const hours = Math.floor(totalMinutes / 60); 
    const minutes = totalMinutes % 60; 
    return `${hours} h ${minutes} min`; 
}

/**
 * Filtra a tabela de histórico com base no input de pesquisa.
 * @param {Event} event - O evento 'input' da barra de pesquisa.
 */
function filterHistoryTable(event) {
    const searchTerm = event.target.value.toLowerCase();
    const tableBody = document.getElementById('history-orders-table-body');
    const rows = tableBody.getElementsByTagName('tr');
    
    for (const row of rows) {
        if (row.getElementsByTagName('td').length > 1) { // Ignora 'nenhum resultado'
            const rowText = row.textContent.toLowerCase();
            row.style.display = rowText.includes(searchTerm) ? '' : 'none';
        }
    }
}

/**
 * Define as datas nos inputs de extrato (atalhos).
 * @param {string} range - 'this_week' ou 'this_month'.
 */
function setStatementDates(range) {
    const today = new Date();
    const endDate = new Date(); // Hoje
    let startDate = new Date();

    if (range === 'this_week') {
        const dayOfWeek = today.getDay(); // 0 = Domingo, 1 = Segunda...
        startDate.setDate(today.getDate() - dayOfWeek); // Vai para o Domingo
    } else if (range === 'this_month') {
        startDate.setDate(1); // Primeiro dia do mês
    }
    
    // Formata para 'YYYY-MM-DD'
    document.getElementById('statement-start-date').value = startDate.toISOString().split('T')[0];
    document.getElementById('statement-end-date').value = endDate.toISOString().split('T')[0];
}