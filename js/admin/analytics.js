// ============================================
// ТАБ: АНАЛИТИКА
// ============================================

let analyticsState = {
    selectedTestId: null,
    selectedDisciplineId: null,
    selectedMode: null,      // exam, training, normal
    selectedGroup: null,
    data: null
};

async function renderAnalyticsTab() {
    const container = document.getElementById('tab-analytics');

    // Показываем индикатор загрузки сразу при первом открытии
    container.innerHTML = `
        <div class="loading-tab">
            <div class="loading-spinner"></div>
            <p>Загрузка аналитики...</p>
        </div>
    `;

    // Загружаем результаты если ещё не загружены (для списка групп)
    if (!adminState.loaded.results) {
        await loadResultsLazy();
    }

    // Собираем уникальные группы из результатов
    const groups = [...new Set(adminState.results.map(r => (r.studentGroup || '').toUpperCase().trim()).filter(g => g))].sort();

    // Формируем опции для searchable dropdowns
    const disciplineOptions = [
        { value: '', label: 'Все дисциплины' },
        ...adminState.disciplines.map(d => ({ value: String(d.id), label: d.name }))
    ];
    const testOptions = [{ value: '', label: 'Все тесты' }];
    const modeOptions = [
        { value: '', label: 'Все формы' },
        { value: 'exam', label: 'Зачёт' },
        { value: 'srez', label: 'Адм. срез' },
        { value: 'normal', label: 'Контрольная работа' },
        { value: 'training', label: 'Тренировка' }
    ];
    const groupOptions = [
        { value: '', label: 'Все группы' },
        ...groups.map(g => ({ value: g, label: g }))
    ];

    container.innerHTML = `
        <div class="admin-section analytics-section">
            <div class="section-header">
                <h2>📊 Аналитика вопросов</h2>
            </div>

            <div class="analytics-filters">
                <div class="filter-group">
                    <label>Дисциплина</label>
                    ${createSearchableDropdown({
                        id: 'analytics-discipline',
                        options: disciplineOptions,
                        value: '',
                        placeholder: 'Все дисциплины',
                        multiple: false,
                        searchPlaceholder: 'Найти дисциплину...'
                    })}
                </div>
                <div class="filter-group">
                    <label>Тест</label>
                    ${createSearchableDropdown({
                        id: 'analytics-test',
                        options: testOptions,
                        value: '',
                        placeholder: 'Все тесты',
                        multiple: false,
                        searchPlaceholder: 'Найти тест...'
                    })}
                </div>
                <div class="filter-group">
                    <label>Форма</label>
                    ${createSearchableDropdown({
                        id: 'analytics-mode',
                        options: modeOptions,
                        value: '',
                        placeholder: 'Все формы',
                        multiple: false,
                        searchPlaceholder: 'Найти форму...'
                    })}
                </div>
                <div class="filter-group">
                    <label>Группа</label>
                    ${createSearchableDropdown({
                        id: 'analytics-group',
                        options: groupOptions,
                        value: '',
                        placeholder: 'Все группы',
                        multiple: false,
                        searchPlaceholder: 'Найти группу...'
                    })}
                </div>
                <button class="btn btn-primary" onclick="loadAnalyticsData()">Обновить</button>
            </div>

            <div id="analytics-loading" class="analytics-loading hidden">
                <div class="loading-spinner"></div>
                <p>Загрузка аналитики...</p>
            </div>

            <div id="analytics-content"></div>
        </div>
    `;

    // Загружаем данные
    await loadAnalyticsData();
}

function onAnalyticsDisciplineChange() {
    const disciplineId = getSearchableDropdownValue('analytics-discipline') || '';

    // Фильтруем тесты по дисциплине
    const tests = adminState.tests.filter(t =>
        !disciplineId || String(t.disciplineId) === String(disciplineId)
    );

    const testOptions = [
        { value: '', label: 'Все тесты' },
        ...tests.map(t => ({ value: String(t.id), label: t.name }))
    ];

    updateSearchableDropdownOptions('analytics-test', testOptions);

    analyticsState.selectedDisciplineId = disciplineId || null;
    loadAnalyticsData();
}

async function loadAnalyticsData() {
    const testId = getSearchableDropdownValue('analytics-test') || '';
    const disciplineId = getSearchableDropdownValue('analytics-discipline') || '';
    const mode = getSearchableDropdownValue('analytics-mode') || '';
    const group = getSearchableDropdownValue('analytics-group') || '';

    analyticsState.selectedTestId = testId || null;
    analyticsState.selectedDisciplineId = disciplineId || null;
    analyticsState.selectedMode = mode || null;
    analyticsState.selectedGroup = group || null;

    const loading = document.getElementById('analytics-loading');
    const content = document.getElementById('analytics-content');

    if (loading) showElement(loading);
    if (content) content.innerHTML = '';

    try {
        let url = `${API_BASE}/analytics?`;
        if (testId) url += `testId=${testId}&`;
        if (disciplineId) url += `disciplineId=${disciplineId}&`;
        if (mode) url += `mode=${mode}&`;
        if (group) url += `group=${encodeURIComponent(group)}&`;

        console.log('Loading analytics from:', url);
        console.log('Token:', adminState.token ? 'present' : 'missing');

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${adminState.token}` }
        });

        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);

        if (data.success) {
            analyticsState.data = data;

            // Обновляем список групп (если ещё не заполнен или пустой)
            if (data.groups && data.groups.length > 0) {
                const currentValue = getSearchableDropdownValue('analytics-group') || '';
                const groupOptions = [
                    { value: '', label: 'Все группы' },
                    ...data.groups.map(g => ({ value: g, label: g }))
                ];
                updateSearchableDropdownOptions('analytics-group', groupOptions);
                if (currentValue) {
                    setSearchableDropdownValue('analytics-group', currentValue);
                }
            }

            renderAnalyticsContent(data);
        } else {
            content.innerHTML = `<div class="empty-state"><p>Ошибка: ${escapeHtml(data.error || 'Неизвестная ошибка')}</p></div>`;
        }
    } catch (error) {
        console.error('Analytics error:', error);
        content.innerHTML = `<div class="empty-state"><p>Ошибка загрузки: ${escapeHtml(error.message)}</p></div>`;
    } finally {
        if (loading) hideElement(loading);
    }
}

// Рендер круговой диаграммы оценок
function renderGradesPieChart(gradeStats, totalAttempts) {
    if (!gradeStats || totalAttempts === 0) {
        return '';
    }

    const total = gradeStats[5] + gradeStats[4] + gradeStats[3] + gradeStats[2];
    if (total === 0) return '';

    // Вычисляем проценты для каждой оценки
    const percents = {
        5: (gradeStats[5] / total * 100).toFixed(1),
        4: (gradeStats[4] / total * 100).toFixed(1),
        3: (gradeStats[3] / total * 100).toFixed(1),
        2: (gradeStats[2] / total * 100).toFixed(1)
    };

    // Создаём conic-gradient для круговой диаграммы
    let gradientParts = [];
    let currentDeg = 0;

    const colors = {
        5: '#10b981', // зелёный
        4: '#3b82f6', // синий
        3: '#f59e0b', // оранжевый
        2: '#ef4444'  // красный
    };

    [5, 4, 3, 2].forEach(grade => {
        if (gradeStats[grade] > 0) {
            const deg = (gradeStats[grade] / total) * 360;
            gradientParts.push(`${colors[grade]} ${currentDeg}deg ${currentDeg + deg}deg`);
            currentDeg += deg;
        }
    });

    const gradient = gradientParts.length > 0
        ? `conic-gradient(${gradientParts.join(', ')})`
        : 'conic-gradient(#374151 0deg 360deg)';

    return `
        <div class="analytics-card">
            <h3>📊 Распределение оценок</h3>
            <div class="grades-chart-container">
                <div class="pie-chart-wrapper">
                    <div class="pie-chart" style="background: ${gradient}">
                        <div class="pie-chart-center">
                            <span class="pie-total">${total}</span>
                            <span class="pie-label">попыток</span>
                        </div>
                    </div>
                </div>
                <div class="grades-legend">
                    <div class="grade-item grade-5">
                        <span class="grade-dot"></span>
                        <span class="grade-name">Отлично (5)</span>
                        <span class="grade-count">${gradeStats[5]}</span>
                        <span class="grade-percent">${percents[5]}%</span>
                    </div>
                    <div class="grade-item grade-4">
                        <span class="grade-dot"></span>
                        <span class="grade-name">Хорошо (4)</span>
                        <span class="grade-count">${gradeStats[4]}</span>
                        <span class="grade-percent">${percents[4]}%</span>
                    </div>
                    <div class="grade-item grade-3">
                        <span class="grade-dot"></span>
                        <span class="grade-name">Удовл. (3)</span>
                        <span class="grade-count">${gradeStats[3]}</span>
                        <span class="grade-percent">${percents[3]}%</span>
                    </div>
                    <div class="grade-item grade-2">
                        <span class="grade-dot"></span>
                        <span class="grade-name">Неуд. (2)</span>
                        <span class="grade-count">${gradeStats[2]}</span>
                        <span class="grade-percent">${percents[2]}%</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderAnalyticsContent(data) {
    const content = document.getElementById('analytics-content');
    const { summary, questions, gradeStats } = data;

    if (!questions || questions.length === 0) {
        content.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📊</div>
                <h3>Нет данных для анализа</h3>
                <p>Выберите тест с результатами или дождитесь первых прохождений</p>
            </div>
        `;
        return;
    }

    content.innerHTML = `
        <!-- Заголовок с кнопкой скачивания -->
        <div class="analytics-header">
            <div class="analytics-title">
                <h2>Анализ слабых мест</h2>
                <p class="analytics-subtitle">Выявление проблемных вопросов и тем</p>
            </div>
            <button class="btn btn-success btn-icon" onclick="downloadAnalyticsReport()">
                <span>📥</span> Скачать отчёт
            </button>
        </div>

        <!-- Сводка -->
        <div class="analytics-summary">
            <div class="summary-card total">
                <div class="summary-icon">📝</div>
                <div class="summary-value">${summary.totalQuestions}</div>
                <div class="summary-label">Вопросов проанализировано</div>
            </div>
            <div class="summary-card attempts">
                <div class="summary-icon">👥</div>
                <div class="summary-value">${summary.totalAttempts}</div>
                <div class="summary-label">Попыток прохождения</div>
            </div>
            <div class="summary-card success">
                <div class="summary-icon">📈</div>
                <div class="summary-value">${summary.avgSuccessRate}%</div>
                <div class="summary-label">Средний % успеха</div>
            </div>
            <div class="summary-card hard-count">
                <div class="summary-icon">🔥</div>
                <div class="summary-value">${summary.hardQuestions}</div>
                <div class="summary-label">Сложных вопросов</div>
            </div>
        </div>

        <!-- Диаграмма сложности (скрываем при пустых данных) -->
        ${summary.totalQuestions > 0 ? `
        <div class="analytics-card">
            <h3>🎯 Распределение по сложности</h3>
            <div class="difficulty-chart">
                <div class="difficulty-bars">
                    <div class="difficulty-bar hard" style="--percent: ${(summary.hardQuestions / summary.totalQuestions * 100)}%">
                        <span class="bar-value">${summary.hardQuestions}</span>
                    </div>
                    <div class="difficulty-bar medium" style="--percent: ${(summary.mediumQuestions / summary.totalQuestions * 100)}%">
                        <span class="bar-value">${summary.mediumQuestions}</span>
                    </div>
                    <div class="difficulty-bar easy" style="--percent: ${(summary.easyQuestions / summary.totalQuestions * 100)}%">
                        <span class="bar-value">${summary.easyQuestions}</span>
                    </div>
                </div>
                <div class="difficulty-legend">
                    <div class="legend-item hard"><span class="legend-dot"></span> Сложные (≤30%)</div>
                    <div class="legend-item medium"><span class="legend-dot"></span> Средние (31-60%)</div>
                    <div class="legend-item easy"><span class="legend-dot"></span> Лёгкие (>60%)</div>
                </div>
            </div>
        </div>
        ` : ''}

        <!-- Круговая диаграмма оценок -->
        ${renderGradesPieChart(gradeStats, summary.totalAttempts)}

        <!-- Топ сложных вопросов -->
        <div class="analytics-card">
            <h3>🔥 Самые сложные вопросы (${questions.filter(q => q.successRate <= 60).length})</h3>
            <div class="questions-list">
                ${questions.filter(q => q.successRate <= 60).slice(0, 20).map((q, i) => `
                    <div class="question-analytics-item ${q.difficulty}">
                        <div class="question-rank">${i + 1}</div>
                        <div class="question-info">
                            <div class="question-text-preview" title="${escapeHtml(q.questionText)}">${escapeHtml(q.questionText)}</div>
                            <div class="question-meta">
                                <span class="meta-tag attempts">${q.totalAttempts} поп.</span>
                                <span class="correct">✓${q.correctCount}</span>
                                <span class="incorrect">✗${q.incorrectCount}</span>
                            </div>
                        </div>
                        <div class="question-stats">
                            <div class="success-rate ${q.difficulty}">
                                <div class="rate-circle">${q.successRate}%</div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- Все вопросы -->
        <div class="analytics-card">
            <h3>📋 Все вопросы (${questions.length})</h3>
            <div class="questions-table-container">
                <table class="analytics-table">
                    <thead>
                        <tr>
                            <th>Вопрос</th>
                            <th>Попыток</th>
                            <th>Успех</th>
                            <th>Сложность</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${questions.map(q => `
                            <tr class="${q.difficulty}">
                                <td class="question-cell">${escapeHtml(q.questionText).substring(0, 80)}${q.questionText.length > 80 ? '...' : ''}</td>
                                <td>${q.totalAttempts}</td>
                                <td>
                                    <div class="mini-progress">
                                        <div class="mini-progress-bar" style="width: ${q.successRate}%; background: ${getSuccessColor(q.successRate)}"></div>
                                    </div>
                                    <span>${q.successRate}%</span>
                                </td>
                                <td><span class="difficulty-badge ${q.difficulty}">${getDifficultyLabel(q.difficulty)}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function getSuccessColor(rate) {
    if (rate <= 30) return '#ef4444';
    if (rate <= 60) return '#f59e0b';
    return '#10b981';
}

// getDifficultyLabel и escapeHtml определены в utils.js

// Скачивание отчёта аналитики
async function downloadAnalyticsReport() {
    const data = analyticsState.data;
    if (!data) {
        await showError('Нет данных для отчёта');
        return;
    }

    const { summary, questions } = data;
    const date = new Date().toLocaleDateString('ru-RU');

    // Генерируем красивый HTML-отчёт
    const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Аналитика тестирования - ${date}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f8fafc;
            color: #1e293b;
            line-height: 1.6;
        }
        .container { max-width: 1000px; margin: 0 auto; padding: 40px 20px; }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            border-radius: 20px;
            margin-bottom: 30px;
            text-align: center;
        }
        .header h1 { font-size: 2rem; margin-bottom: 8px; }
        .header p { opacity: 0.9; }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-item {
            background: white;
            padding: 24px;
            border-radius: 16px;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }
        .summary-item.highlight { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; }
        .summary-value { font-size: 2.5rem; font-weight: 800; }
        .summary-label { font-size: 0.85rem; opacity: 0.8; margin-top: 4px; }

        .card {
            background: white;
            border-radius: 16px;
            padding: 30px;
            margin-bottom: 24px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }
        .card h2 {
            font-size: 1.3rem;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 2px solid #e2e8f0;
        }

        .section-row {
            display: flex;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid #f1f5f9;
        }
        .section-name { flex: 1; font-weight: 500; }
        .section-bar {
            width: 200px;
            height: 24px;
            background: #e2e8f0;
            border-radius: 12px;
            overflow: hidden;
            margin: 0 16px;
        }
        .section-bar-fill { height: 100%; border-radius: 12px; transition: width 0.3s; }
        .section-value { width: 50px; text-align: right; font-weight: 600; }

        .question-item {
            padding: 20px;
            margin-bottom: 16px;
            border-radius: 12px;
            border-left: 4px solid;
        }
        .question-item.hard { background: #fef2f2; border-color: #ef4444; }
        .question-item.medium { background: #fffbeb; border-color: #f59e0b; }
        .question-item.easy { background: #f0fdf4; border-color: #10b981; }

        .question-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
        .question-text { flex: 1; font-weight: 500; }
        .question-rate {
            padding: 6px 16px;
            border-radius: 20px;
            font-weight: 700;
            font-size: 0.9rem;
        }
        .question-item.hard .question-rate { background: #ef4444; color: white; }
        .question-item.medium .question-rate { background: #f59e0b; color: white; }
        .question-item.easy .question-rate { background: #10b981; color: white; }

        .question-meta { display: flex; gap: 20px; font-size: 0.85rem; color: #64748b; }
        .wrong-answers { margin-top: 12px; padding-top: 12px; border-top: 1px dashed #e2e8f0; }
        .wrong-answers-title { font-size: 0.85rem; color: #64748b; margin-bottom: 8px; }
        .wrong-item {
            display: inline-block;
            background: #fee2e2;
            color: #dc2626;
            padding: 4px 12px;
            border-radius: 6px;
            margin: 4px 4px 4px 0;
            font-size: 0.85rem;
        }

        .footer {
            text-align: center;
            padding: 30px;
            color: #64748b;
            font-size: 0.85rem;
        }

        @media print {
            body { background: white; }
            .container { padding: 0; }
            .card, .summary-item { box-shadow: none; border: 1px solid #e2e8f0; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Отчёт по аналитике тестирования</h1>
            <p>Сформирован: ${date}</p>
        </div>

        <div class="summary-grid">
            <div class="summary-item">
                <div class="summary-value">${summary.totalQuestions}</div>
                <div class="summary-label">Вопросов</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${summary.totalAttempts}</div>
                <div class="summary-label">Попыток</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${summary.avgSuccessRate}%</div>
                <div class="summary-label">Средний успех</div>
            </div>
            <div class="summary-item highlight">
                <div class="summary-value">${summary.hardQuestions}</div>
                <div class="summary-label">Проблемных</div>
            </div>
        </div>

        <div class="card">
            <h2>🔥 Вопросы требующие внимания (${questions.filter(q => q.difficulty === 'hard').length})</h2>
            ${questions.filter(q => q.difficulty === 'hard').slice(0, 20).map(q => `
                <div class="question-item hard">
                    <div class="question-header">
                        <div class="question-text">${escapeHtmlReport(q.questionText)}</div>
                        <div class="question-rate">${q.successRate}%</div>
                    </div>
                    <div class="question-meta">
                        <span>👥 ${q.totalAttempts} попыток</span>
                        <span>✅ ${q.correctCount} верно</span>
                        <span>❌ ${q.incorrectCount} ошибок</span>
                    </div>
                    ${q.topWrongAnswers && q.topWrongAnswers.length > 0 ? `
                        <div class="wrong-answers">
                            <div class="wrong-answers-title">Частые неправильные ответы:</div>
                            ${q.topWrongAnswers.map(wa => `<span class="wrong-item">${escapeHtmlReport(wa.answer)} (${wa.count}×)</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>

        <div class="card">
            <h2>⚠️ Вопросы средней сложности (${questions.filter(q => q.difficulty === 'medium').length})</h2>
            ${questions.filter(q => q.difficulty === 'medium').slice(0, 15).map(q => `
                <div class="question-item medium">
                    <div class="question-header">
                        <div class="question-text">${escapeHtmlReport(q.questionText)}</div>
                        <div class="question-rate">${q.successRate}%</div>
                    </div>
                    <div class="question-meta">
                        <span>👥 ${q.totalAttempts} попыток</span>
                        <span>✅ ${q.correctCount}</span>
                        <span>❌ ${q.incorrectCount}</span>
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="footer">
            <p>Система тестирования | Отчёт сформирован автоматически</p>
        </div>
    </div>
</body>
</html>`;

    // Скачиваем файл
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Аналитика_${date.replace(/\./g, '-')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// escapeHtmlReport определена в utils.js

// ============================================
// ОБРАБОТЧИКИ СОБЫТИЙ SEARCHABLE DROPDOWN ДЛЯ АНАЛИТИКИ
// ============================================

// Callback для изменения дисциплины
window['onSearchableDropdownChange_analytics-discipline'] = function(value) {
    onAnalyticsDisciplineChange();
};

// Callback для изменения теста
window['onSearchableDropdownChange_analytics-test'] = function(value) {
    loadAnalyticsData();
};

// Callback для изменения формы
window['onSearchableDropdownChange_analytics-mode'] = function(value) {
    loadAnalyticsData();
};

// Callback для изменения группы
window['onSearchableDropdownChange_analytics-group'] = function(value) {
    loadAnalyticsData();
};

// ============================================
