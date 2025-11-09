/*
 * Ficheiro: js/admin/adminCharts.js
 *
 * (Dependência #4) - Precisa de 'api.js', 'auth.js'
 *
 * Contém toda a lógica de gestão dos gráficos da "Visão Geral".
 * - myServicesChart (Gráfico de Barras - Desempenho)
 * - myDeliveriesStatusChart (Gráfico de Donut - Ativas)
 */

// --- (MELHORIA) Variáveis de estado globais para os gráficos ---
// Mantemos uma referência aos gráficos para podermos destruí-los
// antes de os redesenhar, evitando bugs de memória.
let myServicesChart = null;
let myDeliveriesStatusChart = null;

/**
 * Destrói as instâncias dos gráficos existentes.
 * Chamado pela função showPage() sempre que saímos da "Visão Geral".
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
 * Busca os dados na API /api/stats/services.
 * @param {boolean} reset - Se true, força o reset dos dados.
 */
async function initServicesChart(reset = false) {
    const ctx = document.getElementById('servicesChart');
    if (!ctx) return; // Se o elemento não existir, não faz nada

    if (myServicesChart) {
        myServicesChart.destroy(); // Destrói o gráfico anterior
    }

    let dataValues = [0], adesaoValues = [0], labels = ['A carregar...'];

    if (reset) {
        labels = ['N/D'];
        console.log('SIMULAÇÃO: Resetando dados do gráfico...');
        // Aqui você faria a chamada real à API para resetar
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
                backgroundColor: 'rgba(255, 102, 0, 0.7)', // --primary-color
                borderColor: 'rgba(255, 102, 0, 1)',
                borderWidth: 1 
            },
            { 
                label: 'Nº de Pedidos (Adesão)', 
                data: adesaoValues, 
                backgroundColor: 'rgba(44, 62, 80, 0.7)', // --dark-color
                borderColor: 'rgba(44, 62, 80, 1)',
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
            scales: { 
                y: { 
                    beginAtZero: true, 
                    ticks: { 
                        callback: function(value) { 
                            if (value >= 1000) return value / 1000 + 'k'; 
                            return value; 
                        } 
                    } 
                } 
            },
            plugins: {
                title: { display: true, text: 'Receita vs. Número de Pedidos por Serviço' },
                tooltip: { 
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
 * Recebe os dados diretamente da função loadOverviewStats (em admin.js).
 * @param {number} pendentes - Número de entregas pendentes.
 * @param {number} emTransito - Número de entregas em trânsito.
 */
function initDeliveriesStatusChart(pendentes, emTransito) {
    const ctx = document.getElementById('deliveriesStatusChart');
    if (!ctx) return; // Sai se o elemento não estiver na página

    if (myDeliveriesStatusChart) {
        myDeliveriesStatusChart.destroy(); // Destrói o anterior
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
                'rgba(255, 102, 0, 0.7)', // Laranja (--primary-color)
                'rgba(52, 152, 219, 0.7)' // Azul (--info-color)
            ],
            borderColor: [
                'rgba(255, 102, 0, 1)',
                'rgba(52, 152, 219, 1)'
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
                legend: {
                    position: 'bottom', // Legenda em baixo
                },
                tooltip: {
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