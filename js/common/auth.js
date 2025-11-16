/*
 * js/common/auth.js (corrigido)
 *
 * Normaliza nomes de token e melhora compatibilidade com o frontend existente.
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
    token = localStorage.getItem('adminToken') || localStorage.getItem('token');
    loginPage = 'login.html';
  } else {
    token = localStorage.getItem('driverToken') || localStorage.getItem('token');
    loginPage = 'login-motorista.html';
  }

  if (!token) {
    window.location.href = loginPage;
  }
}

/**
 * Obtém o token de autenticação correto (admin ou driver) com base
 * na página/corpo (body) onde o script está a ser executado.
 * Faz fallback para a key 'token' para compatibilidade.
 * @returns {string|null} O token JWT ou null.
 */
function getAuthToken() {
  // Se houver key única 'token' (compatibilidade), devolve-a
  const generic = localStorage.getItem('token');
  if (generic) return generic;

  // Senão devolve por role (existente)
  if (document.body.classList.contains('dashboard-body')) {
    return localStorage.getItem('adminToken') || null;
  }
  if (document.body.classList.contains('motorista-body')) {
    return localStorage.getItem('driverToken') || null;
  }
  // fallback geral
  return localStorage.getItem('adminToken') || localStorage.getItem('driverToken') || null;
}

/**
 * Cria o objeto de cabeçalho (headers) de autenticação para
 * usar em chamadas 'fetch' à API.
 * @returns {Object} Ex: { 'Authorization': 'Bearer <token>' } — ou {} se não houver token.
 */
function getAuthHeaders() {
  const token = getAuthToken();
  if (!token) return {};
  return {
    'Authorization': `Bearer ${token}`
  };
}

/**
 * Processa o formulário de login para admin ou motorista.
 * Ao guardar o token, guardamos tanto na key específica (adminToken/driverToken)
 * como na key genérica 'token' para compatibilidade com o frontend existente.
 * @param {Event} e - O evento de 'submit' do formulário.
 * @param {string} role - 'admin' ou 'driver'.
 */
async function handleLogin(e, role) {
  e.preventDefault(); // Impede o recarregamento da página

  const form = e.target;
  const submitButton = form.querySelector('button[type="submit"]');

  const email = form.querySelector('#email').value;
  const password = form.querySelector('#password').value;
  const showAlert = (title, message, type) => {
    if (typeof showCustomAlert === 'function') {
      showCustomAlert(title, message, type);
    } else {
      alert(`${title}: ${message}`);
    }
  };

  submitButton.disabled = true;
  submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A entrar...';

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

    // Guarda token nas keys específicas e na key genérica 'token' para compatibilidade
    if (role === 'admin') {
      localStorage.setItem('adminToken', data.token);
      localStorage.setItem('token', data.token);
      window.location.href = 'index.html';
    } else {
      localStorage.setItem('driverToken', data.token);
      localStorage.setItem('token', data.token);
      window.location.href = 'painel-de-entrega.html';
    }

  } catch (error) {
    console.error('Falha no login:', error);
    if (typeof showCustomAlert === 'function') {
      showCustomAlert('Erro de Login', error.message, 'error');
    } else {
      alert(`Erro de Login: ${error.message}`);
    }
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Entrar';
  }
}

/**
 * Faz o logout do utilizador (admin ou motorista) e redireciona.
 * Remove tanto a key específica como a genérica 'token'.
 * @param {string} role - 'admin' ou 'driver'.
 */
function handleLogout(role) {
  // Remove keys específicas e genérica
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('driverToken');
  } catch (err) { /* ignore */ }

  if (role === 'admin') {
    window.location.href = 'login.html';
  } else {
    window.location.href = 'login-motorista.html';
  }
}
