// script.js - Lógica principal del Sistema de Control de Acceso LogSena (con backend API)

// Estado de la aplicación
const appState = {
    currentUser: null,
    token: null,
    users: [], // Array de objetos usuario (para cache local)
    accessLogs: [], // Array de objetos de registro de acceso (para cache local)
    settings: {
        institutionName: "Centro de Biotecnología Industrial (CBI) Palmira",
        qrExpirationDays: 365
    },
    apiBaseUrl: 'http://localhost:3002/api' // URL de la API backend
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    // Verificar si hay un token guardado (de sesión previa)
    const token = localStorage.getItem('logsena_token');
    if (token) {
        appState.token = token;
        // Intentar obtener el perfil del usuario
        fetchProfile();
    }

    // Configurar event listeners globales
    setupGlobalListeners();

    // Mostrar la vista de login inicialmente
    showView('login-view');
});

// Funciones de manejo de datos con API
async function fetchProfile() {
    try {
        const response = await fetch(`${appState.apiBaseUrl}/profile`, {
            headers: {
                'Authorization': `Bearer ${appState.token}`
            }
        });

        if (response.ok) {
            const userData = await response.json();
            appState.currentUser = userData;
            updateNavMenu();
            // Redirigir según el rol después de un pequeño delay
            setTimeout(() => {
                switch(appState.currentUser.role) {
                    case 'admin':
                        showView('dashboard-view');
                        break;
                    case 'guard':
                        showView('scan-view');
                        break;
                    case 'instructor':
                        showView('dashboard-view');
                        break;
                    default:
                        showView('dashboard-view');
                }
            }, 500);
        } else {
            // Token inválido o expirado
            localStorage.removeItem('logsena_token');
            appState.token = null;
            appState.currentUser = null;
            showView('login-view');
        }
    } catch (error) {
        console.error('Error fetching profile:', error);
        showView('login-view');
    }
}

async function loginUser(username, password) {
    try {
        const response = await fetch(`${appState.apiBaseUrl}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            const data = await response.json();
            appState.token = data.token;
            appState.currentUser = data.user;
            localStorage.setItem('logsena_token', appState.token);

            showMessage('login-error', 'Inicio de sesión exitoso.', 'success');

            // Redirigir según el rol
            setTimeout(() => {
                switch(appState.currentUser.role) {
                    case 'admin':
                        showView('dashboard-view');
                        break;
                    case 'guard':
                        showView('scan-view');
                        break;
                    case 'instructor':
                        showView('dashboard-view');
                        break;
                    default:
                        showView('dashboard-view');
                }
            }, 1000);

            return true;
        } else {
            const errorData = await response.json();
            showMessage('login-error', errorData.error || 'Usuario o contraseña incorrectos.', 'error');
            return false;
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('login-error', 'Error de conexión con el servidor.', 'error');
        return false;
    }
}

async function logoutUser() {
    try {
        await fetch(`${appState.apiBaseUrl}/logout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${appState.token}`
            }
        });
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        localStorage.removeItem('logsena_token');
        appState.token = null;
        appState.currentUser = null;
        showView('login-view');
    }
}

// Funciones para obtener datos desde la API
async function fetchUsers() {
    try {
        const response = await fetch(`${appState.apiBaseUrl}/users`, {
            headers: {
                'Authorization': `Bearer ${appState.token}`
            }
        });

        if (response.ok) {
            appState.users = await response.json();
            return appState.users;
        } else {
            throw new Error('Error al obtener usuarios');
        }
    } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
    }
}

async function fetchAccessLogs() {
    try {
        const response = await fetch(`${appState.apiBaseUrl}/access-logs`, {
            headers: {
                'Authorization': `Bearer ${appState.token}`
            }
        });

        if (response.ok) {
            appState.accessLogs = await response.json();
            return appState.accessLogs;
        } else {
            throw new Error('Error al obtener registros de acceso');
        }
    } catch (error) {
        console.error('Error fetching access logs:', error);
        throw error;
    }
}

async function createUser(userData) {
    try {
        // El password ya viene hasheado del frontend, pero en un caso real
        // el hashing debería hacerse en el backend por seguridad
        const response = await fetch(`${appState.apiBaseUrl}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${appState.token}`
            },
            body: JSON.stringify(userData)
        });

        if (response.ok) {
            const newUser = await response.json();
            // Actualizar cache local
            appState.users.push(newUser);
            return newUser;
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al crear usuario');
        }
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
}

async function updateUser(userId, userData) {
    try {
        const response = await fetch(`${appState.apiBaseUrl}/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${appState.token}`
            },
            body: JSON.stringify(userData)
        });

        if (response.ok) {
            const updatedUser = await response.json();
            // Actualizar cache local
            const index = appState.users.findIndex(u => u.id === userId);
            if (index !== -1) {
                appState.users[index] = updatedUser;
            }
            return updatedUser;
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al actualizar usuario');
        }
    } catch (error) {
        console.error('Error updating user:', error);
        throw error;
    }
}

async function deleteUser(userId) {
    try {
        const response = await fetch(`${appState.apiBaseUrl}/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${appState.token}`
            }
        });

        if (response.ok) {
            // Actualizar cache local
            appState.users = appState.users.filter(u => u.id !== userId);
            return true;
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al eliminar usuario');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        throw error;
    }
}

async function registerAccess(accessData) {
    try {
        const response = await fetch(`${appState.apiBaseUrl}/access-logs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${appState.token}`
            },
            body: JSON.stringify(accessData)
        });

        if (response.ok) {
            const accessLog = await response.json();
            // Actualizar cache local
            appState.accessLogs.push(accessLog);
            return accessLog;
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al registrar acceso');
        }
    } catch (error) {
        console.error('Error registering access:', error);
        throw error;
    }
}

// Funciones de manejo de vistas (similares a las anteriores pero adaptadas para API)
function showView(viewId) {
    // Ocultar todas las vistas
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });

    // Mostrar la vista solicitada
    const view = document.getElementById(viewId);
    if (view) {
        view.classList.add('active');
    }

    // Actualizar el menú de navegación
    updateNavMenu();

    // Si es una vista específica, inicializar sus componentes
    if (viewId === 'dashboard-view') {
        initDashboard();
    } else if (viewId === 'user-management-view') {
        loadUsersTable();
    } else if (viewId === 'register-view') {
        resetRegisterForm();
    } else if (viewId === 'scan-view') {
        // El escaneo se inicia cuando se muestra la vista
        setTimeout(setupQRScanner, 100);
    }
}

// Funciones de autenticación y manejo de usuario
function login(username, password) {
    return loginUser(username, password);
}

function logout() {
    logoutUser();
}

function updateNavMenu() {
    const navMenu = document.getElementById('nav-menu');
    if (!navMenu) return;

    // Limpiar el menú
    navMenu.innerHTML = '';

    // Siempre mostrar el enlace de cierre de sesión si hay un usuario
    if (appState.currentUser) {
        const logoutItem = document.createElement('li');
        const logoutLink = document.createElement('a');
        logoutLink.href = '#';
        logoutLink.textContent = 'Cerrar Sesión';
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
        logoutItem.appendChild(logoutLink);
        navMenu.appendChild(logoutItem);

        // Añadir elementos según el rol
        const role = appState.currentUser.role;
        let itemsToAdd = [];

        switch(role) {
            case 'admin':
                itemsToAdd = [
                    { label: 'Panel de Administración', view: 'dashboard-view' },
                    { label: 'Gestión de Usuarios', view: 'user-management-view' },
                    { label: 'Reportes', view: 'reports-view' },
                    { label: 'Generar QR', view: 'qr-generator-view' }
                ];
                break;
            case 'guard':
                itemsToAdd = [
                    { label: 'Registrar Usuario', view: 'register-view' },
                    { label: 'Escanear QR', view: 'scan-view' }
                ];
                break;
            case 'instructor':
                itemsToAdd = [
                    { label: 'Mis Aprendices', view: 'dashboard-view' }, // Simplificado
                    { label: 'Reportes', view: 'reports-view' }
                ];
                break;
            case 'apprentice':
                itemsToAdd = [
                    { label: 'Mi Historial', view: 'dashboard-view' } // Simplificado
                ];
                break;
            case 'visitor':
                itemsToAdd = [
                    { label: 'Mi Información', view: 'dashboard-view' } // Simplificado
                ];
                break;
            default:
                itemsToAdd = [];
        }

        // Insertar los elementos del rol antes del logout
        itemsToAdd.reverse().forEach(item => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = '#';
            a.textContent = item.label;
            a.addEventListener('click', (e) => {
                e.preventDefault();
                showView(item.view);
            });
            li.appendChild(a);
            // Si el menú tiene hijos, insertamos antes del primer hijo, sino al final
            if (navMenu.firstChild) {
                navMenu.insertBefore(li, navMenu.firstChild);
            } else {
                navMenu.appendChild(li);
            }
        });
    } else {
        // Si no hay usuario, mostrar enlaces de login y registro (si aplica)
        const loginItem = document.createElement('li');
        const loginLink = document.createElement('a');
        loginLink.href = '#';
        loginLink.textContent = 'Iniciar Sesión';
        loginLink.addEventListener('click', (e) => {
            e.preventDefault();
            showView('login-view');
        });
        loginItem.appendChild(loginLink);
        navMenu.appendChild(loginItem);
    }
}

// Funciones específicas de vistas (adaptadas para API)
function initDashboard() {
    // Cargar datos para el dashboard
    Promise.all([
        fetchAccessLogs(),
        fetchUsers()
    ]).then(() => {
        // Actualizar tarjetas del dashboard
        document.getElementById('today-entries').textContent = getTodayEntries();
        document.getElementById('today-exits').textContent = getTodayExits();
        document.getElementById('current-inside').textContent = getCurrentInside();
        document.getElementById('today-visitors').textContent = getTodayVisitors();

        // Actualizar gráfico (simplificado)
        updateHourlyChart();
    }).catch(error => {
        console.error('Error loading dashboard data:', error);
        showMessage('dashboard-message', 'Error al cargar los datos del dashboard.', 'error');
    });
}

// Funciones auxiliares para el dashboard (basadas en cache local)
function getTodayEntries() {
    const today = new Date().toISOString().split('T')[0];
    return appState.accessLogs.filter(log =>
        log.timestamp.startsWith(today) &&
        log.action === 'entry'
    ).length;
}

function getTodayExits() {
    const today = new Date().toISOString().split('T')[0];
    return appState.accessLogs.filter(log =>
        log.timestamp.startsWith(today) &&
        log.action === 'exit'
    ).length;
}

function getCurrentInside() {
    const today = new Date().toISOString().split('T')[0];
    const entries = appState.accessLogs.filter(log =>
        log.timestamp.startsWith(today) &&
        log.action === 'entry'
    ).length;
    const exits = appState.accessLogs.filter(log =>
        log.timestamp.startsWith(today) &&
        log.action === 'exit'
    ).length;
    return Math.max(0, entries - exits);
}

function getTodayVisitors() {
    const today = new Date().toISOString().split('T')[0];
    return appState.accessLogs.filter(log =>
        log.timestamp.startsWith(today) &&
        log.userRole === 'visitor'
    ).length;
}

function updateHourlyChart() {
    // En una implementación real, usaríamos una librería como Chart.js
    // Por ahora, solo actualizamos el texto
    const ctx = document.getElementById('hourly-chart').getContext('2d');
    // Limpiar el canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    // Dibujar un mensaje placeholder
    ctx.fillStyle = '#666';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Gráfico de flujo por hora (implementar con Chart.js)', ctx.canvas.width/2, ctx.canvas.height/2);
}

function loadUsersTable() {
    fetchUsers().then(users => {
        const tbody = document.querySelector('#users-table tbody');
        tbody.innerHTML = '';

        users.forEach(user => {
            const tr = document.createElement('tr');

            tr.innerHTML = `
                <td>${user.full_name}</td>
                <td>${user.document_number}</td>
                <td>${user.program || '-'}</td>
                <td>${user.ficha || '-'}</td>
                <td>${getRoleLabel(user.role)}</td>
                <td>${user.is_active ? 'Activo' : 'Inactivo'}</td>
                <td>
                    <button class="action-btn edit-btn" data-id="${user.id}">Editar</button>
                    <button class="action-btn delete-btn" data-id="${user.id}">${user.is_active ? 'Desactivar' : 'Activar'}</button>
                    ${user.role !== 'admin' ?
                        `<button class="action-btn btn-secondary" data-id="${user.id}" id="qr-btn-${user.id}">Ver QR</button>` :
                        ''
                    }
                </td>
            `;

            tbody.appendChild(tr);
        });

        // Añadir event listeners a los botones
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                editUser(id);
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                toggleUserStatus(id);
            });
        });

        document.querySelectorAll('[id^="qr-btn-"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                showUserQR(id);
            });
        });
    }).catch(error => {
        console.error('Error loading users table:', error);
        showMessage('user-management-message', 'Error al cargar la lista de usuarios.', 'error');
    });
}

// Funciones de gestión de usuarios
function addUser(userData) {
    return createUser(userData);
}

function getUserById(id) {
    return appState.users.find(u => u.id === id);
}

function editUser(id) {
    const user = getUserById(id);
    if (!user) return;

    // Llenar el formulario de registro con los datos del usuario
    document.getElementById('reg-fullname').value = user.full_name;
    document.getElementById('reg-document').value = user.document_number;
    document.getElementById('reg-program').value = user.program || '';
    document.getElementById('reg-ficha').value = user.ficha || '';
    document.getElementById('reg-role').value = user.role;

    // Cambiar el título y el comportamiento del botón
    document.querySelector('#register-view h2').textContent = 'Editar Usuario';
    const registerForm = document.getElementById('register-form');
    registerForm.onsubmit = (e) => {
        e.preventDefault();
        const updatedUserData = {
            fullName: document.getElementById('reg-fullname').value,
            document: document.getElementById('reg-document').value,
            program: document.getElementById('reg-program').value,
            ficha: document.getElementById('reg-ficha').value,
            role: document.getElementById('reg-role').value,
            email: user.email || '' // Mantener el email original o permitir edición
        };

        updateUser(id, updatedUserData)
            .then(() => {
                showMessage('register-message', 'Usuario actualizado correctamente.', 'success');
                resetRegisterForm();
                showView('user-management-view');
            })
            .catch(error => {
                showMessage('register-message', 'Error al actualizar el usuario.', 'error');
                console.error('Error updating user:', error);
            });
    };

    showView('register-view');
}

function toggleUserStatus(id) {
    const user = getUserById(id);
    if (!user) return;

    updateUser(id, { is_active: !user.is_active })
        .then(() => {
            loadUsersTable();
            const action = user.is_active ? 'desactivado' : 'activado';
            showMessage('user-management-message', `Usuario ${action} correctamente.`, 'success');
        })
        .catch(error => {
            showMessage('user-management-message', 'Error al cambiar el estado del usuario.', 'error');
            console.error('Error toggling user status:', error);
        });
}

function showUserQR(id) {
    const user = getUserById(id);
    if (!user) return;

    // Mostrar el QR en la vista de generación de QR
    appState.tempQRUserId = id; // Guardar temporalmente el ID

    // Actualizar la vista de generación de QR
    document.getElementById('qr-user-info').innerHTML = `
        <p><strong>Nombre:</strong> ${user.full_name}</p>
        <p><strong>Documento:</strong> ${user.document_number}</p>
        <p><strong>Rol:</strong> ${getRoleLabel(user.role)}</p>
        <p><strong>Email:</strong> ${user.email || 'No disponible'}</p>
    `;

    // Generar y mostrar el QR (usando datos del usuario para generar el QR)
    const qrData = `LOGSENA_${user.id}_${user.document_number}`; // Formato de datos para el QR
    const qrContainer = document.getElementById('qr-code-container');
    qrContainer.innerHTML = ''; // Limpiar

    QRCode.toCanvas(qrData, {
        width: 200,
        height: 200
    }, function (error, canvas) {
        if (error) {
            console.error(error);
            showMessage('qr-message', 'Error al generar el código QR.', 'error');
        } else {
            qrContainer.appendChild(canvas);
            document.getElementById('qr-data-text').textContent = qrData;
            showMessage('qr-message', 'Código QR generado.', 'success');
        }
    });

    showView('qr-generator-view>');
}

// Funciones de escaneo de QR (similares a las anteriores pero adaptadas)
function setupQRScanner() {
    const video = document.getElementById('qr-video');

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment"} })
            .then(function(stream) {
                video.srcObject = stream;
                video.setAttribute("playsinline", true); // necesario para iOS
                video.play();
                // Iniciar el escaneo simulado
                startMockQRScanner();
            })
            .catch(function(err) {
                showMessage('scan-error', 'Error al acceder a la cámara: ' + err.message, 'error');
            });
    } else {
        showMessage('scan-error', 'Su navegador no soporta el escaneo de QR desde la cámara.', 'error');
    }
}

// Simulador de escaneo de QR para demostración
function startMockQRScanner() {
    // Limpiar cualquier escaneo previo
    if (appState.mockScannerInterval) {
        clearInterval(appState.mockScannerInterval);
    }

    // Simular escaneo cada 3 segundos con el QR del usuario de ejemplo
    appState.mockScannerInterval = setInterval(() => {
        // Obtener un usuario activo al azar para simular el escaneo
        const activeUsers = appState.users.filter(u => u.is_active);
        if (activeUsers.length > 0) {
            const randomUser = activeUsers[Math.floor(Math.random() * activeUsers.length)];
            // Generar el mismo formato de QR que usaríamos en la app
            const qrData = `LOGSENA_${randomUser.id}_${randomUser.document_number}`;
            handleQRResult(qrData);
        }
    }, 3000); // Simular escaneo cada 3 segundos
}

function handleQRResult(qrData) {
    // Detener el escaneo simulado (en una implementación real, pararíamos el stream de video)
    if (appState.mockScannerInterval) {
        clearInterval(appState.mockScannerInterval);
        appState.mockScannerInterval = null;
    }

    // Buscar el usuario por su ID extraído del QR
    // Formato esperado: LOGSENA_{id}_{document_number}
    const match = qrData.match(/LOGSENA_(\d+)_.+/);
    if (!match) {
        showMessage('scan-error', 'Código QR no válido.', 'error');
        showScanResult(null);
        return;
    }

    const userId = parseInt(match[1]);
    const user = appState.users.find(u => u.id === userId && u.is_active);

    if (!user) {
        showMessage('scan-error', 'Usuario no encontrado o inactivo.', 'error');
        showScanResult(null);
        return;
    }

    // Mostrar la información del usuario y permitir confirmar entrada/salida
    showScanResult(user);
}

function showScanResult(user) {
    const resultDiv = document.getElementById('scan-result');
    const resultText = document.getElementById('scan-result-text');

    if (user) {
        resultText.innerHTML = `
            <p><strong>Nombre:</strong> ${user.full_name}</p>
            <p><strong>Documento:</strong> ${user.document_number}</p>
            <p><strong>Rol:</strong> ${getRoleLabel(user.role)}</p>
            <p><strong>Estado:</strong> ${user.is_active ? 'Activo' : 'Inactivo'}</p>
        `;
        resultDiv.style.display = 'block';

        // Configurar botones de confirmación
        document.getElementById('confirm-entry').onclick = () => {
            registerAccessForUser(user, 'entry');
        };

        document.getElementById('confirm-exit').onclick = () => {
            registerAccessForUser(user, 'exit');
        };
    } else {
        resultText.textContent = 'Usuario no encontrado o código inválido.';
        resultDiv.style.display = 'block';
    }
}

function registerAccessForUser(user, type) {
    // Verificar si ya registró una entrada sin salida (para evitar múltiples entradas)
    if (type === 'entry') {
        const today = new Date().toISOString().split('T')[0];
        const lastEntry = appState.accessLogs
            .filter(log =>
                log.user_id === user.id &&
                log.timestamp.startsWith(today) &&
                log.action === 'entry'
            )
            .pop();

        const lastExit = appState.accessLogs
            .filter(log =>
                log.user_id === user.id &&
                log.timestamp.startsWith(today) &&
                log.action === 'exit'
            )
            .pop();

        if (lastEntry && (!lastExit || new Date(lastEntry.timestamp) > new Date(lastExit.timestamp))) {
            showMessage('scan-error', 'El usuario ya registró una entrada hoy sin registrar una salida. Por favor, registre la salida primero.', 'error');
            return;
        }
    }

    // Crear el registro de acceso
    const accessData = {
        user_id: user.id,
        action: type, // 'entry' o 'exit'
        location: 'Entrada Principal', // En una app real, esto podría venir de configuración o GPS
        device_info: navigator.userAgent
    };

    registerAccess(accessData)
        .then(accessLog => {
            // Mostrar mensaje de éxito
            const actionText = type === 'entry' ? 'Entrada' : 'Salida';
            showMessage('scan-message', `${actionText} registrada correctamente para ${user.full_name}.`, 'success');

            // Actualizar dashboard si estamos en esa vista
            if (document.getElementById('dashboard-view').classList.contains('active')) {
                initDashboard();
            }

            // Resetear para el próximo escaneo
            setTimeout(() => {
                resetScanView();
                // Reactivar el escaneo simulado para el próximo escaneo
                startMockQRScanner();
            }, 2000);
        })
        .catch(error => {
            showMessage('scan-message', 'Error al registrar el acceso.', 'error');
            console.error('Error registering access:', error);

            // Reactivar el escaneo simulado para el próximo intento
            setTimeout(() => {
                resetScanView();
                startMockQRScanner();
            }, 2000);
        });
}

function showScanResult(user) {
    const resultDiv = document.getElementById('scan-result');
    const resultText = document.getElementById('scan-result-text');

    if (user) {
        resultText.innerHTML = `
            <p><strong>Nombre:</strong> ${user.full_name}</p>
            <p><strong>Documento:</strong> ${user.document_number}</p>
            <p><strong>Rol:</strong> ${getRoleLabel(user.role)}</p>
            <p><strong>Estado:</strong> ${user.is_active ? 'Activo' : 'Inactivo'}</p>
        `;
        resultDiv.style.display = 'block';

        // Configurar botones de confirmación
        document.getElementById('confirm-entry').onclick = () => {
            registerAccessForUser(user, 'entry');
        };

        document.getElementById('confirm-exit').onclick = () => {
            registerAccessForUser(user, 'exit');
        };
    } else {
        resultText.textContent = 'Usuario no encontrado o código inválido.';
        resultDiv.style.display = 'block';
    }
}

// Funciones de reinicio de vistas
function resetRegisterForm() {
    document.getElementById('register-form').reset();
    document.querySelector('#register-view h2').textContent = 'Registro de Usuarios';
    document.getElementById('register-form').onsubmit = (e) => {
        e.preventDefault();
        const newUserData = {
            fullName: document.getElementById('reg-fullname').value,
            document: document.getElementById('reg-document').value,
            program: document.getElementById('reg-program').value,
            ficha: document.getElementById('reg-ficha').value,
            role: document.getElementById('reg-role').value,
            email: '', // No hay campo de email en el formulario
            password: document.getElementById('reg-document').value // Usar documento como password temporal
        };

        createUser(newUserData)
            .then(() => {
                showMessage('register-message', 'Usuario registrado correctamente.', 'success');
                resetRegisterForm();
                showView('user-management-view');
            })
            .catch(error => {
                showMessage('register-message', 'Error al registrar el usuario. Verifique que el documento no esté duplicado.', 'error');
                console.error('Error creating user:', error);
            });
    };
}

function resetScanView() {
    document.getElementById('scan-result').style.display = 'none';
    document.getElementById('scan-result-text').innerHTML = '';
    document.getElementById('scan-error').textContent = '';
}

// Funciones auxiliares
function getRoleLabel(role) {
    const roles = {
        'admin': 'Administrador',
        'guard': 'Guarda de Seguridad',
        'instructor': 'Instructor',
        'apprentice': 'Aprendiz',
        'visitor': 'Visitante',
        'administrative': 'Personal Administrativo'
    };
    return roles[role] || role;
}

// Event Listeners Globales
function setupGlobalListeners() {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            login(username, password);
        });
    }

    // Register form (para nuevos usuarios, no edición)
    const registerForm = document.getElementById('register-form');
    if (registerForm && !registerForm.onsubmit) { // Solo si no tiene un onsubmit asignado (es decir, no estamos en modo edición)
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const newUserData = {
                fullName: document.getElementById('reg-fullname').value,
                document: document.getElementById('reg-document').value,
                program: document.getElementById('reg-program').value,
                ficha: document.getElementById('reg-ficha').value,
                role: document.getElementById('reg-role').value,
                email: '', // No hay campo de email en el formulario
                password: document.getElementById('reg-document').value // Usar documento como password temporal
            };

            createUser(newUserData)
                .then(() => {
                    showMessage('register-message', 'Usuario registrado correctamente.', 'success');
                    resetRegisterForm();
                    showView('user-management-view');
                })
                .catch(error => {
                    showMessage('register-message', 'Error al registrar el usuario. Verifique que el documento no esté duplicado.', 'error');
                    console.error('Error creating user:', error);
                });
        });
    }

    // Cancelar registro
    const cancelRegisterBtn = document.getElementById('cancel-register');
    if (cancelRegisterBtn) {
        cancelRegisterBtn.addEventListener('click', () => {
            resetRegisterForm();
            showView('user-management-view'); // Volver a gestión de usuarios
        });
    }

    // Cancelar escaneo
    const cancelScanBtn = document.getElementById('cancel-scan');
    if (cancelScanBtn) {
        cancelScanBtn.addEventListener('click', () => {
            resetScanView();
            // Reactivar el escaneo simulado si estaba activo
            startMockQRScanner();
        });
    }

    // Generar reporte
    const generateReportBtn = document.getElementById('generate-report');
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', generateDailyReport);
    }

    // Enviar QR por email (simulado)
    const sendQREmailBtn = document.getElementById('send-qr-email');
    if (sendQREmailBtn) {
        sendQREmailBtn.addEventListener('click', sendQRByEmail);
    }

    // Regenerar QR
    const regenerateQRBtn = document.getElementById('regenerate-qr');
    if (regenerateQRBtn) {
        regenerateQRBtn.addEventListener('click', regenerateQRCode);
    }

    // Búsqueda de usuarios
    const searchUsersBtn = document.getElementById('search-users');
    if (searchUsersBtn) {
        searchUsersBtn.addEventListener('click', loadUsersTable);
        const btn = document.getElementById('search-users');
        if (btn) {
            btn.addEventListener('click', () => {
                const searchTerm = document.getElementById('user-search').value.toLowerCase();
                const filteredUsers = appState.users.filter(user =>
                    user.full_name.toLowerCase().includes(searchTerm) ||
                    user.document_number.toLowerCase().includes(searchTerm) ||
                    (user.program && user.program.toLowerCase().includes(searchTerm)) ||
                    (user.ficha && user.ficha.toLowerCase().includes(searchTerm))
                );
                renderUsersTable(filteredUsers);
            });
        }
    }

    // Búsqueda para QR
    const searchQRBtn = document.getElementById('search-for-qr');
    if (searchQRBtn) {
        searchQRBtn.addEventListener('click', () => {
            const searchTerm = document.getElementById('qr-user-search').value.toLowerCase();
            const filteredUsers = appState.users.filter(user =>
                user.full_name.toLowerCase().includes(searchTerm) ||
                user.document_number.toLowerCase().includes(searchTerm)
            );
            displayQRSearchResults(filteredUsers);
        });
    }

    // Exportar reportes (simulado)
    const exportPDFBtn = document.getElementById('export-pdf');
    if (exportPDFBtn) {
        exportPDFBtn.addEventListener('click', () => {
            showMessage('report-message', 'Exportando a PDF... (simulado)', 'success');
            setTimeout(() => {
                showMessage('report-message', 'Reporte exportado a PDF correctamente.', 'success');
            }, 1500);
        });
    }

    const exportExcelBtn = document.getElementById('export-excel');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', () => {
            showMessage('report-message', 'Exportando a Excel... (simulado)', 'success');
            setTimeout(() => {
                showMessage('report-message', 'Reporte exportado a Excel correctamente.', 'success');
            }, 1500);
        });
    }
}

// Funciones de reportes (simplificadas)
function generateDailyReport() {
    const today = new Date().toISOString().split('T')[0];
    const todayLogs = appState.accessLogs.filter(log => log.timestamp.startsWith(today));

    let reportHTML = `
        <h3>Reporte de Accesos - ${today}</h3>
        <p>Total de registros: ${todayLogs.length}</p>
        <p>Entradas: ${todayLogs.filter(log => log.action === 'entry').length}</p>
        <p>Salidas: ${todayLogs.filter(log => log.action === 'exit').length}</p>
        <h4>Detalle de accesos:</h4>
        <table>
            <thead>
                <tr>
                    <th>Hora</th>
                    <th>Nombre</th>
                    <th>Documento</th>
                    <th>Tipo</th>
                    <th>Rol</th>
                </tr>
            </thead>
            <tbody>
    `;

    todayLogs.forEach(log => {
        const time = new Date(log.timestamp).toTimeString().slice(0, 5);
        reportHTML += `
            <tr>
                <td>${time}</td>
                <td>${log.user_name || 'Usuario desconocido'}</td>
                <td>${log.user_document || 'N/A'}</td>
                <td>${log.action === 'entry' ? 'Entrada' : 'Salida'}</td>
                <td>${getRoleLabel(log.user_role || 'unknown')}</td>
            </tr>
        `;
    });

    reportHTML += `
            </tbody>
            </table>
    `;

    document.getElementById('report-output').innerHTML = reportHTML;
}

// Simulación de envío de email
function sendQRByEmail() {
    const userId = appState.tempQRUserId;
    if (!userId) {
        showMessage('qr-message', 'Error: no se ha seleccionado un usuario.', 'error');
        return;
    }

    const user = getUserById(userId);
    if (!user) {
        showMessage('qr-message', 'Error: usuario no encontrado.', 'error');
        return;
    }

    // Simular envío de email
    showMessage('qr-message', `Enviando código QR a ${user.email || 'correo no disponible'}...`, 'success');
    setTimeout(() => {
        showMessage('qr-message', `Código QR enviado correctamente a ${user.email || 'correo no disponible'}.`, 'success');
    }, 1500);
}

// Regenerar código QR
function regenerateQRCode() {
    const userId = appState.tempQRUserId;
    if (!userId) {
        showMessage('qr-message', 'Error: no se ha seleccionado un usuario.', 'error');
        return;
    }

    const user = getUserById(userId);
    if (!user) {
        showMessage('qr-message', 'Error: usuario no encontrado.', 'error');
        return;
    }

    // Generar nuevo QR con el mismo formato
    const newQRData = `LOGSENA_${user.id}_${user.document_number}`;

    // Mostrar el nuevo QR
    const qrContainer = document.getElementById('qr-code-container');
    qrContainer.innerHTML = ''; // Limpiar

    QRCode.toCanvas(newQRData, {
        width: 200,
        height: 200
    }, function (error, canvas) {
        if (error) {
            console.error(error);
            showMessage('qr-message', 'Error al generar el código QR.', 'error');
        } else {
            qrContainer.appendChild(canvas);
            document.getElementById('qr-data-text').textContent = newQRData;
            showMessage('qr-message', 'Código QR regenerado correctamente.', 'success');
        }
    });
}

// Funciones auxiliares para renderizado
function renderUsersTable(usersArray) {
    const tbody = document.querySelector('#users-table tbody');
    tbody.innerHTML = '';

    usersArray.forEach(user => {
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td>${user.full_name}</td>
            <td>${user.document_number}</td>
            <td>${user.program || '-'}</td>
            <td>${user.ficha || '-'}</td>
            <td>${getRoleLabel(user.role)}</td>
            <td>${user.is_active ? 'Activo' : 'Inactivo'}</td>
            <td>
                <button class="action-btn edit-btn" data-id="${user.id}">Editar</button>
                <button class="action-btn delete-btn" data-id="${user.id}">${user.is_active ? 'Desactivar' : 'Activar'}</button>
                ${user.role !== 'admin' ?
                    `<button class="action-btn btn-secondary" data-id="${user.id}" id="qr-btn-${user.id}">Ver QR</button>` :
                    ''
                }
            </td>
        `;

        tbody.appendChild(tr);
    });

    // Reiniciar event listeners para los botones dinámicos
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            editUser(id);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            toggleUserStatus(id);
        });
    });

    document.querySelectorAll('[id^="qr-btn-"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            showUserQR(id);
        });
    });
}

function displayQRSearchResults(usersArray) {
    const container = document.getElementById('qr-user-info');
    if (usersArray.length === 0) {
        container.innerHTML = '<p>No se encontraron usuarios.</p>';
        document.getElementById('qr-code-container').innerHTML = '';
        document.getElementById('qr-data-text').textContent = '';
        return;
    }

    if (usersArray.length === 1) {
        // Mostrar directamente el usuario
        showUserQR(usersArray[0].id);
        return;
    }

    // Mostrar lista para seleccionar
    let html = '<p>Seleccione un usuario:</p><ul>';
    usersArray.forEach(user => {
        html += `<li data-id="${user.id}">${user.full_name} (${user.document_number})</li>`;
    });
    html += '</ul>';

    container.innerHTML = html;

    // Añadir event listeners a los elementos de la lista
    container.querySelectorAll('li').forEach(li => {
        li.addEventListener('click', () => {
            const id = li.dataset.id;
            showUserQR(id);
        });
    });
}

// Iniciar el escaneo QR cuando se muestra la vista de escaneo
document.addEventListener('viewChange', () => {
    if (document.getElementById('scan-view').classList.contains('active')) {
        setupQRScanner();
    }
});

// Función para cambiar de vista (sobrescribiendo la anterior para compatibilidad)
function showView(viewId) {
    // Ocultar todas las vistas
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });

    // Mostrar la vista solicitada
    const view = document.getElementById(viewId);
    if (view) {
        view.classList.add('active');
    }

    // Actualizar el menú de navegación
    updateNavMenu();

    // Disparar evento de cambio de vista
    window.dispatchEvent(new Event('viewChange'));

    // Si es una vista específica, inicializar sus componentes
    if (viewId === 'dashboard-view') {
        initDashboard();
    } else if (viewId === 'user-management-view') {
        loadUsersTable();
    } else if (viewId === 'register-view') {
        resetRegisterForm();
    } else if (viewId === 'scan-view') {
        // El escaneo se inicia cuando se muestra la vista
        setTimeout(setupQRScanner, 100); // Pequeño delay para asegurar que el DOM esté listo
    }
}

// Función para mostrar mensajes
function showMessage(elementId, text, type) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.textContent = text;
    element.className = type === 'error' ? 'error-message' :
                       type === 'success' ? 'success-message' : '';

    // Limpiar el mensaje después de 3 segundos
    setTimeout(() => {
        element.textContent = '';
    }, 3000);
}

// Inicializar la aplicación
// (Ya está siendo llamada por el event listener DOMContentLoaded al inicio)