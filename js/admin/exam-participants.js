// ============================================
// РЕЖИМ ЗАЧЁТА: УПРАВЛЕНИЕ УЧАСТНИКАМИ
// ============================================

// Переменные currentExamTestId, examParticipants определены в state.js

async function showExamParticipantsModal(testId) {
    currentExamTestId = testId;
    const test = adminState.tests.find(t => String(t.id) === String(testId));

    // Загружаем группы если ещё не загружены
    await loadGroupsLazy();

    // Создаём модальное окно если его нет
    if (!document.getElementById('exam-participants-modal')) {
        const modal = document.createElement('div');
        modal.id = 'exam-participants-modal';
        modal.className = 'modal hidden';
        modal.innerHTML = `
            <div class="modal-content participants-modal-compact">
                <div class="modal-header">
                    <h2 id="exam-modal-title">Участники зачёта</h2>
                    <button class="btn-close" onclick="hideExamParticipantsModal()">&times;</button>
                </div>
                <div id="exam-participants-content"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('exam-modal-title').textContent = `Участники: ${test?.name || 'Зачёт'}`;

    // Загружаем участников
    const result = await apiRequest(`/exam/participants?testId=${testId}`);
    examParticipants = result.success ? result.participants : [];

    renderExamParticipantsContent(test);
    showModal('exam-participants-modal');
}

function hideExamParticipantsModal() {
    hideModal('exam-participants-modal');
    currentExamTestId = null;
}

function renderExamParticipantsContent(test) {
    const container = document.getElementById('exam-participants-content');

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
    const participantGroups = [...new Set(examParticipants.map(p => p.group))].sort();

    const statusIcons = {
        'not_started': '⏳',
        'in_progress': '🔄',
        'passed': '✅',
        'failed': '❌'
    };

    const maxAttempts = test?.examSettings?.maxAttempts || 2;

    container.innerHTML = `
        <div class="participants-layout">
            <!-- Левая панель: добавление -->
            <div class="participants-sidebar">
                <div class="participants-info-card">
                    <div class="participants-stat">
                        <span class="stat-value">${examParticipants.length}</span>
                        <span class="stat-label">участников</span>
                    </div>
                    <div class="participants-stat">
                        <span class="stat-value">${participantGroups.length}</span>
                        <span class="stat-label">групп</span>
                    </div>
                </div>

                ${assignedGroups.length > 0 ? `
                    <div class="participants-section">
                        <h4>Быстрое добавление</h4>
                        <div class="quick-add-groups">
                            ${assignedGroups.map(g => {
                                const studentsInGroup = g.students?.length || 0;
                                const alreadyAdded = examParticipants.filter(p => p.group === g.name).length;
                                const isDone = alreadyAdded >= studentsInGroup;
                                return `<button class="group-chip ${isDone ? 'done' : ''}" onclick="addGroupToExam('${g.id}')" ${isDone ? 'disabled' : ''} title="${escapeHtml(g.name)}: ${alreadyAdded}/${studentsInGroup}">
                                    ${escapeHtml(g.name)} <span class="chip-count">${alreadyAdded}/${studentsInGroup}</span>
                                </button>`;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}

                <div class="participants-section">
                    <h4>Добавить вручную</h4>
                    <div class="manual-add-form">
                        <input type="text" id="exam-manual-surname" placeholder="Фамилия" class="input-compact">
                        <input type="text" id="exam-manual-name" placeholder="Имя" class="input-compact">
                        <input type="text" id="exam-manual-patronymic" placeholder="Отчество" class="input-compact">
                        <div class="form-row-compact">
                            <input type="text" id="exam-manual-group" list="exam-groups-list" placeholder="Группа" class="input-compact" oninput="formatGroupInput(this)">
                            <datalist id="exam-groups-list">
                                ${allGroups.map(g => `<option value="${escapeHtml(g.name)}">`).join('')}
                            </datalist>
                            <input type="number" id="exam-manual-attempts" value="${maxAttempts}" min="1" max="10" class="input-compact input-small" title="Попыток">
                        </div>
                        <button class="btn btn-primary btn-full" onclick="addExamParticipantManual()">+ Добавить</button>
                    </div>
                </div>

                <div class="participants-section">
                    <h4>Из файла</h4>
                    <div class="file-upload-compact">
                        <input type="file" id="exam-file" accept=".txt" class="input-compact">
                        <div class="form-row-compact">
                            <input type="text" id="exam-group" list="exam-groups-list-file" placeholder="Группа" class="input-compact" oninput="formatGroupInput(this)">
                            <datalist id="exam-groups-list-file">
                                ${allGroups.map(g => `<option value="${escapeHtml(g.name)}">`).join('')}
                            </datalist>
                            <input type="number" id="exam-attempts-input" value="${maxAttempts}" min="1" max="10" class="input-compact input-small" title="Попыток">
                        </div>
                        <button class="btn btn-secondary btn-full" onclick="uploadExamParticipants()">Загрузить</button>
                    </div>
                </div>
            </div>

            <!-- Правая панель: таблица -->
            <div class="participants-main">
                ${examParticipants.length > 0 ? `
                    <div class="participants-toolbar">
                        <div class="toolbar-left">
                            <input type="text" id="exam-search-input" class="search-input-compact" placeholder="Поиск..." oninput="filterExamParticipants()">
                            ${participantGroups.length > 1 ? `
                                <select id="exam-group-filter" onchange="filterExamParticipants()" class="filter-select">
                                    <option value="">Все группы</option>
                                    ${participantGroups.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('')}
                                </select>
                            ` : ''}
                        </div>
                        <div class="toolbar-right">
                            <button class="btn btn-sm btn-success" onclick="downloadExamPDF()" title="PDF карточки">PDF</button>
                            <button class="btn btn-sm btn-secondary" onclick="exportExamParticipantsToExcel()" title="Excel">Excel</button>
                            <button class="btn btn-sm btn-danger" onclick="clearAllParticipants()" title="Очистить">🗑️</button>
                        </div>
                    </div>

                    <div class="participants-table-wrap">
                        <table class="participants-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>ФИО</th>
                                    <th>Группа</th>
                                    <th>Код</th>
                                    <th>Поп.</th>
                                    <th>Статус</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody id="exam-participants-tbody">
                                ${examParticipants.map((p, i) => `
                                    <tr data-group="${escapeHtml(p.group)}" data-name="${escapeHtml((p.surname + ' ' + p.name + ' ' + (p.patronymic || '')).toLowerCase())}">
                                        <td class="td-num">${i + 1}</td>
                                        <td class="td-name">${escapeHtml(p.surname)} ${escapeHtml(p.name)}${p.patronymic ? ' ' + escapeHtml(p.patronymic.charAt(0)) + '.' : ''}</td>
                                        <td class="td-group">${escapeHtml(p.group)}</td>
                                        <td class="td-code"><code>${escapeHtml(p.password)}</code></td>
                                        <td class="td-att">${p.attemptsLeft}/${p.maxAttempts}</td>
                                        <td class="td-status">${statusIcons[p.status] || '?'}${p.bestGrade ? ` <b>${p.bestGrade}</b>` : ''}</td>
                                        <td class="td-actions">
                                            <button class="btn-mini" onclick="addAttemptToParticipant('${p.id}')" title="+1 попытка">+</button>
                                            <button class="btn-mini btn-danger" onclick="deleteParticipant('${p.id}')" title="Удалить">×</button>
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

function filterExamParticipants() {
    const groupFilter = document.getElementById('exam-group-filter')?.value || '';
    const searchInput = document.getElementById('exam-search-input')?.value.toLowerCase().trim() || '';
    const rows = document.querySelectorAll('#exam-participants-tbody tr');

    rows.forEach(row => {
        const matchesGroup = !groupFilter || row.dataset.group === groupFilter;
        const name = row.dataset.name || '';
        const matchesSearch = !searchInput || name.includes(searchInput);

        toggleElement(row, matchesGroup && matchesSearch);
    });
}

// Добавить всю группу из закреплённых за дисциплиной
async function addGroupToExam(groupId) {
    const group = adminState.groups.find(g => String(g.id) === String(groupId));
    if (!group || !group.students?.length) {
        await showError('В группе нет студентов');
        return;
    }

    const test = adminState.tests.find(t => String(t.id) === String(currentExamTestId));
    const maxAttempts = test?.examSettings?.maxAttempts || 2;

    // Формируем список участников из студентов группы
    const participants = group.students.map(s => {
        const parts = s.fullName.trim().split(/\s+/);
        return {
            surname: parts[0] || '',
            name: parts[1] || '',
            patronymic: parts.slice(2).join(' ') || ''
        };
    }).filter(p => p.surname && p.name);

    if (participants.length === 0) {
        await showError('Не удалось распознать ФИО студентов');
        return;
    }

    const result = await apiRequest('/exam/participants', 'POST', {
        testId: currentExamTestId,
        group: group.name,
        maxAttempts,
        participants
    });

    if (result.success) {
        let message = `Добавлено: ${result.created}`;
        if (result.skipped > 0) {
            message += `, пропущено: ${result.skipped}`;
        }
        await showSuccess(message);
        showExamParticipantsModal(currentExamTestId);
    } else {
        await showError(result.error || 'Ошибка добавления');
    }
}

async function addExamParticipantManual() {
    const surname = document.getElementById('exam-manual-surname').value.trim();
    const name = document.getElementById('exam-manual-name').value.trim();
    const patronymic = document.getElementById('exam-manual-patronymic').value.trim();
    const group = document.getElementById('exam-manual-group').value.trim();
    const attempts = parseInt(document.getElementById('exam-manual-attempts').value) || 2;

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
        testId: currentExamTestId,
        group,
        maxAttempts: attempts,
        participants: [{
            surname,
            name,
            patronymic
        }]
    });

    if (result.success) {
        await showSuccess('Участник добавлен');
        // Очищаем поля
        document.getElementById('exam-manual-surname').value = '';
        document.getElementById('exam-manual-name').value = '';
        document.getElementById('exam-manual-patronymic').value = '';
        // Группу не очищаем - часто добавляют несколько человек из одной группы
        showExamParticipantsModal(currentExamTestId);
    } else {
        await showError(result.error || 'Ошибка добавления');
    }
}

async function uploadExamParticipants() {
    const fileInput = document.getElementById('exam-file');
    const group = document.getElementById('exam-group').value.trim();
    const attempts = parseInt(document.getElementById('exam-attempts-input').value) || 2;

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
            patronymic: parts.slice(2).join(' ') || ''
        };
    }).filter(p => p.surname && p.name);

    if (participants.length === 0) {
        await showError('Не удалось распознать ФИО. Формат: Фамилия Имя Отчество');
        return;
    }

    const result = await apiRequest('/exam/participants', 'POST', {
        testId: currentExamTestId,
        group,
        maxAttempts: attempts,
        participants
    });

    if (result.success) {
        await showSuccess(`Добавлено участников: ${result.created}`);
        showExamParticipantsModal(currentExamTestId); // Обновляем
    } else {
        await showError(result.error || 'Ошибка загрузки');
    }
}

async function addAttemptToParticipant(participantId) {
    const result = await apiRequest(`/exam/participants/${participantId}`, 'PUT', { addAttempts: 1 });
    if (result.success) {
        showExamParticipantsModal(currentExamTestId);
    } else {
        await showError(result.error || 'Ошибка');
    }
}

async function deleteParticipant(participantId) {
    if (!await showConfirm('Удалить участника?', 'Удаление участника')) return;

    const result = await apiRequest(`/exam/participants/${participantId}`, 'DELETE');
    if (result.success) {
        showExamParticipantsModal(currentExamTestId);
    } else {
        await showError(result.error || 'Ошибка удаления');
    }
}

async function clearAllParticipants() {
    if (!await showConfirm('Удалить ВСЕХ участников этого зачёта?', 'Удаление всех участников')) return;

    const result = await apiRequest(`/exam/participants?testId=${currentExamTestId}`, 'DELETE');
    if (result.success) {
        showExamParticipantsModal(currentExamTestId);
    } else {
        await showError(result.error || 'Ошибка удаления');
    }
}

// Генерация PDF с карточками для нарезки
async function downloadExamPDF() {
    if (examParticipants.length === 0) {
        await showError('Нет участников для генерации');
        return;
    }

    const test = adminState.tests.find(t => String(t.id) === String(currentExamTestId));
    const topic = adminState.topics.find(t => String(t.id) === String(test?.topicId));
    const discipline = adminState.disciplines.find(d => String(d.id) === String(topic?.disciplineId));
    const disciplineName = discipline?.name || '';
    const testName = test?.name || 'Зачёт';

    // Сортируем участников по группе, затем по фамилии
    const sortedParticipants = [...examParticipants].sort((a, b) => {
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
                <div class="code-section">
                    <div class="code-label">Ваш код:</div>
                    <div class="code">${escapeHtml(p.password)}</div>
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
            margin-bottom: 3mm;
        }

        .group {
            font-size: 9pt;
            color: #666;
            font-weight: 500;
            margin-bottom: 1mm;
        }

        .fio {
            font-size: 11pt;
            font-weight: 700;
            color: #000;
        }

        .code-section {
            text-align: center;
            background: #f0f7ff;
            border-radius: 3mm;
            padding: 3mm;
            border: 1px solid #cce0ff;
        }

        .code-label {
            font-size: 7pt;
            color: #666;
            text-transform: uppercase;
            margin-bottom: 1mm;
        }

        .code {
            font-family: 'Courier New', monospace;
            font-size: 16pt;
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

// Экспорт участников зачёта в Excel
async function exportExamParticipantsToExcel() {
    try {
        // Проверяем доступность библиотеки ExcelJS
        if (typeof ExcelJS === 'undefined') {
            await showError('Библиотека ExcelJS не загружена. Обновите страницу.');
            return;
        }

        if (examParticipants.length === 0) {
            await showError('Нет участников для экспорта');
            return;
        }

        const test = adminState.tests.find(t => String(t.id) === String(currentExamTestId));
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

    const ws = workbook.addWorksheet('Участники зачёта', {
        properties: { tabColor: { argb: 'FF2B579A' } }
    });

    // Заголовок
    ws.mergeCells('A1:H1');
    ws.getCell('A1').value = `УЧАСТНИКИ ЗАЧЁТА: ${test?.name || 'Зачёт'}`;
    ws.getCell('A1').style = {
        font: { bold: true, size: 16, color: { argb: 'FF2B579A' } },
        alignment: { horizontal: 'center', vertical: 'middle' }
    };
    ws.getRow(1).height = 30;

    if (discipline) {
        ws.getCell('A2').value = `Дисциплина: ${discipline.name}`;
        ws.getCell('A2').font = { italic: true };
    }

    ws.getCell('A3').value = `Дата: ${new Date().toLocaleDateString('ru-RU')} | Всего участников: ${examParticipants.length}`;

    // Заголовки таблицы
    ws.getRow(5).values = ['№', 'Фамилия', 'Имя', 'Отчество', 'Группа', 'Код', 'Попытки', 'Статус'];
    ws.getRow(5).eachCell((cell) => { cell.style = tableHeaderStyle; });
    ws.getRow(5).height = 25;

    // Сортируем по группе и фамилии
    const sorted = [...examParticipants].sort((a, b) => {
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
            p.password || '',
            `${p.attemptsLeft}/${p.maxAttempts}`,
            statusText[p.status] || p.status
        ];
        ws.getRow(rowNum).eachCell((cell) => { cell.style = cellStyle; });
    });

    ws.columns = [
        { width: 6 }, { width: 20 }, { width: 15 }, { width: 18 },
        { width: 12 }, { width: 10 }, { width: 12 }, { width: 14 }
    ];

    // Скачиваем файл
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Участники_зачёта_${test?.name || 'Зачёт'}_${new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);

    showSuccess('Экспорт участников завершён');
    } catch (error) {
        console.error('Ошибка экспорта в Excel:', error);
        await showError('Ошибка при создании файла: ' + error.message);
    }
}
