/*
 * Ficheiro: js/admin/adminModals.js (Corrigido)
 *
 * Contém toda a lógica de ABERTURA e carregamento de dados
 * dos modais (pop-ups) do painel de admin.
 * (Movido de admin.js)
 */

// ... (Todas as funções 'open...Modal' que enviei antes) ...
// (openConfirmationModal, openAssignModal, openEditDriverModal, openHistoryDetailModal, openDriverReportModal, openEditClientModal, openStatementModal)
// ... (Cole-as aqui) ...

/* --- (Funções movidas do admin.js para aqui) --- */

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