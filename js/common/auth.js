/*
 * Ficheiro: js/common/auth.js
 *
 * Versão CORRIGIDA E BLINDADA
 * - Protecção contra múltiplos logins
 * - Tratamento de erro 429 (rate limit)
 * - Evita loops e estados inconsistentes
 */

let loginInProgress = false;

/**
 * Verifica se um utilizador (admin ou motorista) está autenticado.
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
 * Obtém o token correcto consoante o tipo de painel.
 */
function getAuthToken() {
    if (document.body.classList.contains('dashboard-body')) {
        return localStorage.getItem('adminToken');
    }
    if (document.body.classList.contains('motorista-body')) {
        return localStorage.getItem('driverToken');
    }
    return null;
}

/**
 * Headers de autenticação seguros.
 */
function getAuthHeaders() {
    const token = getAuthToken();
    if (!token) return {};
    return {
        'Authorization': `Bearer ${token}`
    };
}

/**
 * Processa login (admin ou motorista).
 */
async function handleLogin(e, role) {
    e.preventDefault();

    if (loginInProgress) return;
    loginInProgress = true;

    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');

    const email = form.querySelector('#email').value.trim();
    const password = form.querySelector('#password').value;

    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A entrar...';

    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, role })
        });

        // RATE LIMIT → parar tudo
        if (response.status === 429) {
            throw new Error(
                'Demasiadas tentativas a partir deste IP. Aguarde alguns minutos antes de tentar novamente.'
            );
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Erro no login');
        }

        if (role === 'admin') {
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('adminName', data.name || 'Admin');
            window.location.href = 'index.html';
        } else {
            localStorage.setItem('driverToken', data.token);
            window.location.href = 'painel-de-entrega.html';
        }

    } catch (error) {
        console.error('Falha no login:', error);

        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Erro de Login', error.message, 'error');
        } else {
            alert(error.message);
        }

        // Em erro grave → limpar sessão por segurança
        localStorage.removeItem('adminToken');
        localStorage.removeItem('driverToken');

    } finally {
        loginInProgress = false;
        submitButton.disabled = false;
        submitButton.innerHTML = 'Entrar';
    }
}

/**
 * Logout seguro.
 */
function handleLogout(role) {
    if (role === 'admin') {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminName');
        window.location.href = 'login.html';
    } else {
        localStorage.removeItem('driverToken');
        window.location.href = 'login-motorista.html';
    }
}
