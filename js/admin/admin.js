/**
 * ===========================
 *  HANDLERS PARA MOTORISTAS
 * ===========================
 */

// Adicionar motorista
async function handleAddDriver(event) {
    event.preventDefault();

    const form = document.getElementById('form-add-motorista');
    if (!form) return;

    const formData = new FormData(form);

    const payload = {
        nome: formData.get('nome'),
        telefone: formData.get('telefone'),
        email: formData.get('email'),
        vehicle_plate: formData.get('vehicle_plate'),
        vehicle_model: formData.get('vehicle_model'),
        password: formData.get('password')
    };

    try {
        await createDriver(payload); // adminApi.js
        showCustomAlert('Sucesso', 'Motorista adicionado com sucesso.');
        form.reset();
        loadDrivers();
    } catch (err) {
        console.error('Erro ao adicionar motorista:', err);
    }
}

// Editar motorista
async function handleUpdateDriver(event) {
    event.preventDefault();

    const form = document.getElementById('form-edit-motorista');
    if (!form) return;

    const formData = new FormData(form);
    const driverId = formData.get('driverId');

    const payload = {
        nome: formData.get('nome'),
        telefone: formData.get('telefone'),
        email: formData.get('email'),
        vehicle_plate: formData.get('vehicle_plate'),
        vehicle_model: formData.get('vehicle_model'),
        status: formData.get('status')
    };

    try {
        await updateDriver(driverId, payload); // adminApi.js
        showCustomAlert('Sucesso', 'Motorista atualizado com sucesso.');
        loadDrivers();
    } catch (err) {
        console.error('Erro ao atualizar motorista:', err);
    }
}

/**
 * ===========================
 *  HANDLERS PARA CLIENTES
 * ===========================
 */

async function handleAddClient(event) {
    event.preventDefault();

    const form = document.getElementById('form-add-cliente');
    if (!form) return;

    const formData = new FormData(form);

    const payload = {
        nome: formData.get('nome'),
        telefone: formData.get('telefone'),
        email: formData.get('email'),
        endereco: formData.get('endereco')
    };

    try {
        const client = await createClient(payload); // adminApi.js
        showCustomAlert('Sucesso', 'Cliente adicionado com sucesso.');
        form.reset();
        loadClients();
        // Atualiza cache para o formulário de entrega
        clientCache.push(client);
    } catch (err) {
        console.error('Erro ao adicionar cliente:', err);
    }
}

async function handleUpdateClient(event) {
    event.preventDefault();

    const form = document.getElementById('form-edit-cliente');
    if (!form) return;

    const formData = new FormData(form);
    const clientId = formData.get('clientId');

    const payload = {
        nome: formData.get('nome'),
        telefone: formData.get('telefone'),
        email: formData.get('email'),
        endereco: formData.get('endereco')
    };

    try {
        await updateClient(clientId, payload); // adminApi.js
        showCustomAlert('Sucesso', 'Cliente atualizado com sucesso.');
        loadClients();
    } catch (err) {
        console.error('Erro ao atualizar cliente:', err);
    }
}

/**
 * ===========================
 *  HANDLER PARA ALTERAÇÃO DE SENHA
 * ===========================
 */

async function handleChangePassword(event) {
    event.preventDefault();

    const form = document.getElementById('form-change-password');
    if (!form) return;

    const formData = new FormData(form);

    const payload = {
        currentPassword: formData.get('currentPassword'),
        newPassword: formData.get('newPassword'),
        confirmPassword: formData.get('confirmPassword')
    };

    try {
        await changeAdminPassword(payload); // adminApi.js
        showCustomAlert('Sucesso', 'Palavra-passe alterada com sucesso.');
        form.reset();
    } catch (err) {
        console.error('Erro ao alterar palavra-passe:', err);
    }
}

/**
 * ===========================
 *  HANDLERS PARA GESTORES
 * ===========================
 */

async function handleAddManager(event) {
    event.preventDefault();

    const form = document.getElementById('form-add-manager');
    if (!form) return;

    const formData = new FormData(form);

    const payload = {
        nome: formData.get('nome'),
        telefone: formData.get('telefone'),
        email: formData.get('email'),
        password: formData.get('password')
    };

    try {
        await createManager(payload); // adminApi.js
        showCustomAlert('Sucesso', 'Gestor adicionado com sucesso.');
        form.reset();
        loadManagers();
    } catch (err) {
        console.error('Erro ao adicionar gestor:', err);
    }
}

async function handleEditManager(event) {
    event.preventDefault();

    const form = document.getElementById('form-edit-manager');
    if (!form) return;

    const formData = new FormData(form);
    const managerId = formData.get('managerId');

    const payload = {
        nome: formData.get('nome'),
        telefone: formData.get('telefone'),
        email: formData.get('email')
    };

    try {
        await updateManager(managerId, payload); // adminApi.js
        showCustomAlert('Sucesso', 'Gestor atualizado com sucesso.');
        loadManagers();
    } catch (err) {
        console.error('Erro ao atualizar gestor:', err);
    }
}

/**
 * ===========================
 *  HANDLERS PARA CUSTOS / DESPESAS
 * ===========================
 */

async function handleAddExpense(event) {
    event.preventDefault();

    const form = document.getElementById('form-add-expense');
    if (!form) return;

    const formData = new FormData(form);

    const payload = {
        description: formData.get('description'),
        amount: Number(formData.get('amount') || 0),
        date: formData.get('date'),
        employeeId: formData.get('employeeId'),
        category: formData.get('category')
    };

    try {
        await createExpense(payload); // adminApi.js
        showCustomAlert('Sucesso', 'Despesa registada com sucesso.');
        form.reset();
        loadExpenses();
    } catch (err) {
        console.error('Erro ao adicionar despesa:', err);
    }
}
