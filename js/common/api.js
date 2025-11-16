/*
 * Ficheiro: js/common/api.js
 * (Dependência #1)
 *
 * Define a constante global da API_URL e a função
 * principal 'apiRequest' para comunicação com o backend.
 */

const API_URL = 'https://entregaah-mz.onrender.com';

/**
 * ✅ FUNÇÃO QUE FALTAVA
 *
 * Função reutilizável para fazer pedidos à API.
 * Trata da autenticação, envio de dados e resposta.
 *
 * @param {string} endpoint - O caminho da API (ex: '/admin/stats')
 * @param {string} method - O método HTTP (ex: 'GET', 'POST', 'PUT')
 * @param {Object} [body=null] - O corpo do pedido para POST/PUT
 * @returns {Promise<Object>} - Os dados da resposta (JSON)
 */
async function apiRequest(endpoint, method, body = null) {
    
    // Assegura que getAuthToken() existe (de auth.js)
    if (typeof getAuthToken !== 'function') {
        console.error("Função getAuthToken() não encontrada. 'auth.js' foi carregado?");
        throw new Error('Erro de autenticação.');
    }
    
    const token = getAuthToken();
    const headers = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        method: method,
        headers: headers,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
        config.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(API_URL + endpoint, config);

        // Trata respostas que não são JSON (ex: 204 No Content)
        if (response.status === 204) {
            return { message: 'Operação bem-sucedida.' };
        }

        const data = await response.json();

        if (!response.ok) {
            // Se a API retornar um erro (ex: 400, 401, 404), usa a mensagem dela
            throw new Error(data.message || `Erro ${response.status}: ${response.statusText}`);
        }

        return data; // Retorna o JSON de sucesso

    } catch (err) {
        console.error(`Erro na API [${method} ${endpoint}]:`, err.message);
        
        // Assegura que showCustomAlert() existe (de ui.js ou adminModals.js)
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Erro de Comunicação', err.message || 'Não foi possível ligar ao servidor.');
        }
        
        // Re-lança o erro para que a função que chamou (ex: fetchStats) saiba que falhou
        throw err;
    }
}
