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

function destroyChartInstance(instanceName) {
    if (window[instanceName]) {
        window[instanceName].destroy();
        window[instanceName] = null;
    }
}

function destroyChartByCanvasId(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();
}

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

    destroyChartByCanvasId('servicesChart');
    destroyChartByCanvasId('deliveriesStatusChart');
    destroyChartByCanvasId('financialPieChart');
    destroyChartByCanvasId('costsByCategoryChart');
    destroyChartByCanvasId('revenueVsCostsChart');

    if (typeof costsByCategoryChart !== 'undefined' && costsByCategoryChart) {
        costsByCategoryChart.destroy();
        costsByCategoryChart = null;
    }
    if (typeof revenueVsCostsChart !== 'undefined' && revenueVsCostsChart) {
        revenueVsCostsChart.destroy();
        revenueVsCostsChart = null;
    }
}

function normalizeChartNumbers(values, expectedLength) {
    const safeValues = Array.isArray(values) ? values : [];
    return Array.from({ length: expectedLength }, (_, index) => Number(safeValues[index] || 0));
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
    if (!canvas || typeof Chart === 'undefined') {
        isServicesChartLoading = false;
        return;
    }

    destroyChartByCanvasId('servicesChart');
    myServicesChart = null;

    let labels = ['Delivery Rápido', 'Doc.', 'Farmácia', 'Cargas', 'Outros'];
    let dataValues = [0, 0, 0, 0, 0];
    let adesaoValues = [0, 0, 0, 0, 0];

    try {
        if (!reset) {
            const response = await fetch(`${API_URL}/api/stats/services`, {
                headers: getAuthHeaders('admin')
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message);

            if (Array.isArray(data.labels) && data.labels.length > 0) {
                labels = data.labels;
                dataValues = normalizeChartNumbers(data.dataValues, labels.length);
                adesaoValues = normalizeChartNumbers(data.adesaoValues, labels.length);
            }
        } else {
            labels = ['Delivery Rápido', 'Doc.', 'Farmácia', 'Cargas', 'Outros'];
            dataValues = [0, 0, 0, 0, 0];
            adesaoValues = [0, 0, 0, 0, 0];
            console.log('SIMULAÇÃO: Resetando dados do gráfico...');
        }

        const ctx = canvas.getContext('2d');

        myServicesChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Nº de Pedidos',
                        type: 'bar',
                        data: adesaoValues,
                        backgroundColor: chartColors.primary,
                        borderColor: chartColors.primary,
                        borderWidth: 1,
                        yAxisID: 'yOrders',
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
                        tension: 0.35,
                        yAxisID: 'yRevenue',
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    yOrders: {
                        type: 'linear',
                        position: 'left',
                        beginAtZero: true,
                        ticks: {
                            color: chartColors.textLight,
                            precision: 0,
                            callback: function(value) {
                                return `${value}`;
                            }
                        },
                        grid: {
                            color: chartColors.borderColor
                        },
                        title: {
                            display: true,
                            text: 'Pedidos',
                            color: chartColors.textLight
                        }
                    },
                    yRevenue: {
                        type: 'linear',
                        position: 'right',
                        beginAtZero: true,
                        ticks: {
                            color: chartColors.textLight,
                            callback: function(value) {
                                if (value >= 1000) return `${value / 1000}k`;
                                return value;
                            }
                        },
                        grid: {
                            drawOnChartArea: false
                        },
                        title: {
                            display: true,
                            text: 'MZN',
                            color: chartColors.textLight
                        }
                    },
                    x: {
                        ticks: {
                            color: chartColors.textLight,
                            maxRotation: 30,
                            minRotation: 0
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
                            color: chartColors.textLight,
                            usePointStyle: true
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
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                const value = context.parsed.y;
                                if (context.dataset.yAxisID === 'yRevenue') {
                                    label += new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(value || 0);
                                } else {
                                    label += `${value || 0} pedidos`;
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Falha ao carregar estatísticas do gráfico:', error);
        const ctx = canvas.getContext('2d');
        myServicesChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Erro ao carregar'],
                datasets: [{ label: 'Pedidos', data: [0], backgroundColor: chartColors.warning }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    } finally {
        isServicesChartLoading = false;
    }
}

/**
 * Inicializa/Atualiza o gráfico de donut (Entregas Ativas).
 */
function initDeliveriesStatusChart(pendentes, emTransito) {
    const ctx = document.getElementById('deliveriesStatusChart');
    if (!ctx || typeof Chart === 'undefined') return;

    destroyChartByCanvasId('deliveriesStatusChart');
    myDeliveriesStatusChart = null;

    const safePendentes = Number(pendentes || 0);
    const safeEmTransito = Number(emTransito || 0);
    const total = safePendentes + safeEmTransito;
    const data = {
        labels: [
            `Pendentes (${safePendentes})`,
            `Em Trânsito (${safeEmTransito})`
        ],
        datasets: [{
            label: 'Entregas Ativas',
            data: [safePendentes, safeEmTransito],
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
    if (!ctx || typeof Chart === 'undefined') return;

    destroyChartByCanvasId('financialPieChart');
    myFinancialPieChart = null;

    const safeLucroEmpresa = Number(lucroEmpresa || 0);
    const safeGanhosMotorista = Number(ganhosMotorista || 0);
    const total = safeLucroEmpresa + safeGanhosMotorista;
    const data = {
        labels: [
            `Lucro da Empresa (MZN ${safeLucroEmpresa.toFixed(2)})`,
            `Ganhos de Motoristas (MZN ${safeGanhosMotorista.toFixed(2)})`
        ],
        datasets: [{
            label: 'Divisão da Receita',
            data: [safeLucroEmpresa, safeGanhosMotorista],
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
