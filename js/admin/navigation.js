// ============================================
// НАВИГАЦИЯ, ПОИСК И ЧЕРНОВИКИ
// ============================================

// ============================================
// BREADCRUMB НАВИГАЦИЯ
// ============================================

// Обновить breadcrumb для страницы вопросов
function updateBreadcrumbForQuestions() {
    const container = document.getElementById('breadcrumb-container');
    if (!container || !currentTestForQuestions) {
        if (container) container.innerHTML = '';
        return;
    }

    const test = currentTestForQuestions;
    const discipline = adminState.disciplines.find(d => String(d.id) === String(test.disciplineId));
    const topic = adminState.topics.find(t => String(t.id) === String(test.topicId));

    // Сохраняем в состояние для навигации
    if (discipline) adminState.currentDiscipline = discipline;
    if (topic) adminState.currentTopic = topic;

    const items = [
        {
            icon: '📚',
            text: 'Дисциплины',
            onClick: 'goToDisciplines()'
        }
    ];

    if (discipline) {
        items.push({
            icon: '📖',
            text: discipline.name,
            onClick: `goToDiscipline('${discipline.id}')`
        });
    }

    if (topic) {
        items.push({
            icon: '📑',
            text: topic.name,
            onClick: `goToTopic('${topic.id}')`
        });
    }

    items.push({
        icon: test.isAdminSrezMode ? '📋' : '📝',
        text: test.name,
        active: true
    });

    container.innerHTML = `
        <nav class="breadcrumb">
            ${items.map((item, idx) => `
                <div class="breadcrumb-item ${item.active ? 'active' : ''}">
                    <span class="breadcrumb-icon">${item.icon}</span>
                    ${item.active
                        ? `<span>${escapeHtml(item.text)}</span>`
                        : `<span class="breadcrumb-link" onclick="${item.onClick}">${escapeHtml(item.text)}</span>`
                    }
                </div>
                ${idx < items.length - 1 ? '<span class="breadcrumb-separator">›</span>' : ''}
            `).join('')}
        </nav>
    `;
}

// Навигация по breadcrumb
function goToDisciplines() {
    adminState.currentDiscipline = null;
    adminState.currentTopic = null;
    currentTestForQuestions = null;
    clearBreadcrumb();
    renderDisciplinesTab();
}

function goToDiscipline(disciplineId) {
    adminState.currentTopic = null;
    currentTestForQuestions = null;
    clearBreadcrumb();
    showTopicsForDiscipline(disciplineId);
}

function goToTopic(topicId) {
    currentTestForQuestions = null;
    clearBreadcrumb();
    showTestsForTopic(topicId);
}

// Очистить breadcrumb
function clearBreadcrumb() {
    const container = document.getElementById('breadcrumb-container');
    if (container) container.innerHTML = '';
}

// Обновить breadcrumb при навигации по дисциплинам/темам
function updateBreadcrumbForNavigation() {
    const container = document.getElementById('breadcrumb-container');
    if (!container) return;

    const items = [
        {
            icon: '📚',
            text: 'Дисциплины',
            onClick: 'goToDisciplines()'
        }
    ];

    // Если выбрана дисциплина
    if (adminState.currentDiscipline) {
        // Если есть ещё и тема - делаем дисциплину кликабельной
        if (adminState.currentTopic) {
            items.push({
                icon: '📖',
                text: adminState.currentDiscipline.name,
                onClick: `goToDiscipline('${adminState.currentDiscipline.id}')`
            });
        } else {
            // Дисциплина - конечная точка
            items.push({
                icon: '📖',
                text: adminState.currentDiscipline.name,
                active: true
            });
        }
    }

    // Если выбрана тема
    if (adminState.currentTopic) {
        items.push({
            icon: '📑',
            text: adminState.currentTopic.name,
            active: true
        });
    }

    // Не показываем breadcrumb если только корень
    if (items.length <= 1) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <nav class="breadcrumb">
            ${items.map((item, idx) => `
                <div class="breadcrumb-item ${item.active ? 'active' : ''}">
                    <span class="breadcrumb-icon">${item.icon}</span>
                    ${item.active
                        ? `<span>${escapeHtml(item.text)}</span>`
                        : `<span class="breadcrumb-link" onclick="${item.onClick}">${escapeHtml(item.text)}</span>`
                    }
                </div>
                ${idx < items.length - 1 ? '<span class="breadcrumb-separator">›</span>' : ''}
            `).join('')}
        </nav>
    `;
}

// Генерация breadcrumb на основе текущего состояния
function renderBreadcrumb() {
    const container = document.getElementById('breadcrumb-container');
    if (!container) return '';

    const items = [];

    // Всегда начинаем с "Дисциплины"
    items.push({
        icon: '📚',
        text: 'Дисциплины',
        onClick: () => {
            adminState.currentDiscipline = null;
            adminState.currentTopic = null;
            renderDisciplinesTab();
        }
    });

    // Если выбрана дисциплина
    if (adminState.currentDiscipline) {
        items.push({
            icon: '📖',
            text: adminState.currentDiscipline.name,
            onClick: () => {
                adminState.currentTopic = null;
                showTopicsForDiscipline(adminState.currentDiscipline.id);
            }
        });
    }

    // Если выбрана тема
    if (adminState.currentTopic) {
        items.push({
            icon: '📑',
            text: adminState.currentTopic.name,
            onClick: () => {
                showTestsForTopic(adminState.currentTopic.id);
            }
        });
    }

    // Если открыт тест (вопросы)
    if (currentTestForQuestions) {
        items.push({
            icon: currentTestForQuestions.isAdminSrezMode ? '📋' : '📝',
            text: currentTestForQuestions.name,
            active: true
        });
    }

    container.innerHTML = generateBreadcrumbHtml(items);
}

// Генерация HTML для breadcrumb
function generateBreadcrumbHtml(items) {
    if (items.length <= 1) return ''; // Не показываем если только корень

    return `
        <nav class="breadcrumb">
            ${items.map((item, idx) => `
                <div class="breadcrumb-item ${item.active ? 'active' : ''}">
                    <span class="breadcrumb-icon">${item.icon}</span>
                    ${item.active
                        ? `<span>${escapeHtml(item.text)}</span>`
                        : `<span class="breadcrumb-link" onclick="${item.onClick ? `(${item.onClick.toString()})()` : ''}">${escapeHtml(item.text)}</span>`
                    }
                </div>
                ${idx < items.length - 1 ? '<span class="breadcrumb-separator">›</span>' : ''}
            `).join('')}
        </nav>
    `;
}

// Простая функция для создания breadcrumb строки
function getBreadcrumbForTest(test) {
    if (!test) return '';

    const discipline = adminState.disciplines.find(d => String(d.id) === String(test.disciplineId));
    const topic = adminState.topics.find(t => String(t.id) === String(test.topicId));

    const parts = [];
    if (discipline) parts.push(discipline.name);
    if (topic) parts.push(topic.name);
    parts.push(test.name);

    return parts.join(' › ');
}


// ============================================
// ГЛОБАЛЬНЫЙ ПОИСК ПО ВОПРОСАМ
// ============================================

let globalSearchResults = [];
let globalSearchSelectedIndex = 0;

// Открыть глобальный поиск
function openGlobalSearch() {
    // Создаём overlay если его нет
    let overlay = document.getElementById('global-search-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'global-search-overlay';
        overlay.className = 'global-search-overlay';
        overlay.innerHTML = `
            <div class="global-search-modal">
                <div class="global-search-header">
                    <span class="global-search-icon">🔍</span>
                    <input type="text" id="global-search-input" placeholder="Поиск по всем вопросам..." autocomplete="off">
                    <button class="global-search-close" onclick="closeGlobalSearch()">&times;</button>
                </div>
                <div class="global-search-results" id="global-search-results">
                    <div class="global-search-empty">
                        <div class="global-search-empty-icon">🔍</div>
                        <div>Начните вводить текст для поиска</div>
                    </div>
                </div>
                <div class="global-search-footer">
                    <div class="global-search-hints">
                        <span><kbd>↑↓</kbd> навигация</span>
                        <span><kbd>Enter</kbd> перейти</span>
                        <span><kbd>Esc</kbd> закрыть</span>
                    </div>
                    <span id="global-search-count"></span>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Обработчики
        const input = overlay.querySelector('#global-search-input');
        input.addEventListener('input', debounce(handleGlobalSearch, 300));
        input.addEventListener('keydown', handleGlobalSearchKeydown);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeGlobalSearch();
        });
    }

    overlay.classList.add('show');
    document.getElementById('global-search-input').focus();
    globalSearchResults = [];
    globalSearchSelectedIndex = 0;
}

// Закрыть глобальный поиск
function closeGlobalSearch() {
    const overlay = document.getElementById('global-search-overlay');
    if (overlay) {
        overlay.classList.remove('show');
    }
}

// Обработка поиска
async function handleGlobalSearch() {
    const query = document.getElementById('global-search-input').value.trim().toLowerCase();
    const resultsContainer = document.getElementById('global-search-results');
    const countEl = document.getElementById('global-search-count');

    if (query.length < 2) {
        resultsContainer.innerHTML = `
            <div class="global-search-empty">
                <div class="global-search-empty-icon">🔍</div>
                <div>Введите минимум 2 символа</div>
            </div>
        `;
        countEl.textContent = '';
        globalSearchResults = [];
        return;
    }

    // Показываем загрузку
    resultsContainer.innerHTML = `
        <div class="global-search-empty">
            <div class="global-search-empty-icon">⏳</div>
            <div>Поиск...</div>
        </div>
    `;

    // Загружаем все вопросы из всех тестов
    try {
        const result = await apiRequest('/questions');
        const allQuestions = result.success ? result.questions : [];

        // Фильтруем по запросу
        globalSearchResults = allQuestions.filter(q => {
            const text = (q.text || '').toLowerCase();
            const options = (q.options || []).map(o => (o.text || o).toLowerCase()).join(' ');
            return text.includes(query) || options.includes(query);
        }).slice(0, 50); // Максимум 50 результатов

        globalSearchSelectedIndex = 0;

        if (globalSearchResults.length === 0) {
            resultsContainer.innerHTML = `
                <div class="global-search-empty">
                    <div class="global-search-empty-icon">😔</div>
                    <div>Ничего не найдено</div>
                </div>
            `;
            countEl.textContent = '';
            return;
        }

        // Рендерим результаты
        resultsContainer.innerHTML = globalSearchResults.map((q, idx) => {
            const test = adminState.tests.find(t => String(t.id) === String(q.testId));
            const discipline = test ? adminState.disciplines.find(d => String(d.id) === String(test.disciplineId)) : null;

            // Подсвечиваем найденный текст
            let displayText = escapeHtml(q.text || '').substring(0, 150);
            if (displayText.length >= 150) displayText += '...';

            const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
            displayText = displayText.replace(regex, '<mark>$1</mark>');

            return `
                <div class="global-search-result-item ${idx === 0 ? 'selected' : ''}"
                     data-index="${idx}"
                     onclick="selectGlobalSearchResult(${idx})">
                    <div class="search-result-text">${displayText}</div>
                    <div class="search-result-meta">
                        <span class="search-result-type">${getQuestionTypeLabel(q.type)}</span>
                        <span>${discipline ? escapeHtml(discipline.name) : ''}</span>
                        <span>›</span>
                        <span>${test ? escapeHtml(test.name) : ''}</span>
                    </div>
                </div>
            `;
        }).join('');

        countEl.textContent = `Найдено: ${globalSearchResults.length}`;
    } catch (error) {
        console.error('Search error:', error);
        resultsContainer.innerHTML = `
            <div class="global-search-empty">
                <div class="global-search-empty-icon">❌</div>
                <div>Ошибка поиска</div>
            </div>
        `;
    }
}

// Экранирование для регулярного выражения
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Обработка клавиш в поиске
function handleGlobalSearchKeydown(e) {
    const results = document.querySelectorAll('.global-search-result-item');

    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            if (globalSearchSelectedIndex < results.length - 1) {
                globalSearchSelectedIndex++;
                updateGlobalSearchSelection();
            }
            break;
        case 'ArrowUp':
            e.preventDefault();
            if (globalSearchSelectedIndex > 0) {
                globalSearchSelectedIndex--;
                updateGlobalSearchSelection();
            }
            break;
        case 'Enter':
            e.preventDefault();
            selectGlobalSearchResult(globalSearchSelectedIndex);
            break;
        case 'Escape':
            closeGlobalSearch();
            break;
    }
}

// Обновление выделения в результатах
function updateGlobalSearchSelection() {
    const results = document.querySelectorAll('.global-search-result-item');
    results.forEach((el, idx) => {
        el.classList.toggle('selected', idx === globalSearchSelectedIndex);
        if (idx === globalSearchSelectedIndex) {
            el.scrollIntoView({ block: 'nearest' });
        }
    });
}

// Выбор результата поиска
function selectGlobalSearchResult(index) {
    const question = globalSearchResults[index];
    if (!question) return;

    closeGlobalSearch();

    // Находим тест и переходим к нему
    const test = adminState.tests.find(t => String(t.id) === String(question.testId));
    if (test) {
        // Устанавливаем состояние навигации
        const discipline = adminState.disciplines.find(d => String(d.id) === String(test.disciplineId));
        const topic = adminState.topics.find(t => String(t.id) === String(test.topicId));

        if (discipline) adminState.currentDiscipline = discipline;
        if (topic) adminState.currentTopic = topic;

        // Переходим к вопросам теста
        manageQuestions(test.id).then(() => {
            // Подсвечиваем найденный вопрос
            setTimeout(() => {
                const questionEl = document.querySelector(`[data-question-id="${question.id}"]`);
                if (questionEl) {
                    questionEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    questionEl.classList.add('highlight-found');
                    setTimeout(() => questionEl.classList.remove('highlight-found'), 3000);
                }
            }, 500);
        });
    }
}


// ============================================
// АВТОСОХРАНЕНИЕ ЧЕРНОВИКА ВОПРОСА
// ============================================

const DRAFT_KEY = 'question_draft';
let draftAutoSaveTimeout = null;

// Сохранить черновик вопроса
function saveDraft() {
    const form = document.getElementById('question-form');
    if (!form) return;

    const draft = {
        testId: currentTestForQuestions?.id,
        timestamp: Date.now(),
        data: {
            type: document.getElementById('question-type')?.value,
            text: document.getElementById('question-text')?.value,
            difficulty: document.getElementById('question-difficulty')?.value,
            weight: document.getElementById('question-weight')?.value,
            variant: document.getElementById('question-variant')?.value,
            hint: document.getElementById('question-hint')?.value,
            image: currentQuestionImage
        }
    };

    // Сохраняем только если есть что-то введённое
    if (draft.data.text && draft.data.text.trim()) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        console.log('Draft saved');
    }
}

// Загрузить черновик
function loadDraft() {
    try {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (!saved) return null;

        const draft = JSON.parse(saved);

        // Проверяем, не устарел ли черновик (24 часа)
        if (Date.now() - draft.timestamp > 24 * 60 * 60 * 1000) {
            clearDraft();
            return null;
        }

        return draft;
    } catch (e) {
        return null;
    }
}

// Очистить черновик
function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
}

// Проверить наличие черновика и показать индикатор
function checkAndShowDraftIndicator() {
    const draft = loadDraft();
    if (!draft) return false;

    // Проверяем, относится ли черновик к текущему тесту
    if (draft.testId !== currentTestForQuestions?.id) {
        // Черновик от другого теста - предлагаем восстановить
        const otherTest = adminState.tests.find(t => String(t.id) === String(draft.testId));
        const testName = otherTest ? otherTest.name : 'другого теста';

        return {
            isDifferentTest: true,
            testName,
            draft
        };
    }

    return {
        isDifferentTest: false,
        draft
    };
}

// Восстановить черновик в форму
function restoreDraft() {
    const draft = loadDraft();
    if (!draft || !draft.data) return;

    const { data } = draft;

    if (data.type && document.getElementById('question-type')) {
        document.getElementById('question-type').value = data.type;
        // Вызываем обновление формы для типа
        if (typeof updateQuestionFormForType === 'function') {
            updateQuestionFormForType();
        }
    }
    if (data.text && document.getElementById('question-text')) {
        document.getElementById('question-text').value = data.text;
    }
    if (data.difficulty && document.getElementById('question-difficulty')) {
        document.getElementById('question-difficulty').value = data.difficulty;
    }
    if (data.weight && document.getElementById('question-weight')) {
        document.getElementById('question-weight').value = data.weight;
    }
    if (data.variant && document.getElementById('question-variant')) {
        document.getElementById('question-variant').value = data.variant;
    }
    if (data.hint && document.getElementById('question-hint')) {
        document.getElementById('question-hint').value = data.hint;
    }
    if (data.image) {
        currentQuestionImage = data.image;
    }

    // Убираем индикатор черновика
    const indicator = document.querySelector('.draft-indicator');
    if (indicator) indicator.remove();

    showNotification('Черновик восстановлен', 'success');
}

// Отклонить черновик
function discardDraft() {
    clearDraft();
    const indicator = document.querySelector('.draft-indicator');
    if (indicator) indicator.remove();
    showNotification('Черновик удалён', 'info');
}

// Инициализация автосохранения для формы вопроса
function initDraftAutoSave() {
    const form = document.getElementById('question-form');
    if (!form) return;

    // Слушаем изменения в форме
    form.addEventListener('input', () => {
        // Отменяем предыдущий таймер
        if (draftAutoSaveTimeout) {
            clearTimeout(draftAutoSaveTimeout);
        }

        // Сохраняем через 2 секунды после последнего ввода
        draftAutoSaveTimeout = setTimeout(saveDraft, 2000);
    });
}

// Генерация HTML индикатора черновика
function getDraftIndicatorHtml(draftInfo) {
    if (!draftInfo) return '';

    const timeAgo = getTimeAgo(draftInfo.draft.timestamp);

    if (draftInfo.isDifferentTest) {
        return `
            <div class="draft-indicator">
                <span class="draft-indicator-icon">📝</span>
                <span class="draft-indicator-text">
                    Найден черновик из теста "${escapeHtml(draftInfo.testName)}" (${timeAgo})
                </span>
                <div class="draft-indicator-actions">
                    <button class="draft-indicator-btn" onclick="restoreDraft()">Восстановить</button>
                    <button class="draft-indicator-btn discard" onclick="discardDraft()">Удалить</button>
                </div>
            </div>
        `;
    }

    return `
        <div class="draft-indicator">
            <span class="draft-indicator-icon">📝</span>
            <span class="draft-indicator-text">Найден несохранённый черновик (${timeAgo})</span>
            <div class="draft-indicator-actions">
                <button class="draft-indicator-btn" onclick="restoreDraft()">Восстановить</button>
                <button class="draft-indicator-btn discard" onclick="discardDraft()">Удалить</button>
            </div>
        </div>
    `;
}

// Вспомогательная функция для отображения времени
function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'только что';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} мин. назад`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} ч. назад`;
    return `${Math.floor(seconds / 86400)} дн. назад`;
}


// ============================================
// ГОРЯЧИЕ КЛАВИШИ ДЛЯ ГЛОБАЛЬНОГО ПОИСКА
// ============================================

document.addEventListener('keydown', function(e) {
    // Ctrl+K или Ctrl+/ - открыть глобальный поиск
    if ((e.key === 'k' || e.key === '/') && e.ctrlKey) {
        e.preventDefault();
        openGlobalSearch();
    }
});
