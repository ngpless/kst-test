// ============================================
// ТАБ: ПОЛЬЗОВАТЕЛИ
// ============================================

async function renderUsersTab() {
    const container = document.getElementById('tab-users');

    if (adminState.user?.role !== 'admin') {
        container.innerHTML = '<div class="empty-state"><p>Нет доступа</p></div>';
        return;
    }

    // Если данные ещё не загружены - показываем индикатор и загружаем
    if (!adminState.loaded.users) {
        container.innerHTML = `
            <div class="loading-tab">
                <div class="loading-spinner"></div>
                <p>Загрузка пользователей...</p>
            </div>
        `;
        await loadUsersLazy();
    }

    const searchQuery = adminState.usersSearchQuery || '';
    const roleFilter = adminState.usersRoleFilter || '';

    // Фильтруем пользователей
    let filteredUsers = adminState.users;

    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredUsers = filteredUsers.filter(u =>
            (u.name || '').toLowerCase().includes(query) ||
            (u.username || '').toLowerCase().includes(query)
        );
    }

    if (roleFilter) {
        filteredUsers = filteredUsers.filter(u => u.role === roleFilter);
    }

    // Статистика
    const stats = {
        total: adminState.users.length,
        admins: adminState.users.filter(u => u.role === 'admin').length,
        teachers: adminState.users.filter(u => u.role === 'teacher').length,
        eduDept: adminState.users.filter(u => u.role === 'education_dept').length
    };

    container.innerHTML = `
        <div class="users-page">
            <!-- Заголовок и статистика -->
            <div class="users-header">
                <div class="users-header-left">
                    <h1 class="users-title">Пользователи</h1>
                    <p class="users-subtitle">Управление учётными записями системы</p>
                </div>
                <button class="btn btn-primary btn-add-user" onclick="showUserForm()">
                    <span class="btn-icon">+</span>
                    <span>Добавить пользователя</span>
                </button>
            </div>

            <!-- Статистика -->
            <div class="users-stats-row">
                <div class="user-stat-card">
                    <div class="stat-icon total">👥</div>
                    <div class="stat-info">
                        <span class="stat-value">${stats.total}</span>
                        <span class="stat-label">Всего</span>
                    </div>
                </div>
                <div class="user-stat-card" onclick="setRoleFilter('admin')">
                    <div class="stat-icon admin">⚙️</div>
                    <div class="stat-info">
                        <span class="stat-value">${stats.admins}</span>
                        <span class="stat-label">Администраторы</span>
                    </div>
                </div>
                <div class="user-stat-card" onclick="setRoleFilter('teacher')">
                    <div class="stat-icon teacher">👨‍🏫</div>
                    <div class="stat-info">
                        <span class="stat-value">${stats.teachers}</span>
                        <span class="stat-label">Преподаватели</span>
                    </div>
                </div>
                <div class="user-stat-card" onclick="setRoleFilter('education_dept')">
                    <div class="stat-icon edu">📋</div>
                    <div class="stat-info">
                        <span class="stat-value">${stats.eduDept}</span>
                        <span class="stat-label">Учебный отдел</span>
                    </div>
                </div>
            </div>

            <!-- Поиск и фильтры -->
            <div class="users-toolbar">
                <div class="users-search-wrapper">
                    <span class="search-icon">🔍</span>
                    <input type="text" id="users-search" placeholder="Поиск по имени или логину..."
                           value="${escapeHtml(searchQuery)}" oninput="filterUsers()">
                </div>
                <div class="users-filters-row">
                    <button class="filter-chip ${!roleFilter ? 'active' : ''}" onclick="setRoleFilter('')">
                        Все
                    </button>
                    <button class="filter-chip ${roleFilter === 'admin' ? 'active' : ''}" onclick="setRoleFilter('admin')">
                        ⚙️ Администраторы
                    </button>
                    <button class="filter-chip ${roleFilter === 'teacher' ? 'active' : ''}" onclick="setRoleFilter('teacher')">
                        👨‍🏫 Преподаватели
                    </button>
                    <button class="filter-chip ${roleFilter === 'education_dept' ? 'active' : ''}" onclick="setRoleFilter('education_dept')">
                        📋 Учебный отдел
                    </button>
                </div>
                ${(searchQuery || roleFilter) ? `<div class="users-filter-info">Найдено: ${filteredUsers.length} из ${adminState.users.length}</div>` : ''}
            </div>

            <!-- Список пользователей -->
            <div class="users-grid" id="users-grid">
                ${filteredUsers.map(u => renderUserCard(u)).join('')}
            </div>
        </div>

        <div id="user-form-modal" class="modal hidden">
            <div class="modal-content modal-user-form">
                <div class="modal-header modal-header-icon">
                    <div class="modal-icon modal-icon-user">👤</div>
                    <div>
                        <h2>Добавление пользователя</h2>
                        <p class="modal-subtitle">Создайте учётную запись для преподавателя или администратора</p>
                    </div>
                    <button class="btn-close" onclick="hideUserForm()">&times;</button>
                </div>
                <form id="user-form">
                    <div class="form-section">
                        <div class="form-section-header">
                            <span class="form-section-number">1</span>
                            <div class="form-section-info">
                                <h3>Выберите роль</h3>
                                <p>Определяет уровень доступа к системе</p>
                            </div>
                        </div>
                        <div class="form-section-content">
                            <div class="role-cards">
                                <label class="role-card" data-role="teacher">
                                    <input type="radio" name="user-role" value="teacher" checked>
                                    <div class="role-card-content">
                                        <span class="role-icon">👨‍🏫</span>
                                        <span class="role-title">Преподаватель</span>
                                        <span class="role-desc">Создание тестов, просмотр своих результатов</span>
                                    </div>
                                </label>
                                <label class="role-card" data-role="education_dept">
                                    <input type="radio" name="user-role" value="education_dept">
                                    <div class="role-card-content">
                                        <span class="role-icon">📋</span>
                                        <span class="role-title">Учебный отдел</span>
                                        <span class="role-desc">Только просмотр всех данных</span>
                                    </div>
                                </label>
                                <label class="role-card" data-role="admin">
                                    <input type="radio" name="user-role" value="admin">
                                    <div class="role-card-content">
                                        <span class="role-icon">⚙️</span>
                                        <span class="role-title">Администратор</span>
                                        <span class="role-desc">Полный доступ ко всем функциям</span>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="form-section">
                        <div class="form-section-header">
                            <span class="form-section-number">2</span>
                            <div class="form-section-info">
                                <h3>Данные для входа</h3>
                                <p>Логин и пароль для авторизации</p>
                            </div>
                        </div>
                        <div class="form-section-content">
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Логин <span class="required">*</span></label>
                                    <input type="text" id="user-username" required placeholder="teacher1">
                                </div>
                                <div class="form-group">
                                    <label>Пароль <span class="required">*</span></label>
                                    <input type="password" id="user-password" required placeholder="Мин. 6 символов">
                                </div>
                            </div>
                            <div class="form-group">
                                <label>ФИО</label>
                                <input type="text" id="user-name" placeholder="Иванов Иван Иванович">
                                <small class="form-hint">Отображается в интерфейсе вместо логина</small>
                            </div>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="hideUserForm()">Отмена</button>
                        <button type="submit" class="btn btn-primary">Создать пользователя</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.getElementById('user-form').addEventListener('submit', saveUser);
}

// Рендер карточки пользователя
function renderUserCard(user) {
    const assignedGroups = (adminState.groups || []).filter(g =>
        (g.assignedTeachers || []).includes(user.username)
    );

    // Получаем дисциплины созданные этим пользователем
    const userDisciplines = (adminState.disciplines || []).filter(d =>
        String(d.createdBy) === String(user.id) ||
        String(d.ownerId) === String(user.id) ||
        d.authorId === user.username ||
        d.author === user.username
    );

    // Получаем дисциплины, назначенные этому преподавателю (где он в assignedTeachers)
    const assignedDisciplines = (adminState.disciplines || []).filter(d =>
        (d.assignedTeachers || []).includes(user.username) &&
        !userDisciplines.some(ud => ud.id === d.id) // Исключаем свои
    );

    // Получаем ID дисциплин пользователя
    const userDisciplineIds = userDisciplines.map(d => String(d.id));

    // Считаем темы для дисциплин пользователя (темы хранятся отдельно в adminState.topics)
    const userTopics = (adminState.topics || []).filter(t =>
        userDisciplineIds.includes(String(t.disciplineId))
    );

    // Считаем тесты для тем пользователя (тесты хранятся отдельно в adminState.tests)
    const userTopicIds = userTopics.map(t => String(t.id));
    const userTests = (adminState.tests || []).filter(t =>
        userTopicIds.includes(String(t.topicId))
    );

    const topicsCount = userTopics.length;
    const testsCount = userTests.length;

    const roleLabels = {
        admin: { label: 'Администратор', icon: '⚙️', class: 'admin' },
        teacher: { label: 'Преподаватель', icon: '👨‍🏫', class: 'teacher' },
        education_dept: { label: 'Учебный отдел', icon: '📋', class: 'edu' }
    };
    const role = roleLabels[user.role] || roleLabels.teacher;
    const isMainAdmin = String(user.id) === '1';

    // Аватар: фото или первая буква имени
    const avatarContent = user.avatarUrl
        ? `<img src="${user.avatarUrl}" alt="${escapeHtml(user.name || user.username)}" class="user-avatar-img">`
        : (user.name || user.username).charAt(0).toUpperCase();

    return `
        <div class="user-card-new ${adminState.expandedUserId === user.id ? 'expanded' : ''}" data-user-id="${user.id}">
            <div class="user-card-main" onclick="toggleUserCard('${user.id}')">
                <div class="user-avatar ${role.class} ${user.avatarUrl ? 'has-photo' : ''}">
                    ${avatarContent}
                </div>
                <div class="user-card-info">
                    <div class="user-name-row">
                        <span class="user-name">${escapeHtml(user.name || user.username)}</span>
                        <span class="user-role-badge ${role.class}">${role.icon} ${role.label}</span>
                    </div>
                    <div class="user-meta">
                        <span class="user-login">@${escapeHtml(user.username)}</span>
                        ${user.role === 'teacher' ? `
                            <span class="user-meta-divider">•</span>
                            <span class="user-meta-item">${userDisciplines.length} дисц.</span>
                            <span class="user-meta-divider">•</span>
                            <span class="user-meta-item">${testsCount} тестов</span>
                            ${assignedGroups.length > 0 ? `
                                <span class="user-meta-divider">•</span>
                                <span class="user-meta-item">${assignedGroups.length} групп</span>
                            ` : ''}
                        ` : ''}
                    </div>
                </div>
                <div class="user-card-toggle">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M6 9l6 6 6-6"/>
                    </svg>
                </div>
            </div>

            <div class="user-card-details">
                <div class="user-details-content">
                    ${user.role === 'teacher' ? `
                        <!-- Группы -->
                        <div class="user-detail-section">
                            <div class="detail-section-header">
                                <span class="detail-section-icon">👥</span>
                                <span class="detail-section-title">Назначенные группы</span>
                                <button class="btn-small btn-outline" onclick="event.stopPropagation(); showAssignGroupsToTeacherModal('${user.username}')">
                                    Изменить
                                </button>
                            </div>
                            <div class="detail-section-body">
                                ${assignedGroups.length > 0 ? `
                                    <div class="groups-tags">
                                        ${assignedGroups.map(g => `
                                            <span class="group-tag">${escapeHtml(g.name)}</span>
                                        `).join('')}
                                    </div>
                                ` : `
                                    <div class="empty-detail">Нет назначенных групп</div>
                                `}
                            </div>
                        </div>

                        <!-- Дисциплины -->
                        <div class="user-detail-section">
                            <div class="detail-section-header">
                                <span class="detail-section-icon">📚</span>
                                <span class="detail-section-title">Дисциплины</span>
                                <span class="detail-count">${userDisciplines.length}</span>
                            </div>
                            <div class="detail-section-body">
                                ${userDisciplines.length > 0 ? `
                                    <div class="disciplines-list-mini">
                                        ${userDisciplines.slice(0, 5).map(d => {
                                            // Темы для этой дисциплины (из adminState.topics)
                                            const dTopics = (adminState.topics || []).filter(t =>
                                                String(t.disciplineId) === String(d.id)
                                            );
                                            const dTopicIds = dTopics.map(t => String(t.id));
                                            // Тесты для тем этой дисциплины (из adminState.tests)
                                            const dTests = (adminState.tests || []).filter(t =>
                                                dTopicIds.includes(String(t.topicId))
                                            );
                                            return `
                                                <div class="discipline-item-mini">
                                                    <span class="discipline-name-mini">${escapeHtml(d.name)}</span>
                                                    <span class="discipline-stats-mini">${dTopics.length} тем, ${dTests.length} тестов</span>
                                                </div>
                                            `;
                                        }).join('')}
                                        ${userDisciplines.length > 5 ? `
                                            <div class="more-items">и ещё ${userDisciplines.length - 5}...</div>
                                        ` : ''}
                                    </div>
                                ` : `
                                    <div class="empty-detail">Нет созданных дисциплин</div>
                                `}
                            </div>
                        </div>

                        <!-- Назначенные дисциплины (от других преподавателей) -->
                        ${assignedDisciplines.length > 0 ? `
                        <div class="user-detail-section">
                            <div class="detail-section-header">
                                <span class="detail-section-icon">📌</span>
                                <span class="detail-section-title">Назначенные дисциплины</span>
                                <span class="detail-count assigned-count">${assignedDisciplines.length}</span>
                            </div>
                            <div class="detail-section-body">
                                <div class="disciplines-list-mini">
                                    ${assignedDisciplines.map(d => {
                                        const ownerName = d.ownerName || 'Неизвестно';
                                        return `
                                            <div class="discipline-item-mini assigned">
                                                <span class="discipline-name-mini">${escapeHtml(d.name)}</span>
                                                <span class="discipline-stats-mini">от ${escapeHtml(ownerName)}</span>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    ` : ''}

                    <!-- Действия -->
                    <div class="user-card-actions">
                        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); showEditUserModal('${user.id}')">
                            ✏️ Редактировать
                        </button>
                        ${!isMainAdmin ? `
                            <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteUser('${user.id}')">
                                🗑️ Удалить
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Раскрытие/закрытие карточки
function toggleUserCard(userId) {
    if (adminState.expandedUserId === userId) {
        adminState.expandedUserId = null;
    } else {
        adminState.expandedUserId = userId;
    }

    // Обновляем только карточки без перерисовки всего
    document.querySelectorAll('.user-card-new').forEach(card => {
        if (card.dataset.userId === String(userId)) {
            card.classList.toggle('expanded');
        } else {
            card.classList.remove('expanded');
        }
    });
}

// Установка фильтра по роли
function setRoleFilter(role) {
    adminState.usersRoleFilter = role;
    renderUsersTab();
}

// Фильтрация пользователей с debounce
function filterUsers() {
    const searchEl = document.getElementById('users-search');
    adminState.usersSearchQuery = searchEl ? searchEl.value : '';

    clearTimeout(usersFilterTimeout);
    usersFilterTimeout = setTimeout(() => {
        updateUsersGrid();
    }, 150);
}

// Обновить только сетку пользователей
function updateUsersGrid() {
    const searchQuery = adminState.usersSearchQuery || '';
    const roleFilter = adminState.usersRoleFilter || '';

    let filteredUsers = adminState.users;

    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredUsers = filteredUsers.filter(u =>
            (u.name || '').toLowerCase().includes(query) ||
            (u.username || '').toLowerCase().includes(query)
        );
    }

    if (roleFilter) {
        filteredUsers = filteredUsers.filter(u => u.role === roleFilter);
    }

    // Обновляем счётчик
    const filterInfo = document.querySelector('.users-filter-info');
    if (searchQuery || roleFilter) {
        if (filterInfo) {
            filterInfo.textContent = `Найдено: ${filteredUsers.length} из ${adminState.users.length}`;
        }
    }

    // Обновляем сетку
    const grid = document.getElementById('users-grid');
    if (grid) {
        grid.innerHTML = filteredUsers.map(u => renderUserCard(u)).join('');
    }
}

function showUserForm() {
    showModal('user-form-modal');
}

function hideUserForm() {
    hideModal('user-form-modal');
    document.getElementById('user-form').reset();
}

async function saveUser(e) {
    e.preventDefault();
    const selectedRole = document.querySelector('input[name="user-role"]:checked');
    const data = {
        username: document.getElementById('user-username').value.trim(),
        password: document.getElementById('user-password').value,
        name: document.getElementById('user-name').value.trim(),
        role: selectedRole ? selectedRole.value : 'teacher'
    };

    // Валидация на фронтенде
    if (!data.username || data.username.length < 3) {
        await showError('Логин должен содержать минимум 3 символа');
        return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(data.username)) {
        await showError('Логин может содержать только латинские буквы, цифры и подчёркивание');
        return;
    }
    if (!data.password || data.password.length < 4) {
        await showError('Пароль должен содержать минимум 4 символа');
        return;
    }
    if (!data.name || data.name.length < 2) {
        await showError('ФИО должно содержать минимум 2 символа');
        return;
    }

    const result = await apiRequest('/users', 'POST', data);
    if (result.success) {
        await loadAllData();
        hideUserForm();
        renderUsersTab();
    } else {
        await showError(result.error || 'Ошибка создания');
    }
}

async function deleteUser(id) {
    if (await showConfirm('Удалить этого пользователя?', 'Удаление пользователя')) {
        await apiRequest(`/users/${id}`, 'DELETE');
        await loadAllData();
        renderUsersTab();
    }
}

// Модальное окно редактирования пользователя
function showEditUserModal(userId) {
    const user = adminState.users.find(u => String(u.id) === String(userId));
    if (!user) return;

    const isMainAdmin = String(userId) === '1';
    const roleLabels = {
        admin: { class: 'admin' },
        teacher: { class: 'teacher' },
        education_dept: { class: 'edu' }
    };
    const roleClass = roleLabels[user.role]?.class || 'teacher';

    const overlay = document.createElement('div');
    overlay.className = 'system-modal-overlay';
    overlay.id = 'edit-user-modal-overlay';
    overlay.innerHTML = `
        <div class="system-modal edit-user-modal-new">
            <div class="system-modal-header">
                <span class="system-modal-icon info">✏️</span>
                <h3 class="system-modal-title">Редактировать пользователя</h3>
            </div>
            <div class="system-modal-body" style="text-align: left;">
                <div class="edit-user-layout-new">
                    <!-- Аватар слева -->
                    <div class="edit-user-avatar-section">
                        <div class="edit-avatar-preview ${roleClass}" id="edit-avatar-preview" data-user-id="${userId}">
                            ${user.avatarUrl
                                ? `<img src="${user.avatarUrl}" alt="Фото">`
                                : `<span class="avatar-letter">${(user.name || user.username).charAt(0).toUpperCase()}</span>`
                            }
                        </div>
                        <button type="button" class="edit-avatar-upload-btn" onclick="openUserAvatarModal('${userId}')">
                            📷 Загрузить фото
                        </button>
                        ${user.avatarUrl ? `<button type="button" class="edit-avatar-remove-btn" onclick="removeUserAvatarFromEdit('${userId}')">Удалить фото</button>` : ''}
                    </div>

                    <!-- Данные справа -->
                    <div class="edit-user-data-section">
                        <div class="form-group compact">
                            <label class="field-label">ФИО</label>
                            <input type="text" id="edit-user-name" value="${escapeHtml(user.name || '')}" class="form-control" placeholder="Иванов Иван Иванович">
                        </div>
                        <div class="form-group compact">
                            <label class="field-label">Логин</label>
                            <input type="text" id="edit-user-username" value="${escapeHtml(user.username)}" class="form-control" ${isMainAdmin ? 'disabled' : ''}>
                        </div>
                        <div class="form-group compact">
                            <label class="field-label">Новый пароль</label>
                            <input type="password" id="edit-user-password" class="form-control" placeholder="Оставьте пустым чтобы не менять">
                        </div>
                        <div class="form-group compact">
                            <label class="field-label">Роль</label>
                            <div class="role-selector-compact" ${isMainAdmin ? 'style="opacity: 0.6; pointer-events: none;"' : ''}>
                                <label class="role-chip-compact ${user.role === 'teacher' ? 'active' : ''}">
                                    <input type="radio" name="edit-user-role" value="teacher" ${user.role === 'teacher' ? 'checked' : ''}>
                                    <span>👨‍🏫 Преподаватель</span>
                                </label>
                                <label class="role-chip-compact ${user.role === 'education_dept' ? 'active' : ''}">
                                    <input type="radio" name="edit-user-role" value="education_dept" ${user.role === 'education_dept' ? 'checked' : ''}>
                                    <span>📋 Уч. отдел</span>
                                </label>
                                <label class="role-chip-compact ${user.role === 'admin' ? 'active' : ''}">
                                    <input type="radio" name="edit-user-role" value="admin" ${user.role === 'admin' ? 'checked' : ''}>
                                    <span>⚙️ Админ</span>
                                </label>
                            </div>
                            ${isMainAdmin ? '<small class="hint-text">Роль главного админа нельзя изменить</small>' : ''}
                        </div>
                    </div>
                </div>
            </div>
            <div class="system-modal-footer">
                <button class="btn btn-secondary" onclick="closeEditUserModal()">Отмена</button>
                <button class="btn btn-primary" onclick="updateUser('${userId}')">Сохранить</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Обработчик выбора роли
    overlay.querySelectorAll('input[name="edit-user-role"]').forEach(radio => {
        radio.addEventListener('change', () => {
            overlay.querySelectorAll('.role-chip-compact').forEach(chip => chip.classList.remove('active'));
            radio.closest('.role-chip-compact').classList.add('active');
        });
    });
}

// Состояние для редактирования аватарки пользователя
let editingUserAvatarId = null;
let userAvatarImageData = null;
let userAvatarStream = null;
let userAvatarEditorState = {
    image: null,
    scale: 1,
    minScale: 0.5,
    maxScale: 3,
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0
};

// Открыть модальное окно аватарки для пользователя (как в ЛК)
function openUserAvatarModal(userId) {
    editingUserAvatarId = userId;
    userAvatarImageData = null;
    userAvatarEditorState = {
        image: null, scale: 1, minScale: 0.5, maxScale: 3,
        offsetX: 0, offsetY: 0, isDragging: false, dragStartX: 0, dragStartY: 0
    };

    const overlay = document.createElement('div');
    overlay.className = 'system-modal-overlay';
    overlay.id = 'user-avatar-modal-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) closeUserAvatarModal(); };
    overlay.innerHTML = `
        <div class="system-modal photo-modal-modern" style="max-width: 480px;">
            <div class="system-modal-header" style="flex-direction: row; padding: 20px 24px;">
                <span class="system-modal-icon info" style="width: 48px; height: 48px; font-size: 1.3rem;">🖼️</span>
                <div style="flex: 1; text-align: left; margin-left: 16px;">
                    <h3 class="system-modal-title" style="margin: 0;">Изменить аватарку</h3>
                    <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: var(--text-light);">Загрузите фото или сделайте снимок</p>
                </div>
                <button class="btn-close" onclick="closeUserAvatarModal()" style="position: relative; right: auto; top: auto; transform: none;">&times;</button>
            </div>
            <div class="system-modal-body" style="padding: 0 24px 24px;">
                <div class="photo-actions-modern photo-upload-options" id="user-avatar-upload-options" style="margin-bottom: 20px;">
                    <label class="photo-action-btn">
                        <span class="photo-action-icon">📁</span>
                        <span class="photo-action-text">Загрузить файл</span>
                        <input type="file" id="user-avatar-file-input" accept=".jpg,.jpeg,.png,.gif,.webp" class="hidden" onchange="handleUserAvatarFile(event)">
                    </label>
                    <button class="photo-action-btn" type="button" onclick="startUserAvatarWebcam()">
                        <span class="photo-action-icon">📸</span>
                        <span class="photo-action-text">Камера</span>
                    </button>
                </div>

                <div id="user-avatar-webcam-container" class="hidden">
                    <video id="user-avatar-webcam-video" autoplay playsinline style="width: 100%; max-height: 300px; border-radius: 12px; border: 2px solid var(--border);"></video>
                    <div class="webcam-controls" style="margin-top: 12px; display: flex; gap: 10px; justify-content: center;">
                        <button class="btn btn-primary" type="button" onclick="captureUserAvatarPhoto()">📸 Снять</button>
                        <button class="btn btn-secondary" type="button" onclick="stopUserAvatarWebcam()">Отмена</button>
                    </div>
                </div>

                <div id="user-avatar-editor-container" class="hidden">
                    <div class="avatar-crop-area" id="user-avatar-crop-area">
                        <canvas id="user-avatar-editor-canvas" width="280" height="280"></canvas>
                        <div class="avatar-crop-circle"></div>
                    </div>
                    <div class="avatar-zoom-controls">
                        <span class="zoom-icon">🔍−</span>
                        <input type="range" id="user-avatar-zoom-slider" min="50" max="300" value="100" oninput="updateUserAvatarZoom(this.value)">
                        <span class="zoom-icon">🔍+</span>
                    </div>
                    <p class="avatar-hint">Перетащите изображение для позиционирования</p>
                </div>
            </div>
            <div class="system-modal-footer hidden" id="user-avatar-modal-footer" style="padding: 16px 24px; border-top: 1px solid var(--border);">
                <button class="btn btn-secondary" type="button" onclick="resetUserAvatarModal()">Отмена</button>
                <button class="btn btn-primary" type="button" onclick="saveUserAvatarToPreview()">Сохранить</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function closeUserAvatarModal() {
    stopUserAvatarWebcam();
    const overlay = document.getElementById('user-avatar-modal-overlay');
    if (overlay) overlay.remove();
}

function handleUserAvatarFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            userAvatarEditorState.image = img;

            // Вычисляем начальный масштаб чтобы изображение заполнило круг
            const canvasSize = 280;
            const minDim = Math.min(img.width, img.height);
            userAvatarEditorState.scale = canvasSize / minDim;
            userAvatarEditorState.minScale = userAvatarEditorState.scale * 0.5;
            userAvatarEditorState.maxScale = userAvatarEditorState.scale * 3;
            userAvatarEditorState.offsetX = 0;
            userAvatarEditorState.offsetY = 0;

            // Обновляем слайдер
            const slider = document.getElementById('user-avatar-zoom-slider');
            if (slider) {
                slider.min = Math.round(userAvatarEditorState.minScale * 100);
                slider.max = Math.round(userAvatarEditorState.maxScale * 100);
                slider.value = Math.round(userAvatarEditorState.scale * 100);
            }

            // Показываем редактор
            const editorContainer = document.getElementById('user-avatar-editor-container');
            const modalFooter = document.getElementById('user-avatar-modal-footer');
            const uploadOptions = document.getElementById('user-avatar-upload-options');

            if (editorContainer) editorContainer.classList.remove('hidden');
            if (modalFooter) modalFooter.classList.remove('hidden');
            if (uploadOptions) uploadOptions.classList.add('hidden');

            // Инициализируем canvas
            initUserAvatarEditor();
            renderUserAvatarCanvas();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Инициализация редактора (drag события)
function initUserAvatarEditor() {
    const canvas = document.getElementById('user-avatar-editor-canvas');
    if (!canvas) return;

    // Mouse events
    canvas.onmousedown = (e) => {
        userAvatarEditorState.isDragging = true;
        userAvatarEditorState.dragStartX = e.clientX - userAvatarEditorState.offsetX;
        userAvatarEditorState.dragStartY = e.clientY - userAvatarEditorState.offsetY;
        canvas.style.cursor = 'grabbing';
    };

    canvas.onmousemove = (e) => {
        if (!userAvatarEditorState.isDragging) return;
        userAvatarEditorState.offsetX = e.clientX - userAvatarEditorState.dragStartX;
        userAvatarEditorState.offsetY = e.clientY - userAvatarEditorState.dragStartY;
        renderUserAvatarCanvas();
    };

    canvas.onmouseup = () => {
        userAvatarEditorState.isDragging = false;
        canvas.style.cursor = 'grab';
    };

    canvas.onmouseleave = () => {
        userAvatarEditorState.isDragging = false;
        canvas.style.cursor = 'grab';
    };

    // Touch events
    canvas.ontouchstart = (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        userAvatarEditorState.isDragging = true;
        userAvatarEditorState.dragStartX = touch.clientX - userAvatarEditorState.offsetX;
        userAvatarEditorState.dragStartY = touch.clientY - userAvatarEditorState.offsetY;
    };

    canvas.ontouchmove = (e) => {
        e.preventDefault();
        if (!userAvatarEditorState.isDragging) return;
        const touch = e.touches[0];
        userAvatarEditorState.offsetX = touch.clientX - userAvatarEditorState.dragStartX;
        userAvatarEditorState.offsetY = touch.clientY - userAvatarEditorState.dragStartY;
        renderUserAvatarCanvas();
    };

    canvas.ontouchend = () => {
        userAvatarEditorState.isDragging = false;
    };

    canvas.style.cursor = 'grab';
}

// Отрисовка canvas
function renderUserAvatarCanvas() {
    const canvas = document.getElementById('user-avatar-editor-canvas');
    const ctx = canvas.getContext('2d');
    const img = userAvatarEditorState.image;

    if (!canvas || !ctx || !img) return;

    const canvasSize = 280;

    // Очищаем
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    // Рисуем изображение с учётом масштаба и смещения
    const scale = userAvatarEditorState.scale;
    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;
    const drawX = (canvasSize - drawWidth) / 2 + userAvatarEditorState.offsetX;
    const drawY = (canvasSize - drawHeight) / 2 + userAvatarEditorState.offsetY;

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
}

// Обновление зума
function updateUserAvatarZoom(value) {
    userAvatarEditorState.scale = value / 100;
    renderUserAvatarCanvas();
}

// Генерация финального изображения
function generateUserAvatarFromEditor() {
    const img = userAvatarEditorState.image;
    if (!img) return null;

    const outputSize = 200;
    const canvasSize = 280;

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = outputSize;
    outputCanvas.height = outputSize;
    const ctx = outputCanvas.getContext('2d');

    const scale = userAvatarEditorState.scale;
    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;
    const drawX = (canvasSize - drawWidth) / 2 + userAvatarEditorState.offsetX;
    const drawY = (canvasSize - drawHeight) / 2 + userAvatarEditorState.offsetY;

    const ratio = outputSize / canvasSize;
    ctx.drawImage(img, drawX * ratio, drawY * ratio, drawWidth * ratio, drawHeight * ratio);

    return outputCanvas.toDataURL('image/jpeg', 0.85);
}

function startUserAvatarWebcam() {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        .then(stream => {
            userAvatarStream = stream;
            const video = document.getElementById('user-avatar-webcam-video');
            video.srcObject = stream;

            const webcamContainer = document.getElementById('user-avatar-webcam-container');
            const uploadOptions = document.getElementById('user-avatar-upload-options');

            if (webcamContainer) webcamContainer.classList.remove('hidden');
            if (uploadOptions) uploadOptions.classList.add('hidden');
        })
        .catch(err => {
            showError('Не удалось получить доступ к камере');
            console.error(err);
        });
}

function stopUserAvatarWebcam() {
    if (userAvatarStream) {
        userAvatarStream.getTracks().forEach(track => track.stop());
        userAvatarStream = null;
    }

    const webcamContainer = document.getElementById('user-avatar-webcam-container');
    const uploadOptions = document.getElementById('user-avatar-upload-options');

    if (webcamContainer) webcamContainer.classList.add('hidden');
    if (uploadOptions) uploadOptions.classList.remove('hidden');
}

function captureUserAvatarPhoto() {
    const video = document.getElementById('user-avatar-webcam-video');

    // Создаём временное изображение из видео
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(video, 0, 0);

    const img = new Image();
    img.onload = () => {
        userAvatarEditorState.image = img;

        const canvasSize = 280;
        const minDim = Math.min(img.width, img.height);
        userAvatarEditorState.scale = canvasSize / minDim;
        userAvatarEditorState.minScale = userAvatarEditorState.scale * 0.5;
        userAvatarEditorState.maxScale = userAvatarEditorState.scale * 3;
        userAvatarEditorState.offsetX = 0;
        userAvatarEditorState.offsetY = 0;

        const slider = document.getElementById('user-avatar-zoom-slider');
        if (slider) {
            slider.min = Math.round(userAvatarEditorState.minScale * 100);
            slider.max = Math.round(userAvatarEditorState.maxScale * 100);
            slider.value = Math.round(userAvatarEditorState.scale * 100);
        }

        stopUserAvatarWebcam();

        const editorContainer = document.getElementById('user-avatar-editor-container');
        const modalFooter = document.getElementById('user-avatar-modal-footer');

        if (editorContainer) editorContainer.classList.remove('hidden');
        if (modalFooter) modalFooter.classList.remove('hidden');

        initUserAvatarEditor();
        renderUserAvatarCanvas();
    };
    img.src = tempCanvas.toDataURL('image/jpeg', 0.9);
}

function resetUserAvatarModal() {
    userAvatarImageData = null;
    userAvatarEditorState.image = null;
    stopUserAvatarWebcam();

    const editorContainer = document.getElementById('user-avatar-editor-container');
    const modalFooter = document.getElementById('user-avatar-modal-footer');
    const uploadOptions = document.getElementById('user-avatar-upload-options');

    if (editorContainer) editorContainer.classList.add('hidden');
    if (modalFooter) modalFooter.classList.add('hidden');
    if (uploadOptions) uploadOptions.classList.remove('hidden');
}

// Сохранить аватарку в превью формы редактирования
function saveUserAvatarToPreview() {
    if (!userAvatarEditorState.image) {
        showError('Нет изображения');
        return;
    }

    userAvatarImageData = generateUserAvatarFromEditor();

    // Обновляем превью в форме редактирования пользователя
    const preview = document.getElementById('edit-avatar-preview');
    if (preview) {
        preview.innerHTML = `<img src="${userAvatarImageData}" alt="Фото">`;
        preview.dataset.newAvatarUrl = userAvatarImageData;
    }

    closeUserAvatarModal();
}

// Удалить аватарку из формы редактирования
function removeUserAvatarFromEdit(userId) {
    const user = adminState.users.find(u => String(u.id) === String(userId));
    const letter = user ? (user.name || user.username).charAt(0).toUpperCase() : '?';

    const preview = document.getElementById('edit-avatar-preview');
    if (preview) {
        preview.innerHTML = `<span class="avatar-letter">${letter}</span>`;
        preview.dataset.newAvatarUrl = '';
        preview.dataset.removeAvatar = 'true';
    }
}

function closeEditUserModal() {
    const overlay = document.getElementById('edit-user-modal-overlay');
    if (overlay) overlay.remove();
}

// Обновление пользователя
async function updateUser(userId) {
    const isMainAdmin = String(userId) === '1';

    const updates = {};

    // Собираем данные
    if (!isMainAdmin) {
        const selectedRole = document.querySelector('input[name="edit-user-role"]:checked');
        if (selectedRole) {
            updates.role = selectedRole.value;
        }

        const username = document.getElementById('edit-user-username').value.trim();
        if (username) {
            updates.username = username;
        }
    }

    const name = document.getElementById('edit-user-name').value.trim();
    updates.name = name;

    const password = document.getElementById('edit-user-password').value;
    if (password) {
        if (password.length < 6) {
            showError('Пароль должен быть минимум 6 символов');
            return;
        }
        updates.password = password;
    }

    // Обрабатываем аватарку
    const preview = document.getElementById('edit-avatar-preview');
    if (preview) {
        if (preview.dataset.newAvatarUrl) {
            updates.avatarUrl = preview.dataset.newAvatarUrl;
        } else if (preview.dataset.removeAvatar === 'true') {
            updates.avatarUrl = null;
        }
    }

    const result = await apiRequest(`/users/${userId}`, 'PUT', updates);

    if (result.success) {
        closeEditUserModal();
        await loadAllData();
        renderUsersTab();
        showSuccess('Пользователь обновлён');
    } else {
        showError(result.error || 'Ошибка обновления');
    }
}

// Модальное окно назначения групп преподавателю
async function showAssignGroupsToTeacherModal(username) {
    const user = adminState.users.find(u => u.username === username);
    if (!user) return;

    const groups = adminState.groups || [];

    // Определяем какие группы уже назначены этому преподавателю
    const assignedGroupIds = groups
        .filter(g => (g.assignedTeachers || []).includes(username))
        .map(g => g.id);

    const overlay = document.createElement('div');
    overlay.className = 'system-modal-overlay';
    overlay.innerHTML = `
        <div class="system-modal" style="max-width: 500px;">
            <div class="system-modal-header">
                <span class="system-modal-icon info">📁</span>
                <h3 class="system-modal-title">Назначить группы</h3>
            </div>
            <div class="system-modal-body" style="text-align: left;">
                <p style="margin-bottom: 15px;">Преподаватель: <strong>${escapeHtml(user.name || user.username)}</strong></p>
                ${groups.length === 0 ? `
                    <div class="empty-state">
                        <p>Нет созданных групп</p>
                    </div>
                ` : `
                    <div class="teachers-checkbox-list">
                        ${groups.map(g => `
                            <label class="checkbox-item">
                                <input type="checkbox" value="${g.id}"
                                    ${assignedGroupIds.includes(g.id) ? 'checked' : ''}>
                                <span>${escapeHtml(g.name)} <small style="color: #9ca3af;">(${g.studentsCount || 0} студ.)</small></span>
                            </label>
                        `).join('')}
                    </div>
                `}
            </div>
            <div class="system-modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.system-modal-overlay').remove()">Отмена</button>
                <button class="btn btn-primary" onclick="saveGroupsToTeacher('${username}')">Сохранить</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

// Сохранение групп для преподавателя
async function saveGroupsToTeacher(username) {
    const checkboxes = document.querySelectorAll('.teachers-checkbox-list input[type="checkbox"]');
    const selectedGroupIds = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);

    // Обновляем каждую группу
    for (const group of adminState.groups) {
        const currentTeachers = group.assignedTeachers || [];
        const isSelected = selectedGroupIds.includes(String(group.id));
        const isCurrentlyAssigned = currentTeachers.includes(username);

        if (isSelected && !isCurrentlyAssigned) {
            // Добавляем преподавателя к группе
            await apiRequest(`/groups/${group.id}`, 'PUT', {
                assignedTeachers: [...currentTeachers, username]
            });
        } else if (!isSelected && isCurrentlyAssigned) {
            // Убираем преподавателя из группы
            await apiRequest(`/groups/${group.id}`, 'PUT', {
                assignedTeachers: currentTeachers.filter(t => t !== username)
            });
        }
    }

    document.querySelector('.system-modal-overlay')?.remove();
    await loadAllData();
    renderUsersTab();
    showSuccess('Группы назначены');
}

// formatDateTime и getAuthorName определены в utils.js

// ============================================
