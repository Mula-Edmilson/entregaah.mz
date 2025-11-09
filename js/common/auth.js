/*
 * Ficheiro: js/common/auth.js
 *
 * (Dependência #2) - Precisa do 'api.js'
 *
 * Centraliza toda a lógica de autenticação:
 * - Login, Logout, Verificação de token, Obtenção de token.
 */

/**
 * Verifica se um utilizador (admin ou motorista) está autenticado.
 * Se não estiver, redireciona para a página de login apropriada.
 * @param {string} role - 'admin' ou 'driver'.
 */
function checkAuth(role) {
    let token;
    let loginPage;

    if (role === 'admin') {
        token = localStorage.getItem('adminToken');
        loginPage = 'login.html';
    } else {
        token = localStorage.getItem('driverToken');
        loginPage = 'login-motorista.html';
    }

    if (!token) {
        window.location.href = loginPage;
    }
}

/**
 * Obtém o token de autenticação correto (admin ou driver) com base
 * na página/corpo (body) onde o script está a ser executado.
 * @returns {string|null} O token JWT ou null.
 */
function getAuthToken() {
    // Verifica a classe no body para saber qual token devolver
    if (document.body.classList.contains('dashboard-body')) {
        return localStorage.getItem('adminToken');
    }
    if (document.body.classList.contains('motorista-body')) {
        return localStorage.getItem('driverToken');
    }
    return null;
}

/**
 * Cria o objeto de cabeçalho (headers) de autenticação para
 * usar em chamadas 'fetch' à API.
 * @returns {Object} Ex: { 'Authorization': 'Bearer <token>' }
 */
function getAuthHeaders() {
    return {
        'Authorization': `Bearer ${getAuthToken()}`
    };
}

/**
 * Processa o formulário de login para admin ou motorista.
 * @param {Event} e - O evento de 'submit' do formulário.
 * @param {string} role - 'admin' ou 'driver'.
 */
async function handleLogin(e, role) {
    e.preventDefault(); // Impede o recarregamento da página

    const form = e.target;
    const email = form.querySelector('#email').value;
    const password = form.querySelector('#password').value;
    const showAlert = (title, message, type) => {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert(title, message, type);
        } else {
            alert(`${title}: ${message}`); // Fallback para o alerta padrão
        }
    };

    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, role })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Erro desconhecido');
        }

        // Se o login for bem-sucedido
        if (role === 'admin') {
            localStorage.setItem('adminToken', data.token);
            window.location.href = 'index.html';
        } else {
            localStorage.setItem('driverToken', data.token);
            window.location.href = 'painel-de-entrega.html';
        }

    } catch (error) {
        console.error('Falha no login:', error);
        
        // Se o modal de alerta existir na página de login, usa-o
        if (alertModal && typeof showCustomAlert === 'function') {
            showCustomAlert('Erro de Login', error.message, 'error');
        } else {
            // Fallback para o alerta padrão do browser
            alert(`Erro de Login: ${error.message}`);
        }
    }
}

/**
 * Faz o logout do utilizador (admin ou motorista) e redireciona.
 * @param {string} role - 'admin' ou 'driver'.
 */
function handleLogout(role) {
    if (role === 'admin') {
        localStorage.removeItem('adminToken');
        window.location.href = 'login.html';
    } else {
        localStorage.removeItem('driverToken');
        window.location.href = 'login-motorista.html';
    }
}