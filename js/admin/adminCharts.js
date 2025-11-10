/*
 * Ficheiro: js/admin/adminCharts.js
 * (MELHORIA) Atualizado com a paleta de cores "Dark-Tech"
 *
 * Contém toda a lógica de gestão dos gráficos da "Visão Geral".
 */

// --- Variáveis de estado globais para os gráficos ---
let myServicesChart = null;
let myDeliveriesStatusChart = null;

// (NOVAS) Cores do tema Dark-Tech
const chartColors = {
    primary: 'rgba(124, 58, 237, 0.7)',  // Violeta
    primaryHover: 'rgba(124, 58, 237, 1)',
    success: 'rgba(16, 185, 129, 0.7)',  // Verde
    successHover: 'rgba(16, 185, 129, 1)',
    info: 'rgba(59, 130, 246, 0.7)',     // Azul
    infoHover: 'rgba(59, 130, 246, 1)',
    
    // Cores de Texto e Grelha para Dark Mode
    textColor: '#e5e7eb',         // --text-color
    textLight: '#9ca3af',         // --text-color-light
    borderColor: '#374151'        // --border-color
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
}

/**
 * Inicializa o gráfico de barras (Desempenho dos Serviços).
 */
async function initServicesChart(reset = false) {
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
                label: 'Valor Rendido (MZN)', 
                data: dataValues, 
                backgroundColor: chartColors.primary, // (MUDANÇA)
                borderColor: chartColors.primaryHover,
                borderWidth: 1 
            },
            { 
                label: 'Nº de Pedidos (Adesão)', 
                data: adesaoValues, 
                backgroundColor: chartColors.success, // (MUDANÇA)
                borderColor: chartColors.successHover,
                borderWidth: 1 
            }
        ]
    };

    myServicesChart = new Chart(ctx, { 
        type: 'bar', 
        data: chartData, 
        options: {
            responsive: true,
            maintainAspectRatio: false,
            // (MUDANÇA) Cores dos Eixos (Dark Mode)
            scales: { 
                y: { 
                    beginAtZero: true, 
                    ticks: { 
                        color: chartColors.textLight, // Cor do texto
                        callback: function(value) { 
                            if (value >= 1000) return value / 1000 + 'k'; 
                            return value; 
                        } 
                    },
                    grid: {
                        color: chartColors.borderColor // Cor da grelha
                    }
                },
                x: {
                    ticks: {
                        color: chartColors.textLight // Cor do texto
                    },
                    grid: {
                        display: false // Remove grelha X
                    }
                }
            },
            // (MUDANÇA) Cores da Legenda e Título (Dark Mode)
            plugins: {
                title: { 
                    display: true, 
                    text: 'Receita vs. Número de Pedidos por Serviço',
                    color: chartColors.textColor, // Cor do título
                    font: { size: 16, weight: '600' }
                },
                legend: {
                    labels: {
                        color: chartColors.textLight // Cor da legenda
                    }
                },
                tooltip: { 
                    backgroundColor: '#111827', // Fundo escuro
                    titleColor: chartColors.textColor,
                    bodyColor: chartColors.textLight,
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
                chartColors.primary, // (MUDANÇA) Violeta
                chartColors.info     // (MUDANÇA) Azul
            ],
            borderColor: [
                chartColors.primaryHover,
                chartColors.infoHover
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
            plugins: {
                // (MUDANÇA) Cores da Legenda (Dark Mode)
                legend: {
                    position: 'bottom',
                    labels: {
                        color: chartColors.textLight // Cor da legenda
                    }
                },
                tooltip: {
                    backgroundColor: '#111827', // Fundo escuro
                    titleColor: chartColors.textColor,
                    bodyColor: chartColors.textLight,
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