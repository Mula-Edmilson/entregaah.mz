/*
 * Ficheiro: js/admin/adminCharts.js
 * (Atualizado com o novo Gráfico Financeiro)
 */

// --- Variáveis de estado globais para os gráficos ---
let myServicesChart = null;
let myDeliveriesStatusChart = null;
let myFinancialPieChart = null; // (NOVA VARIÁVEL)

// (NOVAS) Cores do tema Minimal
const chartColors = {
    primary: 'rgba(59, 130, 246, 0.8)',  // Azul
    primaryLight: 'rgba(59, 130, 246, 0.2)',
    success: 'rgba(16, 185, 129, 0.8)',  // Verde
    successLight: 'rgba(16, 185, 129, 0.2)',
    warning: 'rgba(245, 159, 11, 0.8)', // Amarelo
    warningLight: 'rgba(245, 159, 11, 0.2)',
    
    textColor: '#1E293B',
    textLight: '#6B7280',
    borderColor: '#E5E7EB'
};


/**
 * Destrói as instâncias dos gráficos existentes.
 */
function destroyCharts() {
    if (myServicesChart) {
        myServicesChart.destroy();
        myServicesChart = null;
    }
    if (myDeliveriesStatusChart) {
        myDeliveriesStatusChart.destroy();
        myDeliveriesStatusChart = null;
    }
    // (MUDANÇA) Destrói o novo gráfico
    if (myFinancialPieChart) {
        myFinancialPieChart.destroy();
        myFinancialPieChart = null;
    }
}

/**
 * Inicializa o gráfico de barras (Desempenho dos Serviços).
 */
async function initServicesChart(reset = false) {
    // ... (Esta função permanece 100% igual) ...
    const ctx = document.getElementById('servicesChart');
    if (!ctx) return; 
    if (myServicesChart) {
        myServicesChart.destroy();
    }
    let dataValues = [0], adesaoValues = [0], labels = ['A carregar...'];
    if (reset) {
        labels = ['N/D'];
        console.log('SIMULAÇÃO: Resetando dados do gráfico...');
    } else {
        try {
            const response = await fetch(`${API_URL}/api/stats/services`, { 
                headers: getAuthHeaders() 
            });
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
            { 
                label: 'Nº de Pedidos (Adesão)', 
                type: 'bar',
                data: adesaoValues, 
                backgroundColor: chartColors.primary,
                borderColor: chartColors.primary,
                borderWidth: 1,
                order: 2
            },
            { 
                label: 'Valor Rendido (MZN)', 
                type: 'line',
                data: dataValues, 
                backgroundColor: chartColors.success,
                borderColor: chartColors.success,
                borderWidth: 3,
                fill: false,
                tension: 0.4,
                order: 1
            }
        ]
    };
    myServicesChart = new Chart(ctx, { 
        type: 'bar',
        data: chartData, 
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                y: { 
                    beginAtZero: true, 
                    ticks: { 
                        color: chartColors.textLight,
                        callback: function(value) { 
                            if (value >= 1000) return value / 1000 + 'k'; 
                            return value; 
                        } 
                    },
                    grid: {
                        color: chartColors.borderColor
                    }
                },
                x: {
                    ticks: {
                        color: chartColors.textLight
                    },
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                title: { display: false },
                legend: {
                    position: 'bottom',
                    labels: {
                        color: chartColors.textLight
                    }
                },
                tooltip: { 
                    backgroundColor: '#FFFFFF',
                    titleColor: chartColors.textColor,
                    bodyColor: chartColors.textLight,
                    borderColor: chartColors.borderColor,
                    borderWidth: 1,
                    callbacks: { 
                        label: function(context) { 
                            let l = context.dataset.label || ''; 
                            if (l) l += ': '; 
                            if (context.parsed.y !== null) { 
                                if (context.dataset.label.includes('MZN')) {
                                    l += new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(context.parsed.y); 
                                } else {
                                    l += context.parsed.y + ' pedidos'; 
                                }
                            } 
                            return l; 
                        } 
                    } 
                }
            }
        }
    });
}

/**
 * Inicializa/Atualiza o gráfico de donut (Entregas Ativas).
 */
function initDeliveriesStatusChart(pendentes, emTransito) {
    // ... (Esta função permanece 100% igual) ...
    const ctx = document.getElementById('deliveriesStatusChart');
    if (!ctx) return;
    if (myDeliveriesStatusChart) {
        myDeliveriesStatusChart.destroy();
    }
    const total = pendentes + emTransito;
    const data = {
        labels: [
            `Pendentes (${pendentes})`,
            `Em Trânsito (${emTransito})`
        ],
        datasets: [{
            label: 'Entregas Ativas',
            data: [pendentes, emTransito],
            backgroundColor: [
                chartColors.warning,
                chartColors.success
            ],
            borderColor: [
                chartColors.warning,
                chartColors.success
            ],
            borderWidth: 1
        }]
    };
    myDeliveriesStatusChart = new Chart(ctx, {
        type: 'doughnut',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: chartColors.textLight
                    }
                },
                tooltip: {
                    backgroundColor: '#FFFFFF',
                    titleColor: chartColors.textColor,
                    bodyColor: chartColors.textLight,
                    borderColor: chartColors.borderColor,
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                const percentage = total > 0 ? (context.parsed / total * 100).toFixed(1) : 0;
                                label += `${percentage}%`;
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}


// --- (NOVA FUNÇÃO ADICIONADA) ---
/**
 * Inicializa/Atualiza o gráfico de "pizza" (Divisão Financeira).
 * @param {number} lucroEmpresa - O lucro líquido da empresa.
 * @param {number} ganhosMotorista - O total pago aos motoristas.
 */
function initFinancialPieChart(lucroEmpresa, ganhosMotorista) {
    const ctx = document.getElementById('financialPieChart');
    if (!ctx) return; // Sai se o elemento não estiver na página

    if (myFinancialPieChart) {
        myFinancialPieChart.destroy(); // Destrói o anterior
    }

    const total = lucroEmpresa + ganhosMotorista;
    const data = {
        labels: [
            `Lucro da Empresa (MZN ${lucroEmpresa.toFixed(2)})`,
            `Ganhos de Motoristas (MZN ${ganhosMotorista.toFixed(2)})`
        ],
        datasets: [{
            label: 'Divisão da Receita',
            data: [lucroEmpresa, ganhosMotorista],
            backgroundColor: [
                chartColors.primary, // Azul (Lucro)
                chartColors.success  // Verde (Ganhos Motoristas)
            ],
            borderColor: [
                chartColors.primary,
                chartColors.success
            ],
            borderWidth: 1
        }]
    };

    myFinancialPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: chartColors.textLight
                    }
                },
                tooltip: {
                    backgroundColor: '#FFFFFF',
                    titleColor: chartColors.textColor,
                    bodyColor: chartColors.textLight,
                    borderColor: chartColors.borderColor,
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            let label = context.label.split('(')[0].trim() || ''; // Pega só o nome
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                // Mostra a percentagem
                                const percentage = total > 0 ? (context.parsed / total * 100).toFixed(1) : 0;
                                label += `${percentage}%`;
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}
// --- FIM DA NOVA FUNÇÃO ---