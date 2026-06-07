// ============================================
// ТАБ: ГРУППЫ
// ============================================

// Состояние сортировки групп
let groupsSortBy = 'name'; // 'name', 'course', 'building', 'students'
let groupsSortOrder = 'asc'; // 'asc', 'desc'

// Извлечение курса из названия группы
// Ищем 3 цифры подряд, ПЕРВАЯ цифра - номер курса (1-4)
function extractCourseFromGroupName(name) {
    const match = name.match(/(\d)(\d)(\d)/);
    if (match) {
        const firstDigit = parseInt(match[1]);
        if (firstDigit >= 1 && firstDigit <= 4) {
            return firstDigit;
        }
    }
    return 0; // Нет курса
}

// Извлечение учебного корпуса из названия группы
// Ищем 3 цифры подряд, ПОСЛЕДНЯЯ цифра - номер УК (1-4)
function extractBuildingFromGroupName(name) {
    const match = name.match(/(\d)(\d)(\d)/);
    if (match) {
        const lastDigit = parseInt(match[3]);
        if (lastDigit >= 1 && lastDigit <= 4) {
            return lastDigit;
        }
    }
    return 0; // Нет корпуса
}

// Сортировка групп
function sortGroups(groups) {
    return [...groups].sort((a, b) => {
        let cmp = 0;

        if (groupsSortBy === 'course') {
            const courseA = extractCourseFromGroupName(a.name);
            const courseB = extractCourseFromGroupName(b.name);
            cmp = courseA - courseB;
            // Если курс одинаковый - сортируем по имени
            if (cmp === 0) {
                cmp = a.name.localeCompare(b.name, 'ru');
            }
        } else if (groupsSortBy === 'building') {
            const buildingA = extractBuildingFromGroupName(a.name);
            const buildingB = extractBuildingFromGroupName(b.name);
            cmp = buildingA - buildingB;
            // Если корпус одинаковый - сортируем по имени
            if (cmp === 0) {
                cmp = a.name.localeCompare(b.name, 'ru');
            }
        } else if (groupsSortBy === 'students') {
            const countA = a.studentsCount ?? a.students?.length ?? 0;
            const countB = b.studentsCount ?? b.students?.length ?? 0;
            cmp = countA - countB;
        } else {
            // По умолчанию - по имени
            cmp = a.name.localeCompare(b.name, 'ru');
        }

        return groupsSortOrder === 'desc' ? -cmp : cmp;
    });
}

// Установка сортировки
function setGroupsSort(sortBy) {
    if (groupsSortBy === sortBy) {
        // Переключаем направление
        groupsSortOrder = groupsSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        groupsSortBy = sortBy;
        groupsSortOrder = 'asc';
    }
    renderGroupsTab();
}

async function renderGroupsTab() {
    const container = document.getElementById('tab-groups');
    const isAdmin = adminState.user?.role === 'admin';

    // Если данные ещё не загружены - показываем индикатор и загружаем
    if (!adminState.loaded.groups) {
        container.innerHTML = `
            <div class="loading-tab">
                <div class="loading-spinner"></div>
                <p>Загрузка групп...</p>
            </div>
        `;
        // Загружаем группы и пользователей параллельно (для отображения имён преподавателей)
        await Promise.all([
            loadGroupsLazy(),
            isAdmin ? loadUsersLazy() : Promise.resolve()
        ]);
    }

    // Если выбрана группа - показываем студентов
    if (adminState.currentGroup) {
        renderGroupStudents();
        return;
    }

    // Загружаем папки групп
    await loadFolders('groups');

    // Получаем папки для групп
    const groupFolders = (adminState.folders || []).filter(f => f.type === 'groups');
    const currentFolder = adminState.currentGroupFolder;

    // Иначе показываем список групп
    const groups = adminState.groups || [];
    const searchQuery = adminState.groupsSearchQuery || '';

    // Фильтруем группы по папке (персональные привязки)
    let displayGroups = groups;
    if (currentFolder === '__none__') {
        displayGroups = groups.filter(g => !getFolderIdForItem(g.id, 'groups'));
    } else if (currentFolder) {
        displayGroups = groups.filter(g => getFolderIdForItem(g.id, 'groups') === currentFolder.id);
    }
    // Если currentFolder === null - показываем ВСЕ группы

    // Считаем группы без папки (персональные привязки)
    const withoutFolderCount = groups.filter(g => !getFolderIdForItem(g.id, 'groups')).length;

    // Фильтруем группы по поиску
    let filteredGroups = searchQuery
        ? displayGroups.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : displayGroups;

    // Применяем сортировку
    filteredGroups = sortGroups(filteredGroups);

    // Иконки сортировки
    const sortIcon = (field) => {
        if (groupsSortBy !== field) return '';
        return groupsSortOrder === 'asc' ? ' ↑' : ' ↓';
    };

    container.innerHTML = `
        <div class="admin-section">
            <div class="section-header">
                <h2>Группы студентов</h2>
                <div class="header-actions">
                    ${isAdmin ? '<button class="btn btn-secondary" onclick="showFolderForm(\'groups\')">+ Папка</button>' : ''}
                    ${isAdmin ? '<button class="btn btn-secondary" onclick="showImportGroupsModal()">📥 Импорт</button>' : ''}
                    ${isAdmin ? '<button class="btn btn-danger-outline" onclick="showDeleteStudentFromSystemModal()" title="Полное удаление студента из системы">🗑️ Удалить студента</button>' : ''}
                    ${isAdmin ? '<button class="btn btn-primary" onclick="showCreateGroupModal()">+ Группа</button>' : ''}
                </div>
            </div>

            ${groupFolders.length > 0 ? `
                <div class="folder-tabs">
                    <div class="folder-tab ${!currentFolder ? 'active' : ''}" onclick="closeGroupFolder()">
                        <span class="folder-tab-icon">📋</span>
                        <span class="folder-tab-name">Все</span>
                        <span class="folder-tab-count">${groups.length}</span>
                    </div>
                    ${groupFolders.map(f => {
                        const count = groups.filter(g => getFolderIdForItem(g.id, 'groups') === f.id).length;
                        return `
                        <div class="folder-tab ${currentFolder?.id === f.id ? 'active' : ''}"
                             onclick="openGroupFolder('${f.id}')"
                             style="--folder-color: ${f.color || '#667eea'}">
                            <span class="folder-tab-icon">📁</span>
                            <span class="folder-tab-name">${escapeHtml(f.name)}</span>
                            <span class="folder-tab-count">${count}</span>
                            ${isAdmin ? `
                            <div class="folder-tab-actions" onclick="event.stopPropagation()">
                                <button class="folder-tab-btn" onclick="editFolder('${f.id}')" title="Редактировать">✏️</button>
                                <button class="folder-tab-btn danger" onclick="deleteFolder('${f.id}')" title="Удалить">×</button>
                            </div>
                            ` : ''}
                        </div>
                    `}).join('')}
                    ${withoutFolderCount > 0 ? `
                    <div class="folder-tab ${currentFolder === '__none__' ? 'active' : ''}" onclick="openGroupFolder('__none__')">
                        <span class="folder-tab-icon">📄</span>
                        <span class="folder-tab-name">Без папки</span>
                        <span class="folder-tab-count">${withoutFolderCount}</span>
                    </div>
                    ` : ''}
                </div>
            ` : ''}

            <div class="search-bar groups-search-bar">
                <input type="text" id="groups-search" placeholder="Поиск по названию группы..."
                       value="${escapeHtml(searchQuery)}" oninput="filterGroups(this.value)"
                       class="groups-search-input">
                ${searchQuery ? `<span class="groups-count-span">Найдено: ${filteredGroups.length} из ${displayGroups.length}</span>` : ''}
            </div>

            <div class="sort-bar">
                <span class="sort-label">Сортировка:</span>
                <button class="sort-btn ${groupsSortBy === 'name' ? 'active' : ''}" onclick="setGroupsSort('name')">
                    По названию${sortIcon('name')}
                </button>
                <button class="sort-btn ${groupsSortBy === 'course' ? 'active' : ''}" onclick="setGroupsSort('course')">
                    По курсу${sortIcon('course')}
                </button>
                <button class="sort-btn ${groupsSortBy === 'building' ? 'active' : ''}" onclick="setGroupsSort('building')">
                    По УК${sortIcon('building')}
                </button>
                <button class="sort-btn ${groupsSortBy === 'students' ? 'active' : ''}" onclick="setGroupsSort('students')">
                    По студентам${sortIcon('students')}
                </button>
            </div>

            ${isAdmin && filteredGroups.length > 0 && groupFolders.length > 0 ? `
                <div class="bulk-select-bar">
                    <label class="checkbox-label">
                        <input type="checkbox" id="select-all-groups" onchange="toggleAllGroups(this.checked)">
                        <span>Выбрать все</span>
                    </label>
                    <div class="folder-move-group">
                        <select id="move-groups-to-folder-select" class="folder-select">
                            <option value="">📁 Выберите папку...</option>
                            ${groupFolders.map(f => `
                                <option value="${f.id}">📁 ${escapeHtml(f.name)}</option>
                            `).join('')}
                            <option value="__none__">📄 Убрать из папки</option>
                        </select>
                        <button class="btn btn-primary btn-sm" onclick="moveSelectedGroupsToFolderFromSelect()">
                            Переместить
                        </button>
                    </div>
                    <button class="btn btn-danger btn-sm btn-delete-selected-groups" id="btn-delete-selected-groups" onclick="deleteSelectedGroups()" style="display: none;">
                        Удалить (<span id="selected-groups-count">0</span>)
                    </button>
                </div>
            ` : ''}

            ${filteredGroups.length === 0 ? `
                <div class="empty-state">
                    <p>${searchQuery ? 'Группы не найдены' : (currentFolder ? 'Папка пуста' : (isAdmin ? 'Нет созданных групп' : 'Нет назначенных групп'))}</p>
                    <p class="hint">${searchQuery ? 'Попробуйте изменить запрос поиска' : (currentFolder ? 'Переместите группы в эту папку' : (isAdmin ? 'Создайте группу и добавьте студентов' : 'Обратитесь к администратору для назначения групп'))}</p>
                </div>
            ` : `
                <div class="groups-grid">
                    ${filteredGroups.map(g => `
                        <div class="group-card ${isAdmin ? 'has-checkbox' : ''}" onclick="selectGroup('${g.id}')">
                            ${isAdmin ? `
                                <input type="checkbox" class="group-select" data-id="${g.id}"
                                       onclick="event.stopPropagation(); updateGroupsSelection()"
                                       title="Выбрать для перемещения">
                            ` : ''}
                            <div class="group-card-header">
                                <h3>${escapeHtml(g.name)}</h3>
                                ${isAdmin ? `
                                    <div class="group-actions" onclick="event.stopPropagation()">
                                        <button class="btn-icon" onclick="showAssignTeachersModal('${g.id}')" title="Назначить преподавателей">👥</button>
                                        <button class="btn-icon" onclick="showEditGroupModal('${g.id}')" title="Редактировать">✏️</button>
                                        <button class="btn-icon danger" onclick="deleteGroup('${g.id}')" title="Удалить">🗑️</button>
                                    </div>
                                ` : ''}
                            </div>
                            <div class="group-card-body">
                                <div class="group-stat">
                                    <span class="stat-value">${g.studentsCount ?? g.students?.length ?? 0}</span>
                                    <span class="stat-label">студентов</span>
                                </div>
                                ${isAdmin && g.assignedTeachers?.length > 0 ? `
                                    <div class="assigned-teachers">
                                        <span class="label">Преподаватели:</span>
                                        <span class="teachers">${g.assignedTeachers.map(username => {
                                            const user = (adminState.users || []).find(u => u.username === username);
                                            return user?.name || user?.displayName || username;
                                        }).join(', ')}</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `}
        </div>
    `;
}

// Папки групп
function openGroupFolder(folderId) {
    if (folderId === '__none__') {
        adminState.currentGroupFolder = '__none__';
        renderGroupsTab();
        return;
    }
    const folder = adminState.folders.find(f => f.id === folderId);
    if (folder) {
        adminState.currentGroupFolder = folder;
        renderGroupsTab();
    }
}

function closeGroupFolder() {
    adminState.currentGroupFolder = null;
    renderGroupsTab();
}

// Фильтрация групп по поисковому запросу с debounce
// groupsFilterTimeout определена в state.js
function filterGroups(query) {
    adminState.groupsSearchQuery = query;

    clearTimeout(groupsFilterTimeout);
    groupsFilterTimeout = setTimeout(() => {
        updateGroupsGridOnly();
    }, 150);
}

// Обновить только сетку групп без перерисовки всего таба
function updateGroupsGridOnly() {
    const groups = adminState.groups || [];
    const searchQuery = adminState.groupsSearchQuery || '';
    const isAdmin = adminState.user?.role === 'admin';

    const filteredGroups = searchQuery
        ? groups.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : groups;

    // Обновляем счётчик
    const searchBar = document.querySelector('#tab-groups .search-bar');
    if (searchBar) {
        let countSpan = searchBar.querySelector('.groups-count-span');
        if (searchQuery) {
            if (!countSpan) {
                countSpan = document.createElement('span');
                countSpan.className = 'groups-count-span';
                searchBar.appendChild(countSpan);
            }
            countSpan.textContent = `Найдено: ${filteredGroups.length} из ${groups.length}`;
        } else if (countSpan) {
            countSpan.remove();
        }
    }

    // Обновляем сетку
    const container = document.querySelector('#tab-groups .admin-section');
    if (!container) return;

    let gridEl = container.querySelector('.groups-grid');
    let emptyEl = container.querySelector('.empty-state');

    if (filteredGroups.length === 0) {
        if (gridEl) gridEl.remove();
        if (!emptyEl) {
            emptyEl = document.createElement('div');
            emptyEl.className = 'empty-state';
            container.appendChild(emptyEl);
        }
        emptyEl.innerHTML = `
            <p>${searchQuery ? 'Группы не найдены' : (isAdmin ? 'Нет созданных групп' : 'Нет назначенных групп')}</p>
            <p class="hint">${searchQuery ? 'Попробуйте изменить запрос поиска' : (isAdmin ? 'Создайте группу и добавьте студентов' : 'Обратитесь к администратору')}</p>
        `;
    } else {
        if (emptyEl) emptyEl.remove();
        if (!gridEl) {
            gridEl = document.createElement('div');
            gridEl.className = 'groups-grid';
            container.appendChild(gridEl);
        }
        gridEl.innerHTML = filteredGroups.map(g => `
            <div class="group-card" onclick="selectGroup('${g.id}')">
                <div class="group-card-header">
                    <h3>${escapeHtml(g.name)}</h3>
                    ${isAdmin ? `
                        <div class="group-actions" onclick="event.stopPropagation()">
                            <button class="btn-icon" onclick="showAssignTeachersModal('${g.id}')" title="Назначить преподавателей">👥</button>
                            <button class="btn-icon" onclick="showEditGroupModal('${g.id}')" title="Редактировать">✏️</button>
                            <button class="btn-icon danger" onclick="deleteGroup('${g.id}')" title="Удалить">🗑️</button>
                        </div>
                    ` : ''}
                </div>
                <div class="group-card-body">
                    <div class="group-stat">
                        <span class="stat-value">${g.studentsCount ?? g.students?.length ?? 0}</span>
                        <span class="stat-label">студентов</span>
                    </div>
                    ${isAdmin && g.assignedTeachers?.length > 0 ? `
                        <div class="assigned-teachers">
                            <span class="label">Преподаватели:</span>
                            <span class="teachers">${g.assignedTeachers.map(username => {
                                const user = (adminState.users || []).find(u => u.username === username);
                                return user?.name || user?.displayName || username;
                            }).join(', ')}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }
}

// Выбор группы - показать студентов
async function selectGroup(groupId) {
    // Загружаем полные данные группы
    const result = await apiRequest(`/groups/${groupId}`);
    if (result.success) {
        adminState.currentGroup = result.group;
        renderGroupsTab();
    } else {
        showError('Не удалось загрузить группу');
    }
}

// Рендер списка студентов в группе
function renderGroupStudents() {
    const container = document.getElementById('tab-groups');
    const group = adminState.currentGroup;
    const isAdmin = adminState.user?.role === 'admin';

    if (!group) {
        renderGroupsTab();
        return;
    }

    const students = group.students || [];

    container.innerHTML = `
        <div class="admin-section">
            <div class="section-header">
                <div class="breadcrumb">
                    <a href="#" onclick="adminState.currentGroup = null; renderGroupsTab(); return false;">Группы</a>
                    <span class="separator">→</span>
                    <span class="current">${escapeHtml(group.name)}</span>
                </div>
                ${isAdmin ? `
                    <div class="header-actions">
                        <button class="btn btn-secondary" onclick="showImportStudentsModal('${group.id}')">📄 Импорт из TXT</button>
                        <button class="btn btn-primary" onclick="showAddStudentModal('${group.id}')">+ Добавить студента</button>
                    </div>
                ` : ''}
            </div>

            ${students.length === 0 ? `
                <div class="empty-state">
                    <p>В группе нет студентов</p>
                    <p class="hint">${isAdmin ? 'Добавьте студентов вручную или импортируйте из TXT файла' : 'Студенты ещё не добавлены'}</p>
                </div>
            ` : `
                ${isAdmin ? `
                    <div class="students-bulk-actions hidden" id="students-bulk-actions">
                        <label class="checkbox-label">
                            <input type="checkbox" id="select-all-students" onchange="toggleSelectAllStudents('${group.id}')">
                            <span>Выбрать всех</span>
                        </label>
                        <span class="selected-count" id="selected-students-count">0 выбрано</span>
                        <button class="btn btn-danger btn-sm" onclick="deleteSelectedStudents('${group.id}')">🗑️ Удалить выбранных</button>
                    </div>
                ` : ''}
                <div class="students-list">
                    ${students.map((s, index) => `
                        <div class="student-card" data-student-id="${s.id}">
                            ${isAdmin ? `
                                <input type="checkbox" class="student-checkbox" data-id="${s.id}" onchange="updateStudentsSelection('${group.id}')">
                            ` : ''}
                            <div class="student-photo" onclick="showPhotoModal('${group.id}', '${s.id}')" title="Добавить/изменить фото">
                                ${s.photoUrl ? `<img src="${s.photoUrl}" alt="Фото">` : '<span class="no-photo">📷</span>'}
                            </div>
                            <div class="student-info">
                                <span class="student-number">${index + 1}.</span>
                                <span class="student-name">${escapeHtml(s.fullName)}</span>
                            </div>
                            ${isAdmin ? `
                                <div class="student-actions">
                                    <button class="btn-icon" onclick="showEditStudentModal('${group.id}', '${s.id}')" title="Редактировать">✏️</button>
                                    <button class="btn-icon danger" onclick="deleteStudent('${group.id}', '${s.id}')" title="Удалить">🗑️</button>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            `}
        </div>
    `;
}

// Модальное окно создания группы
function showCreateGroupModal() {
    const overlay = document.createElement('div');
    overlay.className = 'system-modal-overlay';
    overlay.innerHTML = `
        <div class="system-modal" style="max-width: 550px;">
            <div class="system-modal-header">
                <span class="system-modal-icon info">📁</span>
                <h3 class="system-modal-title">Создать группу</h3>
            </div>
            <div class="system-modal-body" style="text-align: left;">
                <div class="form-group">
                    <label>Название группы *</label>
                    <input type="text" id="group-name" placeholder="Например: ИС-21" class="form-control" style="margin-top: 8px;">
                </div>
                <div class="form-group" style="margin-top: 16px;">
                    <label>Список студентов (каждый с новой строки)</label>
                    <textarea id="group-students" rows="8" placeholder="Иванов Иван Иванович
Петров Пётр Петрович
Сидоров Сидор Сидорович" class="form-control" style="margin-top: 8px;"></textarea>
                    <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;">
                        <button type="button" class="btn btn-outline btn-sm" onclick="downloadGroupTemplate()">📥 Шаблон Excel</button>
                        <label class="btn btn-outline btn-sm" style="cursor: pointer; margin: 0;">
                            📤 Из Excel
                            <input type="file" accept=".xlsx,.xls" onchange="importGroupFromExcel(this)" class="hidden">
                        </label>
                    </div>
                    <p class="hint" style="margin-top: 8px;">Можете добавить студентов позже или импортировать из Excel/TXT</p>
                </div>
            </div>
            <div class="system-modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.system-modal-overlay').remove()">Отмена</button>
                <button class="btn btn-primary" onclick="createGroup()">Создать</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('group-name').focus();
}

// Создание группы
async function createGroup() {
    const name = document.getElementById('group-name').value.trim();
    const studentsText = document.getElementById('group-students').value;

    if (!name) {
        showError('Введите название группы');
        return;
    }

    showLoading('Создание группы...');

    // Парсим студентов
    const students = studentsText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(fullName => ({ fullName }));

    const result = await apiRequest('/groups', 'POST', { name, students });

    if (result.success) {
        await reloadGroups();
        hideLoading();
        document.querySelector('.system-modal-overlay')?.remove();
        renderGroupsTab();
        showSuccess(`Группа "${name}" создана`);
    } else {
        hideLoading();
        showError(result.error || 'Ошибка создания группы');
    }
}

// Скачивание шаблона Excel для группы
async function downloadGroupTemplate() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Система тестирования';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Студенты', {
        properties: { tabColor: { argb: 'FF4CAF50' } }
    });

    ws.columns = [
        { header: 'ФИО студента', key: 'fullName', width: 40 }
    ];

    // Стили заголовка
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4CAF50' } };
    ws.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // Примеры
    ws.addRow({ fullName: 'Иванов Иван Иванович' });
    ws.addRow({ fullName: 'Петров Пётр Петрович' });
    ws.addRow({ fullName: 'Сидоров Сидор Сидорович' });

    // Инструкция
    ws.addRow({});
    ws.addRow({ fullName: 'ИНСТРУКЦИЯ:' });
    ws.addRow({ fullName: '1. Введите ФИО каждого студента в отдельную строку' });
    ws.addRow({ fullName: '2. Удалите примеры и эту инструкцию' });
    ws.addRow({ fullName: '3. Сохраните файл и загрузите' });

    for (let row = 5; row <= 8; row++) {
        ws.getRow(row).font = { italic: true, color: { argb: 'FF888888' } };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Шаблон_группа.xlsx';
    a.click();
    URL.revokeObjectURL(a.href);
}

// Импорт студентов из Excel в форму создания группы
async function importGroupFromExcel(input) {
    const file = input.files[0];
    if (!file) return;

    try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);

        const students = [];
        const ws = workbook.worksheets[0];

        ws.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Пропускаем заголовок

            const fullName = row.getCell(1).value?.toString().trim();
            if (fullName && !fullName.startsWith('ИНСТРУКЦИЯ') &&
                !fullName.startsWith('1.') && !fullName.startsWith('2.') && !fullName.startsWith('3.')) {
                students.push(fullName);
            }
        });

        if (students.length > 0) {
            const textarea = document.getElementById('group-students');
            const existing = textarea.value.trim();
            textarea.value = existing ? existing + '\n' + students.join('\n') : students.join('\n');
            showSuccess(`Добавлено ${students.length} студент(ов)`);
        } else {
            showError('Не найдено студентов в файле');
        }
    } catch (error) {
        showError('Ошибка чтения файла: ' + error.message);
    }

    input.value = '';
}

// Модальное окно назначения преподавателей группе
async function showAssignTeachersModal(groupId) {
    const group = adminState.groups.find(g => String(g.id) === String(groupId));
    if (!group) return;

    // Загружаем полные данные группы с assignedTeachers
    const groupData = await apiRequest(`/groups/${groupId}`);
    const assignedTeachers = groupData.success ? (groupData.group.assignedTeachers || []) : [];

    // Убеждаемся, что пользователи загружены
    if (!adminState.loaded.users) {
        await loadUsersLazy();
    }

    // Получаем список преподавателей
    const teachers = (adminState.users || []).filter(u => u.role === 'teacher');

    const overlay = document.createElement('div');
    overlay.className = 'system-modal-overlay';
    overlay.innerHTML = `
        <div class="system-modal" style="max-width: 500px;">
            <div class="system-modal-header">
                <span class="system-modal-icon info">👥</span>
                <h3 class="system-modal-title">Назначить преподавателей</h3>
            </div>
            <div class="system-modal-body" style="text-align: left;">
                <p style="margin-bottom: 15px;">Группа: <strong>${escapeHtml(group.name)}</strong></p>
                ${teachers.length === 0 ? `
                    <div class="empty-state">
                        <p>Нет зарегистрированных преподавателей</p>
                    </div>
                ` : `
                    <div class="teachers-checkbox-list">
                        ${teachers.map(t => `
                            <label class="checkbox-item">
                                <input type="checkbox" value="${escapeHtml(t.username)}"
                                    ${assignedTeachers.includes(t.username) ? 'checked' : ''}>
                                <span>${escapeHtml(t.name || t.displayName || t.username)}</span>
                            </label>
                        `).join('')}
                    </div>
                `}
            </div>
            <div class="system-modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.system-modal-overlay').remove()">Отмена</button>
                <button class="btn btn-primary" onclick="saveAssignedTeachers('${groupId}')">Сохранить</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

// Сохранение назначенных преподавателей
async function saveAssignedTeachers(groupId) {
    const checkboxes = document.querySelectorAll('.teachers-checkbox-list input[type="checkbox"]:checked');
    const assignedTeachers = Array.from(checkboxes).map(cb => cb.value);

    const result = await apiRequest(`/groups/${groupId}`, 'PUT', { assignedTeachers });

    if (result.success) {
        document.querySelector('.system-modal-overlay')?.remove();
        await reloadGroups();
        renderGroupsTab();
        showSuccess('Преподаватели назначены');
    } else {
        showError(result.error || 'Ошибка сохранения');
    }
}

// Модальное окно редактирования группы
async function showEditGroupModal(groupId) {
    const group = adminState.groups.find(g => String(g.id) === String(groupId));
    if (!group) return;

    const overlay = document.createElement('div');
    overlay.className = 'system-modal-overlay';
    overlay.innerHTML = `
        <div class="system-modal" style="max-width: 450px;">
            <div class="system-modal-header">
                <span class="system-modal-icon info">✏️</span>
                <h3 class="system-modal-title">Редактировать группу</h3>
            </div>
            <div class="system-modal-body" style="text-align: left;">
                <div class="form-group">
                    <label>Название группы *</label>
                    <input type="text" id="edit-group-name" value="${escapeHtml(group.name)}" class="form-control" style="margin-top: 8px;">
                </div>
            </div>
            <div class="system-modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.system-modal-overlay').remove()">Отмена</button>
                <button class="btn btn-primary" onclick="updateGroup('${groupId}')">Сохранить</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('edit-group-name').focus();
}

// Обновление группы
async function updateGroup(groupId) {
    const name = document.getElementById('edit-group-name').value.trim();

    if (!name) {
        showError('Введите название группы');
        return;
    }

    showLoading('Сохранение...');
    const result = await apiRequest(`/groups/${groupId}`, 'PUT', { name });

    if (result.success) {
        await reloadGroups();
        hideLoading();
        document.querySelector('.system-modal-overlay')?.remove();
        renderGroupsTab();
        showSuccess('Группа обновлена');
    } else {
        hideLoading();
        showError(result.error || 'Ошибка обновления группы');
    }
}

// Удаление группы
async function deleteGroup(groupId) {
    const group = adminState.groups.find(g => String(g.id) === String(groupId));
    if (!group) return;

    const confirmed = await showConfirm(`Удалить группу "${group.name}"? Все студенты группы будут удалены.`);
    if (!confirmed) return;

    showLoading('Удаление группы...');
    const result = await apiRequest(`/groups/${groupId}`, 'DELETE');

    if (result.success) {
        await reloadGroups();
        hideLoading();
        renderGroupsTab();
        showSuccess('Группа удалена');
    } else {
        hideLoading();
        showError(result.error || 'Ошибка удаления группы');
    }
}

// Модальное окно импорта групп из файла
function showImportGroupsModal() {
    const overlay = document.createElement('div');
    overlay.className = 'system-modal-overlay';
    overlay.innerHTML = `
        <div class="system-modal" style="max-width: 600px;">
            <div class="system-modal-header">
                <span class="system-modal-icon info">📥</span>
                <h3 class="system-modal-title">Импорт групп из файла</h3>
            </div>
            <div class="system-modal-body" style="text-align: left;">
                <div class="form-group">
                    <label><strong>Формат файла TXT:</strong></label>
                    <p class="hint" style="margin: 8px 0;">Каждая группа начинается с названия в квадратных скобках, затем список студентов:</p>
                    <pre style="background: #f5f5f5; padding: 12px; border-radius: 8px; font-size: 13px; margin: 8px 0;">[ИС-21]
Иванов Иван Иванович
Петров Пётр Петрович

[ПР-22]
Сидоров Сидор Сидорович
Козлова Анна Сергеевна</pre>
                </div>
                <div class="form-group">
                    <label>Выберите файл или вставьте текст</label>
                    <input type="file" id="import-groups-file" accept=".txt" class="form-control" onchange="handleImportGroupsFile(this)" style="margin-top: 8px;">
                </div>
                <div class="form-group">
                    <label>Содержимое файла</label>
                    <textarea id="import-groups-text" rows="10" placeholder="[ИС-21]
Иванов Иван Иванович
Петров Пётр Петрович

[ПР-22]
Сидоров Сидор Сидорович" class="form-control" style="font-family: monospace; margin-top: 8px;"></textarea>
                </div>
            </div>
            <div class="system-modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.system-modal-overlay').remove()">Отмена</button>
                <button class="btn btn-primary" onclick="importGroupsFromText()">Импортировать</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

// Обработка файла импорта групп
function handleImportGroupsFile(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('import-groups-text').value = e.target.result;
    };
    reader.readAsText(file, 'UTF-8');
}

// Импорт групп из текста
async function importGroupsFromText() {
    const text = document.getElementById('import-groups-text').value.trim();
    if (!text) {
        showError('Введите данные для импорта');
        return;
    }

    // Парсим формат [Группа] + список студентов
    const lines = text.split('\n');
    const groups = [];
    let currentGroup = null;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Проверяем, является ли строка названием группы [Группа]
        const groupMatch = trimmed.match(/^\[(.+)\]$/);
        if (groupMatch) {
            if (currentGroup && currentGroup.students.length > 0) {
                groups.push(currentGroup);
            }
            currentGroup = {
                name: groupMatch[1].trim(),
                students: []
            };
        } else if (currentGroup) {
            // Это студент
            currentGroup.students.push({ fullName: trimmed });
        }
    }

    // Добавляем последнюю группу
    if (currentGroup && currentGroup.students.length > 0) {
        groups.push(currentGroup);
    }

    if (groups.length === 0) {
        showError('Не найдено групп для импорта. Проверьте формат: [Название группы]');
        return;
    }

    // Создаём группы
    let created = 0;
    let studentsAdded = 0;

    for (const group of groups) {
        const result = await apiRequest('/groups', 'POST', {
            name: group.name,
            students: group.students
        });

        if (result.success) {
            created++;
            studentsAdded += group.students.length;
        }
    }

    document.querySelector('.system-modal-overlay').remove();
    await reloadGroups();
    renderGroupsTab();
    showSuccess(`Импортировано групп: ${created}, студентов: ${studentsAdded}`);
}

// Модальное окно импорта студентов из TXT
function showImportStudentsModal(groupId) {
    const overlay = document.createElement('div');
    overlay.className = 'system-modal-overlay';
    overlay.innerHTML = `
        <div class="system-modal" style="max-width: 550px;">
            <div class="system-modal-header">
                <span class="system-modal-icon info">📄</span>
                <h3 class="system-modal-title">Импорт студентов из TXT</h3>
            </div>
            <div class="system-modal-body" style="text-align: left;">
                <div class="form-group">
                    <label>Выберите файл или вставьте текст</label>
                    <input type="file" id="import-file" accept=".txt" class="form-control" onchange="handleImportFile(this)" style="margin-top: 8px;">
                </div>
                <div class="form-group" style="margin-top: 16px;">
                    <label>Список студентов (каждый ФИО с новой строки)</label>
                    <textarea id="import-text" rows="10" placeholder="Иванов Иван Иванович
Петров Пётр Петрович
Сидоров Сидор Сидорович" class="form-control" style="margin-top: 8px;"></textarea>
                </div>
            </div>
            <div class="system-modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.system-modal-overlay').remove()">Отмена</button>
                <button class="btn btn-primary" onclick="importStudents('${groupId}')">Импортировать</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

// Обработка загрузки файла
function handleImportFile(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('import-text').value = e.target.result;
    };
    reader.readAsText(file, 'UTF-8');
}

// Импорт студентов
async function importStudents(groupId) {
    const text = document.getElementById('import-text').value.trim();

    if (!text) {
        showError('Введите или загрузите список студентов');
        return;
    }

    const result = await apiRequest('/groups/import', 'POST', { groupId, text });

    if (result.success) {
        document.querySelector('.system-modal-overlay')?.remove();
        // Перезагружаем данные группы
        const groupResult = await apiRequest(`/groups/${groupId}`);
        if (groupResult.success) {
            adminState.currentGroup = groupResult.group;
        }
        await reloadGroups();
        renderGroupsTab();
        let message = `Импортировано студентов: ${result.imported}`;
        if (result.skipped > 0) {
            message += ` (пропущено дубликатов: ${result.skipped})`;
        }
        showSuccess(message);
    } else {
        showError(result.error || 'Ошибка импорта');
    }
}

// Модальное окно добавления студента
function showAddStudentModal(groupId) {
    const overlay = document.createElement('div');
    overlay.className = 'system-modal-overlay';
    overlay.innerHTML = `
        <div class="system-modal" style="max-width: 450px;">
            <div class="system-modal-header">
                <span class="system-modal-icon info">👤</span>
                <h3 class="system-modal-title">Добавить студента</h3>
            </div>
            <div class="system-modal-body" style="text-align: left;">
                <div class="form-group">
                    <label>ФИО студента *</label>
                    <input type="text" id="student-fullname" placeholder="Иванов Иван Иванович" class="form-control" style="margin-top: 8px;">
                </div>
            </div>
            <div class="system-modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.system-modal-overlay').remove()">Отмена</button>
                <button class="btn btn-primary" onclick="addStudent('${groupId}')">Добавить</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('student-fullname').focus();
}

// Добавление студента
async function addStudent(groupId) {
    const fullName = document.getElementById('student-fullname').value.trim();

    if (!fullName) {
        showError('Введите ФИО студента');
        return;
    }

    showLoading('Добавление студента...');
    const result = await apiRequest(`/groups/${groupId}/students`, 'POST', { fullName });

    if (result.success) {
        // Перезагружаем данные группы
        const groupResult = await apiRequest(`/groups/${groupId}`);
        if (groupResult.success) {
            adminState.currentGroup = groupResult.group;
        }
        await reloadGroups();
        hideLoading();
        document.querySelector('.system-modal-overlay')?.remove();
        renderGroupsTab();
        showSuccess('Студент добавлен');
    } else {
        hideLoading();
        showError(result.error || 'Ошибка добавления студента');
    }
}

// Модальное окно редактирования студента
function showEditStudentModal(groupId, studentId) {
    const group = adminState.currentGroup;
    if (!group) return;

    const student = group.students.find(s => String(s.id) === String(studentId));
    if (!student) return;

    const overlay = document.createElement('div');
    overlay.className = 'system-modal-overlay';
    overlay.innerHTML = `
        <div class="system-modal" style="max-width: 450px;">
            <div class="system-modal-header">
                <span class="system-modal-icon info">✏️</span>
                <h3 class="system-modal-title">Редактировать студента</h3>
            </div>
            <div class="system-modal-body" style="text-align: left;">
                <div class="form-group">
                    <label>ФИО студента *</label>
                    <input type="text" id="edit-student-fullname" value="${escapeHtml(student.fullName)}" class="form-control" style="margin-top: 8px;">
                </div>
            </div>
            <div class="system-modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.system-modal-overlay').remove()">Отмена</button>
                <button class="btn btn-primary" onclick="updateStudent('${groupId}', '${studentId}')">Сохранить</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('edit-student-fullname').focus();
}

// Обновление студента
async function updateStudent(groupId, studentId) {
    const fullName = document.getElementById('edit-student-fullname').value.trim();

    if (!fullName) {
        showError('Введите ФИО студента');
        return;
    }

    const result = await apiRequest(`/groups/${groupId}/students/${studentId}`, 'PUT', { fullName });

    if (result.success) {
        document.querySelector('.system-modal-overlay')?.remove();
        // Перезагружаем данные группы
        const groupResult = await apiRequest(`/groups/${groupId}`);
        if (groupResult.success) {
            adminState.currentGroup = groupResult.group;
        }
        renderGroupsTab();
        showSuccess('Студент обновлён');
    } else {
        showError(result.error || 'Ошибка обновления');
    }
}

// Обновление выбора студентов (показать/скрыть панель действий)
function updateStudentsSelection(groupId) {
    const allCheckboxes = document.querySelectorAll('.student-checkbox');
    const checked = document.querySelectorAll('.student-checkbox:checked');
    const bulkActions = document.getElementById('students-bulk-actions');
    const countEl = document.getElementById('selected-students-count');
    const selectAll = document.getElementById('select-all-students');

    if (bulkActions) {
        toggleElement(bulkActions, checked.length > 0);
    }
    if (countEl) {
        countEl.textContent = `${checked.length} выбрано`;
    }

    // Обновляем состояние "Выбрать все"
    if (selectAll) {
        selectAll.checked = allCheckboxes.length > 0 && checked.length === allCheckboxes.length;
        selectAll.indeterminate = checked.length > 0 && checked.length < allCheckboxes.length;
    }
}

// Выбрать/снять выбор со всех студентов
function toggleSelectAllStudents(groupId) {
    const selectAll = document.getElementById('select-all-students');
    const checkboxes = document.querySelectorAll('.student-checkbox');

    checkboxes.forEach(cb => {
        cb.checked = selectAll.checked;
    });

    updateStudentsSelection(groupId);
}

// Массовое удаление выбранных студентов
async function deleteSelectedStudents(groupId) {
    const checkboxes = document.querySelectorAll('.student-checkbox:checked');
    const studentIds = Array.from(checkboxes).map(cb => cb.dataset.id);

    if (studentIds.length === 0) {
        showError('Не выбраны студенты для удаления');
        return;
    }

    const confirmed = await showConfirm(`Удалить ${studentIds.length} студентов? Это действие нельзя отменить.`);
    if (!confirmed) return;

    // Удаляем студентов по одному
    let deleted = 0;
    for (const studentId of studentIds) {
        const result = await apiRequest(`/groups/${groupId}/students/${studentId}`, 'DELETE');
        if (result.success) deleted++;
    }

    // Перезагружаем данные группы
    const groupResult = await apiRequest(`/groups/${groupId}`);
    if (groupResult.success) {
        adminState.currentGroup = groupResult.group;
    }
    await reloadGroups();
    renderGroupsTab();
    showSuccess(`Удалено ${deleted} из ${studentIds.length} студентов`);
}

// Удаление студента
async function deleteStudent(groupId, studentId) {
    const group = adminState.currentGroup;
    if (!group) return;

    const student = group.students.find(s => String(s.id) === String(studentId));
    if (!student) return;

    const confirmed = await showConfirm(`Удалить студента "${student.fullName}"?`);
    if (!confirmed) return;

    const result = await apiRequest(`/groups/${groupId}/students/${studentId}`, 'DELETE');

    if (result.success) {
        // Перезагружаем данные группы
        const groupResult = await apiRequest(`/groups/${groupId}`);
        if (groupResult.success) {
            adminState.currentGroup = groupResult.group;
        }
        await reloadGroups();
        renderGroupsTab();
        showSuccess('Студент удалён');
    } else {
        showError(result.error || 'Ошибка удаления');
    }
}

// Модальное окно для фото студента
function showPhotoModal(groupId, studentId) {
    const group = adminState.currentGroup;
    if (!group) return;

    const student = group.students.find(s => String(s.id) === String(studentId));
    if (!student) return;

    const overlay = document.createElement('div');
    overlay.className = 'system-modal-overlay';
    overlay.id = 'photo-modal-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
        <div class="system-modal photo-modal-compact">
            <div class="photo-modal-header">
                <div class="photo-modal-title">
                    <span>📷</span>
                    <div>
                        <h3>Фото студента</h3>
                        <p>${escapeHtml(student.fullName)}</p>
                    </div>
                </div>
                <button class="btn-close" onclick="this.closest('.system-modal-overlay').remove()">&times;</button>
            </div>
            <div class="photo-modal-body">
                <!-- Превью фото -->
                <div id="photo-preview-section">
                    <div class="photo-preview-box">
                        ${student.photoUrl ?
                            `<img src="${student.photoUrl}" id="current-photo" alt="Фото">` :
                            `<div class="photo-empty"><span>👤</span><p>Фото не загружено</p></div>`
                        }
                    </div>
                    <div class="photo-buttons">
                        <label class="photo-btn photo-btn-primary">
                            <span>📁</span> Загрузить
                            <input type="file" accept="image/*" style="display:none" onchange="handlePhotoFile(this, '${groupId}', '${studentId}')">
                        </label>
                        <button class="photo-btn" onclick="startWebcam('${groupId}', '${studentId}')">
                            <span>📸</span> Камера
                        </button>
                        ${student.photoUrl ? `
                        <button class="photo-btn photo-btn-danger" onclick="removePhoto('${groupId}', '${studentId}')">
                            <span>🗑️</span> Удалить
                        </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Webcam -->
                <div id="webcam-container" style="display:none;">
                    <video id="webcam-video" autoplay playsinline></video>
                    <div class="photo-buttons">
                        <button class="photo-btn photo-btn-primary" onclick="capturePhoto('${groupId}', '${studentId}')">📸 Снять</button>
                        <button class="photo-btn" onclick="stopWebcam()">Отмена</button>
                    </div>
                </div>

                <!-- Crop -->
                <div id="crop-container" style="display:none;">
                    <div class="crop-wrapper">
                        <canvas id="crop-canvas"></canvas>
                        <div class="crop-box" id="crop-box">
                            <div class="crop-corner crop-corner-nw"></div>
                            <div class="crop-corner crop-corner-ne"></div>
                            <div class="crop-corner crop-corner-sw"></div>
                            <div class="crop-corner crop-corner-se"></div>
                        </div>
                    </div>
                    <div class="crop-slider-row">
                        <button type="button" class="crop-size-btn" onclick="changeCropSize(-10)">−</button>
                        <input type="range" id="crop-size-slider" min="20" max="100" value="70" oninput="updateCropSize(this.value)">
                        <button type="button" class="crop-size-btn" onclick="changeCropSize(10)">+</button>
                        <span id="crop-size-value" class="crop-size-label">70%</span>
                    </div>
                    <div class="photo-buttons">
                        <button class="photo-btn photo-btn-primary" onclick="applyCrop('${groupId}', '${studentId}')">✓ Сохранить</button>
                        <button class="photo-btn" onclick="cancelCrop()">Отмена</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

// Обработка загруженного файла фото
function handlePhotoFile(input, groupId, studentId) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        showCropModal(e.target.result, groupId, studentId);
    };
    reader.readAsDataURL(file);
}

// Показ модального окна обрезки
function showCropModal(imageData, groupId, studentId) {
    window.cropData = { imageData, groupId, studentId };

    const container = document.getElementById('crop-container');
    showElement(container);

    const canvas = document.getElementById('crop-canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
        // Масштабируем для отображения (уменьшен для компактности)
        const maxSize = 280;
        let width = img.width;
        let height = img.height;

        if (width > maxSize || height > maxSize) {
            if (width > height) {
                height = (height / width) * maxSize;
                width = maxSize;
            } else {
                width = (width / height) * maxSize;
                height = maxSize;
            }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        window.cropData.img = img;
        window.cropData.scale = img.width / width;
        window.cropData.canvasWidth = width;
        window.cropData.canvasHeight = height;

        // Инициализируем область обрезки (квадрат в центре)
        const cropPercent = 70;
        const cropSize = Math.min(width, height) * (cropPercent / 100);
        const cropBox = document.getElementById('crop-box');
        cropBox.style.width = cropSize + 'px';
        cropBox.style.height = cropSize + 'px';
        cropBox.style.left = ((width - cropSize) / 2) + 'px';
        cropBox.style.top = ((height - cropSize) / 2) + 'px';

        // Сбрасываем слайдер
        const slider = document.getElementById('crop-size-slider');
        if (slider) {
            slider.value = cropPercent;
            document.getElementById('crop-size-value').textContent = cropPercent + '%';
        }

        initCropDrag(cropBox, canvas);
        initCropCornerResize(cropBox, canvas);
    };

    img.src = imageData;
}

// Инициализация перетаскивания области обрезки
function initCropDrag(cropBox, canvas) {
    let isDragging = false;
    let isResizing = false;
    let startX, startY, startLeft, startTop, startWidth, startHeight;

    cropBox.onmousedown = (e) => {
        if (e.target === cropBox) {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = cropBox.offsetLeft;
            startTop = cropBox.offsetTop;
        }
    };

    document.onmousemove = (e) => {
        if (isDragging) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            let newLeft = startLeft + dx;
            let newTop = startTop + dy;

            // Ограничиваем область
            newLeft = Math.max(0, Math.min(newLeft, canvas.width - cropBox.offsetWidth));
            newTop = Math.max(0, Math.min(newTop, canvas.height - cropBox.offsetHeight));

            cropBox.style.left = newLeft + 'px';
            cropBox.style.top = newTop + 'px';
        }
    };

    document.onmouseup = () => {
        isDragging = false;
        isResizing = false;
    };
}

// Обновление размера области обрезки через слайдер
function updateCropSize(percent) {
    const cropBox = document.getElementById('crop-box');
    const canvas = document.getElementById('crop-canvas');
    if (!cropBox || !canvas || !window.cropData) return;

    const { canvasWidth, canvasHeight } = window.cropData;
    const minDim = Math.min(canvasWidth, canvasHeight);
    const newSize = Math.max(30, minDim * (percent / 100));

    // Центрируем область обрезки относительно текущего центра
    const currentCenterX = cropBox.offsetLeft + cropBox.offsetWidth / 2;
    const currentCenterY = cropBox.offsetTop + cropBox.offsetHeight / 2;

    let newLeft = currentCenterX - newSize / 2;
    let newTop = currentCenterY - newSize / 2;

    // Ограничиваем область
    newLeft = Math.max(0, Math.min(newLeft, canvasWidth - newSize));
    newTop = Math.max(0, Math.min(newTop, canvasHeight - newSize));

    cropBox.style.width = newSize + 'px';
    cropBox.style.height = newSize + 'px';
    cropBox.style.left = newLeft + 'px';
    cropBox.style.top = newTop + 'px';

    document.getElementById('crop-size-value').textContent = Math.round(percent) + '%';
}

// Изменение размера кнопками +/-
function changeCropSize(delta) {
    const slider = document.getElementById('crop-size-slider');
    if (!slider) return;

    let newValue = parseInt(slider.value) + delta;
    newValue = Math.max(20, Math.min(100, newValue));
    slider.value = newValue;
    updateCropSize(newValue);
}

// Ресайз области обрезки за все 4 угла
function initCropCornerResize(cropBox, canvas) {
    const corners = cropBox.querySelectorAll('.crop-corner');
    if (!corners.length) return;

    let isResizing = false;
    let activeCorner = null;
    let startX, startY, startLeft, startTop, startSize;

    const onStart = (e, corner) => {
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        activeCorner = corner;
        const touch = e.touches ? e.touches[0] : e;
        startX = touch.clientX;
        startY = touch.clientY;
        startLeft = cropBox.offsetLeft;
        startTop = cropBox.offsetTop;
        startSize = cropBox.offsetWidth;
    };

    const onMove = (e) => {
        if (!isResizing || !activeCorner) return;
        e.preventDefault();

        const touch = e.touches ? e.touches[0] : e;
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        const { canvasWidth, canvasHeight } = window.cropData;
        const minDim = Math.min(canvasWidth, canvasHeight);

        let newSize = startSize;
        let newLeft = startLeft;
        let newTop = startTop;

        // В зависимости от угла меняем логику
        if (activeCorner.classList.contains('crop-corner-se')) {
            // Правый нижний - просто увеличиваем размер
            const delta = Math.max(dx, dy);
            newSize = startSize + delta;
        } else if (activeCorner.classList.contains('crop-corner-nw')) {
            // Левый верхний - уменьшаем и двигаем
            const delta = Math.min(dx, dy);
            newSize = startSize - delta;
            newLeft = startLeft + delta;
            newTop = startTop + delta;
        } else if (activeCorner.classList.contains('crop-corner-ne')) {
            // Правый верхний
            const delta = Math.max(dx, -dy);
            newSize = startSize + delta;
            newTop = startTop - delta;
        } else if (activeCorner.classList.contains('crop-corner-sw')) {
            // Левый нижний
            const delta = Math.max(-dx, dy);
            newSize = startSize + delta;
            newLeft = startLeft - delta;
        }

        // Ограничения размера
        newSize = Math.max(40, Math.min(newSize, minDim));

        // Ограничения позиции
        newLeft = Math.max(0, Math.min(newLeft, canvasWidth - newSize));
        newTop = Math.max(0, Math.min(newTop, canvasHeight - newSize));

        // Дополнительная проверка чтобы не выходило за границы
        if (newLeft + newSize > canvasWidth) newSize = canvasWidth - newLeft;
        if (newTop + newSize > canvasHeight) newSize = canvasHeight - newTop;

        cropBox.style.width = newSize + 'px';
        cropBox.style.height = newSize + 'px';
        cropBox.style.left = newLeft + 'px';
        cropBox.style.top = newTop + 'px';

        // Обновляем слайдер
        const percent = Math.round((newSize / minDim) * 100);
        const slider = document.getElementById('crop-size-slider');
        if (slider) {
            slider.value = Math.min(100, Math.max(20, percent));
        }
    };

    const onEnd = () => {
        isResizing = false;
        activeCorner = null;
    };

    corners.forEach(corner => {
        corner.addEventListener('mousedown', (e) => onStart(e, corner));
        corner.addEventListener('touchstart', (e) => onStart(e, corner), { passive: false });
    });

    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchend', onEnd);
}

// Применение обрезки
async function applyCrop(groupId, studentId) {
    const cropBox = document.getElementById('crop-box');
    const { img, scale } = window.cropData;

    // Координаты cropBox (относительно canvas, который имеет тот же размер что и визуально)
    const boxLeft = cropBox.offsetLeft;
    const boxTop = cropBox.offsetTop;
    const boxSize = cropBox.offsetWidth;

    // Переводим в координаты оригинального изображения (scale = img.width / canvas.width)
    const x = boxLeft * scale;
    const y = boxTop * scale;
    const size = boxSize * scale;

    // Создаём canvas для обрезанного изображения
    const cropCanvas = document.createElement('canvas');
    const targetSize = 300; // Размер выходного изображения
    cropCanvas.width = targetSize;
    cropCanvas.height = targetSize;

    const ctx = cropCanvas.getContext('2d');
    ctx.drawImage(img, x, y, size, size, 0, 0, targetSize, targetSize);

    // Конвертируем в JPEG с качеством 0.8
    const croppedData = cropCanvas.toDataURL('image/jpeg', 0.8);

    // Загружаем на сервер
    await uploadPhoto(groupId, studentId, croppedData);
}

// Отмена обрезки
function cancelCrop() {
    hideElement('crop-container');
    window.cropData = null;
}

// Загрузка фото на сервер
async function uploadPhoto(groupId, studentId, imageData) {
    const result = await apiRequest('/photos', 'POST', {
        imageData,
        groupId,
        studentId
    });

    if (result.success) {
        // Закрываем модальное окно
        const overlay = document.querySelector('.system-modal-overlay');
        if (overlay) overlay.remove();

        // Перезагружаем данные группы
        const groupResult = await apiRequest(`/groups/${groupId}`);
        if (groupResult.success) {
            adminState.currentGroup = groupResult.group;
        }
        renderGroupsTab();
        showSuccess('Фото сохранено');
    } else {
        showError(result.error || 'Ошибка загрузки фото');
    }
}

// Удаление фото
async function removePhoto(groupId, studentId) {
    const confirmed = await showConfirm('Удалить фото студента?');
    if (!confirmed) return;

    const result = await apiRequest(`/photos/${groupId}/${studentId}`, 'DELETE');

    if (result.success) {
        // Закрываем модальное окно
        const overlay = document.querySelector('.system-modal-overlay');
        if (overlay) overlay.remove();

        // Перезагружаем данные группы
        const groupResult = await apiRequest(`/groups/${groupId}`);
        if (groupResult.success) {
            adminState.currentGroup = groupResult.group;
        }
        renderGroupsTab();
        showSuccess('Фото удалено');
    } else {
        showError(result.error || 'Ошибка удаления фото');
    }
}

// Запуск веб-камеры
// webcamStream определена в state.js

async function startWebcam(groupId, studentId) {
    try {
        const container = document.getElementById('webcam-container');
        const video = document.getElementById('webcam-video');

        webcamStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        });

        video.srcObject = webcamStream;
        showElement(container);
    } catch (err) {
        showError('Не удалось получить доступ к камере');
    }
}

// Остановка веб-камеры
function stopWebcam() {
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }
    hideElement('webcam-container');
}

// Снимок с веб-камеры
function capturePhoto(groupId, studentId) {
    const video = document.getElementById('webcam-video');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.9);

    stopWebcam();
    showCropModal(imageData, groupId, studentId);
}

// ============================================
// ВЫБОР ГРУПП ДЛЯ ПАПОК
// ============================================

function toggleAllGroups(checked) {
    document.querySelectorAll('.group-select').forEach(cb => {
        cb.checked = checked;
    });
    updateGroupsSelection();
}

function updateGroupsSelection() {
    const selected = document.querySelectorAll('.group-select:checked');
    const count = selected.length;

    const deleteBtn = document.getElementById('btn-delete-selected-groups');
    const countSpan = document.getElementById('selected-groups-count');

    if (deleteBtn) {
        deleteBtn.style.display = count > 0 ? 'inline-flex' : 'none';
    }
    if (countSpan) {
        countSpan.textContent = count;
    }

    // Обновляем состояние "выбрать все"
    const selectAllCheckbox = document.getElementById('select-all-groups');
    const allCheckboxes = document.querySelectorAll('.group-select');
    if (selectAllCheckbox && allCheckboxes.length > 0) {
        selectAllCheckbox.checked = count === allCheckboxes.length;
        selectAllCheckbox.indeterminate = count > 0 && count < allCheckboxes.length;
    }
}

async function moveSelectedGroupsToFolderFromSelect() {
    const select = document.getElementById('move-groups-to-folder-select');
    const folderId = select?.value;

    if (!folderId) {
        await showError('Выберите папку');
        return;
    }

    const selected = document.querySelectorAll('.group-select:checked');
    if (selected.length === 0) {
        await showError('Выберите группы для перемещения');
        return;
    }

    const ids = Array.from(selected).map(cb => cb.dataset.id);

    // Показываем индикатор загрузки
    showLoading('Перемещение групп...');

    try {
        // Перемещаем группы
        for (const id of ids) {
            await apiRequest('/folders/items', 'POST', {
                itemId: id,
                folderId: folderId === '__none__' ? null : folderId,
                type: 'groups'
            });

            // Обновляем локально folderItems
            const existingIndex = adminState.folderItems.findIndex(fi => fi.itemId === id && fi.type === 'groups');
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
                    adminState.folderItems.push({ itemId: id, folderId: folderId, type: 'groups' });
                }
            }
        }

        select.value = '';
        renderGroupsTab();
        hideLoading();
        const action = folderId === '__none__' ? 'Убрано из папки' : 'Перемещено';
        await showSuccess(`${action}: ${ids.length}`);
    } catch (error) {
        hideLoading();
        await showError('Ошибка перемещения: ' + (error.message || 'неизвестная ошибка'));
    }
}

async function deleteSelectedGroups() {
    const selected = document.querySelectorAll('.group-select:checked');
    if (selected.length === 0) return;

    const confirmed = await showConfirm(`Удалить ${selected.length} групп(ы)? Все студенты в группах будут удалены.`);
    if (!confirmed) return;

    const ids = Array.from(selected).map(cb => cb.dataset.id);

    try {
        for (const id of ids) {
            await apiRequest(`/groups/${id}`, 'DELETE');
        }
        adminState.groups = adminState.groups.filter(g => !ids.includes(g.id));
        renderGroupsTab();
        await showSuccess(`Удалено: ${ids.length}`);
    } catch (error) {
        await showError('Ошибка удаления');
    }
}

// ============================================
// ПОЛНОЕ УДАЛЕНИЕ СТУДЕНТА ИЗ СИСТЕМЫ
// ============================================

// Показать модальное окно поиска и удаления студента
function showDeleteStudentFromSystemModal() {
    const overlay = document.createElement('div');
    overlay.className = 'system-modal-overlay';
    overlay.id = 'delete-student-modal';
    overlay.innerHTML = `
        <div class="system-modal" style="max-width: 700px;">
            <div class="system-modal-header">
                <span class="system-modal-icon warning">🗑️</span>
                <h3 class="system-modal-title">Полное удаление студента из системы</h3>
            </div>
            <div class="system-modal-body" style="text-align: left;">
                <div class="form-group">
                    <label><strong>Поиск студента по ФИО</strong></label>
                    <div style="display: flex; gap: 10px; margin-top: 8px;">
                        <input type="text" id="delete-student-search" placeholder="Введите фамилию или ФИО..."
                               class="form-control" style="flex: 1;" onkeyup="if(event.key==='Enter') searchStudentForDeletion()">
                        <button class="btn btn-primary" onclick="searchStudentForDeletion()">🔍 Найти</button>
                    </div>
                    <p class="hint" style="margin-top: 6px;">Минимум 2 символа. Поиск по всем местам: группы, участники тестов, результаты</p>
                </div>

                <div id="delete-student-results" class="hidden" style="margin-top: 20px;">
                    <div class="delete-student-summary" id="delete-student-summary"></div>
                    <div class="delete-student-list" id="delete-student-list" style="max-height: 300px; overflow-y: auto;"></div>

                    <div class="delete-student-options" style="margin-top: 16px; padding: 16px; background: #f8f9fa; border-radius: 8px;">
                        <h4 style="margin: 0 0 12px 0;">Выберите что удалить:</h4>
                        <label class="checkbox-item" style="margin-bottom: 8px;">
                            <input type="checkbox" id="del-from-groups" checked>
                            <span>📁 Удалить из групп студентов</span>
                        </label>
                        <label class="checkbox-item" style="margin-bottom: 8px;">
                            <input type="checkbox" id="del-from-exams" checked>
                            <span>📝 Удалить из участников экзаменов/тестов</span>
                        </label>
                        <label class="checkbox-item" style="margin-bottom: 8px;">
                            <input type="checkbox" id="del-from-srez" checked>
                            <span>📋 Удалить из участников срезов</span>
                        </label>
                        <label class="checkbox-item" style="margin-bottom: 8px; color: #dc3545;">
                            <input type="checkbox" id="del-results">
                            <span>⚠️ Удалить результаты тестов (необратимо!)</span>
                        </label>

                        <div class="form-group" style="margin-top: 12px;">
                            <label>Ограничить по группе (необязательно):</label>
                            <input type="text" id="delete-student-group" placeholder="Оставьте пустым для всех групп"
                                   class="form-control" style="margin-top: 4px;">
                        </div>
                    </div>
                </div>
            </div>
            <div class="system-modal-footer">
                <button class="btn btn-secondary" onclick="closeDeleteStudentModal()">Закрыть</button>
                <button class="btn btn-danger hidden" id="btn-confirm-delete-student" onclick="confirmDeleteStudentFromSystem()">
                    🗑️ Удалить из системы
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('delete-student-search').focus();
}

function closeDeleteStudentModal() {
    const modal = document.getElementById('delete-student-modal');
    if (modal) modal.remove();
}

// Поиск студента для удаления
async function searchStudentForDeletion() {
    const searchInput = document.getElementById('delete-student-search');
    const query = searchInput.value.trim();

    if (query.length < 2) {
        showError('Введите минимум 2 символа');
        return;
    }

    showLoading('Поиск...');

    const result = await apiRequest(`/students/search?q=${encodeURIComponent(query)}`);

    hideLoading();

    if (!result.success) {
        showError(result.error || 'Ошибка поиска');
        return;
    }

    const resultsContainer = document.getElementById('delete-student-results');
    const summaryEl = document.getElementById('delete-student-summary');
    const listEl = document.getElementById('delete-student-list');
    const deleteBtn = document.getElementById('btn-confirm-delete-student');

    if (result.found.length === 0) {
        resultsContainer.classList.remove('hidden');
        summaryEl.innerHTML = `<p style="color: #6b7280;">Студент "${escapeHtml(query)}" не найден в системе</p>`;
        listEl.innerHTML = '';
        deleteBtn.classList.add('hidden');
        return;
    }

    // Группируем результаты
    const byType = {
        group_student: result.found.filter(f => f.type === 'group_student'),
        exam_participant: result.found.filter(f => f.type === 'exam_participant'),
        srez_participant: result.found.filter(f => f.type === 'srez_participant'),
        result: result.found.filter(f => f.type === 'result')
    };

    resultsContainer.classList.remove('hidden');

    summaryEl.innerHTML = `
        <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 12px;">
            <div class="stat-chip">📁 В группах: <strong>${byType.group_student.length}</strong></div>
            <div class="stat-chip">📝 В экзаменах: <strong>${byType.exam_participant.length}</strong></div>
            <div class="stat-chip">📋 В срезах: <strong>${byType.srez_participant.length}</strong></div>
            <div class="stat-chip">📊 Результатов: <strong>${byType.result.length}</strong></div>
        </div>
        <p style="font-weight: 500;">Найдено записей: ${result.found.length}</p>
    `;

    let html = '';

    if (byType.group_student.length > 0) {
        html += `<div class="delete-section"><h5>📁 В группах студентов:</h5><ul>`;
        byType.group_student.slice(0, 10).forEach(s => {
            html += `<li>${escapeHtml(s.fullName)} — группа <strong>${escapeHtml(s.groupName)}</strong></li>`;
        });
        if (byType.group_student.length > 10) html += `<li>...и ещё ${byType.group_student.length - 10}</li>`;
        html += `</ul></div>`;
    }

    if (byType.exam_participant.length > 0) {
        html += `<div class="delete-section"><h5>📝 В участниках экзаменов:</h5><ul>`;
        byType.exam_participant.slice(0, 10).forEach(s => {
            html += `<li>${escapeHtml(s.fullName)} — группа <strong>${escapeHtml(s.groupName)}</strong> (${s.status || '?'})</li>`;
        });
        if (byType.exam_participant.length > 10) html += `<li>...и ещё ${byType.exam_participant.length - 10}</li>`;
        html += `</ul></div>`;
    }

    if (byType.srez_participant.length > 0) {
        html += `<div class="delete-section"><h5>📋 В участниках срезов:</h5><ul>`;
        byType.srez_participant.slice(0, 10).forEach(s => {
            html += `<li>${escapeHtml(s.fullName)} — группа <strong>${escapeHtml(s.groupName)}</strong> (${s.status || '?'})</li>`;
        });
        if (byType.srez_participant.length > 10) html += `<li>...и ещё ${byType.srez_participant.length - 10}</li>`;
        html += `</ul></div>`;
    }

    if (byType.result.length > 0) {
        html += `<div class="delete-section"><h5>📊 Результаты тестов:</h5><ul>`;
        byType.result.slice(0, 10).forEach(s => {
            html += `<li>${escapeHtml(s.fullName)} — группа <strong>${escapeHtml(s.groupName)}</strong>, оценка: ${s.grade || '?'} (${s.percentage || 0}%)</li>`;
        });
        if (byType.result.length > 10) html += `<li>...и ещё ${byType.result.length - 10}</li>`;
        html += `</ul></div>`;
    }

    listEl.innerHTML = html;
    deleteBtn.classList.remove('hidden');

    // Сохраняем данные для удаления
    window.deleteStudentData = {
        query: query,
        found: result.found
    };
}

// Подтверждение и выполнение удаления
async function confirmDeleteStudentFromSystem() {
    if (!window.deleteStudentData) {
        showError('Сначала выполните поиск');
        return;
    }

    const query = window.deleteStudentData.query;
    const groupFilter = document.getElementById('delete-student-group').value.trim();

    const deleteFromGroups = document.getElementById('del-from-groups').checked;
    const deleteFromExams = document.getElementById('del-from-exams').checked;
    const deleteFromSrez = document.getElementById('del-from-srez').checked;
    const deleteResults = document.getElementById('del-results').checked;

    if (!deleteFromGroups && !deleteFromExams && !deleteFromSrez && !deleteResults) {
        showError('Выберите хотя бы один пункт для удаления');
        return;
    }

    let confirmMsg = `Удалить "${query}"`;
    if (groupFilter) confirmMsg += ` из группы "${groupFilter}"`;
    confirmMsg += '?\n\n';
    if (deleteFromGroups) confirmMsg += '✓ Из групп студентов\n';
    if (deleteFromExams) confirmMsg += '✓ Из участников экзаменов\n';
    if (deleteFromSrez) confirmMsg += '✓ Из участников срезов\n';
    if (deleteResults) confirmMsg += '⚠️ РЕЗУЛЬТАТЫ ТЕСТОВ (необратимо!)\n';

    const confirmed = await showConfirm(confirmMsg, 'Подтвердите удаление');
    if (!confirmed) return;

    showLoading('Удаление...');

    const result = await apiRequest('/students/delete-full', 'POST', {
        fullName: query,
        groupName: groupFilter || null,
        deleteFromGroups,
        deleteFromExams,
        deleteFromSrez,
        deleteResults
    });

    hideLoading();

    if (result.success) {
        const d = result.deleted;
        let msg = `Удалено: `;
        const parts = [];
        if (d.fromGroups > 0) parts.push(`${d.fromGroups} из групп`);
        if (d.fromExamParticipants > 0) parts.push(`${d.fromExamParticipants} из экзаменов`);
        if (d.fromSrezParticipants > 0) parts.push(`${d.fromSrezParticipants} из срезов`);
        if (d.fromResults > 0) parts.push(`${d.fromResults} результатов`);

        if (parts.length === 0) {
            msg = 'Записей для удаления не найдено';
        } else {
            msg += parts.join(', ');
        }

        showSuccess(msg);
        closeDeleteStudentModal();

        // Перезагружаем данные
        await reloadGroups();
        renderGroupsTab();
    } else {
        showError(result.error || 'Ошибка удаления');
    }
}

// ============================================
