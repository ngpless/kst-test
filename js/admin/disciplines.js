// Функция переключения вкладки
function switchTab(tabName) {
    const tab = document.querySelector(`.admin-tab[data-tab="${tabName}"]`);
    if (tab) tab.click();
}

// ============================================
// СОРТИРОВКА ДИСЦИПЛИН
// ============================================

let disciplinesSortBy = 'name'; // 'name', 'topics', 'tests', 'groups'
let disciplinesSortOrder = 'asc'; // 'asc', 'desc'

// Сортировка дисциплин
function sortDisciplines(disciplines) {
    return [...disciplines].sort((a, b) => {
        let cmp = 0;

        if (disciplinesSortBy === 'topics') {
            const topicsA = (adminState.topics || []).filter(t => t.disciplineId === a.id).length;
            const topicsB = (adminState.topics || []).filter(t => t.disciplineId === b.id).length;
            cmp = topicsA - topicsB;
        } else if (disciplinesSortBy === 'tests') {
            const testsA = (adminState.tests || []).filter(t => {
                const topic = (adminState.topics || []).find(top => top.id === t.topicId);
                return topic && topic.disciplineId === a.id;
            }).length;
            const testsB = (adminState.tests || []).filter(t => {
                const topic = (adminState.topics || []).find(top => top.id === t.topicId);
                return topic && topic.disciplineId === b.id;
            }).length;
            cmp = testsA - testsB;
        } else if (disciplinesSortBy === 'groups') {
            const groupsA = (a.groups || []).length;
            const groupsB = (b.groups || []).length;
            cmp = groupsA - groupsB;
        } else {
            // По умолчанию - по имени
            cmp = (a.name || '').localeCompare(b.name || '', 'ru');
        }

        // Если значения равны - сортируем по имени
        if (cmp === 0 && disciplinesSortBy !== 'name') {
            cmp = (a.name || '').localeCompare(b.name || '', 'ru');
        }

        return disciplinesSortOrder === 'desc' ? -cmp : cmp;
    });
}

// Установка сортировки дисциплин
function setDisciplinesSort(sortBy) {
    if (disciplinesSortBy === sortBy) {
        disciplinesSortOrder = disciplinesSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        disciplinesSortBy = sortBy;
        disciplinesSortOrder = 'asc';
    }
    renderDisciplinesTab();
}

function createAdminPanel() {
    let adminScreen = document.getElementById('screen-admin');
    if (!adminScreen) {
        adminScreen = document.createElement('div');
        adminScreen.id = 'screen-admin';
        adminScreen.className = 'screen';
        document.body.appendChild(adminScreen);
    }

    adminScreen.innerHTML = `
        <div class="admin-container">
            <div class="admin-sticky-header">
                <div class="admin-header">
                    <div class="flex items-center gap-16">
                        <img src="logo.jpg" alt="Логотип" class="admin-header-logo">
                        <div class="flex-col justify-center">
                            <h1 class="admin-header-title" onclick="switchTab('disciplines')" title="Перейти к дисциплинам">Панель управления</h1>
                            <p class="admin-header-subtitle">Добро пожаловать, ${escapeHtml(adminState.user?.name || 'Преподаватель')}${adminState.user?.role === 'education_dept' ? ' (только просмотр)' : ''}</p>
                        </div>
                    </div>
                    <div class="admin-header-actions">
                        <div class="theme-toggle" onclick="toggleTheme()" title="Переключить тему">
                            <div class="theme-toggle-circle"></div>
                        </div>
                        <button class="btn-help" onclick="showHelpModal()" title="Справка и инструкции">?</button>
                        <button class="btn btn-secondary" onclick="handleAdminLogout()">Выйти</button>
                    </div>
                </div>

                <div class="admin-tabs">
                    <button class="admin-tab active" data-tab="disciplines">Дисциплины</button>
                    <button class="admin-tab" data-tab="results">Результаты</button>
                    <button class="admin-tab" data-tab="analytics">📊 Аналитика</button>
                    ${adminState.user?.role === 'admin' || adminState.user?.role === 'education_dept' ? '<button class="admin-tab" data-tab="srez-monitor">📊 Мониторинг</button>' : ''}
                    <button class="admin-tab" data-tab="groups">Группы</button>
                    ${adminState.user?.role === 'admin' ? '<button class="admin-tab" data-tab="users">Пользователи</button>' : ''}
                    <button class="admin-tab" data-tab="profile">Личный кабинет</button>
                </div>
            </div>

            <div class="admin-content">
                <div id="breadcrumb-container"></div>
                <div id="tab-disciplines" class="admin-tab-content active"></div>
                <div id="tab-results" class="admin-tab-content"></div>
                <div id="tab-analytics" class="admin-tab-content"></div>
                <div id="tab-srez-monitor" class="admin-tab-content"></div>
                <div id="tab-groups" class="admin-tab-content"></div>
                <div id="tab-users" class="admin-tab-content"></div>
                <div id="tab-profile" class="admin-tab-content"></div>
            </div>
        </div>
    `;

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    adminScreen.classList.add('active');

    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
            // Сбрасываем состояние навигации при смене вкладки
            adminState.currentDiscipline = null;
            adminState.currentTopic = null;
            adminState.currentGroup = null;
            currentTestForQuestions = null;
            // Очищаем breadcrumb при переключении вкладок
            clearBreadcrumb();
            loadTabContent(tab.dataset.tab);
            updateUrlState(tab.dataset.tab);
        });
    });

    // Восстанавливаем состояние из URL или загружаем по умолчанию
    restoreUrlState();

    // Проверяем первый визит для показа гида
    checkFirstVisit();

    // Слушаем изменения URL (кнопка назад/вперёд браузера)
    window.addEventListener('popstate', () => {
        restoreUrlState();
    });
}

// Сохранение состояния навигации в URL
function updateUrlState(tab, disciplineId = null, topicId = null) {
    const params = new URLSearchParams();
    params.set('tab', tab || 'disciplines');

    if (disciplineId) {
        params.set('d', disciplineId);
    }
    if (topicId) {
        params.set('t', topicId);
    }

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    history.pushState({ tab, disciplineId, topicId }, '', newUrl);
}

// Восстановление состояния из URL
function restoreUrlState() {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') || 'disciplines';
    const disciplineId = params.get('d');
    const topicId = params.get('t');

    // Активируем нужную вкладку
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));

    const tabBtn = document.querySelector(`.admin-tab[data-tab="${tab}"]`);
    if (tabBtn) {
        tabBtn.classList.add('active');
        document.getElementById(`tab-${tab}`)?.classList.add('active');
    }

    // Восстанавливаем состояние дисциплины/темы
    if (disciplineId) {
        adminState.currentDiscipline = adminState.disciplines.find(d => String(d.id) === String(disciplineId)) || null;
    } else {
        adminState.currentDiscipline = null;
    }

    if (topicId && adminState.currentDiscipline) {
        adminState.currentTopic = adminState.topics.find(t => String(t.id) === String(topicId)) || null;
    } else {
        adminState.currentTopic = null;
    }

    loadTabContent(tab);
}

function loadTabContent(tab) {
    // Останавливаем автообновление монитора при уходе с вкладки
    if (tab !== 'srez-monitor' && typeof stopMonitorAutoRefresh === 'function') {
        stopMonitorAutoRefresh();
    }

    switch (tab) {
        case 'disciplines': renderDisciplinesTab(); break;
        case 'results': renderResultsTab(); break;
        case 'analytics': renderAnalyticsTab(); break;
        case 'srez-monitor': renderSrezMonitorTab(); break;
        case 'groups': renderGroupsTab(); break;
        case 'users': renderUsersTab(); break;
        case 'profile': renderProfileTab(); break;
    }
}

// ============================================
// ТАБ: ДИСЦИПЛИНЫ (главный)
// ============================================

async function renderDisciplinesTab() {
    const container = document.getElementById('tab-disciplines');

    // Если выбрана тема - показываем тесты
    if (adminState.currentTopic) {
        renderTestsView(container);
        return;
    }

    // Если выбрана дисциплина - показываем темы
    if (adminState.currentDiscipline) {
        renderTopicsView(container);
        return;
    }

    // Загружаем группы если ещё не загружены (для отображения названий)
    if (!adminState.loaded.groups) {
        await loadGroupsLazy();
    }

    // Загружаем папки
    await loadFolders('disciplines');

    // Получаем папки для дисциплин (персональные)
    const disciplineFolders = (adminState.folders || []).filter(f => f.type === 'disciplines');
    const currentFolder = adminState.currentDisciplineFolder;

    // Фильтруем дисциплины по текущей папке (используем персональные привязки)
    let displayDisciplines = adminState.disciplines;
    if (currentFolder === '__none__') {
        // Показываем только дисциплины без папки (у текущего пользователя)
        displayDisciplines = adminState.disciplines.filter(d => !getFolderIdForItem(d.id, 'disciplines'));
    } else if (currentFolder) {
        // Конкретная папка - показываем только её содержимое
        displayDisciplines = adminState.disciplines.filter(d => getFolderIdForItem(d.id, 'disciplines') === currentFolder.id);
    }
    // Если currentFolder === null - показываем ВСЕ дисциплины (папка "Все")

    // Считаем дисциплины без папки (персональная привязка)
    const withoutFolderCount = adminState.disciplines.filter(d => !getFolderIdForItem(d.id, 'disciplines')).length;

    // Применяем сортировку
    displayDisciplines = sortDisciplines(displayDisciplines);

    // Иконки сортировки
    const discSortIcon = (field) => {
        if (disciplinesSortBy !== field) return '';
        return disciplinesSortOrder === 'asc' ? ' ↑' : ' ↓';
    };

    // Иначе показываем список дисциплин
    container.innerHTML = `
        <div class="admin-section">
            <div class="section-header">
                <h2>${isReadOnly() ? 'Все дисциплины' : 'Мои дисциплины'}</h2>
                <div class="section-header-actions">
                    ${canEdit() && adminState.disciplines.length > 0 ? `
                        <button class="btn btn-danger btn-delete-selected" id="btn-delete-selected-disciplines" onclick="deleteSelectedDisciplines()" style="display: none;">
                            Удалить выбранные (<span id="selected-disciplines-count">0</span>)
                        </button>
                    ` : ''}
                    ${canEdit() ? `
                        <button class="btn btn-secondary" onclick="showFolderForm('disciplines')">+ Папка</button>
                        <button class="btn btn-primary" onclick="showDisciplineForm()">+ Дисциплина</button>
                    ` : ''}
                </div>
            </div>

            ${disciplineFolders.length > 0 ? `
                <div class="folder-tabs">
                    <div class="folder-tab ${!currentFolder ? 'active' : ''}" onclick="closeDisciplineFolder()">
                        <span class="folder-tab-icon">📋</span>
                        <span class="folder-tab-name">Все</span>
                        <span class="folder-tab-count">${adminState.disciplines.length}</span>
                    </div>
                    ${disciplineFolders.map(f => {
                        const count = adminState.disciplines.filter(d => getFolderIdForItem(d.id, 'disciplines') === f.id).length;
                        return `
                        <div class="folder-tab ${currentFolder?.id === f.id ? 'active' : ''}"
                             onclick="openDisciplineFolder('${f.id}')"
                             style="--folder-color: ${f.color || '#667eea'}">
                            <span class="folder-tab-icon">📁</span>
                            <span class="folder-tab-name">${escapeHtml(f.name)}</span>
                            <span class="folder-tab-count">${count}</span>
                            ${canEdit() ? `
                            <div class="folder-tab-actions" onclick="event.stopPropagation()">
                                <button class="folder-tab-btn" onclick="editFolder('${f.id}')" title="Редактировать">✏️</button>
                                <button class="folder-tab-btn danger" onclick="deleteFolder('${f.id}')" title="Удалить">×</button>
                            </div>
                            ` : ''}
                        </div>
                    `}).join('')}
                    ${withoutFolderCount > 0 ? `
                    <div class="folder-tab ${currentFolder === '__none__' ? 'active' : ''}" onclick="openDisciplineFolder('__none__')">
                        <span class="folder-tab-icon">📄</span>
                        <span class="folder-tab-name">Без папки</span>
                        <span class="folder-tab-count">${withoutFolderCount}</span>
                    </div>
                    ` : ''}
                </div>
            ` : ''}

            ${displayDisciplines.length > 0 || adminState.disciplines.length > 0 ? `
            <div class="search-filters-bar">
                <div class="search-box">
                    <input type="text" id="disciplines-search"
                           placeholder="Поиск по названию дисциплины..."
                           oninput="filterDisciplinesDisplay()">
                </div>
                <div class="search-box">
                    <input type="text" id="disciplines-group-search"
                           placeholder="Поиск по группе..."
                           oninput="filterDisciplinesDisplay()">
                </div>
                <button class="btn btn-secondary btn-sm" onclick="clearDisciplinesSearch()">Сбросить</button>
            </div>

            <div class="sort-bar">
                <span class="sort-label">Сортировка:</span>
                <button class="sort-btn ${disciplinesSortBy === 'name' ? 'active' : ''}" onclick="setDisciplinesSort('name')">
                    По названию${discSortIcon('name')}
                </button>
                <button class="sort-btn ${disciplinesSortBy === 'topics' ? 'active' : ''}" onclick="setDisciplinesSort('topics')">
                    По темам${discSortIcon('topics')}
                </button>
                <button class="sort-btn ${disciplinesSortBy === 'tests' ? 'active' : ''}" onclick="setDisciplinesSort('tests')">
                    По тестам${discSortIcon('tests')}
                </button>
                <button class="sort-btn ${disciplinesSortBy === 'groups' ? 'active' : ''}" onclick="setDisciplinesSort('groups')">
                    По группам${discSortIcon('groups')}
                </button>
            </div>
            ` : ''}

            ${canEdit() && displayDisciplines.length > 0 && disciplineFolders.length > 0 ? `
                <div class="bulk-select-bar">
                    <label class="checkbox-label">
                        <input type="checkbox" id="select-all-disciplines" onchange="toggleAllDisciplines(this.checked)">
                        <span>Выбрать все</span>
                    </label>
                    <div class="folder-move-group">
                        <select id="move-to-folder-select" class="folder-select">
                            <option value="">📁 Выберите папку...</option>
                            ${disciplineFolders.map(f => `
                                <option value="${f.id}" data-color="${f.color || '#667eea'}">📁 ${escapeHtml(f.name)}</option>
                            `).join('')}
                            <option value="__none__">📄 Убрать из папки</option>
                        </select>
                        <button class="btn btn-primary btn-sm" onclick="moveSelectedToFolderFromSelect()" id="btn-move-to-folder">
                            Переместить
                        </button>
                    </div>
                </div>
            ` : ''}

            <div class="disciplines-grid" id="disciplines-grid">
                ${displayDisciplines.length === 0 ? `
                    <div class="empty-state">
                        <div class="empty-icon-text">${currentFolder ? '📁' : '📚'}</div>
                        <p>${currentFolder ? 'Папка пуста' : 'Дисциплин пока нет'}</p>
                        ${canEdit() ? `<p class="hint">${currentFolder ? 'Переместите дисциплины в эту папку' : 'Создайте первую дисциплину для начала работы'}</p>` : ''}
                    </div>
                ` : displayDisciplines.map(d => renderDisciplineCard(d)).join('')}
            </div>
        </div>

        <div id="discipline-form-modal" class="modal hidden">
            <div class="modal-content discipline-modal-compact">
                <div class="modal-header">
                    <h2 id="discipline-form-title">Создание дисциплины</h2>
                    <button class="btn-close" onclick="hideDisciplineForm()">&times;</button>
                </div>
                <form id="discipline-form" class="discipline-form-body">
                    <div class="discipline-form-main">
                        <label class="form-label">Название дисциплины</label>
                        <input type="text" id="discipline-name" required
                               placeholder="Например: ОП.01 Техническая механика"
                               class="discipline-name-input">
                    </div>
                    <div class="discipline-form-groups">
                        <div class="groups-header">
                            <label class="form-label">Закрепить группы</label>
                            <span class="groups-counter" id="discipline-groups-counter">0 выбрано</span>
                        </div>
                        <div class="groups-search-box">
                            <input type="text" id="discipline-groups-search"
                                   placeholder="Поиск группы..."
                                   class="groups-search-input"
                                   oninput="filterDisciplineGroups()">
                        </div>
                        <div id="discipline-groups-list" class="discipline-groups-grid"></div>
                    </div>
                    <div class="discipline-form-teachers" id="discipline-teachers-section">
                        <label class="form-label">Назначить преподавателей</label>
                        <select id="discipline-teachers-select" class="teachers-dropdown" onchange="addTeacherFromDropdown()">
                            <option value="">— Выберите преподавателя —</option>
                        </select>
                        <div id="selected-teachers-list" class="selected-teachers-list"></div>
                    </div>
                    <div class="discipline-form-footer">
                        <button type="button" class="btn btn-secondary" onclick="hideDisciplineForm()">Отмена</button>
                        <button type="submit" class="btn btn-primary">Сохранить</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.getElementById('discipline-form').addEventListener('submit', saveDiscipline);
}

// ============================================
// ПОИСК И ФИЛЬТРАЦИЯ ДИСЦИПЛИН
// ============================================

function filterDisciplinesDisplay() {
    const searchText = (document.getElementById('disciplines-search')?.value || '').toLowerCase().trim();
    const groupSearch = (document.getElementById('disciplines-group-search')?.value || '').toLowerCase().trim();

    const cards = document.querySelectorAll('.discipline-card');
    let visibleCount = 0;

    cards.forEach(card => {
        const name = card.querySelector('h3')?.textContent?.toLowerCase() || '';
        const groupsText = card.querySelector('.discipline-group')?.textContent?.toLowerCase() || '';

        const matchesName = !searchText || name.includes(searchText);
        const matchesGroup = !groupSearch || groupsText.includes(groupSearch);

        if (matchesName && matchesGroup) {
            card.style.display = '';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    // Показываем сообщение если ничего не найдено
    let emptyMsg = document.getElementById('disciplines-search-empty');
    if (visibleCount === 0 && (searchText || groupSearch)) {
        if (!emptyMsg) {
            emptyMsg = document.createElement('div');
            emptyMsg.id = 'disciplines-search-empty';
            emptyMsg.className = 'empty-state';
            emptyMsg.innerHTML = '<p>Ничего не найдено</p>';
            document.querySelector('.disciplines-grid')?.appendChild(emptyMsg);
        }
        emptyMsg.style.display = '';
    } else if (emptyMsg) {
        emptyMsg.style.display = 'none';
    }
}

function clearDisciplinesSearch() {
    const searchInput = document.getElementById('disciplines-search');
    const groupSearchInput = document.getElementById('disciplines-group-search');
    if (searchInput) searchInput.value = '';
    if (groupSearchInput) groupSearchInput.value = '';
    filterDisciplinesDisplay();
}

// ============================================
// РЕНДЕР КАРТОЧКИ ДИСЦИПЛИНЫ
// ============================================

function renderDisciplineCard(d) {
    const groupNames = (d.assignedGroups || [])
        .map(gId => (adminState.groups || []).find(g => g.id === gId)?.name)
        .filter(Boolean);

    // Находим автора дисциплины
    const authorUser = (adminState.users || []).find(u => String(u.id) === String(d.createdBy));
    const authorUsername = authorUser?.username;

    // Получаем имена преподавателей (ФИО), исключая автора
    const teacherNames = (d.assignedTeachers || [])
        .filter(username => username !== authorUsername) // Исключаем автора
        .map(username => {
            const user = (adminState.users || []).find(u => u.username === username);
            return user?.name || username;
        })
        .filter(Boolean);

    // Проверяем, назначен ли текущий пользователь на эту дисциплину
    const isAssignedToMe = (d.assignedTeachers || []).includes(adminState.user?.username);
    const isOwner = d.ownerId === adminState.user?.id || d.createdBy === adminState.user?.id;

    return `
        <div class="discipline-card ${isAssignedToMe && !isOwner ? 'discipline-assigned' : ''}" onclick="openDiscipline('${d.id}')">
            ${canEdit() ? `
                <div class="discipline-checkbox" onclick="event.stopPropagation()">
                    <input type="checkbox" class="discipline-select" data-id="${d.id}" onchange="updateDisciplineSelection()">
                </div>
            ` : ''}
            <div class="discipline-card-inner">
                <div class="discipline-card-header">
                    <h3>${escapeHtml(d.name)}</h3>
                    ${isAssignedToMe && !isOwner ? '<span class="assigned-badge" title="Вам назначена эта дисциплина">📌</span>' : ''}
                    ${canEdit() ? `
                    <div class="discipline-actions" onclick="event.stopPropagation()">
                        <button class="btn-icon btn-icon-edit" onclick="editDiscipline('${d.id}')" title="Редактировать"></button>
                        <button class="btn-icon btn-icon-delete btn-danger" onclick="deleteDiscipline('${d.id}')" title="Удалить"></button>
                    </div>
                    ` : ''}
                </div>
                ${groupNames.length > 0 ? `<div class="discipline-group"><span class="group-label">Группы:</span> ${escapeHtml(groupNames.join(', '))}</div>` : ''}
                ${teacherNames.length > 0 && adminState.user?.role === 'admin' ? `<div class="discipline-teachers" title="${escapeHtml(teacherNames.join(', '))}"><span class="teacher-label">Преподаватели:</span><span class="teacher-names">${escapeHtml(teacherNames.join(', '))}</span></div>` : ''}
                <div class="discipline-stats">
                    <div class="stat-item"><span class="stat-value">${d.topicsCount || 0}</span><span class="stat-label">тем</span></div>
                    <div class="stat-item"><span class="stat-value">${d.testsCount || 0}</span><span class="stat-label">тестов</span></div>
                </div>
                <div class="discipline-author"><span class="author-label">Автор:</span> ${getAuthorName(d.createdBy)}</div>
            </div>
        </div>
    `;
}

// ============================================
// ПАПКИ ДИСЦИПЛИН
// ============================================

let editingFolderId = null;
let editingFolderType = null;

async function loadFolders(type) {
    try {
        const response = await apiRequest(`/folders?type=${type}`);
        if (response.success) {
            // Обновляем только папки нужного типа
            adminState.folders = adminState.folders.filter(f => f.type !== type);
            adminState.folders.push(...response.folders);

            // Обновляем привязки элементов к папкам
            adminState.folderItems = adminState.folderItems.filter(fi => fi.type !== type);
            if (response.folderItems) {
                adminState.folderItems.push(...response.folderItems);
            }
        }
    } catch (e) {
        console.error('Ошибка загрузки папок:', e);
    }
}

// Получить ID папки для элемента (персональная привязка)
function getFolderIdForItem(itemId, type) {
    const binding = adminState.folderItems.find(fi => fi.itemId === itemId && fi.type === type);
    return binding?.folderId || null;
}

function openDisciplineFolder(folderId) {
    if (folderId === '__none__') {
        // Специальная "папка" - без папки
        adminState.currentDisciplineFolder = '__none__';
        renderDisciplinesTab();
        return;
    }
    const folder = adminState.folders.find(f => f.id === folderId);
    if (folder) {
        adminState.currentDisciplineFolder = folder;
        renderDisciplinesTab();
    }
}

function closeDisciplineFolder() {
    adminState.currentDisciplineFolder = null;
    renderDisciplinesTab();
}

function showFolderForm(type, folder = null) {
    editingFolderId = folder?.id || null;
    editingFolderType = type;

    const colors = ['#667eea', '#764ba2', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

    const html = `
        <div class="modal-content folder-modal-content">
            <div class="modal-header">
                <h2>${folder ? 'Редактировать папку' : 'Создать папку'}</h2>
                <button class="btn-close" onclick="closeFolderForm()">&times;</button>
            </div>
            <form id="folder-form" onsubmit="saveFolder(event)">
                <div class="modal-body">
                    <div class="form-group">
                        <label>Название папки</label>
                        <input type="text" id="folder-name" value="${escapeHtml(folder?.name || '')}" required placeholder="Например: 1 курс" class="form-input">
                    </div>
                    <div class="form-group">
                        <label>Цвет</label>
                        <div class="color-picker-row">
                            ${colors.map(c => `
                                <button type="button" class="color-option ${folder?.color === c ? 'selected' : ''}"
                                        style="background: ${c}"
                                        onclick="selectFolderColor('${c}')"
                                        data-color="${c}"></button>
                            `).join('')}
                        </div>
                        <input type="hidden" id="folder-color" value="${folder?.color || '#667eea'}">
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeFolderForm()">Отмена</button>
                    <button type="submit" class="btn btn-primary">Сохранить</button>
                </div>
            </form>
        </div>
    `;

    let modal = document.getElementById('folder-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'folder-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    modal.innerHTML = html;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    // Автоматически выделяем текущий цвет
    const currentColor = folder?.color || '#667eea';
    selectFolderColor(currentColor);
}

function selectFolderColor(color) {
    document.querySelectorAll('.color-option').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.color === color);
    });
    document.getElementById('folder-color').value = color;
}

function closeFolderForm() {
    const modal = document.getElementById('folder-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
    editingFolderId = null;
    editingFolderType = null;
}

async function saveFolder(e) {
    e.preventDefault();

    const name = document.getElementById('folder-name').value.trim();
    const color = document.getElementById('folder-color').value;
    const folderType = editingFolderType; // Сохраняем тип до закрытия формы
    const isEditing = !!editingFolderId;

    if (!name) {
        await showError('Введите название папки');
        return;
    }

    try {
        let response;
        if (editingFolderId) {
            response = await apiRequest(`/folders/${editingFolderId}`, 'PUT', { name, color });
        } else {
            response = await apiRequest('/folders', 'POST', { name, color, type: folderType });
        }

        if (response.success) {
            closeFolderForm();
            await loadFolders(folderType);
            if (folderType === 'disciplines') {
                renderDisciplinesTab();
            } else {
                renderGroupsTab();
            }
            await showSuccess(isEditing ? 'Папка обновлена' : 'Папка создана');
        } else {
            await showError(response.error || 'Ошибка сохранения');
        }
    } catch (error) {
        await showError('Ошибка сохранения папки');
    }
}

function editFolder(folderId) {
    const folder = adminState.folders.find(f => f.id === folderId);
    if (folder) {
        showFolderForm(folder.type, folder);
    }
}

async function deleteFolder(folderId) {
    const folder = adminState.folders.find(f => f.id === folderId);
    if (!folder) return;

    const confirmed = await showConfirm(`Удалить папку "${folder.name}"? Элементы внутри папки не будут удалены.`);
    if (!confirmed) return;

    try {
        const response = await apiRequest(`/folders/${folderId}`, 'DELETE');
        if (response.success) {
            await loadFolders(folder.type);
            if (folder.type === 'disciplines') {
                adminState.currentDisciplineFolder = null;
                renderDisciplinesTab();
            } else {
                adminState.currentGroupFolder = null;
                renderGroupsTab();
            }
            await showSuccess('Папка удалена');
        }
    } catch (error) {
        await showError('Ошибка удаления папки');
    }
}

async function moveSelectedToFolderFromSelect() {
    const select = document.getElementById('move-to-folder-select');
    const folderId = select?.value;

    if (!folderId) {
        await showError('Выберите папку');
        return;
    }

    const selected = document.querySelectorAll('.discipline-select:checked');
    if (selected.length === 0) {
        await showError('Выберите дисциплины для перемещения');
        return;
    }

    const ids = Array.from(selected).map(cb => cb.dataset.id);

    // Показываем индикатор загрузки
    showLoading('Перемещение дисциплин...');

    try {
        // Перемещаем дисциплины
        for (const id of ids) {
            await apiRequest('/folders/items', 'POST', {
                itemId: id,
                folderId: folderId === '__none__' ? null : folderId,
                type: 'disciplines'
            });

            // Обновляем локально folderItems
            const existingIndex = adminState.folderItems.findIndex(fi => fi.itemId === id && fi.type === 'disciplines');
            if (folderId === '__none__') {
                // Удаляем привязку
                if (existingIndex !== -1) {
                    adminState.folderItems.splice(existingIndex, 1);
                }
            } else {
                // Обновляем или добавляем привязку
                if (existingIndex !== -1) {
                    adminState.folderItems[existingIndex].folderId = folderId;
                } else {
                    adminState.folderItems.push({ itemId: id, folderId: folderId, type: 'disciplines' });
                }
            }
        }

        select.value = '';
        renderDisciplinesTab();
        hideLoading();
        const action = folderId === '__none__' ? 'Убрано из папки' : 'Перемещено';
        await showSuccess(`${action}: ${ids.length}`);
    } catch (error) {
        hideLoading();
        await showError('Ошибка перемещения: ' + (error.message || 'неизвестная ошибка'));
    }
}

// editingDisciplineId определена в state.js

// Временное хранилище для групп формы дисциплины
let disciplineFormGroups = [];
let disciplineFormSelectedGroups = [];

// Временное хранилище для преподавателей формы дисциплины
let disciplineFormTeachers = [];
let disciplineFormSelectedTeachers = [];

async function showDisciplineForm(discipline = null) {
    editingDisciplineId = discipline?.id || null;
    document.getElementById('discipline-form-title').textContent = discipline ? 'Редактирование дисциплины' : 'Создание дисциплины';
    document.getElementById('discipline-name').value = discipline?.name || '';
    document.getElementById('discipline-groups-search').value = '';

    // Загружаем группы если ещё не загружены
    if (!adminState.loaded.groups) {
        await loadGroupsLazy();
    }

    // Получаем группы, закреплённые за преподавателем
    const isAdmin = adminState.user?.role === 'admin';

    if (isAdmin) {
        disciplineFormGroups = adminState.groups || [];
    } else {
        const username = adminState.user?.username;
        disciplineFormGroups = (adminState.groups || []).filter(g =>
            (g.assignedTeachers || []).includes(username)
        );
    }

    // Сохраняем выбранные группы
    disciplineFormSelectedGroups = discipline?.assignedGroups || [];

    // Загружаем преподавателей (только для админа)
    if (isAdmin) {
        await loadUsersLazy();
        disciplineFormTeachers = (adminState.users || []).filter(u => u.role === 'teacher');
        disciplineFormSelectedTeachers = discipline?.assignedTeachers || [];
        renderDisciplineTeachersSelect();
        document.getElementById('discipline-teachers-section').style.display = '';
    } else {
        // Скрываем секцию преподавателей для обычных преподавателей
        document.getElementById('discipline-teachers-section').style.display = 'none';
    }

    renderDisciplineGroupsList();
    updateDisciplineGroupsCounter();
    showModal('discipline-form-modal');
}

function renderDisciplineGroupsList(filter = '') {
    const groupsList = document.getElementById('discipline-groups-list');
    const filterLower = filter.toLowerCase().trim();

    // Фильтруем группы
    let filteredGroups = disciplineFormGroups;
    if (filterLower) {
        filteredGroups = disciplineFormGroups.filter(g =>
            g.name.toLowerCase().includes(filterLower)
        );
    }

    if (disciplineFormGroups.length === 0) {
        groupsList.innerHTML = `
            <div class="discipline-groups-empty">
                <span class="empty-icon">📭</span>
                <p>Нет доступных групп</p>
            </div>
        `;
        return;
    }

    if (filteredGroups.length === 0) {
        groupsList.innerHTML = `
            <div class="discipline-groups-empty">
                <span class="empty-icon">🔍</span>
                <p>Группы не найдены</p>
            </div>
        `;
        return;
    }

    groupsList.innerHTML = filteredGroups.map(g => {
        const studentsCount = g.studentsCount ?? g.students?.length ?? 0;
        const isChecked = disciplineFormSelectedGroups.includes(g.id);
        return `
            <label class="discipline-group-item ${isChecked ? 'selected' : ''}" data-group-id="${g.id}">
                <input type="checkbox" name="discipline-groups" value="${g.id}"
                    ${isChecked ? 'checked' : ''}
                    onchange="toggleDisciplineGroup('${g.id}', this.checked)">
                <span class="discipline-group-check">${isChecked ? '✓' : ''}</span>
                <span class="discipline-group-name">${escapeHtml(g.name)}</span>
                <span class="discipline-group-count">${studentsCount}</span>
            </label>
        `;
    }).join('');
}

function filterDisciplineGroups() {
    const search = document.getElementById('discipline-groups-search').value;
    renderDisciplineGroupsList(search);
}

function toggleDisciplineGroup(groupId, isChecked) {
    if (isChecked) {
        if (!disciplineFormSelectedGroups.includes(groupId)) {
            disciplineFormSelectedGroups.push(groupId);
        }
    } else {
        disciplineFormSelectedGroups = disciplineFormSelectedGroups.filter(id => id !== groupId);
    }

    // Обновляем визуальное состояние
    const item = document.querySelector(`.discipline-group-item[data-group-id="${groupId}"]`);
    if (item) {
        item.classList.toggle('selected', isChecked);
        item.querySelector('.discipline-group-check').textContent = isChecked ? '✓' : '';
    }

    updateDisciplineGroupsCounter();
}

function updateDisciplineGroupsCounter() {
    const counter = document.getElementById('discipline-groups-counter');
    const count = disciplineFormSelectedGroups.length;
    counter.textContent = count > 0 ? `${count} выбрано` : 'не выбрано';
    counter.className = 'groups-counter' + (count > 0 ? ' has-selection' : '');
}

// ============================================
// УПРАВЛЕНИЕ ПРЕПОДАВАТЕЛЯМИ ДИСЦИПЛИНЫ
// ============================================

function renderDisciplineTeachersSelect() {
    const select = document.getElementById('discipline-teachers-select');
    if (!select) return;

    // Сортируем по имени
    const sorted = [...disciplineFormTeachers].sort((a, b) => {
        const nameA = (a.name || a.username).toLowerCase();
        const nameB = (b.name || b.username).toLowerCase();
        return nameA.localeCompare(nameB, 'ru');
    });

    // Фильтруем уже выбранных
    const available = sorted.filter(t => !disciplineFormSelectedTeachers.includes(t.username));

    let html = '<option value="">— Выберите преподавателя —</option>';
    if (available.length === 0) {
        html += '<option disabled>Все преподаватели добавлены</option>';
    } else {
        html += available.map(t => {
            const displayName = t.name || t.username;
            return `<option value="${t.username}">${escapeHtml(displayName)}</option>`;
        }).join('');
    }
    select.innerHTML = html;

    // Отображаем выбранных преподавателей
    renderSelectedTeachersList();
}

function renderSelectedTeachersList() {
    const container = document.getElementById('selected-teachers-list');
    if (!container) return;

    if (disciplineFormSelectedTeachers.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = disciplineFormSelectedTeachers.map(username => {
        const teacher = disciplineFormTeachers.find(t => t.username === username);
        const displayName = teacher?.name || username;
        return `
            <div class="selected-teacher-tag">
                <span>${escapeHtml(displayName)}</span>
                <button type="button" class="remove-teacher-btn" onclick="removeTeacher('${username}')">&times;</button>
            </div>
        `;
    }).join('');
}

function addTeacherFromDropdown() {
    const select = document.getElementById('discipline-teachers-select');
    const username = select.value;

    if (!username) return;

    if (!disciplineFormSelectedTeachers.includes(username)) {
        disciplineFormSelectedTeachers.push(username);
    }

    // Обновляем UI
    renderDisciplineTeachersSelect();
}

function removeTeacher(username) {
    disciplineFormSelectedTeachers = disciplineFormSelectedTeachers.filter(u => u !== username);
    renderDisciplineTeachersSelect();
}

function getSelectedTeachersFromSelect() {
    return disciplineFormSelectedTeachers;
}

function hideDisciplineForm() {
    hideModal('discipline-form-modal');
    editingDisciplineId = null;
}

async function saveDiscipline(e) {
    e.preventDefault();
    showLoading('Сохранение дисциплины...');

    const isAdmin = adminState.user?.role === 'admin';

    const data = {
        name: document.getElementById('discipline-name').value.trim(),
        assignedGroups: disciplineFormSelectedGroups
    };

    // Только админ может назначать преподавателей
    if (isAdmin) {
        data.assignedTeachers = getSelectedTeachersFromSelect();
    }

    let result;
    if (editingDisciplineId) {
        result = await apiRequest(`/disciplines/${editingDisciplineId}`, 'PUT', data);
    } else {
        result = await apiRequest('/disciplines', 'POST', data);
    }

    if (result.success) {
        await loadAllData();
        hideLoading();
        hideDisciplineForm();
        renderDisciplinesTab();
    } else {
        hideLoading();
        await showError(result.error || 'Ошибка сохранения');
    }
}

function openDiscipline(id) {
    adminState.currentDiscipline = adminState.disciplines.find(d => String(d.id) === String(id));
    adminState.currentTopic = null;
    renderDisciplinesTab();
    updateUrlState('disciplines', id, null);
}

async function editDiscipline(id) {
    const discipline = adminState.disciplines.find(d => String(d.id) === String(id));
    if (discipline) showDisciplineForm(discipline);
}

async function deleteDiscipline(id) {
    if (await showConfirm('Удалить дисциплину? Все темы и тесты в ней также будут удалены.', 'Удаление дисциплины')) {
        await apiRequest(`/disciplines/${id}`, 'DELETE');
        await loadAllData();
        renderDisciplinesTab();
    }
}

// ============================================
// МАССОВОЕ УДАЛЕНИЕ ДИСЦИПЛИН
// ============================================

function toggleAllDisciplines(checked) {
    document.querySelectorAll('.discipline-select').forEach(cb => {
        cb.checked = checked;
    });
    updateDisciplineSelection();
}

function updateDisciplineSelection() {
    const checkboxes = document.querySelectorAll('.discipline-select:checked');
    const count = checkboxes.length;
    const btn = document.getElementById('btn-delete-selected-disciplines');
    const countSpan = document.getElementById('selected-disciplines-count');
    const selectAllCheckbox = document.getElementById('select-all-disciplines');

    if (btn) {
        btn.style.display = count > 0 ? 'inline-flex' : 'none';
    }
    if (countSpan) {
        countSpan.textContent = count;
    }

    // Обновляем состояние "Выбрать все"
    const allCheckboxes = document.querySelectorAll('.discipline-select');
    if (selectAllCheckbox && allCheckboxes.length > 0) {
        selectAllCheckbox.checked = count === allCheckboxes.length;
        selectAllCheckbox.indeterminate = count > 0 && count < allCheckboxes.length;
    }
}

async function deleteSelectedDisciplines() {
    const checkboxes = document.querySelectorAll('.discipline-select:checked');
    const ids = Array.from(checkboxes).map(cb => cb.dataset.id);

    if (ids.length === 0) {
        showNotification('Выберите дисциплины для удаления', 'warning');
        return;
    }

    const confirmMsg = ids.length === 1
        ? 'Удалить выбранную дисциплину? Все темы и тесты в ней также будут удалены.'
        : `Удалить ${ids.length} дисциплин? Все темы и тесты в них также будут удалены.`;

    if (await showConfirm(confirmMsg, 'Массовое удаление')) {
        showLoading();
        let deleted = 0;
        let errors = 0;

        for (const id of ids) {
            try {
                const result = await apiRequest(`/disciplines/${id}`, 'DELETE');
                if (result.success) {
                    deleted++;
                } else {
                    errors++;
                }
            } catch (e) {
                errors++;
            }
        }

        hideLoading();
        await loadAllData();
        renderDisciplinesTab();

        if (errors > 0) {
            showNotification(`Удалено: ${deleted}, ошибок: ${errors}`, 'warning');
        } else {
            showNotification(`Удалено дисциплин: ${deleted}`, 'success');
        }
    }
}

// ============================================
// ПРОСМОТР ТЕМ
// ============================================

function renderTopicsView(container) {
    const discipline = adminState.currentDiscipline;
    const topics = adminState.topics.filter(t => String(t.disciplineId) === String(discipline.id));

    // Обновляем верхний breadcrumb
    updateBreadcrumbForNavigation();

    container.innerHTML = `
        <div class="admin-section">
            <div class="section-header">
                <div>
                    <h2>${escapeHtml(discipline.name)}</h2>
                    ${discipline.groupName ? `<p class="subtitle">Группа: ${escapeHtml(discipline.groupName)}</p>` : ''}
                </div>
                ${canEdit() ? `<button class="btn btn-primary" onclick="showTopicForm()">+ Добавить тему</button>` : ''}
            </div>

            <div class="topics-list">
                ${topics.length === 0 ? `
                    <div class="empty-state">
                        <div class="empty-icon-text">Нет тем</div>
                        <p>Тем пока нет</p>
                        ${canEdit() ? `<p class="hint">Добавьте тему, чтобы создавать в ней тесты</p>` : ''}
                    </div>
                ` : topics.map(t => `
                    <div class="topic-card" onclick="openTopic('${t.id}')">
                        <div class="topic-info">
                            <h3>${escapeHtml(t.name)}</h3>
                            <span class="topic-tests-count">Тестов: ${t.testsCount || 0}</span>
                            ${t.createdBy ? `<div class="topic-author"><span class="author-label">Автор:</span> ${getAuthorName(t.createdBy)}</div>` : ''}
                        </div>
                        ${canEdit() ? `
                        <div class="topic-actions" onclick="event.stopPropagation()">
                            <button class="btn-icon btn-icon-edit" onclick="editTopic('${t.id}')" title="Редактировать"></button>
                            <button class="btn-icon btn-icon-delete btn-danger" onclick="deleteTopic('${t.id}')" title="Удалить"></button>
                        </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        </div>

        <div id="topic-form-modal" class="modal hidden">
            <div class="modal-content modal-compact">
                <div class="modal-header modal-header-icon">
                    <div class="modal-icon modal-icon-topic">📁</div>
                    <div>
                        <h2 id="topic-form-title">Добавление темы</h2>
                        <p class="modal-subtitle">Тема — это раздел для группировки тестов</p>
                    </div>
                    <button class="btn-close" onclick="hideTopicForm()">&times;</button>
                </div>
                <form id="topic-form">
                    <div class="form-group">
                        <label>Название темы <span class="required">*</span></label>
                        <input type="text" id="topic-name" required placeholder="Например: Раздел 1. Основы">
                        <small class="form-hint">Примеры: "Тема 1. Введение", "Контрольные работы", "Зачёты"</small>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="hideTopicForm()">Отмена</button>
                        <button type="submit" class="btn btn-primary">Сохранить</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.getElementById('topic-form').addEventListener('submit', saveTopic);
}

// editingTopicId определена в state.js

function showTopicForm(topic = null) {
    editingTopicId = topic?.id || null;
    document.getElementById('topic-form-title').textContent = topic ? 'Редактирование темы' : 'Добавление темы';
    document.getElementById('topic-name').value = topic?.name || '';
    showModal('topic-form-modal');
}

function hideTopicForm() {
    hideModal('topic-form-modal');
    editingTopicId = null;
}

async function saveTopic(e) {
    e.preventDefault();
    showLoading('Сохранение темы...');

    const data = {
        name: document.getElementById('topic-name').value.trim(),
        disciplineId: adminState.currentDiscipline.id
    };

    let result;
    if (editingTopicId) {
        result = await apiRequest(`/topics/${editingTopicId}`, 'PUT', data);
    } else {
        result = await apiRequest('/topics', 'POST', data);
    }

    if (result.success) {
        await loadAllData();
        hideLoading();
        hideTopicForm();
        renderDisciplinesTab();
    } else {
        hideLoading();
        await showError(result.error || 'Ошибка сохранения');
    }
}

function openTopic(id) {
    adminState.currentTopic = adminState.topics.find(t => String(t.id) === String(id));
    renderDisciplinesTab();
    updateUrlState('disciplines', adminState.currentDiscipline?.id, id);
}

async function editTopic(id) {
    const topic = adminState.topics.find(t => String(t.id) === String(id));
    if (topic) showTopicForm(topic);
}

async function deleteTopic(id) {
    if (await showConfirm('Удалить тему? Все тесты в ней также будут удалены.', 'Удаление темы')) {
        await apiRequest(`/topics/${id}`, 'DELETE');
        await loadAllData();
        renderDisciplinesTab();
    }
}

function goBack() {
    if (adminState.currentTopic) {
        adminState.currentTopic = null;
        updateUrlState('disciplines', adminState.currentDiscipline?.id, null);
    } else if (adminState.currentDiscipline) {
        adminState.currentDiscipline = null;
        updateUrlState('disciplines', null, null);
    }
    renderDisciplinesTab();
}

// Навигационные функции для breadcrumb
function navigateToDisciplines() {
    adminState.currentTopic = null;
    adminState.currentDiscipline = null;
    updateUrlState('disciplines', null, null);
    renderDisciplinesTab();
}

function navigateToTopics() {
    adminState.currentTopic = null;
    updateUrlState('disciplines', adminState.currentDiscipline?.id, null);
    renderDisciplinesTab();
}

// ============================================
// ПРОСМОТР ТЕСТОВ
// ============================================

function renderTestsView(container) {
    const topic = adminState.currentTopic;
    const discipline = adminState.currentDiscipline;
    const tests = adminState.tests.filter(t => String(t.topicId) === String(topic.id));

    // Обновляем верхний breadcrumb
    updateBreadcrumbForNavigation();

    container.innerHTML = `
        <div class="admin-section">
            <div class="section-header">
                <div>
                    <h2>${escapeHtml(topic.name)}</h2>
                    <p class="subtitle">${escapeHtml(discipline.name)}</p>
                </div>
                ${canEdit() ? `<button class="btn btn-primary" onclick="showTestForm()">+ Создать тест</button>` : ''}
            </div>

            <div class="tests-list">
                ${tests.length === 0 ? `
                    <div class="empty-state">
                        <div class="empty-icon-text">Нет тестов</div>
                        <p>Тестов пока нет</p>
                        ${canEdit() ? `<p class="hint">Создайте тест для этой темы</p>` : ''}
                    </div>
                ` : tests.map(t => {
                    const now = new Date();
                    const availableFrom = t.availableFrom ? new Date(t.availableFrom) : null;
                    const availableUntil = t.availableUntil ? new Date(t.availableUntil) : null;
                    const isTimeActive = (!availableFrom || now >= availableFrom) && (!availableUntil || now <= availableUntil);
                    const statusText = !t.isActive ? 'Отключён' : (!isTimeActive ? 'Вне расписания' : 'Активен');
                    const statusClass = !t.isActive ? 'inactive' : (!isTimeActive ? 'scheduled' : 'active');

                    return `
                    <div class="test-card ${t.isActive && isTimeActive ? '' : 'inactive'}">
                        <div class="test-card-header">
                            <h3>${escapeHtml(t.name)}</h3>
                            <div class="test-badges">
                                ${t.isTrainingMode ? '<span class="test-badge training">Тренировка</span>' : ''}
                                ${t.isExamMode ? '<span class="test-badge exam">Зачёт</span>' : ''}
                                ${t.isAdminSrezMode ? '<span class="test-badge srez">Адм. срез</span>' : ''}
                                ${t.skipGroup ? '<span class="test-badge" style="background:#e0f2fe;color:#0369a1;">Без группы</span>' : ''}
                                ${t.adaptiveMode ? '<span class="test-badge" style="background:#fef3c7;color:#92400e;">Адаптивный</span>' : ''}
                                <span class="test-status ${statusClass}">${statusText}</span>
                            </div>
                        </div>
                        <div class="test-card-info">
                            <p><strong>Время:</strong> ${t.timeLimit} мин | <strong>Вопросов:</strong> ${t.questionsCount} ${t.isAdminSrezMode && t.adminSrezSettings?.variants?.length > 0 ? 'по вариантам' : 'из пула'} | <strong>Штраф:</strong> ${t.penaltyTime || 0} мин</p>
                            ${!t.isExamMode && !t.isAdminSrezMode && t.shortCode ? `<p class="test-code-line"><strong>Код:</strong> <span class="test-short-code" onclick="copyShortCode('${t.shortCode}')" title="Нажмите для копирования">${t.shortCode}</span></p>` : ''}
                            ${t.isExamMode && t.examSettings ? `<p><strong>Попыток:</strong> ${t.examSettings.maxAttempts} | <strong>Проходной балл:</strong> ${t.examSettings.passingGrade}</p>` : ''}
                            ${t.isAdminSrezMode && t.adminSrezSettings ? `<p><strong>Попыток:</strong> ${t.adminSrezSettings.maxAttempts} | <strong>Вариантов:</strong> ${t.adminSrezSettings.variants?.length || 0}</p>` : ''}
                            ${availableFrom || availableUntil ? `
                                <p><strong>Доступ:</strong> ${availableFrom ? formatDateTime(availableFrom) : 'всегда'} — ${availableUntil ? formatDateTime(availableUntil) : 'бессрочно'}</p>
                            ` : ''}
                            ${t.createdBy ? `<p class="test-author"><span class="author-label">Автор:</span> ${getAuthorName(t.createdBy)}</p>` : ''}
                        </div>
                        <div class="test-card-actions">
                            ${t.isExamMode ? `<button class="btn-small btn-accent" onclick="showExamParticipantsModal('${t.id}')" title="Участники зачёта">Участники</button>` : ''}
                            ${t.isAdminSrezMode ? `<button class="btn-small btn-accent" onclick="showSrezParticipantsModal('${t.id}')" title="Участники среза">Участники</button>` : ''}
                            <button class="btn-small" onclick="showTestAccessModal('${t.id}')" title="Ссылка и QR-код">Доступ</button>
                            <button class="btn-small" onclick="goToTestResults('${t.id}')" title="Перейти к результатам">Результаты</button>
                            ${t.isActive ? `<button class="btn-small btn-warning" onclick="openExamMonitor('${t.id}')" title="Мониторинг в реальном времени">🔴 Live</button>` : ''}
                            ${canEdit() ? `
                            <button class="btn-small" onclick="toggleTest('${t.id}')" title="${t.isActive ? 'Отключить' : 'Включить'}">${t.isActive ? 'Откл' : 'Вкл'}</button>
                            <button class="btn-small" onclick="editTest('${t.id}')" title="Редактировать">Изменить</button>
                            <button class="btn-small" onclick="showDuplicateModal('${t.id}')" title="Дублировать">Копия</button>
                            ` : ''}
                            <button class="btn-small" onclick="manageQuestions('${t.id}')" title="${canEdit() ? 'Вопросы' : 'Просмотр вопросов'}">Вопросы</button>
                            ${canEdit() ? `<button class="btn-small btn-danger" onclick="confirmDeleteTest('${t.id}')" title="Удалить">Удалить</button>` : ''}
                        </div>
                    </div>
                `}).join('')}
            </div>
        </div>

        <div id="test-form-modal" class="modal hidden">
            <div class="modal-content test-form-compact">
                <div class="modal-header">
                    <h2 id="test-form-title">Создание теста</h2>
                    <button class="btn-close" onclick="hideTestForm()">&times;</button>
                </div>
                <form id="test-form">
                    <div class="test-form-layout">
                        <!-- Левая колонка: основные поля -->
                        <div class="test-form-main">
                            <div class="form-group">
                                <label>Название теста <span class="required">*</span></label>
                                <input type="text" id="test-name" required placeholder="Например: Контрольная работа №1">
                            </div>

                            <div class="form-row-compact">
                                <div class="form-group">
                                    <label>Время (мин)</label>
                                    <input type="number" id="test-time" value="15" min="5" max="180">
                                </div>
                                <div class="form-group">
                                    <label>Вопросов</label>
                                    <input type="number" id="test-questions-count" value="10" min="1" max="200">
                                </div>
                                <div class="form-group">
                                    <label>Штраф по времени за нарушение (мин)</label>
                                    <input type="number" id="test-penalty" value="0" min="0" max="10">
                                    <small style="display:block;color:#6b7280;margin-top:4px;font-size:12px">0 = не вычитать время (по умолчанию)</small>
                                </div>
                            </div>

                            <div class="form-group">
                                <label>⏱ Время на вопрос (сек, 0 = без ограничения)</label>
                                <input type="number" id="test-question-time-limit" value="0" min="0" max="600" placeholder="0">
                            </div>

                            <div class="form-group" id="password-group">
                                <label>Пароль для входа</label>
                                <input type="text" id="test-password" placeholder="Без пароля">
                            </div>

                            <!-- Настройки зачёта -->
                            <div id="exam-settings-container" class="mode-settings hidden">
                                <div class="mode-settings-title">Настройки зачёта</div>
                                <div class="form-row-compact">
                                    <div class="form-group">
                                        <label>Попыток</label>
                                        <input type="number" id="exam-max-attempts" value="2" min="1" max="10">
                                    </div>
                                    <div class="form-group">
                                        <label>Минимум оценка</label>
                                        <select id="exam-passing-grade">
                                            <option value="3">3</option>
                                            <option value="4">4</option>
                                            <option value="5">5</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <button type="button" class="btn btn-secondary btn-sm btn-full" onclick="showSelectGroupsModal()">Выбрать группы</button>
                                    <div id="selected-groups-list" class="selected-groups-list"></div>
                                    <input type="hidden" id="test-selected-groups" value="">
                                </div>
                            </div>

                            <!-- Настройки адм. среза -->
                            <div id="admin-srez-settings-container" class="mode-settings hidden">
                                <div class="mode-settings-title">Настройки среза</div>

                                <!-- Основные параметры -->
                                <div class="form-row-compact">
                                    <div class="form-group">
                                        <label>Попыток</label>
                                        <input type="number" id="srez-max-attempts" value="1" min="1" max="5">
                                    </div>
                                    <div class="form-group">
                                        <label>Вариантов</label>
                                        <input type="number" id="srez-variants-count" value="4" min="1" max="20" onchange="updateVariantsCount()">
                                    </div>
                                    <div class="form-group">
                                        <label>Группы</label>
                                        <button type="button" class="btn btn-secondary btn-sm" onclick="showSelectGroupsModal()" style="width: 100%;">Выбрать</button>
                                    </div>
                                </div>

                                <!-- Выбранные группы -->
                                <div id="selected-groups-list-srez" class="selected-groups-list" style="margin-top: 8px;"></div>
                                <input type="hidden" id="test-selected-groups-srez" value="">

                                <!-- Варианты и загрузка -->
                                <div style="margin-top: 12px; padding: 12px; background: #f8f9fa; border-radius: 8px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                        <span style="font-weight: 500; font-size: 13px;">Варианты:</span>
                                        <div style="display: flex; gap: 6px;">
                                            <button type="button" class="btn btn-outline btn-sm" onclick="downloadSrezTemplate()" title="Скачать шаблон Excel">📥 Шаблон</button>
                                            <label class="btn btn-accent btn-sm" style="cursor: pointer; margin: 0;" title="Загрузить вопросы из Excel">
                                                📤 Загрузить
                                                <input type="file" accept=".xlsx,.xls" onchange="importSrezVariants(this)" class="hidden">
                                            </label>
                                        </div>
                                    </div>
                                    <div id="srez-variants-list" class="variants-list"></div>
                                    <div id="srez-import-status" style="margin-top: 8px; font-size: 12px;"></div>
                                </div>
                            </div>

                            <!-- Дополнительно (разворачиваемое) -->
                            <details class="extra-settings">
                                <summary>Дополнительно</summary>
                                <div class="extra-settings-content">
                                    <div class="form-row-compact">
                                        <div class="form-group">
                                            <label>С</label>
                                            <input type="datetime-local" id="test-available-from">
                                        </div>
                                        <div class="form-group">
                                            <label>До</label>
                                            <input type="datetime-local" id="test-available-until">
                                        </div>
                                    </div>
                                    <label class="checkbox-inline">
                                        <input type="checkbox" id="test-hide-results">
                                        <span>Скрыть результаты от студента</span>
                                    </label>
                                    <label class="checkbox-inline" style="margin-top: 8px;">
                                        <input type="checkbox" id="test-skip-group">
                                        <span>Без группы (только ФИО)</span>
                                    </label>
                                    <label class="checkbox-inline" style="margin-top: 8px;">
                                        <input type="checkbox" id="test-adaptive-mode">
                                        <span>\uD83C\uDFAF Адаптивное тестирование (сложность подстраивается под ответы)</span>
                                    </label>
                                    <div style="margin-top: 12px;">
                                        <label class="checkbox-inline">
                                            <input type="checkbox" id="test-custom-grade" onchange="toggleGradeScale()">
                                            <span>Своя шкала оценок</span>
                                        </label>
                                        <div id="grade-scale-settings" style="display:none; margin-top: 8px;">
                                            <div style="margin-bottom: 8px;">
                                                <label style="display:inline-flex; align-items:center; gap:4px; cursor:pointer; margin-right:12px;">
                                                    <input type="radio" name="grade-type" value="five" checked onchange="toggleGradeType()">
                                                    <span style="font-size:13px;">Пятибалльная</span>
                                                </label>
                                                <label style="display:inline-flex; align-items:center; gap:4px; cursor:pointer;">
                                                    <input type="radio" name="grade-type" value="pass" onchange="toggleGradeType()">
                                                    <span style="font-size:13px;">Сдал / Не сдал</span>
                                                </label>
                                            </div>
                                            <div id="grade-five-settings">
                                                <div class="form-row-compact">
                                                    <div class="form-group">
                                                        <label>5 от %</label>
                                                        <input type="number" id="grade-scale-5" value="90" min="1" max="100">
                                                    </div>
                                                    <div class="form-group">
                                                        <label>4 от %</label>
                                                        <input type="number" id="grade-scale-4" value="75" min="1" max="100">
                                                    </div>
                                                    <div class="form-group">
                                                        <label>3 от %</label>
                                                        <input type="number" id="grade-scale-3" value="51" min="1" max="100">
                                                    </div>
                                                </div>
                                            </div>
                                            <div id="grade-pass-settings" style="display:none;">
                                                <div class="form-group">
                                                    <label>Сдал от %</label>
                                                    <input type="number" id="grade-pass-percent" value="80" min="1" max="100">
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </details>
                        </div>

                        <!-- Правая колонка: тип теста -->
                        <div class="test-form-sidebar">
                            <label class="field-label">Тип теста</label>
                            <div class="test-mode-selector">
                                <label class="test-mode-option" data-type="normal">
                                    <input type="radio" name="test-type" value="normal" checked onchange="handleTestTypeChange()">
                                    <span class="test-mode-icon">📝</span>
                                    <span class="test-mode-name">Обычный</span>
                                    <span class="test-mode-hint">Вход по паролю</span>
                                </label>
                                <label class="test-mode-option" data-type="training">
                                    <input type="radio" name="test-type" value="training" onchange="handleTestTypeChange()">
                                    <span class="test-mode-icon">📚</span>
                                    <span class="test-mode-name">Тренировка</span>
                                    <span class="test-mode-hint">Видны ответы</span>
                                </label>
                                <label class="test-mode-option" data-type="exam">
                                    <input type="radio" name="test-type" value="exam" onchange="handleTestTypeChange()">
                                    <span class="test-mode-icon">🎓</span>
                                    <span class="test-mode-name">Зачёт</span>
                                    <span class="test-mode-hint">Коды студентам</span>
                                </label>
                                <label class="test-mode-option" data-type="srez">
                                    <input type="radio" name="test-type" value="srez" onchange="handleTestTypeChange()">
                                    <span class="test-mode-icon">📋</span>
                                    <span class="test-mode-name">Адм. срез</span>
                                    <span class="test-mode-hint">Варианты</span>
                                </label>
                            </div>

                            <!-- Скрытые чекбоксы для совместимости -->
                            <input type="checkbox" id="test-training-mode" style="display:none">
                            <input type="checkbox" id="test-exam-mode" style="display:none">
                            <input type="checkbox" id="test-admin-srez-mode" style="display:none">
                        </div>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="hideTestForm()">Отмена</button>
                        <button type="submit" class="btn btn-primary">Сохранить</button>
                    </div>
                </form>
            </div>
        </div>

        <div id="questions-modal" class="modal hidden">
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h2>Управление вопросами</h2>
                    <button class="btn-close" onclick="hideQuestionsModal()">&times;</button>
                </div>
                <div id="questions-content"></div>
            </div>
        </div>

        <div id="test-access-modal" class="modal hidden">
            <div class="modal-content modal-medium">
                <div class="modal-header">
                    <h2>Доступ к тесту</h2>
                    <button class="btn-close" onclick="hideTestAccessModal()">&times;</button>
                </div>
                <div id="test-access-content"></div>
            </div>
        </div>

        <div id="duplicate-modal" class="modal hidden">
            <div class="modal-content modal-medium">
                <div class="modal-header">
                    <h2>Дублирование теста</h2>
                    <button class="btn-close" onclick="hideDuplicateModal()">&times;</button>
                </div>
                <div id="duplicate-content"></div>
            </div>
        </div>

        <div id="delete-confirm-modal" class="modal hidden">
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h2>Удаление теста</h2>
                    <button class="btn-close" onclick="hideDeleteConfirmModal()">&times;</button>
                </div>
                <div id="delete-confirm-content"></div>
            </div>
        </div>
    `;

    document.getElementById('test-form').addEventListener('submit', saveTest);
}

// editingTestId определена в state.js

function showTestForm(test = null) {
    editingTestId = test?.id || null;
    document.getElementById('test-form-title').textContent = test ? 'Редактирование теста' : 'Создание теста';
    document.getElementById('test-name').value = test?.name || '';
    document.getElementById('test-password').value = test?.password || '';
    document.getElementById('test-time').value = test?.timeLimit || 15;
    document.getElementById('test-questions-count').value = test?.questionsCount || 10;
    document.getElementById('test-penalty').value = test?.penaltyTime ?? 0;
    document.getElementById('test-question-time-limit').value = test?.questionTimeLimit || 0;
    document.getElementById('test-training-mode').checked = test?.isTrainingMode || false;
    document.getElementById('test-exam-mode').checked = test?.isExamMode || false;
    document.getElementById('exam-max-attempts').value = test?.examSettings?.maxAttempts || 2;
    document.getElementById('exam-passing-grade').value = test?.examSettings?.passingGrade || 3;
    document.getElementById('test-admin-srez-mode').checked = test?.isAdminSrezMode || false;
    document.getElementById('srez-max-attempts').value = test?.adminSrezSettings?.maxAttempts || 1;
    document.getElementById('srez-variants-count').value = test?.adminSrezSettings?.variants?.length || 4;
    document.getElementById('test-available-from').value = test?.availableFrom ? test.availableFrom.slice(0, 16) : '';
    document.getElementById('test-available-until').value = test?.availableUntil ? test.availableUntil.slice(0, 16) : '';
    document.getElementById('test-hide-results').checked = test?.hideResults || false;
    document.getElementById('test-skip-group').checked = test?.skipGroup || false;
    document.getElementById('test-adaptive-mode').checked = test?.adaptiveMode || false;
    // Шкала оценок
    const hasCustomGrade = !!test?.gradeScale;
    const isPassMode = hasCustomGrade && test.gradeScale.passPercent !== undefined;
    document.getElementById('test-custom-grade').checked = hasCustomGrade;
    document.getElementById('grade-scale-settings').style.display = hasCustomGrade ? 'block' : 'none';
    // Тип шкалы
    const gradeTypeRadio = document.querySelector(`input[name="grade-type"][value="${isPassMode ? 'pass' : 'five'}"]`);
    if (gradeTypeRadio) gradeTypeRadio.checked = true;
    document.getElementById('grade-five-settings').style.display = isPassMode ? 'none' : 'block';
    document.getElementById('grade-pass-settings').style.display = isPassMode ? 'block' : 'none';
    document.getElementById('grade-scale-5').value = test?.gradeScale?.grade5 || 90;
    document.getElementById('grade-scale-4').value = test?.gradeScale?.grade4 || 75;
    document.getElementById('grade-scale-3').value = test?.gradeScale?.grade3 || 51;
    document.getElementById('grade-pass-percent').value = test?.gradeScale?.passPercent || 80;

    // Загружаем выбранные группы
    const selectedGroups = test?.selectedGroups || [];
    document.getElementById('test-selected-groups').value = JSON.stringify(selectedGroups);
    document.getElementById('test-selected-groups-srez').value = JSON.stringify(selectedGroups);
    updateSelectedGroupsDisplay(selectedGroups);

    // Установка типа теста в радио-кнопках
    let testType = 'normal';
    if (test?.isTrainingMode) testType = 'training';
    else if (test?.isExamMode) testType = 'exam';
    else if (test?.isAdminSrezMode) testType = 'srez';

    const radioBtn = document.querySelector(`input[name="test-type"][value="${testType}"]`);
    if (radioBtn) radioBtn.checked = true;

    // Показ/скрытие настроек зачёта и админ среза
    handleTestTypeChange();
    updateVariantsCount();

    showModal('test-form-modal');
}

// Обработчик изменения типа теста (новый интерфейс с карточками)
function handleTestTypeChange() {
    const selectedType = document.querySelector('input[name="test-type"]:checked')?.value || 'normal';

    // Обновляем скрытые чекбоксы для совместимости
    document.getElementById('test-training-mode').checked = selectedType === 'training';
    document.getElementById('test-exam-mode').checked = selectedType === 'exam';
    document.getElementById('test-admin-srez-mode').checked = selectedType === 'srez';

    // Показ/скрытие секций настроек
    const examSettings = document.getElementById('exam-settings-container');
    const srezSettings = document.getElementById('admin-srez-settings-container');
    const passwordGroup = document.getElementById('password-group');

    // Убираем класс hidden и управляем через display
    examSettings.classList.remove('hidden');
    srezSettings.classList.remove('hidden');

    examSettings.style.display = selectedType === 'exam' ? 'block' : 'none';
    srezSettings.style.display = selectedType === 'srez' ? 'block' : 'none';

    // Скрываем пароль для зачёта и среза (там используются коды)
    if (passwordGroup) {
        passwordGroup.style.display = (selectedType === 'exam' || selectedType === 'srez') ? 'none' : 'block';
    }

    // Обновляем список вариантов при выборе среза
    if (selectedType === 'srez') {
        updateVariantsCount();
    }
}

// Переключение сворачиваемых секций
function toggleFormSection(header) {
    const content = header.nextElementSibling;
    const arrow = header.querySelector('.form-section-arrow');

    if (content.classList.contains('form-section-collapsed')) {
        content.classList.remove('form-section-collapsed');
        arrow.textContent = '▲';
    } else {
        content.classList.add('form-section-collapsed');
        arrow.textContent = '▼';
    }
}

// Обновление отображения выбранных групп
function updateSelectedGroupsDisplay(groupIds) {
    const listContainer = document.getElementById('selected-groups-list');
    const listContainerSrez = document.getElementById('selected-groups-list-srez');

    if (!groupIds || groupIds.length === 0) {
        if (listContainer) listContainer.innerHTML = '';
        if (listContainerSrez) listContainerSrez.innerHTML = '';
        return;
    }

    const selectedNames = groupIds.map(gId => {
        const group = adminState.groups.find(g => g.id === gId);
        return group ? group.name : '';
    }).filter(n => n);

    const html = `
        <div class="selected-groups-tags">
            ${selectedNames.map(name => `<span class="group-tag">${escapeHtml(name)}</span>`).join('')}
        </div>
    `;

    if (listContainer) listContainer.innerHTML = html;
    if (listContainerSrez) listContainerSrez.innerHTML = html;
}

function toggleGradeScale() {
    const checked = document.getElementById('test-custom-grade').checked;
    document.getElementById('grade-scale-settings').style.display = checked ? 'block' : 'none';
}

function toggleGradeType() {
    const type = document.querySelector('input[name="grade-type"]:checked')?.value || 'five';
    document.getElementById('grade-five-settings').style.display = type === 'five' ? 'block' : 'none';
    document.getElementById('grade-pass-settings').style.display = type === 'pass' ? 'block' : 'none';
}

// Переключение режимов (тренировка, зачёт и адм. срез взаимоисключающие)
function toggleExamMode() {
    const isTraining = document.getElementById('test-training-mode').checked;
    const isExam = document.getElementById('test-exam-mode').checked;
    const isAdminSrez = document.getElementById('test-admin-srez-mode').checked;

    // Взаимоисключение
    if (isTraining && (isExam || isAdminSrez)) {
        if (event && event.target.id === 'test-training-mode') {
            document.getElementById('test-exam-mode').checked = false;
            document.getElementById('test-admin-srez-mode').checked = false;
        } else {
            document.getElementById('test-training-mode').checked = false;
        }
    }
    if (isExam && isAdminSrez) {
        if (event && event.target.id === 'test-exam-mode') {
            document.getElementById('test-admin-srez-mode').checked = false;
        } else {
            document.getElementById('test-exam-mode').checked = false;
        }
    }

    // Показ настроек зачёта
    const examSettings = document.getElementById('exam-settings-container');
    examSettings.style.display = document.getElementById('test-exam-mode').checked ? 'block' : 'none';

    // Показ настроек адм. среза
    toggleAdminSrezMode();
}

// Переключение режима административного среза
function toggleAdminSrezMode() {
    const isAdminSrez = document.getElementById('test-admin-srez-mode').checked;
    const isTraining = document.getElementById('test-training-mode').checked;
    const isExam = document.getElementById('test-exam-mode').checked;

    // Если включили адм. срез — выключаем другие режимы
    if (isAdminSrez && (isTraining || isExam)) {
        document.getElementById('test-training-mode').checked = false;
        document.getElementById('test-exam-mode').checked = false;
        document.getElementById('exam-settings-container').style.display = 'none';
    }

    // Показ/скрытие настроек адм. среза
    const srezSettings = document.getElementById('admin-srez-settings-container');
    srezSettings.style.display = isAdminSrez ? 'block' : 'none';

    if (isAdminSrez) {
        updateVariantsCount();
    }
}

// Обновление списка вариантов
function updateVariantsCount() {
    const count = parseInt(document.getElementById('srez-variants-count').value) || 2;
    const container = document.getElementById('srez-variants-list');

    let html = '<div style="display: flex; flex-wrap: wrap; gap: 8px;">';
    for (let i = 1; i <= count; i++) {
        const hasQuestions = importedSrezVariants[i] && importedSrezVariants[i].length > 0;
        const badgeStyle = hasQuestions
            ? 'background: var(--success); color: white;'
            : 'background: var(--primary); color: white;';
        const questionsInfo = hasQuestions ? ` (${importedSrezVariants[i].length} вопр.)` : '';
        html += `<span class="variant-badge" style="${badgeStyle} padding: 4px 12px; border-radius: 12px; font-size: 13px;">Вариант ${i}${questionsInfo}</span>`;
    }
    html += '</div>';
    container.innerHTML = html;
}

// Хранилище импортированных вариантов
// importedSrezVariants определена в state.js

// Скачивание шаблона Excel для вариантов
async function downloadSrezTemplate() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Система тестирования';
    workbook.created = new Date();

    const variantsCount = parseInt(document.getElementById('srez-variants-count').value) || 2;

    // Создаём листы для каждого варианта
    for (let v = 1; v <= variantsCount; v++) {
        const ws = workbook.addWorksheet(`Вариант ${v}`, {
            properties: { tabColor: { argb: 'FF6B4CE6' } }
        });

        // Заголовки
        ws.columns = [
            { header: 'Вопрос', key: 'question', width: 50 },
            { header: 'А', key: 'a', width: 25 },
            { header: 'Б', key: 'b', width: 25 },
            { header: 'В', key: 'c', width: 25 },
            { header: 'Г', key: 'd', width: 25 },
            { header: 'Правильный', key: 'correct', width: 12 }
        ];

        // Стили заголовков
        ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B4CE6' } };
        ws.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

        // Примеры вопросов
        ws.addRow({
            question: 'Пример вопроса 1?',
            a: 'Ответ А',
            b: 'Ответ Б',
            c: 'Ответ В',
            d: 'Ответ Г',
            correct: 'Б'
        });
        ws.addRow({
            question: 'Пример вопроса 2?',
            a: 'Вариант ответа',
            b: 'Другой вариант',
            c: 'Третий вариант',
            d: 'Четвёртый вариант',
            correct: 'А'
        });

        // Инструкция
        ws.addRow({});
        ws.addRow({ question: 'ИНСТРУКЦИЯ:', a: '', b: '', c: '', d: '', correct: '' });
        ws.addRow({ question: '1. В колонке "Вопрос" напишите текст вопроса', a: '', b: '', c: '', d: '', correct: '' });
        ws.addRow({ question: '2. В колонках А, Б, В, Г напишите варианты ответов', a: '', b: '', c: '', d: '', correct: '' });
        ws.addRow({ question: '3. В колонке "Правильный" укажите букву правильного ответа (А, Б, В или Г)', a: '', b: '', c: '', d: '', correct: '' });
        ws.addRow({ question: '4. Удалите эти примеры и инструкцию перед загрузкой', a: '', b: '', c: '', d: '', correct: '' });

        // Стили инструкции
        for (let row = 4; row <= 8; row++) {
            ws.getRow(row).font = { italic: true, color: { argb: 'FF888888' } };
        }
    }

    // Скачиваем
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Шаблон_варианты_${variantsCount}шт.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
}

// Импорт вариантов из Excel
async function importSrezVariants(input) {
    const file = input.files[0];
    if (!file) return;

    const statusEl = document.getElementById('srez-import-status');
    statusEl.innerHTML = '<span style="color: #888;">Загрузка...</span>';

    try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);

        importedSrezVariants = {};
        let totalQuestions = 0;
        let variantsFound = 0;

        workbook.eachSheet((worksheet, sheetId) => {
            const sheetName = worksheet.name;
            // Определяем номер варианта из названия листа
            const variantMatch = sheetName.match(/(\d+)/);
            const variantNumber = variantMatch ? parseInt(variantMatch[1]) : sheetId;

            const questions = [];

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Пропускаем заголовок

                const questionText = row.getCell(1).value?.toString().trim();
                const answerA = row.getCell(2).value?.toString().trim();
                const answerB = row.getCell(3).value?.toString().trim();
                const answerC = row.getCell(4).value?.toString().trim();
                const answerD = row.getCell(5).value?.toString().trim();
                const correctLetter = row.getCell(6).value?.toString().trim().toUpperCase();

                // Пропускаем пустые строки и инструкции
                if (!questionText || !answerA || questionText.startsWith('ИНСТРУКЦИЯ') ||
                    questionText.startsWith('1.') || questionText.startsWith('2.') ||
                    questionText.startsWith('3.') || questionText.startsWith('4.')) {
                    return;
                }

                // Определяем индекс правильного ответа
                const letterToIndex = { 'А': 0, 'A': 0, 'Б': 1, 'B': 1, 'В': 2, 'V': 2, 'Г': 3, 'G': 3 };
                const correctIndex = letterToIndex[correctLetter];

                if (correctIndex === undefined) {
                    console.warn(`Неверная буква ответа: ${correctLetter} в строке ${rowNumber}`);
                    return;
                }

                const answers = [answerA, answerB, answerC, answerD].filter(a => a);

                questions.push({
                    text: questionText,
                    answers: answers.map((text, idx) => ({
                        text: text,
                        isCorrect: idx === correctIndex
                    })),
                    variant: variantNumber
                });
            });

            if (questions.length > 0) {
                importedSrezVariants[variantNumber] = questions;
                totalQuestions += questions.length;
                variantsFound++;
            }
        });

        if (variantsFound === 0) {
            statusEl.innerHTML = '<span style="color: var(--danger);">Не найдено вопросов. Проверьте формат файла.</span>';
            return;
        }

        // Обновляем количество вариантов
        document.getElementById('srez-variants-count').value = variantsFound;
        updateVariantsCount();

        statusEl.innerHTML = `<span style="color: var(--success);">Загружено: ${variantsFound} вариант(ов), ${totalQuestions} вопрос(ов)</span>`;

    } catch (error) {
        console.error('Ошибка импорта:', error);
        statusEl.innerHTML = `<span style="color: var(--danger);">Ошибка: ${error.message}</span>`;
    }

    input.value = '';
}

// Сохранение импортированных вопросов для адм. среза
async function saveImportedSrezQuestions(testId) {
    const disciplineId = adminState.currentDiscipline?.id;
    if (!disciplineId) return;

    let savedCount = 0;
    let errors = [];

    for (const [variantNumber, questions] of Object.entries(importedSrezVariants)) {
        for (const q of questions) {
            try {
                const questionData = {
                    text: q.text,
                    answers: q.answers,
                    disciplineId: disciplineId,
                    testId: testId,
                    variant: parseInt(variantNumber)
                };

                const result = await apiRequest('/questions', 'POST', questionData);
                if (result.success) {
                    savedCount++;
                } else {
                    errors.push(`Вариант ${variantNumber}: ${result.error || 'Ошибка'}`);
                }
            } catch (error) {
                errors.push(`Вариант ${variantNumber}: ${error.message}`);
            }
        }
    }

    if (savedCount > 0) {
        await showSuccess(`Сохранено ${savedCount} вопрос(ов) из Excel`);
    }
    if (errors.length > 0) {
        console.error('Ошибки при сохранении вопросов:', errors);
    }
}

function hideTestForm() {
    hideModal('test-form-modal');
    editingTestId = null;
    // Очищаем импортированные варианты при закрытии формы
    importedSrezVariants = {};
}

async function saveTest(e) {
    e.preventDefault();
    showLoading('Сохранение теста...');

    const availableFrom = document.getElementById('test-available-from').value;
    const availableUntil = document.getElementById('test-available-until').value;

    const isExamMode = document.getElementById('test-exam-mode').checked;
    const isAdminSrezMode = document.getElementById('test-admin-srez-mode').checked;

    const passwordValue = document.getElementById('test-password').value.trim();

    // Генерация списка вариантов для адм. среза
    let variants = [];
    if (isAdminSrezMode) {
        const variantsCount = parseInt(document.getElementById('srez-variants-count').value) || 2;
        for (let i = 1; i <= variantsCount; i++) {
            variants.push({ number: i, name: `Вариант ${i}` });
        }
    }

    // Получаем выбранные группы
    let selectedGroups = [];
    if (isExamMode) {
        const groupsInput = document.getElementById('test-selected-groups');
        selectedGroups = groupsInput.value ? JSON.parse(groupsInput.value) : [];
    } else if (isAdminSrezMode) {
        const groupsInput = document.getElementById('test-selected-groups-srez');
        selectedGroups = groupsInput.value ? JSON.parse(groupsInput.value) : [];
    }

    const data = {
        name: document.getElementById('test-name').value.trim(),
        disciplineId: adminState.currentDiscipline.id,
        topicId: adminState.currentTopic.id,
        password: passwordValue || null,
        timeLimit: parseInt(document.getElementById('test-time').value),
        questionsCount: parseInt(document.getElementById('test-questions-count').value),
        penaltyTime: parseInt(document.getElementById('test-penalty').value) || 0,
        questionTimeLimit: parseInt(document.getElementById('test-question-time-limit').value) || 0,
        isTrainingMode: document.getElementById('test-training-mode').checked,
        isExamMode: isExamMode,
        isAdminSrezMode: isAdminSrezMode,
        examSettings: isExamMode ? {
            maxAttempts: parseInt(document.getElementById('exam-max-attempts').value),
            passingGrade: parseInt(document.getElementById('exam-passing-grade').value)
        } : null,
        adminSrezSettings: isAdminSrezMode ? {
            maxAttempts: parseInt(document.getElementById('srez-max-attempts').value),
            variants: variants
        } : null,
        selectedGroups: selectedGroups, // Сохраняем ID выбранных групп
        availableFrom: availableFrom ? new Date(availableFrom).toISOString() : null,
        availableUntil: availableUntil ? new Date(availableUntil).toISOString() : null,
        hideResults: document.getElementById('test-hide-results').checked,
        skipGroup: document.getElementById('test-skip-group').checked,
        adaptiveMode: document.getElementById('test-adaptive-mode').checked,
        gradeScale: document.getElementById('test-custom-grade').checked ? (
            document.querySelector('input[name="grade-type"]:checked')?.value === 'pass'
                ? { passPercent: parseInt(document.getElementById('grade-pass-percent').value) || 80 }
                : {
                    grade5: parseInt(document.getElementById('grade-scale-5').value) || 90,
                    grade4: parseInt(document.getElementById('grade-scale-4').value) || 75,
                    grade3: parseInt(document.getElementById('grade-scale-3').value) || 51
                }
        ) : null
    };

    let result;
    let testId = editingTestId;
    if (editingTestId) {
        result = await apiRequest(`/tests/${editingTestId}`, 'PUT', data);
    } else {
        result = await apiRequest('/tests', 'POST', data);
        if (result.success && result.test) {
            testId = result.test.id;
        }
    }

    if (result.success) {
        // Если выбраны группы и это зачёт/срез - генерируем коды для студентов
        if ((isExamMode || isAdminSrezMode) && selectedGroups.length > 0 && testId) {
            await generateCodesForGroups(testId, selectedGroups, isAdminSrezMode ? variants : null);
        }

        // Если есть импортированные вопросы для адм. среза - сохраняем их
        if (isAdminSrezMode && Object.keys(importedSrezVariants).length > 0 && testId) {
            await saveImportedSrezQuestions(testId);
        }

        await loadAllData();
        hideLoading();
        hideTestForm();
        renderDisciplinesTab();

        // Очищаем импортированные варианты
        importedSrezVariants = {};
    } else {
        hideLoading();
        await showError(result.error || 'Ошибка сохранения');
    }
}

// Генерация кодов для студентов выбранных групп
async function generateCodesForGroups(testId, groupIds, variants = null) {
    for (const groupId of groupIds) {
        // Загружаем полную информацию о группе
        const groupResult = await apiRequest(`/groups/${groupId}`);
        if (!groupResult.success || !groupResult.group) continue;

        const group = groupResult.group;
        const students = group.students || [];

        if (students.length === 0) continue;

        // Подготавливаем участников
        const participants = students.map((student, index) => {
            const participant = {
                surname: student.fullName.split(' ')[0] || '',
                name: student.fullName.split(' ').slice(1).join(' ') || '',
                studentId: student.id,
                photoUrl: student.photoUrl || null
            };

            // Для адм. среза назначаем вариант
            if (variants && variants.length > 0) {
                participant.variant = variants[index % variants.length].number;
            }

            return participant;
        });

        // Отправляем запрос на создание участников
        const maxAttempts = variants ?
            parseInt(document.getElementById('srez-max-attempts').value) || 1 :
            parseInt(document.getElementById('exam-max-attempts').value) || 2;

        await apiRequest('/exam/participants', 'POST', {
            testId,
            group: group.name,
            maxAttempts,
            participants
        });
    }
}

// Модальное окно выбора групп
// selectedGroupsTemp определена в state.js

function showSelectGroupsModal() {
    const isAdminSrezMode = document.getElementById('test-admin-srez-mode').checked;
    const inputId = isAdminSrezMode ? 'test-selected-groups-srez' : 'test-selected-groups';
    const currentValue = document.getElementById(inputId).value;
    selectedGroupsTemp = currentValue ? JSON.parse(currentValue) : [];

    const groups = adminState.groups || [];

    const overlay = document.createElement('div');
    overlay.className = 'system-modal-overlay';
    overlay.id = 'select-groups-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) closeSelectGroupsModal(); };
    overlay.innerHTML = `
        <div class="system-modal" style="max-width: 600px;">
            <div class="system-modal-header" style="flex-direction: row; padding: 20px 24px;">
                <span class="system-modal-icon info" style="width: 48px; height: 48px; font-size: 1.3rem;">👥</span>
                <div style="flex: 1; text-align: left; margin-left: 16px;">
                    <h3 class="system-modal-title" style="margin: 0;">Выбор групп</h3>
                    <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: var(--text-light);">Отметьте группы для зачёта</p>
                </div>
                <button class="btn-close" onclick="closeSelectGroupsModal()" style="position: relative; right: auto; top: auto; transform: none;">&times;</button>
            </div>
            ${groups.length > 0 ? `
                <div style="padding: 0 24px 12px;">
                    <input type="text" id="groups-search-input" class="form-control" placeholder="Поиск группы..." oninput="filterGroupsInModal()" style="width: 100%;">
                </div>
            ` : ''}
            <div class="system-modal-body" style="text-align: left; padding: 0 24px 20px; max-height: 400px; overflow-y: auto;">
                ${groups.length === 0 ? `
                    <div class="empty-state" style="padding: 30px 0;">
                        <div style="font-size: 2.5rem; margin-bottom: 10px;">📭</div>
                        <p style="font-weight: 500;">${adminState.user?.role === 'admin' ? 'Нет созданных групп' : 'Нет назначенных групп'}</p>
                        <p class="hint" style="font-size: 0.85rem; color: var(--text-light);">${adminState.user?.role === 'admin' ? 'Создайте группы во вкладке "Группы"' : 'Обратитесь к администратору'}</p>
                    </div>
                ` : `
                    <div class="groups-select-grid" id="groups-select-container">
                        ${groups.map(g => `
                            <label class="group-select-card ${selectedGroupsTemp.includes(g.id) ? 'selected' : ''}" data-group-id="${g.id}" data-group-name="${g.name.toLowerCase()}">
                                <input type="checkbox" ${selectedGroupsTemp.includes(g.id) ? 'checked' : ''} onchange="toggleGroupSelection('${g.id}')">
                                <span class="group-checkbox-box"></span>
                                <div class="group-select-info">
                                    <span class="group-select-name">${escapeHtml(g.name)}</span>
                                    <span class="group-select-count">${g.studentsCount || 0} чел.</span>
                                </div>
                            </label>
                        `).join('')}
                    </div>
                `}
            </div>
            <div class="system-modal-footer" style="padding: 16px 24px; border-top: 1px solid var(--border);">
                <span style="flex: 1; font-size: 0.85rem; color: var(--text-light);">Выбрано: <strong id="groups-selected-count">${selectedGroupsTemp.length}</strong></span>
                <button class="btn btn-secondary" onclick="closeSelectGroupsModal()">Отмена</button>
                <button class="btn btn-primary" onclick="applyGroupSelection()">Применить</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function filterGroupsInModal() {
    const search = document.getElementById('groups-search-input').value.toLowerCase().trim();
    const cards = document.querySelectorAll('#groups-select-container .group-select-card');

    cards.forEach(card => {
        const name = card.dataset.groupName || '';
        card.style.display = name.includes(search) ? '' : 'none';
    });
}

function toggleGroupSelection(groupId) {
    const index = selectedGroupsTemp.indexOf(groupId);
    if (index > -1) {
        selectedGroupsTemp.splice(index, 1);
    } else {
        selectedGroupsTemp.push(groupId);
    }

    // Обновляем UI
    const card = document.querySelector(`.group-select-card[data-group-id="${groupId}"]`);
    if (card) {
        card.classList.toggle('selected', selectedGroupsTemp.includes(groupId));
    }

    // Обновляем счётчик
    const counter = document.getElementById('groups-selected-count');
    if (counter) counter.textContent = selectedGroupsTemp.length;
}

function applyGroupSelection() {
    const isAdminSrezMode = document.getElementById('test-admin-srez-mode').checked;
    const inputId = isAdminSrezMode ? 'test-selected-groups-srez' : 'test-selected-groups';
    const listId = isAdminSrezMode ? 'selected-groups-list-srez' : 'selected-groups-list';

    document.getElementById(inputId).value = JSON.stringify(selectedGroupsTemp);

    // Обновляем отображение выбранных групп
    const listContainer = document.getElementById(listId);
    if (selectedGroupsTemp.length === 0) {
        listContainer.innerHTML = '';
    } else {
        const selectedNames = selectedGroupsTemp.map(gId => {
            const group = adminState.groups.find(g => g.id === gId);
            return group ? group.name : '';
        }).filter(n => n);

        listContainer.innerHTML = `
            <div class="selected-groups-tags">
                ${selectedNames.map(name => `<span class="group-tag">${escapeHtml(name)}</span>`).join('')}
            </div>
        `;
    }

    closeSelectGroupsModal();
}

function closeSelectGroupsModal() {
    const overlay = document.getElementById('select-groups-overlay');
    if (overlay) overlay.remove();
}

async function editTest(id) {
    const test = adminState.tests.find(t => String(t.id) === String(id));
    if (test) {
        showLoading('Загрузка теста...');
        // Небольшая задержка чтобы показать индикатор
        await new Promise(r => setTimeout(r, 100));
        hideLoading();
        showTestForm(test);
    }
}

async function toggleTest(id, btn = null) {
    const test = adminState.tests.find(t => String(t.id) === String(id));
    if (!test) return;

    // Находим кнопку если не передана
    if (!btn) {
        btn = event?.target;
    }
    const originalText = btn?.textContent;
    if (btn) {
        btn.disabled = true;
        btn.textContent = '...';
    }

    try {
        await apiRequest(`/tests/${id}`, 'PUT', { isActive: !test.isActive });
        await loadAllData();
        renderDisciplinesTab();
        await showSuccess(test.isActive ? 'Тест отключён' : 'Тест включён');
    } catch (e) {
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
}

async function deleteTest(id) {
    await apiRequest(`/tests/${id}`, 'DELETE');

    // Очищаем currentTestForQuestions если удалённый тест был выбран
    if (currentTestForQuestions && String(currentTestForQuestions.id) === String(id)) {
        currentTestForQuestions = null;
        currentQuestionsData = [];
    }

    await loadAllData();
    renderDisciplinesTab();
}

async function copyTestLink(link) {
    const fullUrl = `${window.location.origin}/start`;
    try {
        await navigator.clipboard.writeText(fullUrl);
        await showSuccess('Ссылка скопирована!');
    } catch (e) {
        await showAlert('Скопируйте ссылку: ' + fullUrl);
    }
}

// Переход к результатам конкретного теста
async function goToTestResults(testId) {
    const resultsTab = document.querySelector('.admin-tab[data-tab="results"]');
    if (!resultsTab) return;

    // Находим тест и его дисциплину для предустановки фильтров
    const test = adminState.tests.find(t => String(t.id) === String(testId));
    const disciplineId = test ? String(test.disciplineId || '') : '';

    // Предустанавливаем фильтры в состояние ДО рендера вкладки
    adminState.resultsFilters = {
        fio: '',
        groups: [],
        discipline: disciplineId,
        test: String(testId),
        testType: ''
    };

    // Убираем active со всех вкладок
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));

    // Активируем вкладку результатов
    resultsTab.classList.add('active');
    document.getElementById('tab-results').classList.add('active');

    // Загружаем контент — renderResultsTab() подхватит adminState.resultsFilters
    // через restoreResultsFilters() и применит их автоматически
    await renderResultsTab();
}

// ============================================
// МОДАЛЬНОЕ ОКНО ДОСТУПА (Ссылка + QR-код)
// ============================================

function showTestAccessModal(testId) {
    const test = adminState.tests.find(t => String(t.id) === String(testId));
    if (!test) return;

    // Для админ среза - ссылка на /srez, для остального - /test/xxx
    const fullUrl = test.isAdminSrezMode
        ? `${window.location.origin}/srez`
        : `${window.location.origin}/start`;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(fullUrl)}`;

    // Для админ среза показываем другую информацию
    const accessInfo = test.isAdminSrezMode
        ? `<div class="access-info" style="background: #dbeafe; border-color: #3b82f6;">
            <p style="color: #1e40af;"><strong>Режим:</strong> Административный срез</p>
            <p style="color: #1e40af;">Студенты входят по 5-значному коду с карточки</p>
            <p><strong>Статус:</strong> ${test.isActive ? '✅ Активен' : '❌ Отключён'}</p>
           </div>`
        : `<div class="access-info">
            <p><strong>Статус:</strong> ${test.isActive ? '✅ Активен' : '❌ Отключён'}</p>
            ${test.availableFrom ? `<p><strong>Доступен с:</strong> ${formatDateTime(test.availableFrom)}</p>` : ''}
            ${test.availableUntil ? `<p><strong>Доступен до:</strong> ${formatDateTime(test.availableUntil)}</p>` : ''}
           </div>`;

    const content = document.getElementById('test-access-content');
    content.innerHTML = `
        <div class="access-modal-body">
            <h3>${test.name}</h3>

            <div class="access-section">
                <label>${test.isAdminSrezMode ? 'Ссылка для студентов:' : 'Ссылка на тест:'}</label>
                <div class="access-link-box">
                    <a href="${fullUrl}" target="_blank" class="access-link-clickable" title="Открыть в новой вкладке">${fullUrl}</a>
                    <button class="btn btn-secondary" onclick="copyAccessLink()" title="Копировать ссылку">📋</button>
                    <button class="btn btn-primary" onclick="window.open('${fullUrl}', '_blank')" title="Открыть в новой вкладке">↗️ Открыть</button>
                </div>
                <input type="hidden" id="access-link-input" value="${fullUrl}">
            </div>

            ${!test.isAdminSrezMode && !test.isExamMode && test.shortCode ? `
                <div class="access-section">
                    <label>Короткий код теста:</label>
                    <div class="access-link-box">
                        <span style="font-size: 1.4rem; font-weight: 700; letter-spacing: 3px; color: #1a1a2e; padding: 8px 16px; background: #f3f4f6; border-radius: 8px;">${test.shortCode}</span>
                        <button class="btn btn-secondary" onclick="copyShortCode('${test.shortCode}')">📋</button>
                    </div>
                    <p class="form-hint">Студенты могут ввести этот код на странице <a href="${window.location.origin}/start" target="_blank">/start</a></p>
                </div>
            ` : ''}

            ${test.password && !test.isAdminSrezMode ? `
                <div class="access-section">
                    <label>Пароль для входа:</label>
                    <div class="access-link-box">
                        <input type="text" id="access-password-input" value="${test.password}" readonly>
                        <button class="btn btn-secondary" onclick="copyAccessPassword()">📋</button>
                    </div>
                </div>
            ` : ''}

            <div class="access-section">
                <label>QR-код для быстрого доступа:</label>
                <div class="qr-code-box">
                    <img src="${qrApiUrl}" alt="QR код" id="qr-code-img">
                    <p class="form-hint">Студенты могут отсканировать этот код камерой телефона</p>
                </div>
                <div class="qr-actions">
                    <button class="btn btn-secondary" onclick="downloadQRCode('${test.name}')">💾 Скачать QR</button>
                    <button class="btn btn-secondary" onclick="printQRCode()">🖨️ Печать</button>
                </div>
            </div>

            ${accessInfo}
        </div>
    `;

    showModal('test-access-modal');
}

function hideTestAccessModal() {
    hideModal('test-access-modal');
}

async function copyAccessLink() {
    const input = document.getElementById('access-link-input');
    const url = input.value;

    try {
        await navigator.clipboard.writeText(url);
        await showSuccess('Ссылка скопирована!');
    } catch (err) {
        // Fallback для старых браузеров
        input.type = 'text';
        input.select();
        document.execCommand('copy');
        input.type = 'hidden';
        await showSuccess('Ссылка скопирована!');
    }
}

async function copyAccessPassword() {
    const input = document.getElementById('access-password-input');
    input.select();
    document.execCommand('copy');
    await showSuccess('Пароль скопирован!');
}

async function copyShortCode(code) {
    try {
        await navigator.clipboard.writeText(code);
        await showSuccess('Код скопирован!');
    } catch (err) {
        // Fallback
        const tempInput = document.createElement('input');
        tempInput.value = code;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        await showSuccess('Код скопирован!');
    }
}

function downloadQRCode(testName) {
    const img = document.getElementById('qr-code-img');
    const link = document.createElement('a');
    link.href = img.src;
    link.download = `QR_${testName.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}.png`;
    link.click();
}

function printQRCode() {
    const img = document.getElementById('qr-code-img');
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head><title>QR-код для теста</title></head>
        <body style="text-align: center; padding: 50px;">
            <h2>Отсканируйте для прохождения теста</h2>
            <img src="${img.src}" style="width: 300px; height: 300px;">
            <p>${document.getElementById('access-link-input').value}</p>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// ============================================
// ДУБЛИРОВАНИЕ ТЕСТА
// ============================================

// duplicatingTestId определена в state.js

function showDuplicateModal(testId) {
    const test = adminState.tests.find(t => String(t.id) === String(testId));
    if (!test) return;

    duplicatingTestId = testId;

    // Используем poolQuestionsCount из API (подсчитывается на сервере)
    const questionsCount = test.poolQuestionsCount || 0;

    const content = document.getElementById('duplicate-content');
    content.innerHTML = `
        <div class="duplicate-modal-body">
            <div class="duplicate-preview">
                <h3>Исходный тест: ${test.name}</h3>

                <div class="duplicate-settings">
                    <div class="setting-row">
                        <span class="setting-label">Время:</span>
                        <span class="setting-value">${test.timeLimit} мин</span>
                    </div>
                    <div class="setting-row">
                        <span class="setting-label">Штраф:</span>
                        <span class="setting-value">${test.penaltyTime || 0} мин</span>
                    </div>
                    <div class="setting-row">
                        <span class="setting-label">Вопросов в тесте:</span>
                        <span class="setting-value">${test.questionsCount}</span>
                    </div>
                    <div class="setting-row">
                        <span class="setting-label">Вопросов в пуле:</span>
                        <span class="setting-value">${questionsCount}</span>
                    </div>
                    ${test.password ? `
                        <div class="setting-row">
                            <span class="setting-label">Пароль:</span>
                            <span class="setting-value">${test.password}</span>
                        </div>
                    ` : ''}
                    ${test.availableFrom ? `
                        <div class="setting-row">
                            <span class="setting-label">Доступен с:</span>
                            <span class="setting-value">${formatDateTime(test.availableFrom)}</span>
                        </div>
                    ` : ''}
                    ${test.availableUntil ? `
                        <div class="setting-row">
                            <span class="setting-label">Доступен до:</span>
                            <span class="setting-value">${formatDateTime(test.availableUntil)}</span>
                        </div>
                    ` : ''}
                </div>
            </div>

            <div class="form-group">
                <label>Название нового теста *</label>
                <input type="text" id="duplicate-name" value="${test.name} (копия)" required>
            </div>

            <div class="form-group">
                <label>
                    <input type="checkbox" id="duplicate-questions" checked>
                    Скопировать все вопросы (${questionsCount} шт.)
                </label>
            </div>

            <div class="form-group">
                <label>
                    <input type="checkbox" id="duplicate-reset-schedule">
                    Сбросить расписание доступа
                </label>
            </div>

            <div class="form-actions">
                <button class="btn btn-secondary" onclick="hideDuplicateModal()">Отмена</button>
                <button class="btn btn-primary" id="btn-execute-duplicate" onclick="executeDuplicate()">📑 Дублировать</button>
            </div>
        </div>
    `;

    showModal('duplicate-modal');
}

function hideDuplicateModal() {
    hideModal('duplicate-modal');
    duplicatingTestId = null;
}

async function executeDuplicate() {
    if (!duplicatingTestId) return;

    const test = adminState.tests.find(t => String(t.id) === String(duplicatingTestId));
    if (!test) return;

    const newName = document.getElementById('duplicate-name').value.trim();
    const copyQuestions = document.getElementById('duplicate-questions').checked;
    const resetSchedule = document.getElementById('duplicate-reset-schedule').checked;

    if (!newName) {
        await showError('Введите название теста');
        return;
    }

    // Блокируем кнопку и показываем загрузку
    const btn = document.getElementById('btn-execute-duplicate');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Дублирование...';
    }
    showLoading('Дублирование теста...');

    // Создаём копию теста
    const newTestData = {
        name: newName,
        disciplineId: test.disciplineId,
        topicId: test.topicId,
        password: null, // Новый тест без пароля
        timeLimit: test.timeLimit,
        questionsCount: test.questionsCount,
        penaltyTime: test.penaltyTime,
        availableFrom: resetSchedule ? null : test.availableFrom,
        availableUntil: resetSchedule ? null : test.availableUntil,
        isActive: false // Новый тест отключён по умолчанию
    };

    const result = await apiRequest('/tests', 'POST', newTestData);

    if (result.success && copyQuestions) {
        // Копируем вопросы со всеми полями
        const questionsResult = await apiRequest(`/questions?testId=${duplicatingTestId}`);
        if (questionsResult.success && questionsResult.questions.length > 0) {
            for (const q of questionsResult.questions) {
                await apiRequest('/questions', 'POST', {
                    disciplineId: q.disciplineId,
                    testId: result.test.id,
                    text: q.text,
                    type: q.type || 'single', // Тип вопроса
                    weight: q.weight || 1, // Вес вопроса
                    answers: q.answers,
                    pairs: q.pairs || null, // Для match вопросов
                    items: q.items || null, // Для sequence вопросов
                    correct: q.correct,
                    explanation: q.explanation || '',
                    section: q.section || '',
                    variant: q.variant || null, // Вариант для срезов
                    image: q.image || null // Изображение вопроса
                });
            }
        }
    }

    hideLoading();

    // Восстанавливаем кнопку
    if (btn) {
        btn.disabled = false;
        btn.textContent = '📑 Дублировать';
    }

    if (result.success) {
        await loadAllData();
        hideDuplicateModal();
        renderDisciplinesTab();
        await showSuccess('Тест успешно дублирован!');
    } else {
        await showError(result.error || 'Ошибка дублирования');
    }
}

// ============================================
// ПОДТВЕРЖДЕНИЕ УДАЛЕНИЯ ТЕСТА
// ============================================

// deletingTestId определена в state.js

function confirmDeleteTest(testId) {
    const test = adminState.tests.find(t => String(t.id) === String(testId));
    if (!test) return;

    deletingTestId = testId;

    const content = document.getElementById('delete-confirm-content');
    content.innerHTML = `
        <div class="delete-confirm-body">
            <div class="delete-warning-icon">⚠️</div>
            <p>Вы действительно хотите удалить тест:</p>
            <h3>"${test.name}"</h3>
            <p class="delete-warning">Все вопросы и результаты тестирования будут удалены безвозвратно!</p>

            <div class="form-actions" style="margin-top: 20px;">
                <button class="btn btn-secondary" onclick="hideDeleteConfirmModal()">Отмена</button>
                <button class="btn btn-danger" id="btn-execute-delete" onclick="executeDeleteTest()">🗑️ Удалить</button>
            </div>
        </div>
    `;

    showModal('delete-confirm-modal');
}

function hideDeleteConfirmModal() {
    hideModal('delete-confirm-modal');
    deletingTestId = null;
}

async function executeDeleteTest() {
    if (!deletingTestId) return;

    // Блокируем кнопку
    const btn = document.getElementById('btn-execute-delete');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Удаление...';
    }

    showLoading('Удаление теста...');
    await deleteTest(deletingTestId);
    hideLoading();
    hideDeleteConfirmModal();
    await showSuccess('Тест удалён');
}

