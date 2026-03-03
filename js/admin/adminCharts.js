/*
 * Ficheiro: js/admin/adminCharts.js
 * (Atualizado com o novo Gráfico Financeiro e refatorado para remover duplicações)
 */

// --- Variáveis de estado globais para os gráficos ---
let myServicesChart = null;
let myDeliveriesStatusChart = null;
let myFinancialPieChart = null;
let isServicesChartLoading = false;

// Cores do tema Minimal
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
    if (myFinancialPieChart) {
        myFinancialPieChart.destroy();
        myFinancialPieChart = null;
    }
}

/**
 * Inicializa o gráfico de barras (Desempenho dos Serviços).
 * Versão refatorada com proteção contra chamadas concorrentes.
 */
async function initServicesChart(reset = false) {
    // Previne chamadas concorrentes
    if (isServicesChartLoading) return;
    isServicesChartLoading = true;

    const canvas = document.getElementById('servicesChart');
    if (!canvas) {
        isServicesChartLoading = false;
        return;
    }

    const existingChart = Chart.getChart(canvas);
if (existingChart) {
    existingChart.destroy();
}

myServicesChart = null;

    let dataValues = [0], adesaoValues = [0], labels = ['A carregar...'];

    if (!reset) {
        try {
            const response = await fetch(`${API_URL}/api/stats/services`, { 
                headers: getAuthHeaders('admin') 
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message);

            if (data.labels && data.labels.length > 0) {
                labels = data.labels;
                dataValues = data.dataValues || [0];
                adesaoValues = data.adesaoValues || [0];
            } else {
                labels = ['Nenhum dado'];
            }

        } catch (error) {
            console.error('Falha ao carregar estatísticas do gráfico:', error);
            labels = ['Erro ao carregar'];
        }
    } else {
        labels = ['N/D'];
        console.log('SIMULAÇÃO: Resetando dados do gráfico...');
    }

    const ctx = canvas.getContext('2d');

    myServicesChart = new Chart(ctx, {
        type: 'bar',
        data: {
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
        },
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

    isServicesChartLoading = false;
}

/**
 * Inicializa/Atualiza o gráfico de donut (Entregas Ativas).
 */
function initDeliveriesStatusChart(pendentes, emTransito) {
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

/**
 * Inicializa/Atualiza o gráfico de "pizza" (Divisão Financeira).
 * @param {number} lucroEmpresa - O lucro líquido da empresa.
 * @param {number} ganhosMotorista - O total pago aos motoristas.
 */
function initFinancialPieChart(lucroEmpresa, ganhosMotorista) {
    const ctx = document.getElementById('financialPieChart');
    if (!ctx) return;

    if (myFinancialPieChart) {
        myFinancialPieChart.destroy();
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
                chartColors.primary,
                chartColors.success
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
                            let label = context.label.split('(')[0].trim() || '';
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
