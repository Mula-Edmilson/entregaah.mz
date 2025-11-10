/*
 * Ficheiro: js/admin/adminCharts.js
 * (MELHORIA) Atualizado com a paleta de cores "Minimal SaaS"
 */

// --- Variáveis de estado globais para os gráficos ---
let myServicesChart = null;
let myDeliveriesStatusChart = null;

// (NOVAS) Cores do tema Minimal
const chartColors = {
    primary: 'rgba(59, 130, 246, 0.8)',  // Azul (Cor sólida para barras)
    primaryLight: 'rgba(59, 130, 246, 0.2)', // Azul (Cor de fundo/borda)
    
    success: 'rgba(16, 185, 129, 0.8)',  // Verde (Cor sólida)
    successLight: 'rgba(16, 185, 129, 0.2)', // Verde (Cor de fundo/borda)
    
    warning: 'rgba(245, 159, 11, 0.8)', // Amarelo
    warningLight: 'rgba(245, 159, 11, 0.2)',
    
    // Cores de Texto e Grelha para Light Mode
    textColor: '#1E293B',         // --text-color
    textLight: '#6B7280',         // --text-color-light
    borderColor: '#E5E7EB'        // --border-color
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
    
    // (MUDANÇA) O gráfico da imagem de inspiração (Traffic Sources) é um Bar/Line misto.
    // Vamos replicar isso.
    
    const chartData = {
        labels: labels,
        datasets: [
            { 
                label: 'Nº de Pedidos (Adesão)', 
                type: 'bar', // (MUDANÇA) Adesão agora é Barras
                data: adesaoValues, 
                backgroundColor: chartColors.primary,
                borderColor: chartColors.primary,
                borderWidth: 1,
                order: 2 // Desenha as barras *atrás* da linha
            },
            { 
                label: 'Valor Rendido (MZN)', 
                type: 'line', // (MUDANÇA) Receita agora é Linha
                data: dataValues, 
                backgroundColor: chartColors.success,
                borderColor: chartColors.success,
                borderWidth: 3, // Linha mais grossa
                fill: false,
                tension: 0.4, // Linha curva
                order: 1 // Desenha a linha *à frente* das barras
            }
        ]
    };

    myServicesChart = new Chart(ctx, { 
        type: 'bar', // Tipo base
        data: chartData, 
        options: {
            responsive: true,
            maintainAspectRatio: false,
            // (MUDANÇA) Cores dos Eixos (Light Mode)
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
            // (MUDANÇA) Cores da Legenda e Título (Light Mode)
            plugins: {
                title: { 
                    display: false, // O H3 no HTML já faz isto
                },
                legend: {
                    position: 'bottom',
                    labels: {
                        color: chartColors.textLight // Cor da legenda
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
                chartColors.warning, // (MUDANÇA) Amarelo
                chartColors.success  // (MUDANÇA) Verde
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
            cutout: '70%', // (MUDANÇA) Faz o "buraco" maior, como na imagem
            plugins: {
                // (MUDANÇA) Cores da Legenda (Light Mode)
                legend: {
                    position: 'bottom',
                    labels: {
                        color: chartColors.textLight // Cor da legenda
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