/*
 * Ficheiro: js/common/api.js
 * (Dependência #1)
 *
 * Define a constante global da API_URL e a função
 * principal 'apiRequest' para comunicação com o backend.
 */

/**
 * Detecta automaticamente se estamos em ambiente local (dev)
 * ou em produção (Render, domínio real, etc.) e escolhe a API adequada.
 */
(function () {
    const hostname = window.location.hostname;

    // Consideramos "local" quando:
    // - estás a abrir o ficheiro pelo VS Code / ficheiro (file://)
    // - ou estás em localhost / 127.0.0.1
    const isLocalhost =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '' || // caso de file://
        hostname === '0.0.0.0';

    // ⚙️ Ajusta aqui a porta se o teu backend local estiver noutra porta
    const LOCAL_API = 'http://localhost:3000';
    const PROD_API = 'https://entregaah-mz.onrender.com';

    // Expor globalmente
    window.API_URL = isLocalhost ? LOCAL_API : PROD_API;

    console.log('[API] Usando base URL:', window.API_URL);
})();

/**
 * ✅ FUNÇÃO REUTILIZÁVEL PARA FAZER PEDIDOS À API
 *
 * @param {string} endpoint - ex: '/api/stats/overview'
 * @param {object} options  - { method, headers, body }
 * @returns {Promise<any>}  - JSON da resposta
 */
async function apiRequest(endpoint, options = {}) {
    const url = `${window.API_URL}${endpoint}`;

    const defaultHeaders = {
        'Accept': 'application/json'
    };

    const finalOptions = {
        method: options.method || 'GET',
        headers: {
            ...defaultHeaders,
            ...(options.headers || {})
        },
        body: options.body || null,
        credentials: 'include' // para cookies de sessão/JWT via cookie
    };

    try {
        const response = await fetch(url, finalOptions);

        if (!response.ok) {
            // tentar ler JSON de erro
            let errorData = null;
            try {
                errorData = await response.json();
            } catch (_) {
                // ignore
            }

            const message =
                errorData?.message ||
                `Erro na API (${response.status} ${response.statusText})`;

            console.error(`Erro na API [${finalOptions.method} ${endpoint}]:`, message);

            if (typeof showCustomAlert === 'function') {
                showCustomAlert('Erro de Comunicação', message);
            }

            throw new Error(message);
        }

        // Se não tiver conteúdo (204, etc.)
        if (response.status === 204) {
            return null;
        }

        const data = await response.json();
        return data;
    } catch (err) {
        console.error(`Erro na API [${finalOptions.method} ${endpoint}]:`, err.message);

        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Erro de Comunicação', err.message || 'Não foi possível ligar ao servidor.');
        }

        throw err;
    }
}
