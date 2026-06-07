// ============================================
// LIVE EXAM MONITOR: Мониторинг теста в реальном времени
// ============================================

let examMonitorState = {
    testId: null,
    refreshInterval: null,
    students: [],
    serverTime: 0
};

const EXAM_MONITOR_REFRESH = 5000; // 5 секунд

// ============================================
// ОТКРЫТИЕ МОНИТОРА
// ============================================

function openExamMonitor(testId) {
    examMonitorState.testId = testId;

    const test = (adminState.tests || []).find(t => String(t.id) === String(testId));
    const testName = test ? (test.name || 'Тест') : 'Тест';

    // Создаём модальное окно если его нет
    if (!document.getElementById('exam-monitor-modal')) {
        const modal = document.createElement('div');
        modal.id = 'exam-monitor-modal';
        modal.className = 'modal hidden';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 1100px; width: 95%; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column;">
                <div class="modal-header" style="flex-shrink: 0;">
                    <h2 id="exam-monitor-title">Мониторинг</h2>
                    <button class="btn-close" onclick="closeExamMonitor()">&times;</button>
                </div>
                <div id="exam-monitor-content" style="overflow-y: auto; flex: 1; padding: 16px;"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('exam-monitor-title').textContent = `🔴 Live: ${escapeHtml(testName)}`;
    document.getElementById('exam-monitor-content').innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">Загрузка данных...</div>';

    showModal('exam-monitor-modal');

    // Первая загрузка и автообновление
    refreshExamMonitor();
    if (examMonitorState.refreshInterval) clearInterval(examMonitorState.refreshInterval);
    examMonitorState.refreshInterval = setInterval(refreshExamMonitor, EXAM_MONITOR_REFRESH);
}

function closeExamMonitor() {
    hideModal('exam-monitor-modal');
    if (examMonitorState.refreshInterval) {
        clearInterval(examMonitorState.refreshInterval);
        examMonitorState.refreshInterval = null;
    }
    examMonitorState.testId = null;
    examMonitorState.students = [];
}

// ============================================
// ЗАГРУЗКА ДАННЫХ
// ============================================

async function refreshExamMonitor() {
    if (!examMonitorState.testId) return;

    try {
        const result = await apiRequest(`/exam/monitor/${examMonitorState.testId}`);
        if (result.success) {
            examMonitorState.students = result.students || [];
            examMonitorState.serverTime = result.serverTime || Date.now();
            renderExamMonitorContent();
        }
    } catch (e) {
        console.error('[ExamMonitor] Ошибка загрузки:', e);
    }
}

// ============================================
// РЕНДЕР СОДЕРЖИМОГО
// ============================================

function renderExamMonitorContent() {
    const container = document.getElementById('exam-monitor-content');
    if (!container) return;

    const students = examMonitorState.students;
    const now = examMonitorState.serverTime || Date.now();

    if (students.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:60px 20px;">
                <div style="font-size:48px; margin-bottom:16px;">📭</div>
                <p style="color:#94a3b8; font-size:16px;">Нет активных студентов на этом тесте</p>
                <p style="color:#64748b; font-size:13px; margin-top:8px;">Данные обновляются каждые 5 секунд</p>
            </div>
        `;
        return;
    }

    // Статистика
    const totalStudents = students.length;
    const totalViolations = students.reduce((sum, s) => sum + (s.violations.tabSwitches || 0) + (s.violations.fullscreenExits || 0), 0);
    const avgProgress = students.length > 0
        ? Math.round(students.reduce((sum, s) => sum + (s.totalQuestions > 0 ? (s.answeredCount / s.totalQuestions) * 100 : 0), 0) / students.length)
        : 0;

    const statsHtml = `
        <div style="display:flex; gap:12px; margin-bottom:16px; flex-wrap:wrap;">
            <div style="flex:1; min-width:140px; background:linear-gradient(135deg,#1e293b,#334155); border-radius:10px; padding:14px 18px; text-align:center;">
                <div style="font-size:28px; font-weight:700; color:#60a5fa;">${totalStudents}</div>
                <div style="font-size:12px; color:#94a3b8; margin-top:2px;">Активных</div>
            </div>
            <div style="flex:1; min-width:140px; background:linear-gradient(135deg,#1e293b,#334155); border-radius:10px; padding:14px 18px; text-align:center;">
                <div style="font-size:28px; font-weight:700; color:#34d399;">${avgProgress}%</div>
                <div style="font-size:12px; color:#94a3b8; margin-top:2px;">Средний прогресс</div>
            </div>
            <div style="flex:1; min-width:140px; background:linear-gradient(135deg,#1e293b,#334155); border-radius:10px; padding:14px 18px; text-align:center;">
                <div style="font-size:28px; font-weight:700; color:${totalViolations > 0 ? '#f87171' : '#94a3b8'};">${totalViolations}</div>
                <div style="font-size:12px; color:#94a3b8; margin-top:2px;">Нарушений</div>
            </div>
        </div>
    `;

    // Сортируем: сначала с нарушениями, потом по фамилии
    const sorted = [...students].sort((a, b) => {
        const aViol = (a.violations.tabSwitches || 0) + (a.violations.fullscreenExits || 0);
        const bViol = (b.violations.tabSwitches || 0) + (b.violations.fullscreenExits || 0);
        if (bViol !== aViol) return bViol - aViol;
        return (a.studentSurname || '').localeCompare(b.studentSurname || '');
    });

    const rowsHtml = sorted.map(s => {
        const progress = s.totalQuestions > 0 ? Math.round((s.answeredCount / s.totalQuestions) * 100) : 0;
        const violCount = (s.violations.tabSwitches || 0) + (s.violations.fullscreenExits || 0);
        const isIdle = s.idleMinutes >= 2;

        // Определяем цвет статуса
        let statusColor, statusLabel, rowBg;
        if (violCount > 0) {
            statusColor = '#f87171';
            statusLabel = 'Нарушения';
            rowBg = 'rgba(248,113,113,0.06)';
        } else if (isIdle) {
            statusColor = '#fbbf24';
            statusLabel = 'Неактивен';
            rowBg = 'rgba(251,191,36,0.06)';
        } else {
            statusColor = '#34d399';
            statusLabel = 'Активен';
            rowBg = 'transparent';
        }

        // Цвет прогресс-бара
        let progressColor = '#3b82f6';
        if (progress >= 80) progressColor = '#34d399';
        else if (progress >= 50) progressColor = '#60a5fa';

        const violDetails = [];
        if (s.violations.tabSwitches > 0) violDetails.push(`Вкладки: ${s.violations.tabSwitches}`);
        if (s.violations.fullscreenExits > 0) violDetails.push(`Полноэкран: ${s.violations.fullscreenExits}`);

        return `
            <tr style="background:${rowBg};">
                <td style="padding:10px 12px; white-space:nowrap;">
                    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor};margin-right:8px;box-shadow:0 0 6px ${statusColor};"></span>
                    <strong>${escapeHtml(s.studentSurname)} ${escapeHtml(s.studentName)}</strong>
                </td>
                <td style="padding:10px 12px; color:#94a3b8; font-size:13px;">${escapeHtml(s.studentGroup || '-')}</td>
                <td style="padding:10px 12px; text-align:center;">${s.currentQuestion} / ${s.totalQuestions || '?'}</td>
                <td style="padding:10px 12px; min-width:140px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div style="flex:1; height:8px; background:#1e293b; border-radius:4px; overflow:hidden;">
                            <div style="width:${progress}%; height:100%; background:${progressColor}; border-radius:4px; transition:width 0.5s ease;"></div>
                        </div>
                        <span style="font-size:12px; color:#94a3b8; min-width:35px; text-align:right;">${progress}%</span>
                    </div>
                </td>
                <td style="padding:10px 12px; text-align:center; font-size:13px; color:#94a3b8;">${s.elapsedMinutes} мин</td>
                <td style="padding:10px 12px; text-align:center;">
                    ${violCount > 0
                        ? `<span style="color:#f87171; font-weight:600;" title="${escapeHtml(violDetails.join(', '))}">${violCount} ⚠️</span>`
                        : '<span style="color:#4ade80;">0</span>'
                    }
                </td>
                <td style="padding:10px 12px; text-align:center; font-size:12px; color:${isIdle ? '#fbbf24' : '#64748b'};">
                    ${statusLabel}
                </td>
            </tr>
        `;
    }).join('');

    const updateTime = new Date().toLocaleTimeString('ru-RU');

    container.innerHTML = `
        ${statsHtml}
        <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:14px;">
                <thead>
                    <tr style="border-bottom:2px solid #334155;">
                        <th style="padding:10px 12px; text-align:left; color:#94a3b8; font-weight:600; font-size:12px; text-transform:uppercase;">Студент</th>
                        <th style="padding:10px 12px; text-align:left; color:#94a3b8; font-weight:600; font-size:12px; text-transform:uppercase;">Группа</th>
                        <th style="padding:10px 12px; text-align:center; color:#94a3b8; font-weight:600; font-size:12px; text-transform:uppercase;">Вопрос</th>
                        <th style="padding:10px 12px; text-align:left; color:#94a3b8; font-weight:600; font-size:12px; text-transform:uppercase;">Прогресс</th>
                        <th style="padding:10px 12px; text-align:center; color:#94a3b8; font-weight:600; font-size:12px; text-transform:uppercase;">Время</th>
                        <th style="padding:10px 12px; text-align:center; color:#94a3b8; font-weight:600; font-size:12px; text-transform:uppercase;">Нарушения</th>
                        <th style="padding:10px 12px; text-align:center; color:#94a3b8; font-weight:600; font-size:12px; text-transform:uppercase;">Статус</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
        <div style="text-align:right; margin-top:12px; font-size:11px; color:#64748b;">
            Обновлено: ${updateTime} | Автообновление каждые 5 сек
        </div>
    `;
}
