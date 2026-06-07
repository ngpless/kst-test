// ============================================
// ДАШБОРД МОНИТОРИНГА АДМИНИСТРАТИВНОГО СРЕЗА
// ============================================

// Состояние мониторинга
let monitorState = {
    refreshInterval: null,
    allData: [],           // Все данные по всем тестам
    serverTime: 0,
    lastViolationsCount: 0,
    searchQuery: '',
    isRefreshing: false,
    expandedGroups: new Set(), // Развёрнутые группы
    errors: []             // Технические ошибки
};

const MONITOR_REFRESH_INTERVAL = 5000; // 5 секунд

// ============================================
// РЕНДЕР ВКЛАДКИ
// ============================================

async function renderSrezMonitorTab() {
    const container = document.getElementById('tab-srez-monitor');
    if (!container) return;

    // Получаем тесты административного среза
    const srezTests = (adminState.tests || []).filter(t => t.isAdminSrezMode === true);

    if (srezTests.length === 0) {
        container.innerHTML = `
            <div class="admin-section">
                <div class="section-header">
                    <h2>📊 Мониторинг административного среза</h2>
                </div>
                <div class="empty-state">
                    <div class="empty-icon">📊</div>
                    <p>Нет тестов административного среза</p>
                    <p class="hint">Создайте тест в режиме "Административный срез"</p>
                </div>
            </div>
        `;
        return;
    }

    // Получаем список тестов для сброса
    const testOptions = srezTests.map(t => {
        const disc = adminState.disciplines?.find(d => String(d.id) === String(t.disciplineId));
        return `<option value="${t.id}">${escapeHtml(disc?.name || t.name)}</option>`;
    }).join('');

    container.innerHTML = `
        <div class="admin-section">
            <div class="section-header">
                <h2>📊 Мониторинг административного среза</h2>
                <div class="header-buttons">
                    <button class="btn btn-secondary" onclick="refreshAllMonitorData()">
                        <span class="btn-icon">🔄</span> Обновить
                    </button>
                </div>
            </div>

            <div class="monitor-controls">
                <div class="filter-group">
                    <label>Поиск:</label>
                    <input type="text" id="monitor-search" class="input-field" placeholder="Группа, фамилия, дисциплина..."
                           value="${escapeHtml(monitorState.searchQuery)}" oninput="onMonitorSearch(this.value)">
                </div>
                <div class="filter-group">
                    <label>Сброс попыток:</label>
                    <select id="reset-test-select" class="select-field" style="min-width: 200px;">
                        <option value="">-- Выберите тест --</option>
                        ${testOptions}
                    </select>
                    <button class="btn btn-danger btn-sm" onclick="resetTestAttempts()">Сбросить</button>
                </div>
                <div class="auto-refresh-indicator">
                    <span class="indicator-dot"></span>
                    <span>Автообновление: 5 сек</span>
                    <span id="last-update-time" class="last-update"></span>
                </div>
            </div>

            <div id="monitor-errors" class="monitor-errors"></div>
            <div id="monitor-stats" class="monitor-stats-grid"></div>
            <div id="monitor-content" class="monitor-content">
                <div class="loading-indicator">Загрузка данных...</div>
            </div>
        </div>
    `;

    // Принудительно загружаем данные по всем срезам (сбрасываем флаг блокировки)
    monitorState.isRefreshing = false;
    await loadAllMonitorData();

    // Запускаем автообновление
    startMonitorAutoRefresh();
}

// ============================================
// ЗАГРУЗКА ДАННЫХ ПО ВСЕМ СРЕЗАМ
// ============================================

async function loadAllMonitorData() {
    if (monitorState.isRefreshing) return;

    monitorState.isRefreshing = true;
    monitorState.errors = []; // Сбрасываем ошибки

    try {
        const srezTests = (adminState.tests || []).filter(t => t.isAdminSrezMode === true);

        // Загружаем данные по всем тестам параллельно
        const results = await Promise.all(
            srezTests.map(async test => {
                try {
                    const result = await apiRequest(`/exam/monitor?testId=${test.id}`);
                    if (result.success) {
                        const disc = adminState.disciplines?.find(d => String(d.id) === String(test.disciplineId));
                        return {
                            testId: test.id,
                            testName: test.name,
                            disciplineName: disc?.name || 'Без дисциплины',
                            participants: result.participants,
                            serverTime: result.serverTime,
                            error: null
                        };
                    } else {
                        // API вернул ошибку
                        monitorState.errors.push({
                            type: 'api',
                            testId: test.id,
                            testName: test.name,
                            message: result.error || 'Неизвестная ошибка API'
                        });
                        return null;
                    }
                } catch (e) {
                    console.error(`Error loading test ${test.id}:`, e);
                    monitorState.errors.push({
                        type: 'network',
                        testId: test.id,
                        testName: test.name,
                        message: e.message || 'Ошибка сети'
                    });
                    return null;
                }
            })
        );

        // Фильтруем успешные результаты
        monitorState.allData = results.filter(r => r !== null);
        monitorState.serverTime = Date.now();

        // Проверяем новые нарушения
        const newViolationsCount = monitorState.allData.reduce((sum, test) =>
            sum + test.participants.reduce((s, p) =>
                s + (p.liveProgress?.violations?.length || 0), 0), 0);

        if (newViolationsCount > monitorState.lastViolationsCount && monitorState.lastViolationsCount > 0) {
            playViolationSound();
            showNotification('⚠️ Зафиксировано новое нарушение!', 'warning');
        }
        monitorState.lastViolationsCount = newViolationsCount;

        renderMonitorErrors();
        renderMonitorStats();
        renderMonitorContent();
        updateLastUpdateTime();
    } catch (err) {
        console.error('Monitor load error:', err);
        monitorState.errors.push({
            type: 'critical',
            message: err.message || 'Критическая ошибка загрузки'
        });
        renderMonitorErrors();
    } finally {
        monitorState.isRefreshing = false;
    }
}

// ============================================
// СБРОС ПОПЫТОК
// ============================================

async function resetTestAttempts() {
    const select = document.getElementById('reset-test-select');
    const testId = select?.value;

    if (!testId) {
        showNotification('Выберите тест для сброса', 'warning');
        return;
    }

    const test = adminState.tests?.find(t => String(t.id) === testId);
    const testName = test?.name || 'тест';

    if (!confirm(`Сбросить ВСЕ попытки для теста "${testName}"?\n\nКоды участников останутся, но все результаты и активные сессии будут удалены.`)) {
        return;
    }

    try {
        const result = await apiRequest('/exam/participants/reset', 'POST', { testId });
        if (result.success) {
            showNotification(`Сброшено: ${result.resetParticipants} участников, удалено ${result.deletedResults} результатов`, 'success');
            select.value = '';
            await loadAllMonitorData();
        } else {
            showNotification('Ошибка: ' + (result.error || 'Неизвестная ошибка'), 'error');
        }
    } catch (e) {
        showNotification('Ошибка сброса: ' + e.message, 'error');
    }
}

// ============================================
// ОТОБРАЖЕНИЕ ОШИБОК
// ============================================

function renderMonitorErrors() {
    const container = document.getElementById('monitor-errors');
    if (!container) return;

    if (!monitorState.errors || monitorState.errors.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div class="monitor-errors-box">
            <div class="errors-header">
                <span class="errors-icon">🚨</span>
                <span class="errors-title">Технические проблемы (${monitorState.errors.length})</span>
            </div>
            <div class="errors-list">
                ${monitorState.errors.map(err => `
                    <div class="error-item error-${err.type}">
                        <span class="error-type">${getErrorTypeLabel(err.type)}</span>
                        ${err.testName ? `<span class="error-test">${escapeHtml(err.testName)}</span>` : ''}
                        <span class="error-message">${escapeHtml(err.message)}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function getErrorTypeLabel(type) {
    switch (type) {
        case 'network': return '🌐 Сеть';
        case 'api': return '⚙️ API';
        case 'critical': return '💥 Критическая';
        default: return '❓ Ошибка';
    }
}

async function refreshAllMonitorData() {
    await loadAllMonitorData();
    showNotification('Данные обновлены', 'success');
}

function onMonitorSearch(query) {
    monitorState.searchQuery = query.toLowerCase().trim();
    renderMonitorContent();
}

// ============================================
// АВТООБНОВЛЕНИЕ
// ============================================

function startMonitorAutoRefresh() {
    stopMonitorAutoRefresh();
    monitorState.refreshInterval = setInterval(() => {
        if (!monitorState.isRefreshing) {
            loadAllMonitorData();
        }
    }, MONITOR_REFRESH_INTERVAL);
}

function stopMonitorAutoRefresh() {
    if (monitorState.refreshInterval) {
        clearInterval(monitorState.refreshInterval);
        monitorState.refreshInterval = null;
    }
}

// ============================================
// РЕНДЕР СТАТИСТИКИ
// ============================================

function renderMonitorStats() {
    const stats = document.getElementById('monitor-stats');
    if (!stats) return;

    const now = monitorState.serverTime || Date.now();

    // Считаем УНИКАЛЬНЫХ студентов (по ФИО + группа)
    const uniqueStudents = new Map(); // key -> {hasLive, hasCompleted, hasViolation, grades[]}

    let staleSessions = 0, expiredSessions = 0;

    monitorState.allData.forEach(test => {
        test.participants.forEach(p => {
            const studentKey = `${p.surname}_${p.name}_${p.patronymic || ''}_${p.group}`;

            if (!uniqueStudents.has(studentKey)) {
                uniqueStudents.set(studentKey, {
                    name: `${p.surname} ${p.name}`,
                    group: p.group,
                    hasLive: false,
                    hasCompleted: false,
                    hasViolation: false,
                    grades: []
                });
            }

            const student = uniqueStudents.get(studentKey);

            if (p.liveProgress) {
                student.hasLive = true;

                // Проверяем зависшие сессии
                const lastUpdate = p.liveProgress.lastUpdate || p.liveProgress.startTime;
                const noUpdateSec = Math.floor((now - lastUpdate) / 1000);

                if (noUpdateSec > 30) {
                    staleSessions++;
                }

                // Проверяем истёкшие сессии
                const remaining = Math.floor((p.liveProgress.endTime - now) / 1000);
                if (remaining <= 0) {
                    expiredSessions++;
                }

                if (p.liveProgress.violations?.length > 0) {
                    student.hasViolation = true;
                }
            } else if (p.bestResult) {
                student.hasCompleted = true;
                if (p.bestResult.grade) {
                    student.grades.push(p.bestResult.grade);
                }
                if (p.bestResult.violationsCount > 0) {
                    student.hasViolation = true;
                }
            }
        });
    });

    // Подсчитываем статистику по уникальным студентам
    let total = uniqueStudents.size;
    let notStarted = 0, inProgress = 0, completed = 0, withViolations = 0;
    let gradesSum = 0, gradesCount = 0;

    uniqueStudents.forEach(student => {
        if (student.hasLive) {
            inProgress++;
        } else if (student.hasCompleted) {
            completed++;
        } else {
            notStarted++;
        }

        if (student.hasViolation) {
            withViolations++;
        }

        // Средняя оценка по всем дисциплинам студента
        student.grades.forEach(g => {
            gradesSum += g;
            gradesCount++;
        });
    });

    const avgGrade = gradesCount > 0 ? (gradesSum / gradesCount).toFixed(1) : '-';
    const problemSessions = staleSessions + expiredSessions;

    stats.innerHTML = `
        <div class="monitor-stat-card">
            <div class="stat-icon">👥</div>
            <div class="stat-info">
                <div class="stat-value">${total}</div>
                <div class="stat-label">Всего</div>
            </div>
        </div>
        <div class="monitor-stat-card">
            <div class="stat-icon">⏳</div>
            <div class="stat-info">
                <div class="stat-value">${notStarted}</div>
                <div class="stat-label">Ждут</div>
            </div>
        </div>
        <div class="monitor-stat-card ${inProgress > 0 ? 'active' : ''}">
            <div class="stat-icon">🔄</div>
            <div class="stat-info">
                <div class="stat-value">${inProgress}</div>
                <div class="stat-label">В процессе</div>
            </div>
        </div>
        <div class="monitor-stat-card ${completed > 0 ? 'success' : ''}" ${completed > 0 ? `onclick="showCompletedList()" style="cursor:pointer" title="Нажмите чтобы увидеть кто завершил"` : ''}>
            <div class="stat-icon">✅</div>
            <div class="stat-info">
                <div class="stat-value">${completed}</div>
                <div class="stat-label">Завершили</div>
            </div>
        </div>
        <div class="monitor-stat-card">
            <div class="stat-icon">📊</div>
            <div class="stat-info">
                <div class="stat-value">${avgGrade}</div>
                <div class="stat-label">Ср. оценка</div>
            </div>
        </div>
        <div class="monitor-stat-card ${withViolations > 0 ? 'danger' : ''}">
            <div class="stat-icon">⚠️</div>
            <div class="stat-info">
                <div class="stat-value">${withViolations}</div>
                <div class="stat-label">Нарушения</div>
            </div>
        </div>
        ${problemSessions > 0 ? `
        <div class="monitor-stat-card problem-blink">
            <div class="stat-icon">🚨</div>
            <div class="stat-info">
                <div class="stat-value">${problemSessions}</div>
                <div class="stat-label">Проблемы</div>
            </div>
        </div>
        ` : ''}
    `;
}

// ============================================
// РЕНДЕР ГРУПП И СТУДЕНТОВ
// ============================================

function renderMonitorContent() {
    const container = document.getElementById('monitor-content');
    if (!container) return;

    if (monitorState.allData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">👥</div>
                <p>Нет данных для отображения</p>
            </div>
        `;
        return;
    }

    // Собираем всех студентов по группам с их дисциплинами
    const groupsMap = {};

    monitorState.allData.forEach(test => {
        test.participants.forEach(p => {
            const groupName = p.group || 'Без группы';
            const studentKey = `${p.surname}_${p.name}_${p.patronymic || ''}_${groupName}`;

            if (!groupsMap[groupName]) {
                groupsMap[groupName] = {};
            }

            if (!groupsMap[groupName][studentKey]) {
                groupsMap[groupName][studentKey] = {
                    surname: p.surname,
                    name: p.name,
                    patronymic: p.patronymic,
                    group: groupName,
                    disciplines: []
                };
            }

            // Добавляем дисциплину
            groupsMap[groupName][studentKey].disciplines.push({
                disciplineName: test.disciplineName,
                testId: test.testId,
                status: p.status,
                liveProgress: p.liveProgress,
                bestResult: p.bestResult,
                variant: p.variant
            });
        });
    });

    // Фильтруем по поиску
    const query = monitorState.searchQuery;
    let filteredGroups = {};

    Object.keys(groupsMap).forEach(groupName => {
        const students = Object.values(groupsMap[groupName]);
        const filteredStudents = students.filter(s => {
            if (!query) return true;

            const fullName = `${s.surname || ''} ${s.name || ''} ${s.patronymic || ''}`.toLowerCase();
            const groupLower = (s.group || '').toLowerCase();
            const disciplines = s.disciplines.map(d => d.disciplineName.toLowerCase()).join(' ');

            return fullName.includes(query) || groupLower.includes(query) || disciplines.includes(query);
        });

        if (filteredStudents.length > 0) {
            filteredGroups[groupName] = filteredStudents;
        }
    });

    if (Object.keys(filteredGroups).length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <p>Никого не найдено по запросу "${escapeHtml(query)}"</p>
            </div>
        `;
        return;
    }

    // Сортируем группы по алфавиту
    const sortedGroups = Object.keys(filteredGroups).sort((a, b) => a.localeCompare(b, 'ru'));

    container.innerHTML = sortedGroups.map(groupName => {
        const students = filteredGroups[groupName]
            .sort((a, b) => `${a.surname} ${a.name}`.localeCompare(`${b.surname} ${b.name}`, 'ru'));

        const isExpanded = monitorState.expandedGroups.has(groupName);

        // Статистика группы
        let groupInProgress = 0, groupCompleted = 0, groupHasProblems = false;
        students.forEach(s => {
            s.disciplines.forEach(d => {
                if (d.liveProgress) {
                    groupInProgress++;
                } else if (d.bestResult) {
                    // Завершили - ТОЛЬКО если есть реальный результат
                    groupCompleted++;
                }
                if ((d.liveProgress?.violations?.length > 0) || (d.bestResult?.violationsCount > 0)) {
                    groupHasProblems = true;
                }
            });
        });

        return `
            <div class="monitor-group ${groupHasProblems ? 'has-problems' : ''}">
                <div class="monitor-group-header" onclick="toggleMonitorGroup('${escapeHtml(groupName)}')">
                    <div class="group-title">
                        <span class="expand-icon">${isExpanded ? '▼' : '▶'}</span>
                        <span class="group-name">${escapeHtml(groupName)}</span>
                        <span class="group-count">${students.length} чел.</span>
                    </div>
                    <div class="group-status-badges">
                        ${groupInProgress > 0 ? `<span class="badge badge-progress">${groupInProgress} в процессе</span>` : ''}
                        ${groupCompleted > 0 ? `<span class="badge badge-completed">${groupCompleted} ✓</span>` : ''}
                        ${groupHasProblems ? `<span class="badge badge-violations">⚠️</span>` : ''}
                    </div>
                </div>
                <div class="monitor-group-content ${isExpanded ? '' : 'collapsed'}">
                    <div class="students-list">
                        ${students.map(s => renderStudentWithDisciplines(s)).join('')}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function toggleMonitorGroup(groupName) {
    if (monitorState.expandedGroups.has(groupName)) {
        monitorState.expandedGroups.delete(groupName);
    } else {
        monitorState.expandedGroups.add(groupName);
    }
    renderMonitorContent();
}

// ============================================
// КАРТОЧКА СТУДЕНТА С ДИСЦИПЛИНАМИ
// ============================================

function renderStudentWithDisciplines(student) {
    const fullName = [student.surname, student.name, student.patronymic].filter(Boolean).join(' ');
    const shortName = `${student.surname || ''} ${student.name || ''}`;

    // Общая статистика студента
    let hasProblems = false;
    student.disciplines.forEach(d => {
        if ((d.liveProgress?.violations?.length > 0) || (d.bestResult?.violationsCount > 0)) {
            hasProblems = true;
        }
    });

    return `
        <div class="student-row ${hasProblems ? 'has-violations' : ''}" title="${escapeHtml(fullName)}">
            <div class="student-name-col">
                <span class="student-fio">${escapeHtml(shortName)}</span>
            </div>
            <div class="student-disciplines-col">
                ${student.disciplines.map(d => renderDisciplineStatus(d)).join('')}
            </div>
        </div>
    `;
}

function renderDisciplineStatus(disc) {
    const live = disc.liveProgress;
    const result = disc.bestResult;

    let statusClass = 'not-started';
    let statusIcon = '⏳';
    let statusText = '';
    let questionInfo = '';
    let warningIcon = '';

    if (live) {
        statusClass = 'in-progress';
        statusIcon = '🔄';

        // Текущий вопрос (1-based для отображения)
        const currentQ = (live.currentQuestion || 0) + 1;
        const totalQ = live.totalQuestions || 0;
        const answered = live.answeredCount || 0;

        // Показываем: вопрос X, отвечено Y/Z
        questionInfo = `В${currentQ}`;
        statusText = `${answered}/${totalQ}`;

        // Время
        const now = monitorState.serverTime || Date.now();
        const remaining = Math.max(0, Math.floor((live.endTime - now) / 1000));
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        statusText += ` ⏱${mins}:${String(secs).padStart(2, '0')}`;

        // Проверяем "зависшую" сессию - нет обновлений больше 30 секунд
        const lastUpdate = live.lastUpdate || live.startTime;
        const noUpdateSec = Math.floor((now - lastUpdate) / 1000);

        if (noUpdateSec > 30) {
            // Сессия зависла - вкладка закрыта или проблема
            statusClass += ' stale-session';
            warningIcon = `<span class="warning-blink" title="Нет активности ${noUpdateSec} сек. Возможно вкладка закрыта!">⚠️</span>`;
        }

        // Мало времени - меньше 2 минут
        if (remaining > 0 && remaining < 120) {
            statusClass += ' low-time';
        }

        // Время истекло но тест не завершён
        if (remaining <= 0) {
            statusClass += ' time-expired';
            warningIcon = `<span class="warning-blink critical" title="Время истекло! Тест должен был завершиться">🚨</span>`;
        }
    } else if (disc.status === 'passed' && result) {
        // Сдал - есть результат с проходным баллом
        statusClass = 'passed';
        statusIcon = '✅';
        statusText = `${result.grade}`;
    } else if (disc.status === 'failed' && result) {
        // Не сдал - есть результат но не прошёл
        statusClass = 'failed';
        statusIcon = '❌';
        statusText = `${result.grade}`;
    }
    // else - остаётся not-started с ⏳ (по умолчанию)

    const violationsCount = live?.violations?.length || result?.violationsCount || 0;
    const hasViolations = violationsCount > 0;

    // Сокращаем название дисциплины
    const discName = disc.disciplineName.length > 20
        ? disc.disciplineName.substring(0, 18) + '...'
        : disc.disciplineName;

    return `
        <div class="disc-status ${statusClass} ${hasViolations ? 'has-violations' : ''}" title="${escapeHtml(disc.disciplineName)}">
            ${warningIcon}
            <span class="disc-name">${escapeHtml(discName)}</span>
            <span class="disc-icon">${statusIcon}</span>
            ${questionInfo ? `<span class="disc-question">${questionInfo}</span>` : ''}
            ${statusText ? `<span class="disc-info">${statusText}</span>` : ''}
            ${hasViolations ? `<span class="disc-violations">⚠️${violationsCount}</span>` : ''}
        </div>
    `;
}

// ============================================
// ПОКАЗАТЬ КТО ЗАВЕРШИЛ
// ============================================

function showCompletedList() {
    const completedList = [];

    monitorState.allData.forEach(test => {
        test.participants.forEach(p => {
            if (p.bestResult) {
                completedList.push({
                    name: `${p.surname} ${p.name}`,
                    group: p.group,
                    discipline: test.disciplineName,
                    grade: p.bestResult.grade,
                    percentage: p.bestResult.percentage
                });
            }
        });
    });

    if (completedList.length === 0) {
        showNotification('Никто ещё не завершил тест', 'info');
        return;
    }

    // Группируем по группам
    const byGroup = {};
    completedList.forEach(item => {
        if (!byGroup[item.group]) byGroup[item.group] = [];
        byGroup[item.group].push(item);
    });

    let message = 'Завершили тест:\n\n';
    Object.keys(byGroup).sort().forEach(group => {
        message += `📁 ${group}:\n`;
        byGroup[group].forEach(item => {
            message += `  • ${item.name} — ${item.discipline}: ${item.grade} (${item.percentage}%)\n`;
        });
        message += '\n';
    });

    alert(message);
}

// ============================================
// ЗВУКОВОЕ ОПОВЕЩЕНИЕ
// ============================================

function playViolationSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.frequency.value = 800;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
        console.warn('Audio not supported');
    }
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function updateLastUpdateTime() {
    const el = document.getElementById('last-update-time');
    if (el) {
        const now = new Date();
        const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        el.textContent = `| Обновлено: ${time}`;
    }
}
