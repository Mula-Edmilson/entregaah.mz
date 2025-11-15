/*
 * Ficheiro: js/admin/adminManagers.js
 * Gestão de Gestores (Managers)
 */

async function loadManagers() {
  const tableBody = document.getElementById('managers-table-body');
  tableBody.innerHTML = '<tr><td colspan="4">A carregar gestores...</td></tr>';

  try {
    const response = await fetch(`${API_URL}/api/managers`, {
      headers: getAuthHeaders()
    });

    if (response.status === 401) return handleLogout('admin');

    const data = await response.json();
    if (!response.ok) throw new Error(data.message);

    const managers = data.managers || [];

    tableBody.innerHTML = '';

    if (managers.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="4">Nenhum gestor registado.</td></tr>';
      return;
    }

    managers.forEach((manager) => {
      tableBody.innerHTML += `
        <tr>
          <td>${manager.nome}</td>
          <td>${manager.telefone}</td>
          <td>${manager.email}</td>
          <td>
            <button class="btn-action-small" onclick="openEditManagerModal('${manager._id}')">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-action-small btn-danger" onclick="deleteManager('${manager._id}')">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    });
  } catch (error) {
    console.error('Erro ao carregar gestores:', error);
    tableBody.innerHTML = '<tr><td colspan="4">Erro ao carregar gestores.</td></tr>';
  }
}

async function handleAddManager(event) {
  event.preventDefault();

  const nome = document.getElementById('manager-name').value;
  const telefone = document.getElementById('manager-phone').value;
  const email = document.getElementById('manager-email').value;
  const password = document.getElementById('manager-password').value;

  try {
    const response = await fetch(`${API_URL}/api/managers`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ nome, telefone, email, password })
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.message);

    showCustomAlert('Sucesso', 'Gestor criado com sucesso.', 'success');
    document.getElementById('form-add-manager').reset();
    showAddManagerForm(false);
    loadManagers();
  } catch (error) {
    console.error('Erro ao adicionar gestor:', error);
    showCustomAlert('Erro', error.message || 'Erro ao adicionar gestor.', 'error');
  }
}

async function openEditManagerModal(managerId) {
  const modal = document.getElementById('edit-manager-modal');
  modal.classList.remove('hidden');
  document.getElementById('edit-manager-id').value = managerId;

  document.getElementById('form-edit-manager').reset();
  document.getElementById('edit-manager-name').value = 'A carregar...';

  try {
    const response = await fetch(`${API_URL}/api/managers/${managerId}`, {
      headers: getAuthHeaders()
    });

    if (response.status === 401) return handleLogout('admin');

    const data = await response.json();
    if (!response.ok) throw new Error(data.message);

    const manager = data.manager;

    document.getElementById('edit-manager-name').value = manager.nome;
    document.getElementById('edit-manager-phone').value = manager.telefone;
    document.getElementById('edit-manager-email').value = manager.email;
  } catch (error) {
    console.error('Erro ao carregar gestor:', error);
    showCustomAlert('Erro', 'Erro ao carregar dados do gestor.', 'error');
    closeEditManagerModal();
  }
}

async function handleEditManager(event) {
  event.preventDefault();

  const managerId = document.getElementById('edit-manager-id').value;
  const nome = document.getElementById('edit-manager-name').value;
  const telefone = document.getElementById('edit-manager-phone').value;
  const email = document.getElementById('edit-manager-email').value;

  try {
    const response = await fetch(`${API_URL}/api/managers/${managerId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ nome, telefone, email })
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.message);

    showCustomAlert('Sucesso', 'Gestor atualizado com sucesso.', 'success');
    closeEditManagerModal();
    loadManagers();
  } catch (error) {
    console.error('Erro ao atualizar gestor:', error);
    showCustomAlert('Erro', error.message || 'Erro ao atualizar gestor.', 'error');
  }
}

async function deleteManager(managerId) {
  if (!confirm('Tem certeza que deseja apagar este gestor?')) return;

  try {
    const response = await fetch(`${API_URL}/api/managers/${managerId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.message);

    showCustomAlert('Sucesso', 'Gestor apagado com sucesso.', 'success');
    loadManagers();
  } catch (error) {
    console.error('Erro ao apagar gestor:', error);
    showCustomAlert('Erro', error.message || 'Erro ao apagar gestor.', 'error');
  }
}

function showAddManagerForm(show) {
  const form = document.getElementById('form-add-manager');
  const btn = document.getElementById('btn-show-manager-form');

  if (show) {
    form.classList.remove('hidden');
    btn.classList.add('hidden');
  } else {
    form.classList.add('hidden');
    btn.classList.remove('hidden');
  }
}

function closeEditManagerModal() {
  document.getElementById('edit-manager-modal').classList.add('hidden');
}