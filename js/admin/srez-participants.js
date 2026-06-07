// ============================================
// УПРАВЛЕНИЕ УЧАСТНИКАМИ АДМИНИСТРАТИВНОГО СРЕЗА
// ============================================

// Переменные currentSrezTestId, srezParticipants определены в state.js

// Форматирование названия группы: первые 2-4 буквы большие, потом дефис и цифры
function formatGroupInput(input) {
    let value = input.value;

    // Разбиваем на буквенную и числовую части
    const match = value.match(/^([а-яА-Яa-zA-Z]+)(.*)$/);
    if (match) {
        const letters = match[1].toUpperCase(); // Буквы всегда большие
        const rest = match[2];
        input.value = letters + rest;
    }
}

async function showSrezParticipantsModal(testId) {
    currentSrezTestId = testId;
    const test = adminState.tests.find(t => String(t.id) === String(testId));

    // Загружаем группы если ещё не загружены
    await loadGroupsLazy();

    // Создаём модальное окно если его нет
    if (!document.getElementById('srez-participants-modal')) {
        const modal = document.createElement('div');
        modal.id = 'srez-participants-modal';
        modal.className = 'modal hidden';
        modal.innerHTML = `
            <div class="modal-content participants-modal-compact">
                <div class="modal-header">
                    <h2 id="srez-modal-title">Участники среза</h2>
                    <button class="btn-close" onclick="hideSrezParticipantsModal()">&times;</button>
                </div>
                <div id="srez-participants-content"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('srez-modal-title').textContent = `Участники: ${test?.name || 'Срез'}`;

    // Загружаем участников (используем тот же API exam)
    const result = await apiRequest(`/exam/participants?testId=${testId}`);
    srezParticipants = result.success ? result.participants : [];

    renderSrezParticipantsContent(test);
    showModal('srez-participants-modal');
}

function hideSrezParticipantsModal() {
    hideModal('srez-participants-modal');
    currentSrezTestId = null;
}

function renderSrezParticipantsContent(test) {
    const container = document.getElementById('srez-participants-content');
    const variants = test?.adminSrezSettings?.variants || [];
    const variantsCount = variants.length || 2;
    const maxAttempts = test?.adminSrezSettings?.maxAttempts || 1;

    // Получаем дисциплину теста
    const topic = adminState.topics.find(t => String(t.id) === String(test?.topicId));
    const discipline = adminState.disciplines.find(d => String(d.id) === String(topic?.disciplineId));

    // Получаем группы, закреплённые за дисциплиной
    const assignedGroupIds = discipline?.assignedGroups || [];
    const assignedGroups = (adminState.groups || []).filter(g =>
        assignedGroupIds.includes(String(g.id))
    );

    // Все группы для ручного добавления
    const allGroups = adminState.groups || [];

    // Группируем участников по группам
    const participantGroups = [...new Set(srezParticipants.map(p => p.group))].sort();

    const statusIcons = {
        'not_started': '⏳',
        'in_progress': '🔄',
        'passed': '✅',
        'failed': '❌'
    };

    container.innerHTML = `
        <div class="participants-layout">
            <!-- Левая панель: добавление -->
            <div class="participants-sidebar">
                <div class="participants-info-card">
                    <div class="participants-stat">
                        <span class="stat-value">${srezParticipants.length}</span>
                        <span class="stat-label">участников</span>
                    </div>
                    <div class="participants-stat">
                        <span class="stat-value">${variantsCount}</span>
                        <span class="stat-label">вариантов</span>
                    </div>
                </div>

                ${assignedGroups.length > 0 ? `
                    <div class="participants-section">
                        <h4>Быстрое добавление</h4>
                        <div class="quick-add-groups">
                            ${assignedGroups.map(g => {
                                const studentsInGroup = g.students?.length || 0;
                                const alreadyAdded = srezParticipants.filter(p => p.group === g.name).length;
                                const isDone = alreadyAdded >= studentsInGroup;
                                return `<button class="group-chip ${isDone ? 'done' : ''}" onclick="addGroupToSrez('${g.id}')" ${isDone ? 'disabled' : ''} title="${escapeHtml(g.name)}: ${alreadyAdded}/${studentsInGroup}">
                                    ${escapeHtml(g.name)} <span class="chip-count">${alreadyAdded}/${studentsInGroup}</span>
                                </button>`;
                            }).join('')}
                        </div>
                        <div class="variant-for-group">
                            <label>Вариант для добавляемых:</label>
                            <select id="srez-group-variant" class="input-compact">
                                <option value="">Не задан</option>
                                ${Array.from({length: variantsCount}, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
                            </select>
                        </div>
                        <div class="auto-distribute-option">
                            <label class="checkbox-label">
                                <input type="checkbox" id="srez-auto-distribute" checked>
                                <span>Авторасределение вариантов (1, 2, 3...)</span>
                            </label>
                        </div>
                    </div>
                ` : ''}

                <div class="participants-section">
                    <h4>Добавить вручную</h4>
                    <div class="manual-add-form">
                        <input type="text" id="srez-manual-surname" placeholder="Фамилия" class="input-compact">
                        <input type="text" id="srez-manual-name" placeholder="Имя" class="input-compact">
                        <input type="text" id="srez-manual-patronymic" placeholder="Отчество" class="input-compact">
                        <div class="form-row-compact">
                            <input type="text" id="srez-manual-group" list="srez-groups-list" placeholder="Группа" class="input-compact" oninput="formatGroupInput(this)">
                            <datalist id="srez-groups-list">
                                ${allGroups.map(g => `<option value="${escapeHtml(g.name)}">`).join('')}
                            </datalist>
                            <select id="srez-manual-variant" class="input-compact input-small">
                                <option value="">Вар.</option>
                                ${Array.from({length: variantsCount}, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
                            </select>
                        </div>
                        <button class="btn btn-primary btn-full" onclick="addSrezParticipantManual()">+ Добавить</button>
                    </div>
                </div>

                <div class="participants-section">
                    <h4>Из файла</h4>
                    <div class="file-upload-compact">
                        <input type="file" id="srez-file" accept=".txt" class="input-compact">
                        <div class="form-row-compact">
                            <input type="text" id="srez-group" list="srez-groups-list-file" placeholder="Группа" class="input-compact" oninput="formatGroupInput(this)">
                            <datalist id="srez-groups-list-file">
                                ${allGroups.map(g => `<option value="${escapeHtml(g.name)}">`).join('')}
                            </datalist>
                            <select id="srez-variant-select" class="input-compact input-small">
                                <option value="">Вар.</option>
                                ${Array.from({length: variantsCount}, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
                            </select>
                        </div>
                        <button class="btn btn-secondary btn-full" onclick="uploadSrezParticipants()">Загрузить</button>
                    </div>
                </div>
            </div>

            <!-- Правая панель: таблица -->
            <div class="participants-main">
                ${srezParticipants.length > 0 ? `
                    <div class="participants-toolbar">
                        <div class="toolbar-left">
                            <input type="text" id="srez-search-input" class="search-input-compact" placeholder="Поиск..." oninput="filterSrezParticipants()">
                            ${participantGroups.length > 1 ? `
                                <select id="srez-group-filter" onchange="filterSrezParticipants()" class="filter-select">
                                    <option value="">Все группы</option>
                                    ${participantGroups.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('')}
                                </select>
                            ` : ''}
                        </div>
                        <div class="toolbar-right">
                            <button class="btn btn-sm btn-success" onclick="downloadSrezPDF()" title="PDF карточки">PDF</button>
                            <button class="btn btn-sm btn-secondary" onclick="exportSrezParticipantsToExcel()" title="Excel">Excel</button>
                            <button class="btn btn-sm btn-secondary" onclick="assignVariantsToGroup()" title="Варианты">Вар.</button>
                            <button class="btn btn-sm btn-danger" onclick="clearAllSrezParticipants()" title="Очистить">🗑️</button>
                        </div>
                    </div>

                    <div class="participants-table-wrap">
                        <table class="participants-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>ФИО</th>
                                    <th>Группа</th>
                                    <th>Вар.</th>
                                    <th>Код</th>
                                    <th>Поп.</th>
                                    <th>Статус</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody id="srez-participants-tbody">
                                ${srezParticipants.map((p, i) => `
                                    <tr data-group="${escapeHtml(p.group)}" data-name="${escapeHtml((p.surname + ' ' + p.name + ' ' + (p.patronymic || '')).toLowerCase())}">
                                        <td class="td-num">${i + 1}</td>
                                        <td class="td-name">${escapeHtml(p.surname)} ${escapeHtml(p.name)}${p.patronymic ? ' ' + escapeHtml(p.patronymic.charAt(0)) + '.' : ''}</td>
                                        <td class="td-group">${escapeHtml(p.group)}</td>
                                        <td class="td-var">
                                            <select class="variant-select-mini" onchange="updateParticipantVariant('${p.id}', this.value)">
                                                <option value="">-</option>
                                                ${Array.from({length: variantsCount}, (_, j) => `<option value="${j + 1}" ${p.variant == j + 1 ? 'selected' : ''}>${j + 1}</option>`).join('')}
                                            </select>
                                        </td>
                                        <td class="td-code"><code>${escapeHtml(p.password)}</code></td>
                                        <td class="td-att">${p.attemptsLeft}/${p.maxAttempts}</td>
                                        <td class="td-status">${statusIcons[p.status] || '?'}${p.bestGrade ? ` <b>${p.bestGrade}</b>` : ''}</td>
                                        <td class="td-actions">
                                            <button class="btn-mini" onclick="addAttemptToSrezParticipant('${p.id}')" title="+1 попытка">+</button>
                                            <button class="btn-mini btn-danger" onclick="deleteSrezParticipant('${p.id}')" title="Удалить">×</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div class="participants-empty">
                        <div class="empty-icon">👥</div>
                        <p>Нет участников</p>
                        ${assignedGroups.length > 0
                            ? '<p class="empty-hint">Добавьте студентов из групп дисциплины слева</p>'
                            : '<p class="empty-hint">Добавьте вручную или загрузите список</p>'
                        }
                    </div>
                `}
            </div>
        </div>
    `;
}

function filterSrezParticipants() {
    const groupFilter = document.getElementById('srez-group-filter')?.value || '';
    const searchInput = document.getElementById('srez-search-input')?.value.toLowerCase().trim() || '';
    const rows = document.querySelectorAll('#srez-participants-tbody tr');

    rows.forEach(row => {
        const matchesGroup = !groupFilter || row.dataset.group === groupFilter;
        const name = row.dataset.name || '';
        const matchesSearch = !searchInput || name.includes(searchInput);

        toggleElement(row, matchesGroup && matchesSearch);
    });
}

// Добавить всю группу из закреплённых за дисциплиной
async function addGroupToSrez(groupId) {
    const group = adminState.groups.find(g => String(g.id) === String(groupId));
    if (!group || !group.students?.length) {
        await showError('В группе нет студентов');
        return;
    }

    const test = adminState.tests.find(t => String(t.id) === String(currentSrezTestId));
    const maxAttempts = test?.adminSrezSettings?.maxAttempts || 1;

    // Получаем выбранный вариант из общего селекта
    const variantSelect = document.getElementById('srez-group-variant');
    const variant = variantSelect?.value ? parseInt(variantSelect.value) : null;

    // Проверяем флаг авторасределения
    const autoDistributeCheckbox = document.getElementById('srez-auto-distribute');
    const autoDistribute = autoDistributeCheckbox?.checked && !variant; // авто только если не выбран конкретный вариант

    // Формируем список участников из студентов группы
    const participants = group.students.map(s => {
        const parts = s.fullName.trim().split(/\s+/);
        return {
            surname: parts[0] || '',
            name: parts[1] || '',
            patronymic: parts.slice(2).join(' ') || '',
            variant
        };
    }).filter(p => p.surname && p.name);

    if (participants.length === 0) {
        await showError('Не удалось распознать ФИО студентов');
        return;
    }

    const result = await apiRequest('/exam/participants', 'POST', {
        testId: currentSrezTestId,
        group: group.name,
        maxAttempts,
        participants,
        autoDistribute
    });

    if (result.success) {
        let message = `Добавлено: ${result.created}`;
        if (result.skipped > 0) {
            message += `, пропущено: ${result.skipped}`;
        }
        await showSuccess(message);
        showSrezParticipantsModal(currentSrezTestId);
    } else {
        await showError(result.error || 'Ошибка добавления');
    }
}

async function addSrezParticipantManual() {
    const surname = document.getElementById('srez-manual-surname').value.trim();
    const name = document.getElementById('srez-manual-name').value.trim();
    const patronymic = document.getElementById('srez-manual-patronymic').value.trim();
    const groupSelect = document.getElementById('srez-manual-group');
    const group = groupSelect.value.trim();
    const variant = document.getElementById('srez-manual-variant').value;
    const test = adminState.tests.find(t => String(t.id) === String(currentSrezTestId));
    const maxAttempts = test?.adminSrezSettings?.maxAttempts || 1;

    if (!surname) {
        await showError('Укажите фамилию');
        return;
    }
    if (!name) {
        await showError('Укажите имя');
        return;
    }
    if (!group) {
        await showError('Укажите группу');
        return;
    }

    const result = await apiRequest('/exam/participants', 'POST', {
        testId: currentSrezTestId,
        group,
        maxAttempts,
        participants: [{
            surname,
            name,
            patronymic,
            variant: variant ? parseInt(variant) : null
        }]
    });

    if (result.success) {
        await showSuccess('Участник добавлен');
        // Очищаем поля
        document.getElementById('srez-manual-surname').value = '';
        document.getElementById('srez-manual-name').value = '';
        document.getElementById('srez-manual-patronymic').value = '';
        // Группу не очищаем - часто добавляют несколько человек из одной группы
        showSrezParticipantsModal(currentSrezTestId);
    } else {
        await showError(result.error || 'Ошибка добавления');
    }
}

async function uploadSrezParticipants() {
    const fileInput = document.getElementById('srez-file');
    const group = document.getElementById('srez-group').value.trim();
    const variant = document.getElementById('srez-variant-select').value;
    const test = adminState.tests.find(t => String(t.id) === String(currentSrezTestId));
    const maxAttempts = test?.adminSrezSettings?.maxAttempts || 1;

    // Проверяем флаг авторасределения
    const autoDistributeCheckbox = document.getElementById('srez-auto-distribute');
    const autoDistribute = autoDistributeCheckbox?.checked && !variant; // авто только если не выбран конкретный вариант

    if (!fileInput.files[0]) {
        await showError('Выберите файл со списком');
        return;
    }
    if (!group) {
        await showError('Укажите группу');
        return;
    }

    const file = fileInput.files[0];
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());

    if (lines.length === 0) {
        await showError('Файл пустой или не содержит строк с ФИО');
        return;
    }

    // Парсим ФИО
    const participants = lines.map(line => {
        const parts = line.trim().split(/\s+/);
        return {
            surname: parts[0] || '',
            name: parts[1] || '',
            patronymic: parts.slice(2).join(' ') || '',
            variant: variant ? parseInt(variant) : null
        };
    }).filter(p => p.surname && p.name);

    if (participants.length === 0) {
        await showError('Не удалось распознать ФИО. Формат: Фамилия Имя Отчество');
        return;
    }

    const result = await apiRequest('/exam/participants', 'POST', {
        testId: currentSrezTestId,
        group,
        maxAttempts,
        participants,
        autoDistribute
    });

    if (result.success) {
        let message = `Добавлено: ${result.created}`;
        if (result.skipped > 0) {
            message += `, пропущено дубликатов: ${result.skipped}`;
        }
        await showSuccess(message);
        showSrezParticipantsModal(currentSrezTestId);
    } else {
        await showError(result.error || 'Ошибка загрузки');
    }
}

async function updateParticipantVariant(participantId, variant) {
    const result = await apiRequest(`/exam/participants/${participantId}`, 'PUT', {
        variant: variant ? parseInt(variant) : null
    });
    if (!result.success) {
        await showError(result.error || 'Ошибка обновления варианта');
        showSrezParticipantsModal(currentSrezTestId);
    }
}

async function assignVariantsToGroup() {
    const groups = [...new Set(srezParticipants.map(p => p.group))].sort();
    const test = adminState.tests.find(t => String(t.id) === String(currentSrezTestId));
    const variantsCount = test?.adminSrezSettings?.variants?.length || 2;

    // Создаём модальное окно для назначения
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content modal-small">
            <div class="modal-header">
                <h2>Назначить вариант группе</h2>
                <button class="btn-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body-padded">
                <div class="form-group">
                    <label>Группа</label>
                    <select id="assign-variant-group">
                        ${groups.map(g => `<option value="${g}">${g}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Вариант</label>
                    <select id="assign-variant-value">
                        ${Array.from({length: variantsCount}, (_, i) => `<option value="${i + 1}">Вариант ${i + 1}</option>`).join('')}
                    </select>
                </div>
                <div class="form-actions">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Отмена</button>
                    <button class="btn btn-primary" onclick="executeAssignVariantToGroup(this.closest('.modal'))">Назначить</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    showModal(modal);
}

async function executeAssignVariantToGroup(modal) {
    const group = document.getElementById('assign-variant-group').value;
    const variant = parseInt(document.getElementById('assign-variant-value').value);

    const participantsInGroup = srezParticipants.filter(p => p.group === group);

    for (const p of participantsInGroup) {
        await apiRequest(`/exam/participants/${p.id}`, 'PUT', { variant });
    }

    modal.remove();
    await showSuccess(`Вариант ${variant} назначен группе ${group}`);
    showSrezParticipantsModal(currentSrezTestId);
}

async function addAttemptToSrezParticipant(participantId) {
    const result = await apiRequest(`/exam/participants/${participantId}`, 'PUT', { addAttempts: 1 });
    if (result.success) {
        showSrezParticipantsModal(currentSrezTestId);
    } else {
        await showError(result.error || 'Ошибка');
    }
}

async function deleteSrezParticipant(participantId) {
    if (!await showConfirm('Удалить участника?', 'Удаление участника')) return;

    const result = await apiRequest(`/exam/participants/${participantId}`, 'DELETE');
    if (result.success) {
        showSrezParticipantsModal(currentSrezTestId);
    } else {
        await showError(result.error || 'Ошибка удаления');
    }
}

async function clearAllSrezParticipants() {
    if (!await showConfirm('Удалить ВСЕХ участников этого среза?', 'Удаление всех участников')) return;

    const result = await apiRequest(`/exam/participants?testId=${currentSrezTestId}`, 'DELETE');
    if (result.success) {
        showSrezParticipantsModal(currentSrezTestId);
    } else {
        await showError(result.error || 'Ошибка удаления');
    }
}

// Глобальное удаление всех участников из ВСЕХ административных срезов
async function clearAllSrezParticipantsGlobal() {
    if (!await showConfirm(
        'Удалить ВСЕХ участников из ВСЕХ административных срезов?\n\nЭто действие нельзя отменить!',
        '⚠️ Массовое удаление'
    )) return;

    // Получаем все тесты административного среза
    const srezTests = adminState.tests.filter(t => t.isAdminSrezMode === true);

    if (srezTests.length === 0) {
        await showError('Нет тестов административного среза');
        return;
    }

    showSuccess(`Удаляю участников из ${srezTests.length} срезов...`, 30000);

    let deletedCount = 0;
    let errorCount = 0;

    for (const test of srezTests) {
        try {
            const result = await apiRequest(`/exam/participants?testId=${test.id}`, 'DELETE');
            if (result.success) {
                deletedCount++;
            } else {
                errorCount++;
            }
        } catch (err) {
            console.error(`Ошибка удаления участников теста ${test.id}:`, err);
            errorCount++;
        }
    }

    if (errorCount > 0) {
        showSuccess(`Удалено из ${deletedCount} срезов. Ошибок: ${errorCount}`);
    } else {
        showSuccess(`Готово! Удалены участники из ${deletedCount} срезов. Теперь запустите "Массовую настройку".`);
    }
}

// Генерация PDF с карточками для адм. среза
async function downloadSrezPDF() {
    if (srezParticipants.length === 0) {
        await showError('Нет участников для генерации');
        return;
    }

    const test = adminState.tests.find(t => String(t.id) === String(currentSrezTestId));
    const topic = adminState.topics.find(t => String(t.id) === String(test?.topicId));
    const discipline = adminState.disciplines.find(d => String(d.id) === String(topic?.disciplineId));
    const disciplineName = discipline?.name || '';
    const testName = test?.name || 'Административный срез';

    // Сортируем участников по группе, затем по фамилии
    const sortedParticipants = [...srezParticipants].sort((a, b) => {
        const groupCompare = (a.group || '').localeCompare(b.group || '', 'ru');
        if (groupCompare !== 0) return groupCompare;
        return (a.surname || '').localeCompare(b.surname || '', 'ru');
    });

    // Группируем участников по группам
    const groupedByGroup = {};
    sortedParticipants.forEach(p => {
        const groupName = p.group || 'Без группы';
        if (!groupedByGroup[groupName]) {
            groupedByGroup[groupName] = [];
        }
        groupedByGroup[groupName].push(p);
    });

    // Генерируем карточки (10 на страницу - 2 колонки x 5 рядов)
    // Каждая группа начинается с нового листа
    const cardsPerPage = 10;
    const pages = [];

    // Функция для создания HTML карточки
    const createCard = (p) => `
        <div class="card">
            <div class="card-header">
                <div class="discipline">${escapeHtml(disciplineName)}</div>
                <div class="test-name">${escapeHtml(testName)}</div>
            </div>
            <div class="card-body">
                <div class="student-info">
                    <div class="group">${escapeHtml(p.group)}</div>
                    <div class="fio">${escapeHtml(p.surname)} ${escapeHtml(p.name)} ${escapeHtml(p.patronymic || '')}</div>
                </div>
                <div class="code-variant-row">
                    ${p.variant ? `<div class="variant-section">
                        <div class="variant-label">Вариант</div>
                        <div class="variant">${p.variant}</div>
                    </div>` : ''}
                    <div class="code-section ${p.variant ? '' : 'full-width'}">
                        <div class="code-label">Ваш код:</div>
                        <div class="code">${escapeHtml(p.password)}</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Генерируем страницы для каждой группы отдельно
    Object.keys(groupedByGroup).sort((a, b) => a.localeCompare(b, 'ru')).forEach(groupName => {
        const groupParticipants = groupedByGroup[groupName];

        for (let i = 0; i < groupParticipants.length; i += cardsPerPage) {
            const pageParticipants = groupParticipants.slice(i, i + cardsPerPage);
            const cards = pageParticipants.map(createCard).join('');
            pages.push(`<div class="page">${cards}</div>`);
        }
    });

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Карточки - ${testName}</title>
    <style>
        @page { size: A4; margin: 5mm; }
        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page { page-break-after: always; }
            .page:last-child { page-break-after: avoid; }
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: Arial, sans-serif;
            background: #fff;
        }

        .page {
            width: 200mm;
            min-height: 287mm;
            padding: 3mm;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            grid-template-rows: repeat(5, 1fr);
            gap: 3mm;
        }

        .card {
            border: 2px dashed #333;
            border-radius: 4mm;
            padding: 3mm;
            display: flex;
            flex-direction: column;
            background: linear-gradient(135deg, #fafafa 0%, #fff 100%);
            position: relative;
        }

        .card::before {
            content: '✂';
            position: absolute;
            top: -2mm;
            left: 50%;
            transform: translateX(-50%);
            font-size: 8pt;
            color: #999;
        }

        .card-header {
            text-align: center;
            padding-bottom: 2mm;
            border-bottom: 1px solid #ddd;
            margin-bottom: 2mm;
        }

        .discipline {
            font-size: 8pt;
            color: #0066cc;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .test-name {
            font-size: 9pt;
            color: #333;
            font-weight: 500;
            margin-top: 1mm;
        }

        .card-body {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .student-info {
            text-align: center;
            margin-bottom: 2mm;
        }

        .group {
            font-size: 9pt;
            color: #666;
            font-weight: 500;
            margin-bottom: 1mm;
        }

        .fio {
            font-size: 10pt;
            font-weight: 700;
            color: #000;
        }

        .code-variant-row {
            display: flex;
            gap: 2mm;
            align-items: stretch;
        }

        .variant-section {
            flex: 0 0 25mm;
            text-align: center;
            background: #fff3e0;
            border-radius: 2mm;
            padding: 2mm;
            border: 1px solid #ffcc80;
        }

        .variant-label {
            font-size: 6pt;
            color: #e65100;
            text-transform: uppercase;
            margin-bottom: 1mm;
        }

        .variant {
            font-size: 16pt;
            font-weight: bold;
            color: #e65100;
        }

        .code-section {
            flex: 1;
            text-align: center;
            background: #f0f7ff;
            border-radius: 2mm;
            padding: 2mm;
            border: 1px solid #cce0ff;
        }

        .code-section.full-width {
            flex: 1;
        }

        .code-label {
            font-size: 6pt;
            color: #666;
            text-transform: uppercase;
            margin-bottom: 1mm;
        }

        .code {
            font-family: 'Courier New', monospace;
            font-size: 14pt;
            font-weight: bold;
            color: #0066cc;
            letter-spacing: 2px;
        }
    </style>
</head>
<body>
    ${pages.join('')}
</body>
</html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
}

// Экспорт участников среза в Excel
async function exportSrezParticipantsToExcel() {
    try {
        // Проверяем доступность библиотеки ExcelJS
        if (typeof ExcelJS === 'undefined') {
            await showError('Библиотека ExcelJS не загружена. Обновите страницу.');
            return;
        }

        if (srezParticipants.length === 0) {
            await showError('Нет участников для экспорта');
            return;
        }

        const test = adminState.tests.find(t => String(t.id) === String(currentSrezTestId));
        const topic = adminState.topics.find(t => String(t.id) === String(test?.topicId));
        const discipline = adminState.disciplines.find(d => String(d.id) === String(topic?.disciplineId));

        const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Система тестирования';
    workbook.created = new Date();

    const tableHeaderStyle = {
        font: { bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        border: {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
        }
    };

    const cellStyle = {
        alignment: { vertical: 'middle', wrapText: true },
        border: {
            top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
            left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
            bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
            right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
        }
    };

    const ws = workbook.addWorksheet('Участники среза', {
        properties: { tabColor: { argb: 'FF2B579A' } }
    });

    ws.mergeCells('A1:I1');
    ws.getCell('A1').value = `УЧАСТНИКИ СРЕЗА: ${test?.name || 'Срез'}`;
    ws.getCell('A1').style = {
        font: { bold: true, size: 16, color: { argb: 'FF2B579A' } },
        alignment: { horizontal: 'center', vertical: 'middle' }
    };
    ws.getRow(1).height = 30;

    if (discipline) {
        ws.getCell('A2').value = `Дисциплина: ${discipline.name}`;
        ws.getCell('A2').font = { italic: true };
    }

    ws.getCell('A3').value = `Дата: ${new Date().toLocaleDateString('ru-RU')} | Всего участников: ${srezParticipants.length}`;

    ws.getRow(5).values = ['№', 'Фамилия', 'Имя', 'Отчество', 'Группа', 'Вариант', 'Код', 'Попытки', 'Статус'];
    ws.getRow(5).eachCell((cell) => { cell.style = tableHeaderStyle; });
    ws.getRow(5).height = 25;

    const sorted = [...srezParticipants].sort((a, b) => {
        const groupCmp = (a.group || '').localeCompare(b.group || '', 'ru');
        if (groupCmp !== 0) return groupCmp;
        return (a.surname || '').localeCompare(b.surname || '', 'ru');
    });

    const statusText = {
        'not_started': 'Не начал',
        'in_progress': 'В процессе',
        'passed': 'Сдал',
        'failed': 'Не сдал'
    };

    sorted.forEach((p, idx) => {
        const rowNum = 6 + idx;
        ws.getRow(rowNum).values = [
            idx + 1,
            p.surname || '',
            p.name || '',
            p.patronymic || '',
            p.group || '',
            p.variant || '-',
            p.password || '',
            `${p.attemptsLeft}/${p.maxAttempts}`,
            statusText[p.status] || p.status
        ];
        ws.getRow(rowNum).eachCell((cell) => { cell.style = cellStyle; });
    });

    ws.columns = [
        { width: 6 }, { width: 20 }, { width: 15 }, { width: 18 },
        { width: 12 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 14 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Участники_среза_${test?.name || 'Срез'}_${new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);

    showSuccess('Экспорт участников завершён');
    } catch (error) {
        console.error('Ошибка экспорта в Excel:', error);
        await showError('Ошибка при создании файла: ' + error.message);
    }
}

// ============================================
// МАССОВАЯ ВЫГРУЗКА PDF КАРТОЧЕК В ZIP АРХИВ
// Объединённые карточки: один студент - все дисциплины
// ============================================

// Создание HTML для объединённой карточки студента (все дисциплины)
function createCombinedCardHTML(studentData) {
    // studentData = { fio, group, disciplines: [{name, variant, code}, ...] }
    const disciplineRows = studentData.disciplines.map(d => `
        <div class="discipline-row">
            <div class="disc-name">${escapeHtml(d.name)}</div>
            <div class="disc-variant">${d.variant || '-'}</div>
            <div class="disc-code">${escapeHtml(d.code)}</div>
        </div>
    `).join('');

    return `
        <div class="card-combined">
            <div class="card-site-url">kst-test.ru/start</div>
            <div class="card-header-combined">
                <div class="student-fio">${escapeHtml(studentData.fio)}</div>
                <div class="student-group">${escapeHtml(studentData.group)}</div>
            </div>
            <div class="card-body-combined">
                <div class="discipline-row header-row">
                    <div class="disc-name header-cell">Дисциплина</div>
                    <div class="disc-variant header-cell">Вар.</div>
                    <div class="disc-code header-cell">Код доступа</div>
                </div>
                ${disciplineRows}
            </div>
        </div>
    `;
}

// CSS стили для объединённых карточек (компактные)
function getCombinedCardsCSS() {
    return `
        .card-combined {
            border: 1.5px dashed #888;
            border-radius: 6px;
            overflow: hidden;
            background: #fff;
            page-break-inside: avoid;
        }
        .card-site-url {
            background: #dbeafe;
            color: #1e40af;
            text-align: center;
            font-size: 11px;
            font-weight: 700;
            padding: 3px 10px;
            font-family: 'Courier New', monospace;
            letter-spacing: 0.5px;
        }
        .card-header-combined {
            background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
            color: white;
            padding: 6px 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .student-fio {
            font-size: 12px;
            font-weight: 700;
        }
        .student-group {
            font-size: 10px;
            background: rgba(255,255,255,0.2);
            padding: 2px 8px;
            border-radius: 10px;
        }
        .card-body-combined {
            padding: 0;
        }
        .discipline-row {
            display: grid;
            grid-template-columns: 1fr 35px 70px;
            gap: 6px;
            padding: 4px 10px;
            border-bottom: 1px solid #e2e8f0;
            align-items: center;
            font-size: 11px;
        }
        .discipline-row:last-child {
            border-bottom: none;
        }
        .discipline-row.header-row {
            background: #f1f5f9;
            border-bottom: 2px solid #cbd5e1;
            padding: 3px 10px;
        }
        .header-cell {
            font-size: 9px !important;
            font-weight: 600 !important;
            color: #64748b !important;
            text-transform: uppercase;
            background: transparent !important;
        }
        .disc-name {
            color: #1e293b;
            font-weight: 500;
            line-height: 1.2;
        }
        .disc-variant {
            text-align: center;
            font-size: 12px;
            font-weight: 700;
            color: #ea580c;
            background: #fff7ed;
            padding: 2px 4px;
            border-radius: 4px;
        }
        .disc-code {
            text-align: center;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            font-weight: 700;
            color: #0066cc;
            background: #eff6ff;
            padding: 2px 4px;
            border-radius: 4px;
            letter-spacing: 1px;
        }
    `;
}

// Генерация HTML документа с карточками (для печати в PDF)
function generateCombinedCardsHTML(studentsData, groupName) {
    const cardsHTML = studentsData.map(s => createCombinedCardHTML(s)).join('');

    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Коды доступа - ${groupName}</title>
    <style>
        @page {
            size: A4;
            margin: 8mm;
        }
        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .card-combined { page-break-inside: avoid; }
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: Arial, sans-serif;
            background: #fff;
            padding: 5px;
        }
        .cards-container {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
        }
        ${getCombinedCardsCSS()}
    </style>
</head>
<body>
    <div class="cards-container">
        ${cardsHTML}
    </div>
</body>
</html>`;
}

// Массовая выгрузка всех карточек в ZIP архив (HTML файлы для печати)
async function exportAllSrezAccessCodesToZip() {
    try {
        // Проверяем наличие JSZip
        if (typeof JSZip === 'undefined') {
            await showError('Библиотека JSZip не загружена. Обновите страницу.');
            return;
        }

        // Получаем все тесты административного среза
        const srezTests = adminState.tests.filter(t => t.isAdminSrezMode === true);

        if (srezTests.length === 0) {
            await showError('Нет тестов административного среза');
            return;
        }

        showSuccess('Собираю данные участников...', 30000);

        // Собираем ВСЕ данные: студент -> его дисциплины с кодами
        const allData = {};

        for (const test of srezTests) {
            const topic = adminState.topics.find(t => String(t.id) === String(test.topicId));
            const discipline = adminState.disciplines.find(d => String(d.id) === String(topic?.disciplineId));
            const disciplineName = discipline?.name || 'Без дисциплины';

            const result = await apiRequest(`/exam/participants?testId=${test.id}`);
            const participants = result.success ? result.participants : [];

            for (const p of participants) {
                const groupName = p.group || 'Без группы';
                const fio = `${p.surname || ''} ${p.name || ''} ${p.patronymic || ''}`.trim();
                const studentKey = `${fio}___${groupName}`;

                if (!allData[groupName]) {
                    allData[groupName] = {};
                }

                if (!allData[groupName][studentKey]) {
                    allData[groupName][studentKey] = {
                        fio: fio,
                        group: groupName,
                        disciplines: []
                    };
                }

                allData[groupName][studentKey].disciplines.push({
                    name: disciplineName,
                    variant: p.variant || '',
                    code: p.password || ''
                });
            }
        }

        const groupNames = Object.keys(allData).sort((a, b) => a.localeCompare(b, 'ru'));

        if (groupNames.length === 0) {
            await showError('Нет участников для экспорта');
            return;
        }

        showSuccess(`Формирую файлы для ${groupNames.length} групп...`, 10000);

        const zip = new JSZip();
        const codesFolder = zip.folder('Коды доступа');

        for (const groupName of groupNames) {
            const students = Object.values(allData[groupName])
                .sort((a, b) => a.fio.localeCompare(b.fio, 'ru'));

            // Сортируем дисциплины внутри каждого студента
            students.forEach(s => {
                s.disciplines.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
            });

            // Генерируем HTML
            const htmlContent = generateCombinedCardsHTML(students, groupName);
            const fileName = sanitizeFileName(groupName) + '.html';
            codesFolder.file(fileName, htmlContent);
        }

        showSuccess('Создаю архив...', 5000);

        const content = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        // Скачиваем
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Коды_доступа_${new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')}.zip`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);

        showSuccess(`Готово! Создано ${groupNames.length} файлов. Откройте HTML и нажмите Ctrl+P для печати в PDF.`);

    } catch (error) {
        console.error('Ошибка экспорта:', error);
        await showError('Ошибка при создании архива: ' + error.message);
    }
}

// Функция для очистки имени файла от недопустимых символов
function sanitizeFileName(name) {
    return (name || 'Без_названия')
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, ' ')
        .trim();
}

// ============================================
// МАССОВАЯ ВЫГРУЗКА WORD ОТЧЁТОВ ПО СРЕЗАМ
// ============================================

async function exportAllSrezReportsToZip() {
    try {
        if (typeof docx === 'undefined' || typeof JSZip === 'undefined') {
            await showError('Библиотеки docx или JSZip не загружены. Обновите страницу.');
            return;
        }

        await showSuccess('Формирование отчётов... Подождите.');

        // 1. Находим все тесты-срезы
        const srezTests = adminState.tests.filter(t => t.isAdminSrezMode);
        if (srezTests.length === 0) {
            await showError('Нет административных срезов');
            return;
        }

        // 2. Загружаем все результаты
        if (!adminState.results || adminState.results.length === 0) {
            await loadResultsLazy();
        }

        // 3. Параллельно загружаем участников всех тестов
        const participantsPromises = srezTests.map(test =>
            apiRequest(`/exam/participants?testId=${test.id}`)
                .then(r => ({ testId: test.id, participants: r.success ? r.participants : [] }))
                .catch(() => ({ testId: test.id, participants: [] }))
        );
        const allParticipantsData = await Promise.all(participantsPromises);

        // 4. Группируем: группа → дисциплина → данные
        const reportData = {}; // { groupName: { disciplineName: { test, allParticipants[], resultIds[] } } }

        for (const test of srezTests) {
            const topic = adminState.topics.find(t => String(t.id) === String(test.topicId));
            const discipline = adminState.disciplines.find(d => String(d.id) === String(topic?.disciplineId || test.disciplineId));
            const disciplineName = discipline ? discipline.name : 'Неизвестная дисциплина';

            const testParticipants = allParticipantsData.find(p => p.testId === test.id)?.participants || [];

            // Собираем группы из участников
            const participantGroups = [...new Set(testParticipants.map(p => p.group).filter(g => g))];

            // Также добавляем группы, закреплённые за дисциплиной
            const assignedGroupIds = discipline?.assignedGroups || [];
            const assignedGroups = (adminState.groups || []).filter(g =>
                assignedGroupIds.includes(String(g.id))
            );
            const assignedGroupNames = assignedGroups.map(g => g.name).filter(g => g);

            // Объединяем все группы (из участников + закреплённые за дисциплиной)
            const allGroupNames = [...new Set([...participantGroups, ...assignedGroupNames])].sort((a, b) => a.localeCompare(b, 'ru'));

            const testResults = adminState.results.filter(r => String(r.testId) === String(test.id));

            for (const groupName of allGroupNames) {
                if (!reportData[groupName]) reportData[groupName] = {};

                // Участники из exam/participants
                const groupParticipants = testParticipants.filter(p => p.group === groupName);

                // Если участников нет — берём студентов из группы
                let allParticipantsForGroup = groupParticipants;
                if (groupParticipants.length === 0) {
                    const groupObj = (adminState.groups || []).find(g =>
                        (g.name || '').toUpperCase().trim() === groupName.toUpperCase().trim()
                    );
                    if (groupObj && groupObj.students && groupObj.students.length > 0) {
                        allParticipantsForGroup = groupObj.students.map(s => {
                            const parts = (s.fullName || '').trim().split(/\s+/);
                            return {
                                surname: parts[0] || '',
                                name: parts[1] || '',
                                patronymic: parts.slice(2).join(' ') || '',
                                group: groupName,
                                variant: null
                            };
                        }).filter(p => p.surname && p.name);
                    }
                }

                const groupResultIds = testResults
                    .filter(r => (r.studentGroup || '').toUpperCase().trim() === groupName.toUpperCase().trim())
                    .map(r => r.id);

                reportData[groupName][disciplineName] = {
                    test,
                    allParticipants: allParticipantsForGroup,
                    resultIds: groupResultIds
                };
            }
        }

        // 5. Параллельно загружаем все детальные результаты (пакетами по 20)
        const allResultIds = [];
        for (const groups of Object.values(reportData)) {
            for (const data of Object.values(groups)) {
                for (const id of data.resultIds) {
                    allResultIds.push(id);
                }
            }
        }

        // Загрузка пакетами по 20 параллельных запросов
        const detailedResultsMap = {};
        const batchSize = 20;
        for (let i = 0; i < allResultIds.length; i += batchSize) {
            const batch = allResultIds.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(id =>
                    apiRequest(`/results/${id}`)
                        .then(r => r.success ? { id, result: r.result } : null)
                        .catch(() => null)
                )
            );
            batchResults.filter(Boolean).forEach(r => {
                detailedResultsMap[r.id] = r.result;
            });
        }

        // 6. Генерируем Word файлы параллельно и пакуем в ZIP
        const zip = new JSZip();
        const docPromises = [];

        for (const [groupName, disciplines] of Object.entries(reportData)) {
            const folderName = sanitizeFileName(groupName);

            for (const [disciplineName, data] of Object.entries(disciplines)) {
                const students = data.resultIds
                    .map(id => detailedResultsMap[id])
                    .filter(Boolean);

                docPromises.push(
                    createSrezReportDocx(data.test, disciplineName, groupName, students, data.allParticipants)
                        .then(blob => {
                            const fileName = `${sanitizeFileName(disciplineName)}.docx`;
                            zip.file(`${folderName}/${fileName}`, blob);
                        })
                );
            }
        }

        await Promise.all(docPromises);

        const fileCount = docPromises.length;
        if (fileCount === 0) {
            await showError('Нет данных для формирования отчётов');
            return;
        }

        // 7. Скачиваем ZIP
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = `Отчёты_срезов_${new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')}.zip`;
        link.click();

        await showSuccess(`Архив сформирован: ${fileCount} файлов`);

    } catch (error) {
        console.error('Ошибка массовой выгрузки:', error);
        await showError('Ошибка: ' + error.message);
    }
}

// Создание Word документа для одной группы + дисциплины
async function createSrezReportDocx(test, disciplineName, groupName, detailedResults, allParticipants) {
    const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, BorderStyle, VerticalAlign } = docx;

    const tableBorders = {
        top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
    };

    const createCell = (text, options = {}) => {
        return new TableCell({
            children: [new Paragraph({
                children: [new TextRun({
                    text: String(text),
                    size: options.size || 18,
                    bold: options.bold || false,
                    font: 'Times New Roman'
                })],
                alignment: options.align || AlignmentType.CENTER,
            })],
            verticalAlign: VerticalAlign.CENTER,
            width: options.width ? { size: options.width, type: WidthType.DXA } : undefined,
            borders: tableBorders,
        });
    };

    // Группируем результаты по студентам (лучшая попытка)
    const studentMap = {};
    detailedResults.forEach(r => {
        const key = `${(r.studentSurname || '').toLowerCase().trim()}_${(r.studentName || '').toLowerCase().trim()}`;
        if (!studentMap[key]) {
            studentMap[key] = {
                studentName: r.studentName,
                studentSurname: r.studentSurname,
                studentPatronymic: r.studentPatronymic || '',
                variant: r.variant || null,
                attempts: []
            };
        }
        if (r.variant && !studentMap[key].variant) {
            studentMap[key].variant = r.variant;
        }
        studentMap[key].attempts.push(r);
    });

    Object.values(studentMap).forEach(student => {
        student.attempts.sort((a, b) => b.percentage - a.percentage);
        student.bestAttempt = student.attempts[0];
    });

    // Добавляем участников без результатов
    if (allParticipants && allParticipants.length > 0) {
        allParticipants.forEach(p => {
            const key = `${(p.surname || '').toLowerCase().trim()}_${(p.name || '').toLowerCase().trim()}`;
            if (!studentMap[key]) {
                studentMap[key] = {
                    studentName: p.name || '',
                    studentSurname: p.surname || '',
                    studentPatronymic: p.patronymic || '',
                    variant: p.variant || null,
                    attempts: [],
                    bestAttempt: null,
                    didNotPass: true
                };
            }
        });
    }

    const sortedStudents = Object.values(studentMap).sort((a, b) => {
        return (a.studentSurname || '').localeCompare(b.studentSurname || '', 'ru');
    });

    const questionsCount = test.questionsCount || 10;

    // Максимальный балл
    const studentsWithResults = sortedStudents.filter(s => s.bestAttempt && !s.didNotPass);
    const firstWithMax = studentsWithResults.find(s => s.bestAttempt && s.bestAttempt.maxPoints);
    const maxScore = firstWithMax ? firstWithMax.bestAttempt.maxPoints : questionsCount;

    // Статистика (только для прошедших тест)
    const grades = studentsWithResults.map(s => s.bestAttempt.grade);
    const grade5 = grades.filter(g => g === 5).length;
    const grade4 = grades.filter(g => g === 4).length;
    const grade3 = grades.filter(g => g === 3).length;
    const grade2 = grades.filter(g => g === 2).length;

    const totalStudents = sortedStudents.length;
    const totalParticipated = studentsWithResults.length;

    // Дата - берём дату последнего результата
    const lastDate = detailedResults.length > 0
        ? detailedResults.map(r => new Date(r.completedAt || r.submittedAt)).sort((a, b) => b - a)[0]
        : null;
    const testDate = lastDate ? lastDate.toLocaleDateString('ru-RU') : new Date().toLocaleDateString('ru-RU');

    // ФИО преподавателя
    let teacherName = '';
    if (test.createdBy && adminState.users) {
        const teacher = adminState.users.find(u => String(u.id) === String(test.createdBy));
        if (teacher && teacher.name) {
            const nameParts = teacher.name.trim().split(/\s+/);
            if (nameParts.length >= 3) {
                teacherName = `${nameParts[0]} ${nameParts[1][0]}.${nameParts[2][0]}.`;
            } else if (nameParts.length === 2) {
                teacherName = `${nameParts[0]} ${nameParts[1][0]}.`;
            } else {
                teacherName = teacher.name;
            }
        }
    }

    // Заголовок таблицы
    const headerRow = new TableRow({
        children: [
            createCell('№', { bold: true, size: 18, width: 400 }),
            createCell('ФИО обучающегося', { bold: true, size: 18, width: 3500 }),
            createCell('Вариант', { bold: true, size: 18, width: 700 }),
            ...Array.from({ length: questionsCount }, (_, i) =>
                createCell(String(i + 1), { bold: true, size: 16, width: 350 })
            ),
            createCell('Итого баллов', { bold: true, size: 18, width: 800 }),
            createCell('Оценка', { bold: true, size: 18, width: 700 }),
        ],
    });

    // Строки данных — все студенты (прошедшие и не прошедшие)
    const dataRows = sortedStudents.map((student, idx) => {
        const result = student.bestAttempt;
        const fullName = `${student.studentSurname || ''} ${student.studentName || ''} ${student.studentPatronymic || ''}`.trim();

        // Если студент не проходил тест — ставим '-'
        if (!result || student.didNotPass) {
            return new TableRow({
                children: [
                    createCell(String(idx + 1) + '.', { size: 18 }),
                    createCell(fullName, { align: AlignmentType.LEFT, size: 18 }),
                    createCell(student.variant ? String(student.variant) : '', { size: 18 }),
                    ...Array.from({ length: questionsCount }, () => createCell('-', { size: 16 })),
                    createCell('-', { size: 18 }),
                    createCell('-', { size: 18 }),
                ],
            });
        }

        const questionScores = [];
        if (result.details && result.details.length > 0) {
            for (let i = 0; i < questionsCount; i++) {
                if (result.details[i]) {
                    const detail = result.details[i];
                    const weight = detail.weight || 1;
                    const points = detail.pointsEarned !== undefined ? detail.pointsEarned : (detail.isCorrect ? weight : 0);
                    questionScores.push(points);
                } else {
                    questionScores.push(0);
                }
            }
        } else {
            for (let i = 0; i < questionsCount; i++) questionScores.push(0);
        }

        const totalPoints = result.earnedPoints !== undefined ? result.earnedPoints : (result.correctCount || 0);

        return new TableRow({
            children: [
                createCell(String(idx + 1) + '.', { size: 18 }),
                createCell(fullName, { align: AlignmentType.LEFT, size: 18 }),
                createCell(student.variant ? String(student.variant) : '', { size: 18 }),
                ...questionScores.map(score => createCell(String(score), { size: 16 })),
                createCell(String(totalPoints), { size: 18 }),
                createCell(String(result.grade), { size: 18 }),
            ],
        });
    });

    // Пороги оценок
    const threshold2 = Math.ceil(maxScore * 0.5) - 1;
    const threshold3min = Math.ceil(maxScore * 0.5);
    const threshold3max = Math.ceil(maxScore * 0.7) - 1;
    const threshold4min = Math.ceil(maxScore * 0.7);
    const threshold4max = Math.ceil(maxScore * 0.9) - 1;
    const threshold5min = Math.ceil(maxScore * 0.9);

    // Создаём документ
    const doc = new Document({
        sections: [{
            properties: {
                page: { margin: { top: 567, right: 567, bottom: 567, left: 567 } },
            },
            children: [
                new Paragraph({
                    children: [new TextRun({ text: 'Результаты административного среза', bold: true, size: 28, font: 'Times New Roman' })],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 200 },
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: 'Группа ', size: 24, font: 'Times New Roman' }),
                        new TextRun({ text: groupName, bold: true, size: 24, font: 'Times New Roman' }),
                        new TextRun({ text: '    Дисциплина ', size: 24, font: 'Times New Roman' }),
                        new TextRun({ text: disciplineName, bold: true, size: 24, font: 'Times New Roman' }),
                    ],
                    spacing: { after: 100 },
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: `Дата проведения административного среза ${testDate}`, size: 24, font: 'Times New Roman' }),
                    ],
                    spacing: { after: 100 },
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: `Количество обучающихся в группе по списку – ${totalStudents}`, size: 24, font: 'Times New Roman' }),
                    ],
                    spacing: { after: 100 },
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: `Количество обучающихся, принявших участие в административном срезе - ${totalParticipated}`, size: 24, font: 'Times New Roman' }),
                    ],
                    spacing: { after: 200 },
                }),

                // Таблица результатов
                new Table({
                    rows: [headerRow, ...dataRows],
                    width: { size: 100, type: WidthType.PERCENTAGE },
                }),

                new Paragraph({ spacing: { after: 300 } }),

                // Статистика
                new Paragraph({
                    children: [new TextRun({ text: 'Итого:', bold: true, size: 24, font: 'Times New Roman' })],
                    spacing: { after: 100 },
                }),
                new Table({
                    rows: [
                        new TableRow({ children: [createCell('Оценка', { bold: true, width: 2500 }), createCell('Количество человек', { bold: true, width: 2500 })] }),
                        new TableRow({ children: [createCell('«5»'), createCell(String(grade5))] }),
                        new TableRow({ children: [createCell('«4»'), createCell(String(grade4))] }),
                        new TableRow({ children: [createCell('«3»'), createCell(String(grade3))] }),
                        new TableRow({ children: [createCell('«2»'), createCell(String(grade2))] }),
                    ],
                    width: { size: 30, type: WidthType.PERCENTAGE },
                }),

                new Paragraph({ spacing: { after: 300 } }),

                // Критерии
                new Paragraph({
                    children: [new TextRun({ text: 'Критерии оценивания работы', bold: true, size: 24, font: 'Times New Roman' })],
                    spacing: { after: 100 },
                }),
                ...Array.from({ length: questionsCount }, (_, i) =>
                    new Paragraph({
                        children: [new TextRun({ text: `Полностью верно выполненное задание № ${i + 1} - 1 балл,`, size: 22, font: 'Times New Roman' })],
                    })
                ),

                new Paragraph({ spacing: { after: 200 } }),

                new Paragraph({
                    children: [new TextRun({ text: 'Алгоритм перевода баллов', bold: true, underline: {}, size: 24, font: 'Times New Roman' })],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 100 },
                }),
                new Paragraph({ children: [new TextRun({ text: `Неудовлетворительно - ${threshold2} и менее баллов`, size: 22, font: 'Times New Roman' })] }),
                new Paragraph({ children: [new TextRun({ text: `Удовлетворительно – ${threshold3min}–${threshold3max} баллов`, size: 22, font: 'Times New Roman' })] }),
                new Paragraph({ children: [new TextRun({ text: `Хорошо – ${threshold4min}–${threshold4max} баллов`, size: 22, font: 'Times New Roman' })] }),
                new Paragraph({ children: [new TextRun({ text: `Отлично – ${threshold5min}–${maxScore} баллов`, size: 22, font: 'Times New Roman' })], spacing: { after: 400 } }),

                // Подпись
                new Paragraph({ spacing: { after: 200 } }),
                new Paragraph({
                    children: [
                        new TextRun({ text: 'Преподаватель   ___', size: 24, font: 'Times New Roman' }),
                        new TextRun({ text: teacherName || '_________________', size: 24, font: 'Times New Roman', underline: {} }),
                        new TextRun({ text: '___      ___________________________', size: 24, font: 'Times New Roman' }),
                    ],
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: '                                           ФИО                                                 подпись', size: 20, font: 'Times New Roman', italics: true }),
                    ],
                }),
            ],
        }],
    });

    return await Packer.toBlob(doc);
}
