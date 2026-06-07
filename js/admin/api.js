// ============================================
// API ФУНКЦИИ
// ============================================

// Timeout по умолчанию для API запросов (30 секунд)
const API_TIMEOUT = 30000;

// Создаёт AbortController с таймаутом
function createTimeoutController(timeout = API_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    return { controller, timeoutId };
}

async function apiRequest(endpoint, method = 'GET', data = null, timeout = API_TIMEOUT) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };

    if (adminState.token) {
        options.headers['Authorization'] = `Bearer ${adminState.token}`;
    }

    if (data) {
        options.body = JSON.stringify(data);
    }

    // Добавляем timeout через AbortController
    const { controller, timeoutId } = createTimeoutController(timeout);
    options.signal = controller.signal;

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        clearTimeout(timeoutId);

        // Проверяем HTTP статус
        if (!response.ok) {
            // Пробуем получить сообщение об ошибке из тела ответа
            try {
                const errorData = await response.json();
                return {
                    success: false,
                    error: errorData.error || errorData.message || `Ошибка сервера: ${response.status}`
                };
            } catch {
                return { success: false, error: `Ошибка сервера: ${response.status}` };
            }
        }

        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);

        // Разные сообщения для разных типов ошибок
        if (error.name === 'AbortError') {
            console.error('API Timeout:', endpoint);
            return { success: false, error: 'Превышено время ожидания ответа от сервера' };
        }

        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            console.error('API Network Error:', error);
            return { success: false, error: 'Нет соединения с сервером. Проверьте интернет-подключение' };
        }

        console.error('API Error:', error);
        return { success: false, error: 'Ошибка соединения с сервером' };
    }
}

// ============================================
// АВТОРИЗАЦИЯ
// ============================================

async function handleAdminLogin(username, password) {
    const result = await apiRequest('/auth/login', 'POST', { username, password });
    if (result.success) {
        adminState.token = result.token;
        adminState.user = result.user;
        localStorage.setItem('admin_token', result.token);
        localStorage.setItem('admin_user', JSON.stringify(result.user));
        return true;
    }
    return false;
}

async function handleAdminLogout() {
    await apiRequest('/auth/logout', 'POST');
    // Очищаем все данные состояния для безопасности
    adminState.token = null;
    adminState.user = null;
    adminState.disciplines = [];
    adminState.topics = [];
    adminState.tests = [];
    adminState.questions = [];
    adminState.results = [];
    adminState.users = [];
    adminState.allUsers = [];
    adminState.groups = [];
    adminState.folders = [];
    adminState.folderItems = [];
    adminState.currentDiscipline = null;
    adminState.currentTopic = null;
    adminState.currentGroup = null;
    adminState.loaded = { disciplines: false, results: false, groups: false, users: false };
    adminState.loading = { results: false, groups: false, users: false };
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    window.location.href = 'index.html';
}

async function checkAuth() {
    if (!adminState.token) return false;
    const result = await apiRequest('/auth/check');
    if (result.success) {
        adminState.user = result.user;
        return true;
    }
    adminState.token = null;
    adminState.user = null;
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    return false;
}

// Новая функция проверки авторизации с учётом режима техработ
async function checkAuthWithMaintenance() {
    if (!adminState.token) return { success: false, maintenance: false };

    const result = await apiRequest('/auth/check');
    if (!result.success) {
        adminState.token = null;
        adminState.user = null;
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        return { success: false, maintenance: false };
    }

    adminState.user = result.user;

    // Проверяем режим техработ для не-админов
    if (adminState.user.role !== 'admin') {
        try {
            const res = await fetch('api/maintenance');
            const data = await res.json();

            if (data.enabled) {
                showMaintenanceBlockingScreen(data.message);
                return { success: false, maintenance: true };
            }
        } catch (e) {
            // Если не удалось проверить - пропускаем
        }
    }

    return { success: true, maintenance: false };
}

// ============================================
// АВТОМАТИЧЕСКАЯ ПРОВЕРКА АВТОРИЗАЦИИ
// ============================================

let authCheckInterval = null;
const AUTH_CHECK_INTERVAL = 60000; // Проверка каждые 60 секунд

// Запуск периодической проверки авторизации
function startAuthChecker() {
    // Останавливаем предыдущий интервал если есть
    if (authCheckInterval) {
        clearInterval(authCheckInterval);
    }

    // Запускаем проверку каждые 60 секунд
    authCheckInterval = setInterval(async () => {
        if (!adminState.token) {
            // Нет токена - перенаправляем на вход
            stopAuthChecker();
            redirectToLogin('Сессия не найдена');
            return;
        }

        try {
            const result = await apiRequest('/auth/check');
            if (!result.success) {
                // Сессия истекла или невалидна
                stopAuthChecker();
                redirectToLogin('Сессия истекла. Пожалуйста, войдите снова.');
            }
        } catch (error) {
            console.error('Ошибка проверки авторизации:', error);
            // При ошибке сети не разлогиниваем, просто логируем
        }
    }, AUTH_CHECK_INTERVAL);

    console.log('Автопроверка авторизации запущена');
}

// Остановка проверки
function stopAuthChecker() {
    if (authCheckInterval) {
        clearInterval(authCheckInterval);
        authCheckInterval = null;
    }
}

// Перенаправление на страницу входа с сообщением
function redirectToLogin(message) {
    // Очищаем данные сессии
    adminState.token = null;
    adminState.user = null;
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');

    // Сохраняем сообщение для показа на странице входа
    if (message) {
        sessionStorage.setItem('auth_message', message);
    }

    // Перенаправляем на страницу входа
    window.location.href = 'index.html';
}

// Показать сообщение об истечении сессии (если есть)
function showAuthMessage() {
    const message = sessionStorage.getItem('auth_message');
    if (message) {
        sessionStorage.removeItem('auth_message');
        // Показываем уведомление после небольшой задержки (чтобы страница успела загрузиться)
        setTimeout(() => {
            showError(message);
        }, 500);
    }
}

// Показать блокирующий экран техработ
function showMaintenanceBlockingScreen(message) {
    // Удаляем экран загрузки если есть
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.classList.add('hidden');

    // Удаляем всё содержимое
    document.body.innerHTML = '';

    // Создаём блокирующий экран
    const blockingScreen = document.createElement('div');
    blockingScreen.id = 'maintenance-blocking-screen';
    blockingScreen.className = 'maintenance-blocking-screen';
    blockingScreen.innerHTML = `
        <div class="maintenance-blocking-content">
            <div class="maintenance-blocking-icon">🔧</div>
            <h1 class="maintenance-blocking-title">Технические работы</h1>
            <p class="maintenance-blocking-message">${escapeHtml(message || 'Ведутся технические работы. Пожалуйста, подождите.')}</p>
            <div class="maintenance-blocking-info">
                <p>Система временно недоступна для работы.</p>
                <p>Пожалуйста, попробуйте позже.</p>
            </div>
            <button class="btn btn-secondary maintenance-blocking-btn" onclick="goToMainPage()">
                На главную
            </button>
        </div>
    `;

    document.body.appendChild(blockingScreen);
}

// Переход на главную без зацикливания
function goToMainPage() {
    // Очищаем токен чтобы не было зацикливания
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    window.location.href = 'index.html';
}

// ============================================
// ЗАГРУЗКА ДАННЫХ
// ============================================

// Загрузка всех результатов с пагинацией
async function loadAllResults() {
    const allResults = [];
    let offset = 0;
    const limit = 1000;

    while (true) {
        const response = await apiRequest(`/results?limit=${limit}&offset=${offset}`);
        if (!response.success) break;

        allResults.push(...response.results);

        // Если загрузили меньше лимита - значит это последняя страница
        if (response.results.length < limit || allResults.length >= response.total) {
            break;
        }
        offset += limit;
    }

    return allResults;
}

// Сброс штрафа для всех тестов (только для админа, одноразовая миграция)
async function resetAllPenalties() {
    if (adminState.user?.role !== 'admin') return;

    // Проверяем, была ли уже выполнена миграция
    if (localStorage.getItem('penalties_reset_done')) return;

    const result = await apiRequest('/tests/reset-penalty', 'POST');
    if (result.success) {
        console.log('Миграция штрафов выполнена:', result.message);
        localStorage.setItem('penalties_reset_done', 'true');
    }
}

// Загрузка базовых данных (дисциплины, темы, тесты) - при входе
async function loadAllData() {
    // Базовые запросы для всех ролей
    const requests = [
        apiRequest('/disciplines'),
        apiRequest('/topics'),
        apiRequest('/tests'),
        apiRequest('/users') // Загружаем пользователей для отображения имён авторов
    ];

    const results = await Promise.all(requests);

    if (results[0].success) adminState.disciplines = results[0].disciplines;
    if (results[1].success) adminState.topics = results[1].topics;
    if (results[2].success) adminState.tests = results[2].tests;

    // Сохраняем всех пользователей для отображения авторов
    if (results[3]?.success) {
        adminState.allUsers = results[3].users;
        // Для админа также в users (для управления)
        if (adminState.user?.role === 'admin') {
            adminState.users = results[3].users;
            adminState.loaded.users = true;
        }
    }

    adminState.loaded.disciplines = true;

    // Одноразовая миграция штрафов (для админа)
    await resetAllPenalties();
}

// Ленивая загрузка результатов
async function loadResultsLazy() {
    if (adminState.loaded.results || adminState.loading.results) return;

    adminState.loading.results = true;
    const results = await loadAllResults();

    if (Array.isArray(results)) {
        adminState.results = results;
    }

    adminState.loaded.results = true;
    adminState.loading.results = false;
}

// Ленивая загрузка групп
async function loadGroupsLazy() {
    if (adminState.loaded.groups || adminState.loading.groups) return;

    adminState.loading.groups = true;
    const response = await apiRequest('/groups?full=true');

    if (response.success) {
        adminState.groups = response.groups;
    }

    adminState.loaded.groups = true;
    adminState.loading.groups = false;
}

// Принудительная перезагрузка групп (для обновления после изменений)
async function reloadGroups() {
    adminState.loading.groups = true;
    const response = await apiRequest('/groups?full=true');

    if (response.success) {
        adminState.groups = response.groups;
    }

    adminState.loaded.groups = true;
    adminState.loading.groups = false;
}

// Ленивая загрузка пользователей (только для админа)
async function loadUsersLazy() {
    if (adminState.user?.role !== 'admin') return;
    if (adminState.loaded.users || adminState.loading.users) return;

    adminState.loading.users = true;
    const response = await apiRequest('/users');

    if (response.success) {
        adminState.users = response.users;
    }

    adminState.loaded.users = true;
    adminState.loading.users = false;
}
