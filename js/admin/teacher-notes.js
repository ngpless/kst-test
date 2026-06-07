// ============================================
// ОТМЕТКИ ПРЕПОДАВАТЕЛЯ
// ============================================

async function showTeacherNotesModal(resultId) {
    // Загружаем детали результата
    const response = await apiRequest(`/results/${resultId}`);
    if (!response.success) {
        showNotification('Ошибка загрузки данных', 'error');
        return;
    }

    const result = response.result;
    const teacherNotes = result.teacherNotes || [];

    const noteTypes = [
        { value: 'cheating', label: '📋 Списывание' },
        { value: 'phone', label: '📱 Использование телефона' },
        { value: 'talking', label: '💬 Разговор' },
        { value: 'notes', label: '📝 Использование шпаргалки' },
        { value: 'help', label: '🤝 Получал подсказки' },
        { value: 'other', label: '📌 Другое' }
    ];

    const typeOptions = noteTypes.map(t => `<option value="${t.value}">${t.label}</option>`).join('');

    // Генерируем список существующих отметок
    const existingNotes = teacherNotes.map((note, idx) => {
        const noteType = noteTypes.find(t => t.value === note.type);
        return `
            <div class="teacher-note-item" data-id="${note.id}">
                <span class="note-type">${noteType ? noteType.label : note.type}</span>
                <span class="note-desc">${note.description || '-'}</span>
                <span class="note-by">${note.addedBy}</span>
                <span class="note-time">${new Date(note.timestamp).toLocaleString('ru-RU')}</span>
                <button class="btn-icon-delete" onclick="removeTeacherNote('${resultId}', '${note.id}')" title="Удалить отметку">×</button>
            </div>
        `;
    }).join('') || '<p class="no-notes">Отметок пока нет</p>';

    const modalHtml = `
        <div class="teacher-notes-modal-overlay" id="teacher-notes-modal">
            <div class="teacher-notes-modal">
                <div class="modal-header">
                    <h3>👨‍🏫 Отметки преподавателя</h3>
                    <button class="modal-close" onclick="closeTeacherNotesModal()">×</button>
                </div>
                <div class="modal-student-info">
                    <strong>${result.studentSurname} ${result.studentName}</strong>
                    <span class="student-group">${result.studentGroup}</span>
                </div>

                <div class="existing-notes">
                    <h4>Существующие отметки (${teacherNotes.length})</h4>
                    <div class="notes-list">
                        ${existingNotes}
                    </div>
                </div>

                <div class="add-note-section">
                    <h4>Добавить отметку</h4>
                    <div class="note-form">
                        <select id="new-note-type" class="note-type-select">
                            ${typeOptions}
                        </select>
                        <input type="text" id="new-note-description" placeholder="Описание (опционально)" class="note-description-input">
                        <button class="btn btn-primary" onclick="addTeacherNote('${resultId}')">Добавить</button>
                    </div>
                </div>

                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeTeacherNotesModal()">Закрыть</button>
                </div>
            </div>
        </div>
    `;

    // Добавляем стили для модалки если ещё не добавлены
    if (!document.getElementById('teacher-notes-modal-styles')) {
        const styles = document.createElement('style');
        styles.id = 'teacher-notes-modal-styles';
        styles.textContent = `
            .teacher-notes-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            }
            .teacher-notes-modal {
                background: var(--card);
                border-radius: 16px;
                padding: 24px;
                max-width: 600px;
                width: 95%;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            }
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
                padding-bottom: 12px;
                border-bottom: 1px solid var(--border);
            }
            .modal-header h3 { margin: 0; color: var(--text); }
            .modal-close {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: var(--text-light);
                padding: 4px 8px;
            }
            .modal-close:hover { color: var(--danger); }
            .modal-student-info {
                background: var(--bg);
                padding: 12px 16px;
                border-radius: 8px;
                margin-bottom: 20px;
            }
            .modal-student-info .student-group {
                color: var(--text-light);
                margin-left: 12px;
            }
            .existing-notes h4, .add-note-section h4 {
                margin: 0 0 12px 0;
                color: var(--text);
                font-size: 0.95rem;
            }
            .notes-list {
                background: var(--bg);
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 20px;
            }
            .teacher-note-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px 12px;
                background: var(--card);
                border-radius: 6px;
                margin-bottom: 8px;
            }
            .teacher-note-item:last-child { margin-bottom: 0; }
            .note-type { font-weight: 500; min-width: 150px; }
            .note-desc { flex: 1; color: var(--text-light); }
            .note-by { font-size: 0.8rem; color: var(--text-light); }
            .note-time { font-size: 0.8rem; color: var(--text-light); }
            .teacher-note-item .btn-icon-delete {
                background: none;
                border: none;
                color: var(--danger);
                cursor: pointer;
                font-size: 18px;
                padding: 4px 8px;
            }
            .no-notes { color: var(--text-light); text-align: center; margin: 0; }
            .note-form {
                display: flex;
                gap: 12px;
                flex-wrap: wrap;
            }
            .note-type-select {
                padding: 10px 12px;
                border: 1px solid var(--border);
                border-radius: 8px;
                background: var(--card);
                color: var(--text);
                min-width: 200px;
            }
            .note-description-input {
                flex: 1;
                min-width: 150px;
                padding: 10px 12px;
                border: 1px solid var(--border);
                border-radius: 8px;
                background: var(--card);
                color: var(--text);
            }
            .modal-footer {
                margin-top: 20px;
                padding-top: 16px;
                border-top: 1px solid var(--border);
                text-align: right;
            }
            .btn-teacher { color: #d97706 !important; }
            .btn-teacher:hover { background: rgba(217, 119, 6, 0.1) !important; }
        `;
        document.head.appendChild(styles);
    }

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeTeacherNotesModal() {
    const modal = document.getElementById('teacher-notes-modal');
    if (modal) modal.remove();
}

async function addTeacherNote(resultId) {
    const noteType = document.getElementById('new-note-type').value;
    const noteDescription = document.getElementById('new-note-description').value.trim();

    // Загружаем текущие отметки
    const response = await apiRequest(`/results/${resultId}`);
    if (!response.success) {
        showNotification('Ошибка загрузки', 'error');
        return;
    }

    const currentNotes = response.result.teacherNotes || [];

    // Добавляем новую отметку
    currentNotes.push({
        type: noteType,
        description: noteDescription,
        timestamp: new Date().toISOString()
    });

    // Сохраняем
    const saveResponse = await apiRequest(`/results/${resultId}/teacher-notes`, 'PUT', {
        teacherNotes: currentNotes
    });

    if (saveResponse.success) {
        showNotification('Отметка добавлена', 'success');
        closeTeacherNotesModal();
        showTeacherNotesModal(resultId); // Перезагружаем модалку
        // Обновляем данные результатов в памяти без сброса фильтров
        const newResults = await loadAllResults();
        if (newResults.length > 0) {
            adminState.results = newResults;
            filterResultsAdvanced(false);
        }
    } else {
        showNotification('Ошибка сохранения', 'error');
    }
}

async function removeTeacherNote(resultId, noteId) {
    if (!await showConfirm('Удалить эту отметку?', 'Удаление')) return;

    // Загружаем текущие отметки
    const response = await apiRequest(`/results/${resultId}`);
    if (!response.success) {
        showNotification('Ошибка загрузки', 'error');
        return;
    }

    // Удаляем отметку по ID
    const filteredNotes = (response.result.teacherNotes || []).filter(n => n.id !== noteId);

    // Сохраняем
    const saveResponse = await apiRequest(`/results/${resultId}/teacher-notes`, 'PUT', {
        teacherNotes: filteredNotes
    });

    if (saveResponse.success) {
        showNotification('Отметка удалена', 'success');
        closeTeacherNotesModal();
        showTeacherNotesModal(resultId); // Перезагружаем модалку
        // Обновляем данные результатов в памяти без сброса фильтров
        const newResults = await loadAllResults();
        if (newResults.length > 0) {
            adminState.results = newResults;
            filterResultsAdvanced(false);
        }
    } else {
        showNotification('Ошибка удаления', 'error');
    }
}

function exportResults() {
    // Экспортируем отфильтрованные результаты (если есть), иначе все
    const resultsToExport = adminState.filteredResults && adminState.filteredResults.length > 0
        ? adminState.filteredResults
        : adminState.results;

    const csv = ['Фамилия;Имя;Группа;Дисциплина;Тест;Баллы;Макс.баллы;Процент;Оценка;Нарушений (античит);Штрафы (препод.);Дата'];
    resultsToExport.forEach(r => {
        const test = adminState.tests.find(t => String(t.id) === String(r.testId));
        const discipline = test ? adminState.disciplines.find(d => String(d.id) === String(test.disciplineId)) : null;
        const disciplineName = discipline ? discipline.name : '';
        const testName = test ? test.name : (r.testName || 'Неизвестно');
        const completedDate = r.completedAt || r.submittedAt;
        const violationsCount = r.violationsCount || (r.violations ? r.violations.length : 0);
        const teacherPenaltyCount = r.teacherPenaltyCount || (r.teacherNotes ? r.teacherNotes.length : 0);
        // Используем скорректированные баллы если есть
        const earnedPoints = r.adjustedEarnedPoints !== undefined ? r.adjustedEarnedPoints : (r.earnedPoints || r.correctCount || 0);
        const maxPoints = r.maxPoints || r.totalQuestions || 0;

        csv.push(`${r.studentSurname || ''};${r.studentName || ''};${r.studentGroup || ''};${disciplineName};${testName};${earnedPoints};${maxPoints};${r.percentage};${r.grade};${violationsCount};${teacherPenaltyCount};${completedDate ? new Date(completedDate).toLocaleString('ru-RU') : ''}`);
    });

    // BOM для корректного отображения UTF-8 в Excel
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `results_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

// ============================================
// ЭКСПОРТ ГРУППЫ В EXCEL (КРАСИВЫЙ АКАДЕМИЧЕСКИЙ ОТЧЁТ)
// ============================================

async function exportGroupToExcel() {
    try {
        // Проверяем доступность библиотеки ExcelJS
        if (typeof ExcelJS === 'undefined') {
            showNotification('Библиотека ExcelJS не загружена. Обновите страницу.', 'error');
            return;
        }

        // Получаем выбранные группы (если есть) - используем кастомный dropdown
        const selectedGroups = (getSearchableDropdownValue('results-group-filter') || [])
            .map(g => g.toUpperCase().trim())
            .filter(g => g); // Убираем пустые

        // Получаем выбранный тест - используем кастомный dropdown
        const testFilter = getSearchableDropdownValue('results-test-filter');
        if (!testFilter) {
            showNotification('Выберите тест для экспорта', 'warning');
            return;
        }

    const test = adminState.tests.find(t => String(t.id) === String(testFilter));
    if (!test) {
        showNotification('Тест не найден', 'error');
        return;
    }

    showNotification('Загрузка данных... Пожалуйста, подождите.', 'info');

    // Фильтруем результаты по тесту (и группам, если выбраны)
    const filteredResults = adminState.results.filter(r => {
        if (String(r.testId) !== String(testFilter)) return false;
        // Если группы не выбраны - берём все результаты по тесту
        if (selectedGroups.length === 0) return true;
        const studentGroup = (r.studentGroup || '').toUpperCase().trim();
        return selectedGroups.includes(studentGroup);
    });

    if (filteredResults.length === 0) {
        showNotification('Нет результатов для выбранной группы и теста', 'warning');
        return;
    }

    // Загружаем детальные данные каждого результата
    const detailedResults = [];
    for (const r of filteredResults) {
        try {
            const response = await apiRequest(`/results/${r.id}`);
            if (response.success) {
                detailedResults.push(response.result);
            }
        } catch (e) {
            console.error('Ошибка загрузки результата:', r.id, e);
        }
    }

    if (detailedResults.length === 0) {
        showNotification('Не удалось загрузить детальные данные', 'error');
        return;
    }

    // Группируем результаты по студентам (ФИО + группа)
    const studentMap = {};
    detailedResults.forEach(r => {
        const key = `${(r.studentSurname || '').toLowerCase().trim()}_${(r.studentName || '').toLowerCase().trim()}_${(r.studentGroup || '').toUpperCase().trim()}`;
        if (!studentMap[key]) {
            studentMap[key] = {
                studentName: r.studentName,
                studentSurname: r.studentSurname,
                studentGroup: r.studentGroup,
                attempts: []
            };
        }
        studentMap[key].attempts.push(r);
    });

    // Сортируем попытки каждого студента по дате
    Object.values(studentMap).forEach(student => {
        student.attempts.sort((a, b) => new Date(a.completedAt || a.submittedAt) - new Date(b.completedAt || b.submittedAt));
        // Лучшая попытка - с максимальным процентом
        student.bestAttempt = student.attempts.reduce((best, curr) =>
            curr.percentage > best.percentage ? curr : best, student.attempts[0]);
    });

    // Массив студентов с лучшими результатами для рейтинга и статистики
    const bestResults = Object.values(studentMap).map(s => s.bestAttempt);

    // Создаём Excel с ExcelJS
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Система тестирования';
    workbook.created = new Date();

    // Если группы не выбраны - собираем уникальные группы из результатов
    const groupName = selectedGroups.length > 0
        ? selectedGroups.join(', ')
        : [...new Set(detailedResults.map(r => (r.studentGroup || '').toUpperCase().trim()).filter(g => g))].sort().join(', ') || 'Все группы';

    // Стили
    const headerStyle = {
        font: { bold: true, size: 14, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B579A' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
        }
    };

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

    // Сортируем по фамилии по алфавиту
    const sorted = [...bestResults].sort((a, b) => {
        const surnameA = (a.studentSurname || '').toLowerCase();
        const surnameB = (b.studentSurname || '').toLowerCase();
        return surnameA.localeCompare(surnameB, 'ru');
    });

    // Статистика (по лучшим результатам)
    const grades = bestResults.map(r => r.grade);
    const percentages = bestResults.map(r => r.percentage);
    const avgPercent = (percentages.reduce((a, b) => a + b, 0) / percentages.length).toFixed(1);
    const grade5 = grades.filter(g => g === 5).length;
    const grade4 = grades.filter(g => g === 4).length;
    const grade3 = grades.filter(g => g === 3).length;
    const grade2 = grades.filter(g => g === 2).length;
    const passed = grades.filter(g => g >= 3).length;

    // ======= ЛИСТ 1: СВОДКА =======
    const ws1 = workbook.addWorksheet('Сводка', {
        properties: { tabColor: { argb: 'FF2B579A' } }
    });

    // Заголовок
    ws1.mergeCells('A1:F1');
    ws1.getCell('A1').value = 'ВЕДОМОСТЬ РЕЗУЛЬТАТОВ ТЕСТИРОВАНИЯ';
    ws1.getCell('A1').style = {
        font: { bold: true, size: 18, color: { argb: 'FF2B579A' } },
        alignment: { horizontal: 'center', vertical: 'middle' }
    };
    ws1.getRow(1).height = 35;

    // Информация о тесте
    ws1.getCell('A3').value = 'Дисциплина:';
    ws1.getCell('A3').font = { bold: true };
    const discipline = adminState.disciplines.find(d => String(d.id) === String(test.disciplineId));
    ws1.getCell('B3').value = discipline ? discipline.name : '-';

    ws1.getCell('A4').value = 'Тест:';
    ws1.getCell('A4').font = { bold: true };
    ws1.getCell('B4').value = test.name;

    ws1.getCell('A5').value = 'Группа:';
    ws1.getCell('A5').font = { bold: true };
    ws1.getCell('B5').value = groupName;

    ws1.getCell('A6').value = 'Дата формирования:';
    ws1.getCell('A6').font = { bold: true };
    ws1.getCell('B6').value = new Date().toLocaleDateString('ru-RU');

    // Статистика - красивый блок
    ws1.mergeCells('A8:F8');
    ws1.getCell('A8').value = 'СТАТИСТИКА';
    ws1.getCell('A8').style = headerStyle;
    ws1.getRow(8).height = 25;

    // Статистика в две колонки
    ws1.getCell('A10').value = 'Всего студентов:';
    ws1.getCell('B10').value = bestResults.length;
    ws1.getCell('B10').font = { bold: true, size: 14 };

    ws1.getCell('A11').value = 'Средний балл:';
    ws1.getCell('B11').value = avgPercent + '%';
    ws1.getCell('B11').font = { bold: true, size: 14 };

    ws1.getCell('D10').value = 'Сдали:';
    ws1.getCell('E10').value = passed;
    ws1.getCell('E10').font = { bold: true, color: { argb: 'FF28A745' } };
    ws1.getCell('F10').value = `(${((passed / bestResults.length) * 100).toFixed(0)}%)`;

    ws1.getCell('D11').value = 'Не сдали:';
    ws1.getCell('E11').value = grade2;
    ws1.getCell('E11').font = { bold: true, color: { argb: 'FFDC3545' } };
    ws1.getCell('F11').value = `(${((grade2 / bestResults.length) * 100).toFixed(0)}%)`;

    // Распределение оценок
    ws1.mergeCells('A13:F13');
    ws1.getCell('A13').value = 'РАСПРЕДЕЛЕНИЕ ОЦЕНОК';
    ws1.getCell('A13').style = headerStyle;
    ws1.getRow(13).height = 25;

    const gradeLabels = ['Отлично (5)', 'Хорошо (4)', 'Удовлетв. (3)', 'Неудовлетв. (2)'];
    const gradeCounts = [grade5, grade4, grade3, grade2];
    const gradeColors = ['FF28A745', 'FF5BC0DE', 'FFFFC107', 'FFDC3545'];

    gradeLabels.forEach((label, idx) => {
        ws1.getCell(`A${15 + idx}`).value = label;
        ws1.getCell(`B${15 + idx}`).value = gradeCounts[idx];
        ws1.getCell(`B${15 + idx}`).font = { bold: true };
        ws1.getCell(`C${15 + idx}`).value = `${((gradeCounts[idx] / bestResults.length) * 100).toFixed(0)}%`;

        // Визуальная полоса
        const percent = (gradeCounts[idx] / bestResults.length) * 100;
        ws1.getCell(`D${15 + idx}`).value = '█'.repeat(Math.round(percent / 5));
        ws1.getCell(`D${15 + idx}`).font = { color: { argb: gradeColors[idx] } };
    });

    // Ширина колонок
    ws1.columns = [
        { width: 22 }, { width: 15 }, { width: 12 }, { width: 15 }, { width: 10 }, { width: 12 }
    ];

    // ======= ЛИСТ 2: РЕЙТИНГ =======
    const ws2 = workbook.addWorksheet('Рейтинг студентов', {
        properties: { tabColor: { argb: 'FF28A745' } }
    });

    // Заголовок
    ws2.mergeCells('A1:K1');
    ws2.getCell('A1').value = `РЕЙТИНГ СТУДЕНТОВ — ${groupName}`;
    ws2.getCell('A1').style = {
        font: { bold: true, size: 16, color: { argb: 'FF2B579A' } },
        alignment: { horizontal: 'center', vertical: 'middle' }
    };
    ws2.getRow(1).height = 30;

    // Заголовки таблицы (добавлен столбец "Штрафы препод.")
    const headers = ['№', 'Фамилия', 'Имя', 'Группа', 'Баллы', 'Макс', '%', 'Оценка', 'Нарушения', 'Штрафы', 'Дата'];
    ws2.getRow(3).values = headers;
    ws2.getRow(3).eachCell((cell) => {
        cell.style = tableHeaderStyle;
    });
    ws2.getRow(3).height = 25;

    // Данные студентов
    sorted.forEach((r, idx) => {
        const rowNum = 4 + idx;
        const date = r.completedAt || r.submittedAt;
        const violations = r.violationsCount || (r.violations ? r.violations.length : 0);
        const teacherPenalties = r.teacherPenaltyCount || (r.teacherNotes ? r.teacherNotes.length : 0);
        // Используем скорректированные баллы
        const earnedPoints = r.adjustedEarnedPoints !== undefined ? r.adjustedEarnedPoints : (r.earnedPoints || r.correctCount || 0);
        const maxPoints = r.maxPoints || r.totalQuestions || 0;

        ws2.getRow(rowNum).values = [
            idx + 1,
            r.studentSurname || '',
            r.studentName || '',
            r.studentGroup || '',
            earnedPoints,
            maxPoints,
            r.percentage,
            r.grade,
            violations,
            teacherPenalties,
            date ? new Date(date).toLocaleDateString('ru-RU') : ''
        ];

        // Стилизация строки
        ws2.getRow(rowNum).eachCell((cell) => {
            cell.style = cellStyle;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        // Цвет по оценке
        const gradeCell = ws2.getCell(`H${rowNum}`);
        if (r.grade === 5) {
            gradeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } };
            gradeCell.font = { bold: true, color: { argb: 'FF155724' } };
        } else if (r.grade === 4) {
            gradeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1ECF1' } };
            gradeCell.font = { bold: true, color: { argb: 'FF0C5460' } };
        } else if (r.grade === 3) {
            gradeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
            gradeCell.font = { bold: true, color: { argb: 'FF856404' } };
        } else {
            gradeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8D7DA' } };
            gradeCell.font = { bold: true, color: { argb: 'FF721C24' } };
        }

        // Подсветка нарушений
        if (violations > 0) {
            ws2.getCell(`I${rowNum}`).font = { bold: true, color: { argb: 'FFDC3545' } };
        }

        // Подсветка штрафов преподавателя
        if (teacherPenalties > 0) {
            ws2.getCell(`J${rowNum}`).font = { bold: true, color: { argb: 'FFD97706' } };
        }

        // Чередование цвета строк
        if (idx % 2 === 1) {
            ws2.getRow(rowNum).eachCell((cell) => {
                if (!cell.fill || cell.fill.fgColor?.argb === undefined) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
                }
            });
        }
    });

    // Ширина колонок (добавлен столбец для штрафов)
    ws2.columns = [
        { width: 5 }, { width: 20 }, { width: 15 }, { width: 14 },
        { width: 8 }, { width: 6 }, { width: 6 }, { width: 10 }, { width: 10 }, { width: 8 }, { width: 14 }
    ];

    // Закрепление заголовка
    ws2.views = [{ state: 'frozen', ySplit: 3 }];

    // ======= ЛИСТ 3: АНАЛИЗ ВОПРОСОВ =======
    const ws3 = workbook.addWorksheet('Анализ вопросов', {
        properties: { tabColor: { argb: 'FFFFC107' } }
    });

    // Собираем статистику по вопросам
    const questionStats = {};
    detailedResults.forEach(result => {
        if (result.details) {
            result.details.forEach(detail => {
                const qId = detail.questionId;
                if (!questionStats[qId]) {
                    questionStats[qId] = {
                        text: detail.questionText || 'Вопрос',
                        correct: 0,
                        total: 0
                    };
                }
                questionStats[qId].total++;
                if (detail.isCorrect) questionStats[qId].correct++;
            });
        }
    });

    const sortedQuestions = Object.entries(questionStats)
        .map(([id, stat]) => ({
            id, text: stat.text, correct: stat.correct, total: stat.total,
            percent: Math.round((stat.correct / stat.total) * 100)
        }))
        .sort((a, b) => a.percent - b.percent);

    // Заголовок
    ws3.mergeCells('A1:F1');
    ws3.getCell('A1').value = 'АНАЛИЗ СЛОЖНОСТИ ВОПРОСОВ';
    ws3.getCell('A1').style = {
        font: { bold: true, size: 16, color: { argb: 'FF2B579A' } },
        alignment: { horizontal: 'center', vertical: 'middle' }
    };
    ws3.getRow(1).height = 30;

    ws3.getCell('A2').value = 'Вопросы отсортированы по сложности (сначала самые трудные)';
    ws3.getCell('A2').font = { italic: true, color: { argb: 'FF666666' } };

    // Заголовки таблицы
    ws3.getRow(4).values = ['№', 'Вопрос', 'Верно', 'Всего', '% верных', 'Уровень'];
    ws3.getRow(4).eachCell((cell) => { cell.style = tableHeaderStyle; });
    ws3.getRow(4).height = 25;

    sortedQuestions.forEach((q, idx) => {
        const rowNum = 5 + idx;
        let level = 'Лёгкий';
        let levelColor = 'FF28A745';
        if (q.percent < 50) { level = 'Сложный'; levelColor = 'FFDC3545'; }
        else if (q.percent < 70) { level = 'Средний'; levelColor = 'FFFFC107'; }

        ws3.getRow(rowNum).values = [
            idx + 1,
            q.text.length > 100 ? q.text.substring(0, 100) + '...' : q.text,
            q.correct, q.total, q.percent + '%', level
        ];

        ws3.getRow(rowNum).eachCell((cell) => { cell.style = cellStyle; });
        ws3.getCell(`F${rowNum}`).font = { bold: true, color: { argb: levelColor } };

        if (idx % 2 === 1) {
            ws3.getRow(rowNum).eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
            });
        }
    });

    ws3.columns = [
        { width: 5 }, { width: 70 }, { width: 8 }, { width: 8 }, { width: 10 }, { width: 12 }
    ];
    ws3.views = [{ state: 'frozen', ySplit: 4 }];

    // ======= ЛИСТЫ СТУДЕНТОВ =======
    // Используем studentMap для отображения всех попыток
    // Сортировка по алфавиту (фамилия)
    const sortedStudents = Object.values(studentMap).sort((a, b) => {
        const surnameA = (a.studentSurname || '').toLowerCase();
        const surnameB = (b.studentSurname || '').toLowerCase();
        if (surnameA < surnameB) return -1;
        if (surnameA > surnameB) return 1;
        // Если фамилии одинаковые - по имени
        const nameA = (a.studentName || '').toLowerCase();
        const nameB = (b.studentName || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });

    sortedStudents.forEach((student, idx) => {
        const studentFullName = `${student.studentSurname || ''} ${student.studentName || ''}`.trim();
        let sheetName = `${idx + 1}. ${student.studentSurname || 'Студент'}`;
        if (sheetName.length > 31) sheetName = sheetName.substring(0, 28) + '...';
        sheetName = sheetName.replace(/[\\\/\?\*\[\]:]/g, '');

        const bestResult = student.bestAttempt;
        const wsStudent = workbook.addWorksheet(sheetName, {
            properties: { tabColor: { argb: bestResult.grade >= 3 ? 'FF28A745' : 'FFDC3545' } }
        });

        // Заголовок с оценкой
        wsStudent.mergeCells('A1:E1');
        wsStudent.getCell('A1').value = studentFullName;
        wsStudent.getCell('A1').style = {
            font: { bold: true, size: 18, color: { argb: 'FF2B579A' } },
            alignment: { horizontal: 'center', vertical: 'middle' }
        };
        wsStudent.getRow(1).height = 35;

        // Информация о лучшем результате
        wsStudent.getCell('A3').value = 'Группа:';
        wsStudent.getCell('A3').font = { bold: true };
        wsStudent.getCell('B3').value = student.studentGroup || '';

        wsStudent.getCell('A4').value = 'Лучший результат:';
        wsStudent.getCell('A4').font = { bold: true };
        wsStudent.getCell('B4').value = `${bestResult.correctCount} из ${bestResult.totalQuestions} (${bestResult.percentage}%)`;

        wsStudent.getCell('D3').value = 'Лучшая оценка:';
        wsStudent.getCell('D3').font = { bold: true };
        wsStudent.getCell('E3').value = bestResult.grade;
        wsStudent.getCell('E3').font = { bold: true, size: 20 };
        if (bestResult.grade >= 4) wsStudent.getCell('E3').font.color = { argb: 'FF28A745' };
        else if (bestResult.grade === 3) wsStudent.getCell('E3').font.color = { argb: 'FFFFC107' };
        else wsStudent.getCell('E3').font.color = { argb: 'FFDC3545' };

        wsStudent.getCell('D4').value = 'Всего попыток:';
        wsStudent.getCell('D4').font = { bold: true };
        wsStudent.getCell('E4').value = student.attempts.length;
        wsStudent.getCell('E4').font = { bold: true, size: 14 };

        let rowNum = 6;

        // ======= ИСТОРИЯ ПОПЫТОК =======
        if (student.attempts.length > 1) {
            wsStudent.mergeCells(`A${rowNum}:E${rowNum}`);
            wsStudent.getCell(`A${rowNum}`).value = 'ИСТОРИЯ ПОПЫТОК';
            wsStudent.getCell(`A${rowNum}`).style = {
                font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6C757D' } },
                alignment: { horizontal: 'center', vertical: 'middle' }
            };
            wsStudent.getRow(rowNum).height = 25;
            rowNum++;

            wsStudent.getRow(rowNum).values = ['Попытка', 'Дата', 'Результат', '%', 'Оценка'];
            wsStudent.getRow(rowNum).eachCell((cell) => { cell.style = tableHeaderStyle; });
            rowNum++;

            student.attempts.forEach((attempt, attemptIdx) => {
                const attemptDate = attempt.completedAt || attempt.submittedAt;
                const isBest = attempt.id === bestResult.id;
                wsStudent.getRow(rowNum).values = [
                    attemptIdx + 1,
                    attemptDate ? new Date(attemptDate).toLocaleString('ru-RU') : '-',
                    `${attempt.correctCount} из ${attempt.totalQuestions}`,
                    attempt.percentage + '%',
                    attempt.grade
                ];
                wsStudent.getRow(rowNum).eachCell((cell) => {
                    cell.style = cellStyle;
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    if (isBest) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
                        cell.font = { bold: true };
                    }
                });
                rowNum++;
            });

            wsStudent.getCell(`A${rowNum}`).value = '* Жёлтым выделена лучшая попытка (идёт в зачёт)';
            wsStudent.getCell(`A${rowNum}`).font = { italic: true, size: 10, color: { argb: 'FF666666' } };
            rowNum += 2;
        }

        // ======= ОШИБКИ (по лучшей попытке) =======
        wsStudent.mergeCells(`A${rowNum}:E${rowNum}`);
        wsStudent.getCell(`A${rowNum}`).value = 'ОШИБКИ В ЛУЧШЕЙ ПОПЫТКЕ (темы для повторения)';
        wsStudent.getCell(`A${rowNum}`).style = {
            font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC3545' } },
            alignment: { horizontal: 'center', vertical: 'middle' }
        };
        wsStudent.getRow(rowNum).height = 25;
        rowNum++;

        wsStudent.getRow(rowNum).values = ['№', 'Вопрос', '', 'Ваш ответ', 'Правильный ответ'];
        wsStudent.getRow(rowNum).eachCell((cell) => { cell.style = tableHeaderStyle; });
        rowNum++;

        let wrongCount = 0;
        if (bestResult.details) {
            bestResult.details.forEach((detail) => {
                if (!detail.isCorrect) {
                    wrongCount++;
                    wsStudent.getRow(rowNum).values = [
                        wrongCount,
                        (detail.questionText || '').substring(0, 60),
                        '',
                        detail.userAnswerText || detail.userAnswer || '-',
                        detail.correctAnswerText || detail.correctAnswer || '-'
                    ];
                    wsStudent.getRow(rowNum).eachCell((cell) => {
                        cell.style = cellStyle;
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4E4' } };
                    });
                    rowNum++;
                }
            });
        }

        if (wrongCount === 0) {
            wsStudent.getCell(`A${rowNum}`).value = 'Все ответы правильные! Отличный результат!';
            wsStudent.getCell(`A${rowNum}`).font = { bold: true, color: { argb: 'FF28A745' } };
            rowNum++;
        }

        rowNum += 2;

        // ======= ВСЕ ОТВЕТЫ ПО КАЖДОЙ ПОПЫТКЕ =======
        student.attempts.forEach((attempt, attemptIdx) => {
            const attemptDate = attempt.completedAt || attempt.submittedAt;
            const isBest = attempt.id === bestResult.id;

            wsStudent.mergeCells(`A${rowNum}:E${rowNum}`);
            const attemptTitle = student.attempts.length > 1
                ? `ПОПЫТКА ${attemptIdx + 1} — ${attemptDate ? new Date(attemptDate).toLocaleString('ru-RU') : ''} (${attempt.percentage}%, оценка ${attempt.grade})${isBest ? ' ★ ЛУЧШАЯ' : ''}`
                : 'ВСЕ ОТВЕТЫ';
            wsStudent.getCell(`A${rowNum}`).value = attemptTitle;
            wsStudent.getCell(`A${rowNum}`).style = {
                font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: isBest ? 'FF28A745' : 'FF4472C4' } },
                alignment: { horizontal: 'center', vertical: 'middle' }
            };
            wsStudent.getRow(rowNum).height = 25;
            rowNum++;

            wsStudent.getRow(rowNum).values = ['№', 'Вопрос', '', 'Ваш ответ', 'Результат'];
            wsStudent.getRow(rowNum).eachCell((cell) => { cell.style = tableHeaderStyle; });
            rowNum++;

            if (attempt.details) {
                attempt.details.forEach((detail, qIdx) => {
                    wsStudent.getRow(rowNum).values = [
                        qIdx + 1,
                        (detail.questionText || '').substring(0, 60),
                        '',
                        detail.userAnswerText || detail.userAnswer || '-',
                        detail.isCorrect ? '✓ Верно' : '✗ Неверно'
                    ];
                    wsStudent.getRow(rowNum).eachCell((cell) => { cell.style = cellStyle; });

                    const resultCell = wsStudent.getCell(`E${rowNum}`);
                    if (detail.isCorrect) {
                        resultCell.font = { bold: true, color: { argb: 'FF155724' } };
                        wsStudent.getRow(rowNum).eachCell((cell) => {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } };
                        });
                    } else {
                        resultCell.font = { bold: true, color: { argb: 'FF721C24' } };
                        wsStudent.getRow(rowNum).eachCell((cell) => {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8D7DA' } };
                        });
                    }
                    rowNum++;
                });
            }
            rowNum += 2;
        });

        wsStudent.columns = [
            { width: 8 }, { width: 45 }, { width: 5 }, { width: 25 }, { width: 25 }
        ];
    });

    // Сохраняем файл
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);

    const fileName = `Ведомость_${groupName}_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.download = fileName.replace(/[\\\/\?\*\[\]:]/g, '_');
    link.click();

    const attemptsInfo = detailedResults.length > bestResults.length
        ? ` (${detailedResults.length} попыток)`
        : '';
    showNotification(`Ведомость сохранена: ${bestResults.length} студентов${attemptsInfo}`, 'success');
    } catch (error) {
        console.error('Ошибка экспорта в Excel:', error);
        showNotification('Ошибка при создании файла: ' + error.message, 'error');
    }
}

// ============================================
// ЭКСПОРТ В WORD (ФОРМАТ АДМИНИСТРАТИВНОГО СРЕЗА)
// ============================================

async function exportToWord() {
    try {
        // Проверяем доступность библиотеки docx
        if (typeof docx === 'undefined') {
            showNotification('Библиотека docx не загружена. Обновите страницу.', 'error');
            return;
        }

        // Получаем выбранные группы (если есть) - используем кастомный dropdown
        const selectedGroups = (getSearchableDropdownValue('results-group-filter') || [])
            .map(g => g.toUpperCase().trim())
            .filter(g => g); // Убираем пустые

        // Получаем выбранный тест - используем кастомный dropdown
        const testFilter = getSearchableDropdownValue('results-test-filter');
        if (!testFilter) {
            showNotification('Выберите тест для экспорта', 'warning');
            return;
        }

    const test = adminState.tests.find(t => String(t.id) === String(testFilter));
    if (!test) {
        showNotification('Тест не найден', 'error');
        return;
    }

    showNotification('Формирование документа... Пожалуйста, подождите.', 'info');

    // Фильтруем результаты по тесту (и группам, если выбраны)
    const filteredResults = adminState.results.filter(r => {
        if (String(r.testId) !== String(testFilter)) return false;
        // Если группы не выбраны - берём все результаты по тесту
        if (selectedGroups.length === 0) return true;
        const studentGroup = (r.studentGroup || '').toUpperCase().trim();
        return selectedGroups.includes(studentGroup);
    });

    // Загружаем детальные данные каждого результата (если есть)
    const detailedResults = [];
    for (const r of filteredResults) {
        try {
            const response = await apiRequest(`/results/${r.id}`);
            if (response.success) {
                detailedResults.push(response.result);
            }
        } catch (e) {
            console.error('Ошибка загрузки результата:', r.id, e);
        }
    }

    // Группируем результаты по студентам (берём лучшую попытку)
    const studentMap = {};
    detailedResults.forEach(r => {
        const key = `${(r.studentSurname || '').toLowerCase().trim()}_${(r.studentName || '').toLowerCase().trim()}_${(r.studentGroup || '').toUpperCase().trim()}`;
        if (!studentMap[key]) {
            studentMap[key] = {
                studentName: r.studentName,
                studentSurname: r.studentSurname,
                studentPatronymic: r.studentPatronymic || '',
                studentGroup: r.studentGroup,
                variant: r.variant || null,
                attempts: []
            };
        }
        // Сохраняем вариант если он есть
        if (r.variant && !studentMap[key].variant) {
            studentMap[key].variant = r.variant;
        }
        studentMap[key].attempts.push(r);
    });

    // Сортируем попытки и берём лучшую
    Object.values(studentMap).forEach(student => {
        student.attempts.sort((a, b) => b.percentage - a.percentage);
        student.bestAttempt = student.attempts[0];
    });

    // Получаем полный список студентов из групп
    const relevantGroups = (adminState.groups || []).filter(g => {
        const groupNameUpper = (g.name || '').toUpperCase().trim();
        if (selectedGroups.length > 0) {
            return selectedGroups.includes(groupNameUpper);
        }
        // Если группы не выбраны - берём группы из результатов
        const resultGroups = [...new Set(detailedResults.map(r => (r.studentGroup || '').toUpperCase().trim()).filter(x => x))];
        return resultGroups.includes(groupNameUpper);
    });

    // Добавляем студентов из групп, которые не проходили тест
    relevantGroups.forEach(group => {
        if (!group.students || !group.students.length) return;
        group.students.forEach(s => {
            const parts = (s.fullName || '').trim().split(/\s+/);
            const surname = parts[0] || '';
            const name = parts[1] || '';
            const patronymic = parts.slice(2).join(' ') || '';
            const key = `${surname.toLowerCase().trim()}_${name.toLowerCase().trim()}_${(group.name || '').toUpperCase().trim()}`;
            if (!studentMap[key]) {
                // Студент не проходил тест — добавляем без результата
                studentMap[key] = {
                    studentName: name,
                    studentSurname: surname,
                    studentPatronymic: patronymic,
                    studentGroup: group.name,
                    variant: null,
                    attempts: [],
                    bestAttempt: null, // нет результата
                    didNotPass: true
                };
            }
        });
    });

    // Сортируем по фамилии
    const sortedStudents = Object.values(studentMap).sort((a, b) => {
        const surnameA = (a.studentSurname || '').toLowerCase();
        const surnameB = (b.studentSurname || '').toLowerCase();
        return surnameA.localeCompare(surnameB, 'ru');
    });

    if (sortedStudents.length === 0) {
        showNotification('Нет данных для формирования документа', 'warning');
        return;
    }

    // Получаем информацию о дисциплине
    const discipline = adminState.disciplines.find(d => String(d.id) === String(test.disciplineId));
    const disciplineName = discipline ? discipline.name : 'Дисциплина';
    // Если группы не выбраны - собираем уникальные группы из результатов
    const groupName = selectedGroups.length > 0
        ? selectedGroups.join(', ')
        : [...new Set(detailedResults.map(r => (r.studentGroup || '').toUpperCase().trim()).filter(g => g))].sort().join(', ') || 'Все группы';

    // Получаем дату проведения (дата первого результата)
    const firstDate = detailedResults
        .map(r => new Date(r.completedAt || r.submittedAt))
        .sort((a, b) => a - b)[0];
    const testDate = firstDate ? firstDate.toLocaleDateString('ru-RU') : new Date().toLocaleDateString('ru-RU');

    // Определяем количество вопросов
    const questionsCount = test.questionsCount || 10;

    // Количество студентов по списку (все) и участвовавших (с результатами)
    const totalStudentsByList = sortedStudents.length;
    const studentsWithResults = sortedStudents.filter(s => s.bestAttempt && !s.didNotPass);
    const totalStudentsParticipated = studentsWithResults.length;

    // Максимальный балл - берём из первого результата с maxPoints, иначе = questionsCount
    const firstResultWithMax = studentsWithResults.find(s => s.bestAttempt && s.bestAttempt.maxPoints);
    const maxScore = firstResultWithMax ? firstResultWithMax.bestAttempt.maxPoints : questionsCount;

    // Статистика по оценкам (только для тех, кто проходил)
    const grades = studentsWithResults.map(s => s.bestAttempt.grade);
    const grade5 = grades.filter(g => g === 5).length;
    const grade4 = grades.filter(g => g === 4).length;
    const grade3 = grades.filter(g => g === 3).length;
    const grade2 = grades.filter(g => g === 2).length;

    // Получаем ФИО преподавателя (создателя теста)
    let teacherName = '';
    if (test.createdBy && adminState.users) {
        const teacher = adminState.users.find(u => String(u.id) === String(test.createdBy));
        if (teacher && teacher.name) {
            // Преобразуем "Фамилия Имя Отчество" в "Фамилия И.О."
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

    // Создаём Word документ с помощью docx
    const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, BorderStyle, VerticalAlign, PageOrientation } = docx;

    // Стили границ для таблицы
    const tableBorders = {
        top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
    };

    // Функция для создания ячейки таблицы
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

    // Создаём двухстрочный заголовок таблицы
    // Первая строка: №, ФИО, Вариант, "Итого баллов" с подзаголовками номеров вопросов, Итого баллов, Оценка
    const headerRow1 = new TableRow({
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

    // Создаём строки данных студентов
    const dataRows = sortedStudents.map((student, idx) => {
        const result = student.bestAttempt;
        const fullName = `${student.studentSurname || ''} ${student.studentName || ''} ${student.studentPatronymic || ''}`.trim();

        // Если студент не проходил тест — ставим '-' во все ячейки баллов
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

        // Баллы за каждый вопрос (с учётом веса)
        const questionScores = [];
        if (result.details && result.details.length > 0) {
            for (let i = 0; i < questionsCount; i++) {
                if (result.details[i]) {
                    // Используем pointsEarned если есть, иначе isCorrect ? weight : 0
                    const detail = result.details[i];
                    const weight = detail.weight || 1;
                    const points = detail.pointsEarned !== undefined ? detail.pointsEarned : (detail.isCorrect ? weight : 0);
                    questionScores.push(points);
                } else {
                    questionScores.push(0);
                }
            }
        } else {
            for (let i = 0; i < questionsCount; i++) {
                questionScores.push(0);
            }
        }

        // Итого баллов - используем earnedPoints если есть, иначе correctCount
        const totalPoints = result.earnedPoints !== undefined ? result.earnedPoints : (result.correctCount || 0);

        return new TableRow({
            children: [
                createCell(String(idx + 1) + '.', { size: 18 }),
                createCell(fullName, { align: AlignmentType.LEFT, size: 18 }),
                createCell(student.variant ? String(student.variant) : '', { size: 18 }), // Вариант
                ...questionScores.map(score => createCell(String(score), { size: 16 })),
                createCell(String(totalPoints), { size: 18 }),
                createCell(String(result.grade), { size: 18 }),
            ],
        });
    });

    // Рассчитываем пороги для оценок на основе maxScore
    const threshold2 = Math.ceil(maxScore * 0.5) - 1;  // Неудовлетворительно
    const threshold3min = Math.ceil(maxScore * 0.5);   // Удовлетворительно мин
    const threshold3max = Math.ceil(maxScore * 0.7) - 1; // Удовлетворительно макс
    const threshold4min = Math.ceil(maxScore * 0.7);   // Хорошо мин
    const threshold4max = Math.ceil(maxScore * 0.9) - 1; // Хорошо макс
    const threshold5min = Math.ceil(maxScore * 0.9);   // Отлично мин

    // Создаём документ (книжная ориентация)
    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: 567,    // 1 см
                        right: 567,
                        bottom: 567,
                        left: 567,
                    },
                },
            },
            children: [
                // Заголовок
                new Paragraph({
                    children: [new TextRun({ text: 'Результаты административного среза', bold: true, size: 28, font: 'Times New Roman' })],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 200 },
                }),

                // Группа и Дисциплина
                new Paragraph({
                    children: [
                        new TextRun({ text: 'Группа ', size: 24, font: 'Times New Roman' }),
                        new TextRun({ text: groupName, bold: true, size: 24, font: 'Times New Roman' }),
                        new TextRun({ text: ' Дисциплина ', size: 24, font: 'Times New Roman' }),
                        new TextRun({ text: disciplineName, bold: true, size: 24, font: 'Times New Roman' }),
                    ],
                    spacing: { after: 100 },
                }),

                // Дата и количество по списку
                new Paragraph({
                    children: [
                        new TextRun({ text: `Дата проведения административного среза ${testDate} `, size: 24, font: 'Times New Roman' }),
                        new TextRun({ text: `Количество обучающихся в группе по списку – ${totalStudentsByList}`, size: 24, font: 'Times New Roman' }),
                    ],
                    spacing: { after: 100 },
                }),

                // Количество участников
                new Paragraph({
                    children: [
                        new TextRun({ text: `Количество обучающихся, принявших участие в административном срезе - ${totalStudentsParticipated}`, size: 24, font: 'Times New Roman' }),
                    ],
                    spacing: { after: 200 },
                }),

                // Таблица с результатами
                new Table({
                    rows: [headerRow1, ...dataRows],
                    width: { size: 100, type: WidthType.PERCENTAGE },
                }),

                // Пустая строка
                new Paragraph({ spacing: { after: 300 } }),

                // Итого по оценкам
                new Paragraph({
                    children: [new TextRun({ text: 'Итого:', bold: true, size: 24, font: 'Times New Roman' })],
                    spacing: { after: 100 },
                }),

                new Table({
                    rows: [
                        new TableRow({
                            children: [
                                createCell('Оценка', { bold: true, width: 2500 }),
                                createCell('Количество человек', { bold: true, width: 2500 }),
                            ],
                        }),
                        new TableRow({
                            children: [createCell('«5»'), createCell(String(grade5))],
                        }),
                        new TableRow({
                            children: [createCell('«4»'), createCell(String(grade4))],
                        }),
                        new TableRow({
                            children: [createCell('«3»'), createCell(String(grade3))],
                        }),
                        new TableRow({
                            children: [createCell('«2»'), createCell(String(grade2))],
                        }),
                    ],
                    width: { size: 30, type: WidthType.PERCENTAGE },
                }),

                // Пустая строка
                new Paragraph({ spacing: { after: 300 } }),

                // Критерии оценивания работы
                new Paragraph({
                    children: [new TextRun({ text: 'Критерии оценивания работы', bold: true, size: 24, font: 'Times New Roman' })],
                    spacing: { after: 100 },
                }),

                // Генерируем критерии для каждого задания
                ...Array.from({ length: questionsCount }, (_, i) =>
                    new Paragraph({
                        children: [new TextRun({ text: `Полностью верно выполненное задание № ${i + 1} - 1 балл,`, size: 22, font: 'Times New Roman' })],
                    })
                ),

                // Пустая строка
                new Paragraph({ spacing: { after: 200 } }),

                // Алгоритм перевода баллов
                new Paragraph({
                    children: [new TextRun({ text: 'Алгоритм перевода баллов', bold: true, underline: {}, size: 24, font: 'Times New Roman' })],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 100 },
                }),

                new Paragraph({
                    children: [new TextRun({ text: `Неудовлетворительно - ${threshold2} и менее баллов`, size: 22, font: 'Times New Roman' })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: `Удовлетворительно – ${threshold3min}–${threshold3max} баллов`, size: 22, font: 'Times New Roman' })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: `Хорошо – ${threshold4min}–${threshold4max} баллов`, size: 22, font: 'Times New Roman' })],
                }),
                new Paragraph({
                    children: [new TextRun({ text: `Отлично – ${threshold5min}–${maxScore} баллов`, size: 22, font: 'Times New Roman' })],
                    spacing: { after: 400 },
                }),

                // Подпись преподавателя
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

    // Сохраняем файл
    const blob = await Packer.toBlob(doc);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const fileName = `Админ_срез_${groupName}_${testDate.replace(/\./g, '-')}.docx`;
    link.download = fileName.replace(/[\\\/\?\*\[\]:]/g, '_');
    link.click();

    showNotification(`Документ сохранён: ${sortedStudents.length} студентов (${totalStudentsParticipated} прошли тест)`, 'success');
    } catch (error) {
        console.error('Ошибка экспорта в Word:', error);
        showNotification('Ошибка при создании документа: ' + error.message, 'error');
    }
}

// ============================================
