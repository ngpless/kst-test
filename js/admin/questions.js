// ============================================
// УПРАВЛЕНИЕ ВОПРОСАМИ
// ============================================

// Переменные currentTestForQuestions, currentQuestionsData, currentVariantFilter
// определены в state.js

async function manageQuestions(testId) {
    // Показываем загрузку
    showLoading('Загрузка вопросов...');

    currentTestForQuestions = adminState.tests.find(t => String(t.id) === String(testId));

    // Загружаем вопросы ТОЛЬКО по testId
    // Убран fallback по disciplineId, т.к. он подтягивал вопросы из других тестов
    let result = await apiRequest(`/questions?testId=${testId}`);
    let questions = result.success ? result.questions : [];

    hideLoading();

    // Сохраняем вопросы для фильтрации
    currentQuestionsData = questions;
    currentVariantFilter = 'all';

    // Проверяем, есть ли варианты в адм. срезе
    const isSrez = currentTestForQuestions?.isAdminSrezMode;
    const hasVariants = isSrez && currentTestForQuestions?.adminSrezSettings?.variants?.length > 0;
    const variants = hasVariants ? currentTestForQuestions.adminSrezSettings.variants : [];

    // Статистика по вариантам
    const variantStats = {};
    let noVariantCount = 0;
    questions.forEach(q => {
        if (q.variant) {
            variantStats[q.variant] = (variantStats[q.variant] || 0) + 1;
        } else {
            noVariantCount++;
        }
    });

    // Обновляем breadcrumb навигацию
    updateBreadcrumbForQuestions();

    const content = document.getElementById('questions-content');
    content.innerHTML = `
        <div class="questions-panel">
            <!-- Шапка -->
            <div class="questions-panel-header">
                <div class="questions-panel-title">
                    <div class="questions-panel-icon">${isSrez ? '📋' : '📝'}</div>
                    <div class="questions-panel-info">
                        <h3>${escapeHtml(currentTestForQuestions.name)}</h3>
                        <span class="questions-panel-type">${isSrez ? 'Административный срез' : (currentTestForQuestions.isExamMode ? 'Режим зачёта' : (currentTestForQuestions.isTrainingMode ? 'Тренировка' : 'Контрольная работа'))}</span>
                    </div>
                </div>
                <div class="questions-panel-stats">
                    <div class="stat-item">
                        <span class="stat-value">${questions.length}</span>
                        <span class="stat-label">вопросов</span>
                    </div>
                    ${hasVariants ? `
                    <div class="stat-item">
                        <span class="stat-value">${variants.length}</span>
                        <span class="stat-label">вариантов</span>
                    </div>
                    ` : ''}
                </div>
            </div>

            <!-- Кнопки действий -->
            <div class="questions-panel-actions">
                <button class="btn btn-primary" onclick="showQuestionForm()">
                    <span class="btn-icon-inline">+</span> Добавить вопрос
                </button>
                <button class="btn btn-secondary" onclick="showImportForm()">
                    <span class="btn-icon-inline">📥</span> Импорт
                </button>
                <button class="btn btn-secondary" onclick="showExportModal()">
                    <span class="btn-icon-inline">📤</span> Экспорт
                </button>
                <button class="btn btn-outline" onclick="previewTest()" title="Предпросмотр теста">
                    <span class="btn-icon-inline">👁</span> Предпросмотр
                </button>
            </div>

            ${isSrez ? `
            <!-- Блок вариантов для среза -->
            <div class="variants-section">
                <div class="variants-section-header">
                    <h4>Варианты</h4>
                    ${!hasVariants ? `
                    <div class="variants-warning">
                        <span class="warning-icon">⚠️</span>
                        <span>Варианты не настроены! Перейдите в настройки теста и укажите количество вариантов.</span>
                    </div>
                    ` : ''}
                </div>

                ${hasVariants ? `
                <div class="variants-grid">
                    ${variants.map(v => {
                        const count = variantStats[v.number] || 0;
                        const isComplete = count >= (currentTestForQuestions.questionsCount || 10);
                        return `
                        <div class="variant-card ${currentVariantFilter === v.number ? 'active' : ''} ${count === 0 ? 'empty' : ''}" onclick="filterQuestionsByVariant(${v.number})">
                            <div class="variant-card-header">
                                <span class="variant-card-number">Вариант ${v.number}</span>
                                ${isComplete ? '<span class="variant-complete-badge">✓</span>' : ''}
                            </div>
                            <div class="variant-card-count">${count} вопр.</div>
                            <div class="variant-card-progress">
                                <div class="progress-bar" style="width: ${Math.min(100, (count / (currentTestForQuestions.questionsCount || 10)) * 100)}%"></div>
                            </div>
                        </div>
                        `;
                    }).join('')}
                    ${noVariantCount > 0 ? `
                    <div class="variant-card variant-card-none ${currentVariantFilter === 'none' ? 'active' : ''}" onclick="filterQuestionsByVariant('none')">
                        <div class="variant-card-header">
                            <span class="variant-card-number">Без варианта</span>
                            <span class="variant-warning-badge">!</span>
                        </div>
                        <div class="variant-card-count">${noVariantCount} вопр.</div>
                        <button class="assign-variant-btn" onclick="event.stopPropagation(); showAssignVariantModal()" title="Назначить вариант">📋 Назначить</button>
                    </div>
                    ` : ''}
                </div>
                <div class="variants-tabs-wrapper">
                    <button class="variant-filter-btn ${currentVariantFilter === 'all' ? 'active' : ''}" onclick="filterQuestionsByVariant('all')">
                        Все вопросы
                    </button>
                    <button class="btn btn-outline btn-sm hidden" onclick="previewVariant()" id="preview-variant-btn">
                        👁 Просмотр варианта
                    </button>
                </div>
                ` : `
                <div class="variants-empty-state">
                    <p>Для создания вариантов:</p>
                    <ol>
                        <li>Закройте это окно</li>
                        <li>Нажмите "Редактировать" у теста</li>
                        <li>В разделе "Настройки админ. среза" укажите количество вариантов</li>
                        <li>Сохраните тест</li>
                    </ol>
                </div>
                `}
            </div>
            ` : ''}

            <!-- Массовые действия -->
            ${questions.length > 0 ? `
            <div class="questions-bulk-bar" id="questions-bulk-actions">
                <label class="checkbox-label">
                    <input type="checkbox" id="select-all-questions" onchange="toggleAllQuestions()">
                    <span>Выбрать все</span>
                </label>
                <div class="bulk-buttons hidden" id="questions-bulk-buttons">
                    <span class="selected-count" id="questions-selected-count">0 выбрано</span>
                    <button class="btn btn-danger btn-small" onclick="deleteSelectedQuestions()">Удалить</button>
                </div>
            </div>
            ` : ''}

            <!-- Список вопросов -->
            <div class="questions-list-container">
                <div class="questions-list" id="questions-list">
                    ${questions.length === 0 ? `
                    <div class="questions-empty-state">
                        <div class="empty-icon">📝</div>
                        <h4>Вопросов пока нет</h4>
                        <p>Добавьте первый вопрос вручную или импортируйте из GIFT-файла</p>
                        <div class="empty-actions">
                            <button class="btn btn-primary" onclick="showQuestionForm()">+ Добавить вопрос</button>
                            <button class="btn btn-secondary" onclick="showImportForm()">📥 Импорт GIFT</button>
                        </div>
                    </div>
                    ` : renderQuestionsListHtml(questions, hasVariants)}
                </div>
            </div>
        </div>

        <!-- Форма импорта -->
        <div id="import-form-container" class="import-overlay hidden">
            <div class="import-panel">
                <div class="import-panel-header">
                    <h3>📥 Импорт вопросов (GIFT формат)</h3>
                    <button class="btn-close" onclick="hideImportForm()">×</button>
                </div>
                <form id="import-form">
                    ${hasVariants ? `
                    <div class="form-group import-variant-select">
                        <label><strong>Вариант для импортируемых вопросов:</strong></label>
                        <select id="import-variant">
                            <option value="">— Выберите вариант —</option>
                            ${variants.map(v => `<option value="${v.number}">Вариант ${v.number}</option>`).join('')}
                        </select>
                        <p class="form-hint">Все вопросы из импорта будут привязаны к выбранному варианту</p>
                    </div>
                    ` : ''}
                    <div class="import-template-link">
                        <button type="button" class="btn btn-outline btn-sm" onclick="downloadGiftTemplate()">📄 Скачать шаблон GIFT</button>
                    </div>
                    <div class="import-tabs">
                        <button type="button" class="import-tab active" onclick="switchImportTab('text')">Вставить текст</button>
                        <button type="button" class="import-tab" onclick="switchImportTab('file')">Загрузить файл</button>
                    </div>
                    <div id="import-tab-text" class="import-tab-content">
                        <div class="form-group">
                            <label>Вставьте текст в формате GIFT</label>
                            <textarea id="import-content" rows="10" placeholder="::Вопрос::Текст вопроса{
=Правильный ответ
~Неправильный 1
~Неправильный 2
~Неправильный 3
}"></textarea>
                        </div>
                    </div>
                    <div id="import-tab-file" class="import-tab-content hidden">
                        <div class="form-group">
                            <label>Выберите файл .txt или .gift</label>
                            <div class="file-upload-area" id="file-upload-area">
                                <input type="file" id="import-file" accept=".txt,.gift" onchange="handleFileSelect(event)">
                                <div class="file-upload-placeholder">
                                    <span class="file-icon">📄</span>
                                    <p>Перетащите файл сюда или нажмите для выбора</p>
                                    <p class="hint">Поддерживаются файлы .txt и .gift</p>
                                </div>
                                <div class="file-upload-selected hidden" id="file-selected">
                                    <span class="file-icon">✅</span>
                                    <p id="selected-file-name">файл.txt</p>
                                    <button type="button" class="btn-icon" onclick="clearFileSelection()">✕</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="import-form-footer">
                        <button type="button" class="btn btn-secondary" onclick="hideImportForm()">Отмена</button>
                        <button type="submit" class="btn btn-primary">📥 Импортировать</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Показываем модальное окно (убираем класс hidden)
    const modal = document.getElementById('questions-modal');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    const importForm = document.getElementById('import-form');
    if (importForm) {
        importForm.addEventListener('submit', importQuestions);
    }
}

function hideQuestionsModal() {
    const modal = document.getElementById('questions-modal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
    currentTestForQuestions = null;
}

// Рендер HTML списка вопросов (с группировкой по вариантам если нужно)
function renderQuestionsListHtml(questions, hasVariants) {
    if (questions.length === 0) {
        return '<p class="empty-hint">Вопросов пока нет</p>';
    }

    // Если есть варианты и фильтр не "все" - просто список
    if (!hasVariants || currentVariantFilter !== 'all') {
        return questions.map((q, idx) => renderQuestionItemHtml(q, idx)).join('');
    }

    // Группируем вопросы по вариантам
    const variants = currentTestForQuestions?.adminSrezSettings?.variants || [];
    const grouped = {};
    const noVariant = [];

    questions.forEach(q => {
        if (q.variant) {
            if (!grouped[q.variant]) grouped[q.variant] = [];
            grouped[q.variant].push(q);
        } else {
            noVariant.push(q);
        }
    });

    let html = '';

    // Рендерим каждый вариант отдельным блоком
    variants.forEach(v => {
        const varQuestions = grouped[v.number] || [];
        if (varQuestions.length > 0) {
            html += `
                <div class="variant-group">
                    <div class="variant-group-header">
                        <span class="variant-group-title">Вариант ${v.number}</span>
                        <span class="variant-group-count">${varQuestions.length} вопр.</span>
                    </div>
                    <div class="variant-group-questions">
                        ${varQuestions.map((q, idx) => renderQuestionItemHtml(q, idx)).join('')}
                    </div>
                </div>
            `;
        }
    });

    // Вопросы без варианта
    if (noVariant.length > 0) {
        html += `
            <div class="variant-group variant-group-none">
                <div class="variant-group-header">
                    <span class="variant-group-title">Без варианта</span>
                    <span class="variant-group-count">${noVariant.length} вопр.</span>
                </div>
                <div class="variant-group-questions">
                    ${noVariant.map((q, idx) => renderQuestionItemHtml(q, idx)).join('')}
                </div>
            </div>
        `;
    }

    return html;
}

// Рендер одного элемента вопроса
function renderQuestionItemHtml(q, idx) {
    const variantBadge = q.variant ? `<div class="question-variant-badge">В${q.variant}</div>` : '';
    // Извлекаем только текст без HTML-тегов для списка, показываем иконку если есть картинка
    const hasImage = q.text && q.text.includes('<img');
    const textOnly = stripHtmlTags(q.text || '');
    const imageIcon = hasImage ? '<span class="question-has-image" title="Содержит картинку">🖼️</span>' : '';
    return `
        <div class="question-item" data-id="${q.id}" data-variant="${q.variant || ''}">
            <input type="checkbox" class="question-checkbox" data-id="${q.id}" onchange="updateQuestionsSelection()">
            <div class="question-number">${idx + 1}</div>
            ${variantBadge}
            <div class="question-type-badge ${q.type || 'single'}">${getQuestionTypeLabel(q.type)}</div>
            ${(q.weight || 1) > 1 ? `<div class="question-weight-badge" title="Вес вопроса: ${q.weight} баллов">${q.weight}б</div>` : ''}
            ${imageIcon}
            <div class="question-text">${escapeHtml(textOnly)}</div>
            <div class="question-actions">
                <button class="btn-icon" onclick="previewSingleQuestion('${q.id}')" title="Предпросмотр">👁</button>
                <button class="btn-icon" onclick="editQuestion('${q.id}')" title="Редактировать">✏️</button>
                <button class="btn-icon btn-danger" onclick="deleteQuestion('${q.id}')" title="Удалить">🗑️</button>
            </div>
        </div>
    `;
}

// Удаление HTML-тегов из текста
function stripHtmlTags(html) {
    return new DOMParser().parseFromString(html, 'text/html').body.textContent || '';
}

// Фильтрация вопросов по варианту
function filterQuestionsByVariant(variant) {
    currentVariantFilter = variant;

    // Обновляем активные карточки вариантов
    document.querySelectorAll('.variant-card').forEach(card => {
        card.classList.remove('active');
    });
    if (variant !== 'all') {
        const activeCard = document.querySelector(`.variant-card[onclick*="filterQuestionsByVariant(${variant === 'none' ? "'none'" : variant})"]`);
        if (activeCard) activeCard.classList.add('active');
    }

    // Обновляем кнопку "Все вопросы"
    document.querySelectorAll('.variant-filter-btn').forEach(btn => {
        btn.classList.toggle('active', variant === 'all');
    });

    // Фильтруем вопросы
    let filtered;
    if (variant === 'all') {
        filtered = currentQuestionsData;
    } else if (variant === 'none') {
        filtered = currentQuestionsData.filter(q => !q.variant);
    } else {
        filtered = currentQuestionsData.filter(q => q.variant === variant);
    }

    // Проверяем, есть ли варианты
    const hasVariants = currentTestForQuestions?.isAdminSrezMode &&
                        currentTestForQuestions?.adminSrezSettings?.variants?.length > 0;

    // Перерендериваем список
    const listContainer = document.getElementById('questions-list');
    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div class="questions-empty-state">
                <div class="empty-icon">${variant === 'none' ? '✓' : '📝'}</div>
                <h4>${variant === 'none' ? 'Все вопросы распределены по вариантам' : 'Нет вопросов в этом варианте'}</h4>
                <p>${variant === 'none' ? 'Отлично! Все вопросы имеют назначенный вариант.' : 'Добавьте вопросы или импортируйте их из GIFT-файла'}</p>
            </div>
        `;
    } else {
        listContainer.innerHTML = renderQuestionsListHtml(filtered, hasVariants && variant === 'all');
    }

    // Рендерим LaTeX формулы в списке вопросов
    if (typeof renderLatex === 'function') {
        renderLatex(listContainer);
    }

    // Обновляем bulk actions
    const bulkActions = document.getElementById('questions-bulk-actions');
    if (bulkActions) {
        bulkActions.style.display = filtered.length > 0 ? 'flex' : 'none';
    }

    // Сбрасываем выбор
    const selectAll = document.getElementById('select-all-questions');
    if (selectAll) selectAll.checked = false;
    updateQuestionsSelection();

    // Показываем/скрываем кнопку предпросмотра варианта
    const previewBtn = document.getElementById('preview-variant-btn');
    if (previewBtn) {
        if (variant !== 'all' && variant !== 'none' && filtered.length > 0) {
            previewBtn.style.display = 'inline-flex';
            previewBtn.textContent = `👁 Просмотр варианта ${variant}`;
        } else {
            previewBtn.style.display = 'none';
        }
    }
}

// Модальное окно назначения вариантов вопросам без варианта
function showAssignVariantModal() {
    const variants = currentTestForQuestions?.adminSrezSettings?.variants || [];
    const questionsWithoutVariant = currentQuestionsData.filter(q => !q.variant);

    if (questionsWithoutVariant.length === 0) {
        showSuccess('Все вопросы уже имеют назначенный вариант');
        return;
    }

    if (variants.length === 0) {
        showError('Сначала настройте варианты в настройках теста');
        return;
    }

    // Создаём модальное окно
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'assign-variant-modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h2>Назначить вариант</h2>
                <button class="btn-close" onclick="document.getElementById('assign-variant-modal').remove()">×</button>
            </div>
            <div class="modal-body" style="padding: 24px;">
                <p style="margin-bottom: 16px;">Вопросов без варианта: <strong>${questionsWithoutVariant.length}</strong></p>

                <div class="form-group">
                    <label>Выберите вариант для назначения:</label>
                    <select id="assign-variant-select" class="form-control" style="width: 100%; padding: 12px; font-size: 1rem;">
                        <option value="">— Выберите вариант —</option>
                        ${variants.map(v => `<option value="${v.number}">Вариант ${v.number}</option>`).join('')}
                        <option value="distribute">🔀 Распределить равномерно</option>
                    </select>
                </div>

                <div class="form-group" style="margin-top: 16px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" id="assign-only-selected" style="width: 18px; height: 18px;">
                        <span>Только выбранные вопросы</span>
                    </label>
                </div>
            </div>
            <div class="modal-footer" style="padding: 16px 24px; border-top: 1px solid var(--border); display: flex; gap: 12px; justify-content: flex-end;">
                <button class="btn btn-secondary" onclick="document.getElementById('assign-variant-modal').remove()">Отмена</button>
                <button class="btn btn-primary" onclick="assignVariantToQuestions()">Назначить</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Назначение варианта вопросам
async function assignVariantToQuestions() {
    const select = document.getElementById('assign-variant-select');
    const onlySelected = document.getElementById('assign-only-selected').checked;
    const value = select.value;

    if (!value) {
        showError('Выберите вариант');
        return;
    }

    // Определяем какие вопросы обновлять
    let questionsToUpdate;
    if (onlySelected) {
        const selectedIds = Array.from(document.querySelectorAll('.question-checkbox:checked')).map(cb => cb.dataset.id);
        questionsToUpdate = currentQuestionsData.filter(q => !q.variant && selectedIds.includes(q.id));
    } else {
        questionsToUpdate = currentQuestionsData.filter(q => !q.variant);
    }

    if (questionsToUpdate.length === 0) {
        showError('Нет вопросов для назначения');
        return;
    }

    const variants = currentTestForQuestions?.adminSrezSettings?.variants || [];

    // Показываем индикатор загрузки
    showLoading();

    try {
        let successCount = 0;
        for (let i = 0; i < questionsToUpdate.length; i++) {
            const q = questionsToUpdate[i];
            let variantNumber;

            if (value === 'distribute') {
                // Равномерное распределение
                variantNumber = variants[i % variants.length].number;
            } else {
                variantNumber = parseInt(value);
            }

            const result = await apiRequest(`/questions/${q.id}`, 'PUT', {
                ...q,
                variant: variantNumber
            });

            if (result.success) {
                successCount++;
                // Обновляем локальные данные
                const idx = currentQuestionsData.findIndex(cq => cq.id === q.id);
                if (idx !== -1) {
                    currentQuestionsData[idx].variant = variantNumber;
                }
            }
        }

        hideLoading();
        document.getElementById('assign-variant-modal').remove();
        showSuccess(`Назначено вариантов: ${successCount} из ${questionsToUpdate.length}`);

        // Перезагружаем список вопросов
        await manageQuestions(currentTestForQuestions.id);

    } catch (error) {
        hideLoading();
        showError('Ошибка при назначении вариантов: ' + error.message);
    }
}

// editingQuestionId, editingQuestionData, lastEditedQuestionId определены в state.js

function showQuestionForm(question = null) {
    editingQuestionId = question?.id || null;
    editingQuestionData = question;

    // Скрываем импорт если открыт
    const importContainer = document.getElementById('import-form-container');
    if (importContainer) {
        importContainer.classList.add('hidden');
        importContainer.style.display = 'none';
    }

    // Удаляем предыдущее модальное окно если есть
    const existingModal = document.getElementById('question-edit-modal');
    if (existingModal) existingModal.remove();

    const isEdit = !!question;
    const questionType = question?.type || 'single';

    // Создаём модальное окно
    const modal = document.createElement('div');
    modal.id = 'question-edit-modal';
    modal.className = 'question-edit-modal-overlay';
    modal.innerHTML = `
        <div class="question-edit-modal">
            <div class="question-edit-modal-header">
                <div class="question-edit-modal-title">
                    <span class="question-edit-modal-icon">${isEdit ? '✏️' : '➕'}</span>
                    <h3>${isEdit ? 'Редактирование вопроса' : 'Новый вопрос'}</h3>
                </div>
                <button class="question-edit-modal-close" onclick="hideQuestionForm()">&times;</button>
            </div>

            <form id="question-form" class="question-edit-modal-body">
                <div class="question-form-section">
                    <label class="question-form-label">
                        <span class="label-icon">📝</span>
                        Тип вопроса
                    </label>
                    <div class="question-type-selector">
                        <label class="question-type-option ${questionType === 'single' ? 'active' : ''}">
                            <input type="radio" name="question-type-radio" value="single" ${questionType === 'single' ? 'checked' : ''} onchange="onQuestionTypeChange()">
                            <span class="type-icon">◉</span>
                            <span class="type-label">Один ответ</span>
                        </label>
                        <label class="question-type-option ${questionType === 'multiple' ? 'active' : ''}">
                            <input type="radio" name="question-type-radio" value="multiple" ${questionType === 'multiple' ? 'checked' : ''} onchange="onQuestionTypeChange()">
                            <span class="type-icon">☑️</span>
                            <span class="type-label">Несколько ответов</span>
                        </label>
                        <label class="question-type-option ${questionType === 'match' ? 'active' : ''}">
                            <input type="radio" name="question-type-radio" value="match" ${questionType === 'match' ? 'checked' : ''} onchange="onQuestionTypeChange()">
                            <span class="type-icon">↔️</span>
                            <span class="type-label">Сопоставление</span>
                        </label>
                        <label class="question-type-option ${questionType === 'sequence' ? 'active' : ''}">
                            <input type="radio" name="question-type-radio" value="sequence" ${questionType === 'sequence' ? 'checked' : ''} onchange="onQuestionTypeChange()">
                            <span class="type-icon">📋</span>
                            <span class="type-label">Последовательность</span>
                        </label>
                        <label class="question-type-option ${questionType === 'short_answer' ? 'active' : ''}">
                            <input type="radio" name="question-type-radio" value="short_answer" ${questionType === 'short_answer' ? 'checked' : ''} onchange="onQuestionTypeChange()">
                            <span class="type-icon">✍️</span>
                            <span class="type-label">Короткий ответ</span>
                        </label>
                        <label class="question-type-option ${questionType === 'fill_blanks' ? 'active' : ''}">
                            <input type="radio" name="question-type-radio" value="fill_blanks" ${questionType === 'fill_blanks' ? 'checked' : ''} onchange="onQuestionTypeChange()">
                            <span class="type-icon">📝</span>
                            <span class="type-label">Пропуски</span>
                        </label>
                    </div>
                </div>

                <div class="question-form-section">
                    <label class="question-form-label">
                        <span class="label-icon">❓</span>
                        Текст вопроса
                    </label>
                    <div class="question-text-editor-container">
                        <div class="question-text-toolbar">
                            <button type="button" class="toolbar-btn" onclick="insertImageToQuestionText()" title="Вставить картинку (или Ctrl+V)">
                                🖼️ Картинка
                            </button>
                            <span class="toolbar-hint">Ctrl+V — вставить картинку из буфера</span>
                        </div>
                        <div class="question-text-editor"
                             id="question-text-editor"
                             contenteditable="true"
                             data-placeholder="Введите текст вопроса..."></div>
                        <input type="hidden" id="question-text" value="">
                    </div>
                </div>

                <div class="question-form-row">
                    <div class="question-form-section" style="flex: 1;">
                        <label class="question-form-label">
                            <span class="label-icon">⚖️</span>
                            Вес вопроса
                        </label>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="number" id="question-weight" value="${question?.weight || 1}" min="1" max="10" style="width: 70px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 16px;">
                            <span style="color: var(--text-secondary); font-size: 13px;">баллов</span>
                        </div>
                    </div>

                    ${currentTestForQuestions?.isAdminSrezMode && currentTestForQuestions?.adminSrezSettings?.variants?.length > 0 ? `
                    <div class="question-form-section" style="flex: 1;">
                        <label class="question-form-label">
                            <span class="label-icon">📋</span>
                            Вариант
                        </label>
                        <select id="question-variant" style="width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px;" required>
                            <option value="">— Выберите вариант —</option>
                            ${currentTestForQuestions.adminSrezSettings.variants.map(v =>
                                `<option value="${v.number}" ${question?.variant === v.number ? 'selected' : ''}>Вариант ${v.number}</option>`
                            ).join('')}
                        </select>
                    </div>
                    ` : ''}
                </div>

                <div class="question-form-section" id="question-answers-container">
                    <!-- Динамическое содержимое в зависимости от типа -->
                </div>
            </form>

            <div class="question-edit-modal-footer">
                <button type="button" class="btn btn-secondary" onclick="hideQuestionForm()">Отмена</button>
                <button type="button" class="btn btn-primary" onclick="saveQuestionFromModal()">
                    ${isEdit ? '💾 Сохранить изменения' : '➕ Добавить вопрос'}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Устанавливаем текст вопроса (с картинками) безопасно после создания DOM
    const questionTextEditor = document.getElementById('question-text-editor');
    const questionTextHidden = document.getElementById('question-text');
    if (questionTextEditor && question) {
        // Собираем контент: текст + картинка (из поля image или из тега img в тексте)
        let editorContent = question.text || '';

        // Если есть отдельное поле image и в тексте нет <img> - добавляем картинку
        if (question.image && !editorContent.includes('<img')) {
            editorContent += `<img src="${question.image}" alt="Картинка вопроса">`;
        }

        questionTextEditor.innerHTML = editorContent;
    }
    if (questionTextHidden && question?.text) {
        questionTextHidden.value = question.text;
    }

    // Инициализируем редактор текста вопроса с поддержкой вставки картинок
    setTimeout(() => initQuestionTextEditor(), 0);

    // Рендерим поля для ответов
    renderQuestionAnswersForm(questionType, question);

    // Проверяем наличие черновика (только для нового вопроса)
    if (!isEdit) {
        const draftInfo = checkAndShowDraftIndicator();
        if (draftInfo && draftInfo.draft) {
            // Добавляем индикатор черновика в форму
            const form = document.getElementById('question-form');
            if (form) {
                const indicator = document.createElement('div');
                indicator.innerHTML = getDraftIndicatorHtml(draftInfo);
                form.insertBefore(indicator.firstElementChild, form.firstChild);
            }
        }

        // Инициализируем автосохранение черновика
        initDraftAutoSave();
    }

    // Закрытие по клику на оверлей
    modal.addEventListener('click', (e) => {
        if (e.target === modal) hideQuestionForm();
    });

    // Закрытие по Escape
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            hideQuestionForm();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    // Фокус на редактор текста вопроса
    setTimeout(() => {
        const editor = document.getElementById('question-text-editor');
        if (editor) editor.focus();
    }, 100);
}

function onQuestionTypeChange() {
    const selectedRadio = document.querySelector('input[name="question-type-radio"]:checked');
    const questionType = selectedRadio ? selectedRadio.value : 'single';

    // Обновляем активный класс на кнопках типа
    document.querySelectorAll('.question-type-option').forEach(opt => {
        opt.classList.remove('active');
        if (opt.querySelector(`input[value="${questionType}"]`)) {
            opt.classList.add('active');
        }
    });

    renderQuestionAnswersForm(questionType, null);
}

function renderQuestionAnswersForm(type, question) {
    const container = document.getElementById('question-answers-container');

    if (type === 'single' || type === 'multiple') {
        // Одиночный или множественный выбор - динамическое количество вариантов (2-25)
        const answers = question?.answers || [];
        const correct = question?.correct || 'А';
        const correctLetters = type === 'multiple'
            ? (Array.isArray(question?.correct) ? question.correct : (question?.correct ? [question.correct] : []))
            : [];
        const inputType = type === 'multiple' ? 'checkbox' : 'radio';
        const inputName = type === 'multiple' ? 'correct-multiple' : 'correct';

        // Минимум 2 варианта, или сколько есть в вопросе
        const initialCount = Math.max(2, answers.length, 4);

        container.innerHTML = `
            <div class="form-group">
                <label>Ответы (отметьте ${type === 'multiple' ? 'все правильные' : 'правильный'})</label>
                <p class="hint" style="margin-bottom: 8px;">Ctrl+V — вставить картинку из буфера обмена</p>
                <div class="answers-editor answers-with-images" id="answers-editor">
                    ${renderAnswerRows(answers, correct, correctLetters, inputType, inputName, initialCount)}
                </div>
                <div class="answers-actions" style="margin-top: 12px; display: flex; gap: 8px;">
                    <button type="button" class="btn btn-secondary btn-small" onclick="addAnswerOption()">+ Добавить вариант</button>
                    <span class="hint" style="align-self: center;">Максимум 25 вариантов</span>
                </div>
                ${type === 'multiple' ? '<p class="hint">Выберите все варианты, которые являются правильными</p>' : ''}
            </div>
        `;
        // Инициализируем редакторы ответов с поддержкой вставки картинок
        setTimeout(() => initAnswerEditors(), 0);
    } else if (type === 'match') {
        // Сопоставление - пары left/right с поддержкой картинок и формул
        const pairs = question?.pairs || [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }];
        container.innerHTML = `
            <div class="form-group">
                <label>Пары для сопоставления</label>
                <p class="hint" style="margin-bottom: 12px;">Каждый элемент может содержать текст, картинку или формулу LaTeX ($формула$). Нажмите 🖼️ для загрузки картинки.</p>
                <div class="pairs-editor" id="pairs-editor">
                    ${pairs.map((pair, i) => renderMatchPairRow(pair, i, pairs.length)).join('')}
                </div>
                <button type="button" class="btn btn-secondary btn-small" onclick="addPair()">+ Добавить пару</button>
            </div>
        `;
    } else if (type === 'sequence') {
        // Последовательность - элементы в правильном порядке
        const items = question?.items || ['', '', ''];
        // items теперь может быть массивом объектов {text, image} или строк (для совместимости)
        const normalizedItems = items.map(item => {
            if (typeof item === 'string') return { text: item, image: '' };
            return { text: item.text || '', image: item.image || '' };
        });
        container.innerHTML = `
            <div class="form-group">
                <label>Элементы последовательности (в правильном порядке)</label>
                <p class="hint" style="margin-bottom: 12px;">Введите элементы в том порядке, в котором они должны стоять. Студенту они будут показаны в перемешанном виде. Можно добавить картинку к каждому элементу.</p>
                <div class="sequence-editor" id="sequence-editor">
                    ${normalizedItems.map((item, i) => renderSequenceItemRow(item, i, normalizedItems.length)).join('')}
                </div>
                <button type="button" class="btn btn-secondary btn-small" onclick="addSequenceItem()">+ Добавить шаг</button>
            </div>
        `;
    } else if (type === 'short_answer') {
        // Короткий ответ - список правильных вариантов
        const correctAnswers = question?.correct || [''];
        container.innerHTML = `
            <div class="form-group">
                <label>Правильные варианты ответа (каждый с новой строки)</label>
                <textarea id="short-answers" rows="4" placeholder="Введите варианты ответа, каждый с новой строки" required>${Array.isArray(correctAnswers) ? correctAnswers.join('\n') : correctAnswers}</textarea>
                <p class="hint">Студент должен ввести один из этих вариантов (регистр не учитывается)</p>
            </div>
        `;
    } else if (type === 'fill_blanks') {
        // Заполнение пропусков - текст с пропусками
        const blanks = question?.blanks || {};
        const blanksArray = Object.entries(blanks).map(([id, values]) => ({
            id,
            values: Array.isArray(values) ? values : [values]
        }));

        container.innerHTML = `
            <div class="form-group">
                <label>Пропуски в тексте вопроса</label>
                <p class="hint" style="margin-bottom: 12px; background: #eff6ff; padding: 12px; border-radius: 8px; border-left: 3px solid #3b82f6;">
                    <strong>Как создать пропуски:</strong><br>
                    1. В тексте вопроса используйте <code>{{1}}</code>, <code>{{2}}</code> и т.д. для обозначения пропусков<br>
                    2. Ниже укажите правильные ответы для каждого пропуска<br><br>
                    <strong>Пример:</strong> "Столица России - {{1}}, а столица Франции - {{2}}."
                </p>
                <div class="fill-blanks-editor" id="fill-blanks-editor">
                    ${blanksArray.length > 0 ? blanksArray.map((blank, i) => renderFillBlankRow(blank, i)).join('') : renderFillBlankRow({ id: '1', values: [''] }, 0)}
                </div>
                <button type="button" class="btn btn-secondary btn-small" onclick="addFillBlank()">+ Добавить пропуск</button>
            </div>
        `;
    }
}

// Рендер строки для пропуска
function renderFillBlankRow(blank, index) {
    return `
        <div class="fill-blank-row" data-blank-index="${index}">
            <div class="fill-blank-row-header">
                <span class="fill-blank-id">{{${blank.id}}}</span>
                <button type="button" class="btn-icon btn-danger-icon" onclick="removeFillBlank(${index})" title="Удалить пропуск">&times;</button>
            </div>
            <input type="text" class="fill-blank-answers" placeholder="Правильные ответы через запятую" value="${blank.values.join(', ')}">
            <p class="hint" style="font-size: 11px; margin-top: 4px;">Укажите все допустимые варианты ответа через запятую (регистр не учитывается)</p>
        </div>
    `;
}

// Добавить новый пропуск
function addFillBlank() {
    const editor = document.getElementById('fill-blanks-editor');
    const rows = editor.querySelectorAll('.fill-blank-row');
    const newIndex = rows.length;
    const newId = newIndex + 1;

    const newRow = document.createElement('div');
    newRow.innerHTML = renderFillBlankRow({ id: String(newId), values: [''] }, newIndex);
    editor.appendChild(newRow.firstElementChild);
}

// Удалить пропуск
function removeFillBlank(index) {
    const editor = document.getElementById('fill-blanks-editor');
    const rows = editor.querySelectorAll('.fill-blank-row');
    if (rows.length <= 1) {
        showError('Должен быть хотя бы один пропуск');
        return;
    }
    rows[index].remove();

    // Перенумеровать оставшиеся
    editor.querySelectorAll('.fill-blank-row').forEach((row, i) => {
        row.querySelector('.fill-blank-id').textContent = `{{${i + 1}}}`;
        row.dataset.blankIndex = i;
    });
}

// Функции для картинок в ответах
function toggleAnswerImage(letter) {
    const row = document.getElementById(`answer-image-row-${letter}`);
    const btn = document.querySelector(`.answer-row-extended[data-letter="${letter}"] .btn-answer-image`);
    if (row.style.display === 'none') {
        row.style.display = 'flex';
        btn.classList.add('active');
    } else {
        row.style.display = 'none';
        btn.classList.remove('active');
    }
}

function uploadAnswerImage(letter, event) {
    const file = event.target.files[0];
    if (!file) return;

    // Проверяем размер (макс 1MB)
    if (file.size > 1024 * 1024) {
        showError('Изображение слишком большое (максимум 1MB)');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const imageData = e.target.result;
        document.getElementById(`answer-image-${letter}`).value = imageData;
        document.getElementById(`answer-image-preview-${letter}`).innerHTML = `<img src="${imageData}" alt="Картинка ответа ${letter}">`;
        document.querySelector(`.answer-row-extended[data-letter="${letter}"] .btn-answer-image`).classList.add('has-image');
    };
    reader.readAsDataURL(file);
}

function removeAnswerImage(letter) {
    document.getElementById(`answer-image-${letter}`).value = '';
    document.getElementById(`answer-image-preview-${letter}`).innerHTML = '';
    document.querySelector(`.answer-row-extended[data-letter="${letter}"] .btn-answer-image`).classList.remove('has-image');
}

// Рендер одной строки пары сопоставления
function renderMatchPairRow(pair, index, totalPairs) {
    const hasLeftImage = pair.leftImage && pair.leftImage.length > 10;
    const hasRightImage = pair.rightImage && pair.rightImage.length > 10;

    return `
        <div class="match-pair-card" data-index="${index}">
            <div class="match-pair-header">
                <span class="match-pair-number">Пара ${index + 1}</span>
                <button type="button" class="btn-icon btn-danger" onclick="removePair(${index})" ${totalPairs <= 2 ? 'disabled' : ''} title="Удалить пару">✕</button>
            </div>
            <div class="match-pair-content">
                <div class="match-pair-side match-pair-left-side">
                    <label>Левый элемент</label>
                    <input type="text" class="pair-left" placeholder="Текст или формула $x^2$" value="${escapeHtml(pair.left || '')}">
                    <div class="match-pair-image-area">
                        <input type="hidden" class="pair-left-image" id="pair-left-image-${index}" value="${pair.leftImage || ''}">
                        <div class="match-pair-image-preview" id="pair-left-preview-${index}" ${!hasLeftImage ? 'style="display:none"' : ''}>
                            ${hasLeftImage ? `<img src="${pair.leftImage}" alt="Картинка"><button type="button" class="btn-remove-img" onclick="removePairSideImage(${index}, 'left')">✕</button>` : ''}
                        </div>
                        <label class="btn-upload-image ${hasLeftImage ? 'has-image' : ''}" title="Загрузить картинку">
                            🖼️ Картинка
                            <input type="file" accept="image/*" onchange="uploadPairSideImage(${index}, 'left', event)" style="display:none">
                        </label>
                    </div>
                </div>
                <div class="match-pair-arrow">→</div>
                <div class="match-pair-side match-pair-right-side">
                    <label>Правый элемент</label>
                    <input type="text" class="pair-right" placeholder="Текст или формула $y^2$" value="${escapeHtml(pair.right || '')}">
                    <div class="match-pair-image-area">
                        <input type="hidden" class="pair-right-image" id="pair-right-image-${index}" value="${pair.rightImage || ''}">
                        <div class="match-pair-image-preview" id="pair-right-preview-${index}" ${!hasRightImage ? 'style="display:none"' : ''}>
                            ${hasRightImage ? `<img src="${pair.rightImage}" alt="Картинка"><button type="button" class="btn-remove-img" onclick="removePairSideImage(${index}, 'right')">✕</button>` : ''}
                        </div>
                        <label class="btn-upload-image ${hasRightImage ? 'has-image' : ''}" title="Загрузить картинку">
                            🖼️ Картинка
                            <input type="file" accept="image/*" onchange="uploadPairSideImage(${index}, 'right', event)" style="display:none">
                        </label>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Загрузка картинки для стороны пары (left/right)
function uploadPairSideImage(index, side, event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
        showError('Изображение слишком большое (максимум 1MB)');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const imageData = e.target.result;
        document.getElementById(`pair-${side}-image-${index}`).value = imageData;

        const preview = document.getElementById(`pair-${side}-preview-${index}`);
        preview.innerHTML = `<img src="${imageData}" alt="Картинка"><button type="button" class="btn-remove-img" onclick="removePairSideImage(${index}, '${side}')">✕</button>`;
        preview.style.display = 'flex';

        // Отмечаем кнопку
        const card = document.querySelector(`.match-pair-card[data-index="${index}"]`);
        const uploadLabel = card.querySelector(`.match-pair-${side}-side .btn-upload-image`);
        uploadLabel.classList.add('has-image');
    };
    reader.readAsDataURL(file);
}

// Удаление картинки со стороны пары
function removePairSideImage(index, side) {
    document.getElementById(`pair-${side}-image-${index}`).value = '';

    const preview = document.getElementById(`pair-${side}-preview-${index}`);
    preview.innerHTML = '';
    preview.style.display = 'none';

    const card = document.querySelector(`.match-pair-card[data-index="${index}"]`);
    const uploadLabel = card.querySelector(`.match-pair-${side}-side .btn-upload-image`);
    uploadLabel.classList.remove('has-image');
}

function addPair() {
    const editor = document.getElementById('pairs-editor');
    const currentPairs = editor.querySelectorAll('.match-pair-card').length;
    const newIndex = currentPairs;

    const newPairHtml = renderMatchPairRow({ left: '', right: '' }, newIndex, currentPairs + 1);
    editor.insertAdjacentHTML('beforeend', newPairHtml);

    // Обновляем все кнопки удаления (минимум 2 пары)
    updatePairRemoveButtons();
}

function removePair(index) {
    const editor = document.getElementById('pairs-editor');
    const cards = editor.querySelectorAll('.match-pair-card');
    if (cards.length <= 2) return;

    // Удаляем карточку пары
    cards[index].remove();

    // Переиндексируем оставшиеся карточки
    const remainingCards = editor.querySelectorAll('.match-pair-card');
    remainingCards.forEach((card, i) => {
        card.dataset.index = i;
        card.querySelector('.match-pair-number').textContent = `Пара ${i + 1}`;

        // Обновляем ID для левой стороны
        const leftImageInput = card.querySelector('.pair-left-image');
        leftImageInput.id = `pair-left-image-${i}`;
        const leftPreview = card.querySelector('.match-pair-left-side .match-pair-image-preview');
        leftPreview.id = `pair-left-preview-${i}`;

        // Обновляем ID для правой стороны
        const rightImageInput = card.querySelector('.pair-right-image');
        rightImageInput.id = `pair-right-image-${i}`;
        const rightPreview = card.querySelector('.match-pair-right-side .match-pair-image-preview');
        rightPreview.id = `pair-right-preview-${i}`;

        // Обновляем обработчики
        const removeBtn = card.querySelector('.match-pair-header .btn-danger');
        removeBtn.onclick = () => removePair(i);

        // Обновляем file input handlers
        const leftFileInput = card.querySelector('.match-pair-left-side input[type="file"]');
        leftFileInput.onchange = (e) => uploadPairSideImage(i, 'left', e);
        const rightFileInput = card.querySelector('.match-pair-right-side input[type="file"]');
        rightFileInput.onchange = (e) => uploadPairSideImage(i, 'right', e);

        // Обновляем кнопки удаления картинок
        const leftRemoveBtn = leftPreview.querySelector('.btn-remove-img');
        if (leftRemoveBtn) leftRemoveBtn.onclick = () => removePairSideImage(i, 'left');
        const rightRemoveBtn = rightPreview.querySelector('.btn-remove-img');
        if (rightRemoveBtn) rightRemoveBtn.onclick = () => removePairSideImage(i, 'right');
    });

    updatePairRemoveButtons();
}

function updatePairRemoveButtons() {
    const editor = document.getElementById('pairs-editor');
    const cards = editor.querySelectorAll('.match-pair-card');
    cards.forEach(card => {
        const btn = card.querySelector('.match-pair-header .btn-danger');
        btn.disabled = cards.length <= 2;
    });
}

// Функции для редактора последовательности
function renderSequenceItemRow(item, index, totalItems) {
    const hasImage = item.image && item.image.length > 10;
    return `
        <div class="sequence-row sequence-row-card" data-index="${index}">
            <div class="sequence-row-header">
                <span class="sequence-order">${index + 1}</span>
                <button type="button" class="btn-icon btn-danger" onclick="removeSequenceItem(${index})" ${totalItems <= 2 ? 'disabled' : ''} title="Удалить">✕</button>
            </div>
            <div class="sequence-row-content">
                <input type="text" class="sequence-item-input" placeholder="Текст шага ${index + 1}" value="${escapeHtml(item.text || '')}">
                <input type="hidden" id="sequence-image-${index}" value="${item.image || ''}">
            </div>
            <div class="sequence-row-image">
                <div class="sequence-image-preview" id="sequence-image-preview-${index}">
                    ${hasImage ? `<img src="${item.image}" alt="Картинка шага ${index + 1}">` : ''}
                </div>
                <div class="sequence-image-actions">
                    <label class="btn btn-outline btn-small">
                        📷 Картинка
                        <input type="file" accept="image/*" onchange="uploadSequenceImage(${index}, event)" class="hidden">
                    </label>
                    ${hasImage ? `<button type="button" class="btn btn-danger btn-small" onclick="removeSequenceImage(${index})">✕</button>` : ''}
                </div>
            </div>
        </div>
    `;
}

function addSequenceItem() {
    const editor = document.getElementById('sequence-editor');
    const currentItems = editor.querySelectorAll('.sequence-row').length;
    const newIndex = currentItems;

    const newRow = document.createElement('div');
    newRow.innerHTML = renderSequenceItemRow({ text: '', image: '' }, newIndex, currentItems + 1);
    editor.appendChild(newRow.firstElementChild);

    updateSequenceRemoveButtons();
}

function removeSequenceItem(index) {
    const editor = document.getElementById('sequence-editor');
    const rows = editor.querySelectorAll('.sequence-row');
    if (rows.length <= 2) return;

    rows[index].remove();

    // Переиндексируем оставшиеся
    const remainingRows = editor.querySelectorAll('.sequence-row');
    remainingRows.forEach((row, i) => {
        row.dataset.index = i;
        row.querySelector('.sequence-order').textContent = i + 1;
        row.querySelector('.sequence-item-input').placeholder = `Текст шага ${i + 1}`;
        row.querySelector('.btn-danger').setAttribute('onclick', `removeSequenceItem(${i})`);
        // Обновляем ID картинки
        const imageInput = row.querySelector('input[type="hidden"]');
        if (imageInput) imageInput.id = `sequence-image-${i}`;
        const imagePreview = row.querySelector('.sequence-image-preview');
        if (imagePreview) imagePreview.id = `sequence-image-preview-${i}`;
        // Обновляем обработчик загрузки
        const fileInput = row.querySelector('input[type="file"]');
        if (fileInput) fileInput.setAttribute('onchange', `uploadSequenceImage(${i}, event)`);
        // Обновляем кнопку удаления картинки
        const removeImgBtn = row.querySelector('.sequence-image-actions .btn-danger');
        if (removeImgBtn) removeImgBtn.setAttribute('onclick', `removeSequenceImage(${i})`);
    });

    updateSequenceRemoveButtons();
}

function updateSequenceRemoveButtons() {
    const editor = document.getElementById('sequence-editor');
    const rows = editor.querySelectorAll('.sequence-row');
    rows.forEach(row => {
        const btn = row.querySelector('.sequence-row-header .btn-danger');
        if (btn) btn.disabled = rows.length <= 2;
    });
}

function uploadSequenceImage(index, event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
        showError('Изображение слишком большое (максимум 1MB)');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const imageData = e.target.result;
        document.getElementById(`sequence-image-${index}`).value = imageData;
        const preview = document.getElementById(`sequence-image-preview-${index}`);
        preview.innerHTML = `<img src="${imageData}" alt="Картинка шага ${index + 1}">`;

        // Добавляем кнопку удаления если её нет
        const actionsDiv = preview.parentElement.querySelector('.sequence-image-actions');
        if (!actionsDiv.querySelector('.btn-danger')) {
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'btn btn-danger btn-small';
            removeBtn.textContent = '✕';
            removeBtn.onclick = () => removeSequenceImage(index);
            actionsDiv.appendChild(removeBtn);
        }
    };
    reader.readAsDataURL(file);
}

function removeSequenceImage(index) {
    document.getElementById(`sequence-image-${index}`).value = '';
    document.getElementById(`sequence-image-preview-${index}`).innerHTML = '';
    // Удаляем кнопку удаления
    const row = document.querySelector(`.sequence-row[data-index="${index}"]`);
    const removeBtn = row?.querySelector('.sequence-image-actions .btn-danger');
    if (removeBtn) removeBtn.remove();
}

function hideQuestionForm() {
    const modal = document.getElementById('question-edit-modal');
    if (modal) modal.remove();
    editingQuestionId = null;
    currentQuestionImage = null;
}

// Новая функция сохранения из модального окна
async function saveQuestionFromModal() {
    const selectedRadio = document.querySelector('input[name="question-type-radio"]:checked');
    const questionType = selectedRadio ? selectedRadio.value : 'single';
    const weight = parseInt(document.getElementById('question-weight').value) || 1;

    // Получаем текст из contenteditable редактора
    const editor = document.getElementById('question-text-editor');
    let questionHtml = editor ? editor.innerHTML.trim() : document.getElementById('question-text').value.trim();

    // Извлекаем первую картинку из текста и сохраняем в отдельное поле
    let extractedImage = currentQuestionImage || null;
    const imgMatch = questionHtml.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
    if (imgMatch) {
        extractedImage = imgMatch[1]; // base64 или URL картинки
        // Удаляем все картинки из текста
        questionHtml = questionHtml.replace(/<img[^>]*>/gi, '').trim();
        // Убираем лишние <br> в начале и конце
        questionHtml = questionHtml.replace(/^(<br\s*\/?>)+|(<br\s*\/?>)+$/gi, '').trim();
    }

    // Очищаем текст от лишних тегов, оставляем только текст
    const cleanText = stripHtmlTags(questionHtml).trim();

    const data = {
        testId: currentTestForQuestions.id,
        disciplineId: currentTestForQuestions.disciplineId,
        text: cleanText,
        type: questionType,
        weight: Math.min(10, Math.max(1, weight)), // от 1 до 10
        image: extractedImage
    };

    // Добавляем вариант для срезов
    const variantSelect = document.getElementById('question-variant');
    if (variantSelect && variantSelect.value) {
        data.variant = parseInt(variantSelect.value);
    }

    if (questionType === 'single' || questionType === 'multiple') {
        // Собираем ответы динамически (до 25 вариантов)
        const answerRows = document.querySelectorAll('#answers-editor .answer-row-extended');
        data.answers = [];

        answerRows.forEach((row, i) => {
            const letter = ANSWER_LETTERS[i];
            // Получаем HTML из contenteditable редактора
            const textEditor = row.querySelector('.answer-text-editor');
            let answerHtml = textEditor ? textEditor.innerHTML.trim() : '';

            // Извлекаем картинку из HTML если есть
            let answerImage = '';
            const answerImgMatch = answerHtml.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
            if (answerImgMatch) {
                answerImage = answerImgMatch[1];
                // Удаляем картинки из текста
                answerHtml = answerHtml.replace(/<img[^>]*>/gi, '').trim();
            }

            // Очищаем текст от HTML тегов
            const answerText = stripHtmlTags(answerHtml).trim();

            // Добавляем только если есть текст или картинка
            if (answerText || answerImage) {
                data.answers.push({ letter, text: answerText, image: answerImage || undefined });
            }
        });

        if (data.answers.length < 2) {
            await showError('Минимум 2 варианта ответа');
            return;
        }

        if (questionType === 'multiple') {
            const checkedBoxes = document.querySelectorAll('input[name="correct-multiple"]:checked');
            const correctAnswers = Array.from(checkedBoxes).map(cb => cb.value);
            if (correctAnswers.length === 0) {
                await showError('Выберите хотя бы один правильный ответ');
                return;
            }
            data.correct = correctAnswers;
        } else {
            const checkedRadio = document.querySelector('input[name="correct"]:checked');
            if (!checkedRadio) {
                await showError('Выберите правильный ответ');
                return;
            }
            data.correct = checkedRadio.value;
        }
    } else if (questionType === 'match') {
        const pairs = [];
        const pairCards = document.querySelectorAll('#pairs-editor .match-pair-card');
        pairCards.forEach((card, index) => {
            const left = card.querySelector('.pair-left').value.trim();
            const right = card.querySelector('.pair-right').value.trim();
            const leftImage = document.getElementById(`pair-left-image-${index}`)?.value || '';
            const rightImage = document.getElementById(`pair-right-image-${index}`)?.value || '';

            // Пара валидна если есть хотя бы один элемент с каждой стороны (текст или картинка)
            const hasLeft = left || leftImage;
            const hasRight = right || rightImage;
            if (hasLeft && hasRight) {
                pairs.push({ left, right, leftImage, rightImage });
            }
        });
        if (pairs.length < 2) {
            await showError('Минимум 2 пары для сопоставления');
            return;
        }
        data.pairs = pairs;
        // correct - объект {индекс_левого: индекс_правого}
        const correct = {};
        pairs.forEach((pair, i) => {
            correct[i] = i;
        });
        data.correct = correct;
    } else if (questionType === 'sequence') {
        const items = [];
        const itemRows = document.querySelectorAll('#sequence-editor .sequence-row');
        itemRows.forEach((row, index) => {
            const text = row.querySelector('.sequence-item-input').value.trim();
            const image = document.getElementById(`sequence-image-${index}`)?.value || '';
            // Элемент валиден если есть текст или картинка
            if (text || image) {
                items.push({ text, image });
            }
        });
        if (items.length < 2) {
            await showError('Минимум 2 элемента для последовательности');
            return;
        }
        data.items = items;
        // correctOrder - правильный порядок (индексы элементов)
        data.correctOrder = items.map((_, i) => i);
    } else if (questionType === 'short_answer') {
        const answersText = document.getElementById('short-answers').value.trim();
        const correctAnswers = answersText.split('\n').map(a => a.trim()).filter(a => a);
        if (correctAnswers.length === 0) {
            await showError('Введите хотя бы один правильный ответ');
            return;
        }
        data.correct = correctAnswers;
    } else if (questionType === 'fill_blanks') {
        // Собираем пропуски
        const blanks = {};
        const blankRows = document.querySelectorAll('#fill-blanks-editor .fill-blank-row');
        blankRows.forEach((row, index) => {
            const blankId = String(index + 1);
            const answersInput = row.querySelector('.fill-blank-answers').value.trim();
            const answers = answersInput.split(',').map(a => a.trim()).filter(a => a);
            if (answers.length > 0) {
                blanks[blankId] = answers;
            }
        });

        // Проверяем что в тексте есть пропуски
        const textBlanks = data.text.match(/\{\{(\d+)\}\}/g) || [];
        if (textBlanks.length === 0) {
            await showError('В тексте вопроса не найдены пропуски. Используйте {{1}}, {{2}} и т.д.');
            return;
        }

        // Проверяем что для всех пропусков заданы ответы
        const textBlankIds = textBlanks.map(b => b.replace(/[{}]/g, ''));
        for (const id of textBlankIds) {
            if (!blanks[id] || blanks[id].length === 0) {
                await showError(`Укажите правильный ответ для пропуска {{${id}}}`);
                return;
            }
        }

        data.blanks = blanks;
        data.blanksCount = Object.keys(blanks).length;
    }

    showLoading('Сохранение вопроса...');

    let result;
    if (editingQuestionId) {
        result = await apiRequest(`/questions/${editingQuestionId}`, 'PUT', data);
    } else {
        result = await apiRequest('/questions', 'POST', data);
    }

    if (result.success) {
        // Запоминаем ID для подсветки
        lastEditedQuestionId = editingQuestionId || result.question?.id || null;

        // Очищаем черновик после успешного сохранения
        clearDraft();

        hideLoading();
        hideQuestionForm();
        await manageQuestions(currentTestForQuestions.id);

        // Подсвечиваем отредактированный вопрос
        if (lastEditedQuestionId) {
            highlightQuestion(lastEditedQuestionId);
        }
    } else {
        hideLoading();
        await showError(result.error || 'Ошибка сохранения');
    }
}

// Подсветка отредактированного вопроса
function highlightQuestion(questionId) {
    const questionItem = document.querySelector(`.question-item[data-id="${questionId}"]`);
    if (questionItem) {
        questionItem.classList.add('question-just-edited');
        questionItem.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Убираем подсветку через 3 секунды
        setTimeout(() => {
            questionItem.classList.remove('question-just-edited');
        }, 3000);
    }
}

async function editQuestion(id) {
    if (!currentTestForQuestions) {
        await showError('Ошибка: тест не выбран');
        return;
    }
    const result = await apiRequest(`/questions?testId=${currentTestForQuestions.id}`);
    if (result.success) {
        const question = result.questions.find(q => String(q.id) === String(id));
        if (question) showQuestionForm(question);
    }
}

async function deleteQuestion(id) {
    // Сохраняем данные вопроса для возможности отмены
    const questionToDelete = currentQuestionsData.find(q => String(q.id) === String(id));
    if (!questionToDelete) {
        showError('Вопрос не найден');
        return;
    }

    // Оптимистичное удаление - сразу убираем из UI
    const questionEl = document.querySelector(`[data-question-id="${id}"]`);
    if (questionEl) {
        questionEl.style.transition = 'all 0.3s ease';
        questionEl.style.opacity = '0';
        questionEl.style.transform = 'translateX(-20px)';
        setTimeout(() => questionEl.remove(), 300);
    }

    // Обновляем локальный массив
    currentQuestionsData = currentQuestionsData.filter(q => String(q.id) !== String(id));
    updateQuestionsCount();

    // Показываем toast с возможностью отмены
    showUndoToast('Вопрос удалён', async () => {
        // Восстанавливаем вопрос
        try {
            showLoading('Восстановление...');
            // Пересоздаём вопрос на сервере
            const restored = await apiRequest('/questions', 'POST', {
                ...questionToDelete,
                id: undefined // Сервер создаст новый ID
            });
            hideLoading();
            if (restored.success) {
                await manageQuestions(currentTestForQuestions.id);
            }
        } catch (e) {
            hideLoading();
            showError('Не удалось восстановить вопрос');
        }
    });

    // Реальное удаление на сервере (в фоне)
    try {
        await apiRequest(`/questions/${id}`, 'DELETE');
    } catch (error) {
        console.error('Delete error:', error);
        // Если удаление не удалось - восстанавливаем UI
        await manageQuestions(currentTestForQuestions.id);
        showError('Ошибка при удалении вопроса');
    }
}

// Обновить счётчик вопросов
function updateQuestionsCount() {
    const countEl = document.querySelector('.questions-panel-stats .stat-value');
    if (countEl) {
        countEl.textContent = currentQuestionsData.length;
    }
}

async function showImportForm() {
    if (!currentTestForQuestions) {
        await showError('Ошибка: тест не выбран');
        return;
    }
    const importContainer = document.getElementById('import-form-container');
    const questionContainer = document.getElementById('question-form-container');
    if (importContainer) {
        importContainer.classList.remove('hidden');
        importContainer.style.display = 'flex';
    }
    if (questionContainer) questionContainer.style.display = 'none';
    // Очищаем форму
    const importContent = document.getElementById('import-content');
    if (importContent) importContent.value = '';
    clearFileSelection();
}

function hideImportForm() {
    const importContainer = document.getElementById('import-form-container');
    if (importContainer) {
        importContainer.classList.add('hidden');
        importContainer.style.display = 'none';
    }
    clearFileSelection();
    switchImportTab('text');
}

// selectedImportFile определена в state.js

// Скачивание шаблона GIFT
function downloadGiftTemplate() {
    const template = `// ==========================================
// ШАБЛОН GIFT ФОРМАТА ДЛЯ ИМПОРТА ВОПРОСОВ
// Система тестирования КСТ
// ==========================================

// ПОДДЕРЖИВАЕМЫЕ ТИПЫ ВОПРОСОВ:
//
// 1. ВО - Выбор одного ответа
//    Синтаксис: =правильный ~неправильный
//
// 2. МВ - Множественный выбор (несколько правильных)
//    Синтаксис: %50%правильный1 %50%правильный2 ~неправильный
//    Проценты должны давать в сумме 100%
//
// 3. КО - Короткий ответ (ввод текста)
//    Синтаксис: {=ответ} или {=ответ1 =ответ2}
//
// 4. СО - Соответствие (match)
//    Синтаксис: =левое -> правое
//
// 5. ПД - Последовательность
//    Синтаксис: #1 первый #2 второй #3 третий
//
// 6. LaTeX формулы: $x^2 + y^2 = z^2$
//
// ==========================================


// ═══════════════════════════════════════════
// ВО: ВЫБОР ОДНОГО ОТВЕТА
// ═══════════════════════════════════════════

::ВО-1::Столица России? {
=Москва
~Санкт-Петербург
~Казань
~Новосибирск
}

::ВО-2::Чему равен $2^{10}$? {
=1024
~512
~2048
~256
}

::ВО-3::Какой газ составляет основную часть атмосферы Земли? {
=Азот
~Кислород
~Углекислый газ
~Аргон
}


// ═══════════════════════════════════════════
// МВ: МНОЖЕСТВЕННЫЙ ВЫБОР (несколько правильных)
// ═══════════════════════════════════════════
// Проценты указывают долю правильности.
// Сумма процентов правильных ответов = 100%
// Неправильные ответы: ~

::МВ-1::Какие из перечисленных чисел являются простыми? {
~4
%33.33333%2
%33.33333%3
~6
%33.33334%7
~9
}

::МВ-2::Выберите все страны Европы: {
%50%Франция
%50%Германия
~Бразилия
~Япония
~Австралия
}

::МВ-3::Какие единицы измерения относятся к СИ? {
%33.33333%Метр
%33.33333%Килограмм
%33.33334%Секунда
~Фунт
~Дюйм
}


// ═══════════════════════════════════════════
// КО: КОРОТКИЙ ОТВЕТ (ввод текста)
// ═══════════════════════════════════════════
// Можно указать несколько правильных вариантов через =

::КО-1::Назовите столицу Франции {=Париж}

::КО-2::Чему равен корень из 144? {=12 =двенадцать}

::КО-3::Химический символ воды (формула) {=H2O =h2o}


// ═══════════════════════════════════════════
// СО: УСТАНОВЛЕНИЕ СООТВЕТСТВИЯ
// ═══════════════════════════════════════════

::СО-1::Установите соответствие между странами и столицами {
=Россия -> Москва
=Франция -> Париж
=Германия -> Берлин
=Италия -> Рим
}

::СО-2::Сопоставьте формулы с названиями {
=$E = mc^2$ -> Эквивалентность массы и энергии
=$F = ma$ -> Второй закон Ньютона
=$S = \\frac{at^2}{2}$ -> Путь при равноускоренном движении
}

::СО-3::Соедините элемент с его химическим символом {
=Водород -> H
=Кислород -> O
=Углерод -> C
=Азот -> N
}


// ═══════════════════════════════════════════
// ПД: ПОСЛЕДОВАТЕЛЬНОСТЬ ДЕЙСТВИЙ
// ═══════════════════════════════════════════
// Номера указывают правильный порядок

::ПД-1::Расположите этапы решения квадратного уравнения в правильном порядке {
#1 Привести уравнение к стандартному виду
#2 Вычислить дискриминант
#3 Проверить знак дискриминанта
#4 Найти корни по формуле
}

::ПД-2::Укажите правильный порядок арифметических операций {
#1 Вычисления в скобках
#2 Возведение в степень
#3 Умножение и деление
#4 Сложение и вычитание
}

::ПД-3::Расположите планеты по удалённости от Солнца (от ближней к дальней) {
#1 Меркурий
#2 Венера
#3 Земля
#4 Марс
}


// ═══════════════════════════════════════════
// ДОПОЛНИТЕЛЬНЫЕ ВОЗМОЖНОСТИ
// ═══════════════════════════════════════════

// Вопрос с LaTeX формулой:
::ВО-LaTeX::Решите уравнение $x^2 - 5x + 6 = 0$. Найдите сумму корней. {
=5
~6
~-5
~11
}

// Комментарии (строки начинающиеся с //) игнорируются

// Пустые строки между вопросами допускаются
`;

    const blob = new Blob([template], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Шаблон_GIFT.txt';
    a.click();
    URL.revokeObjectURL(a.href);
}

function switchImportTab(tab) {
    document.querySelectorAll('.import-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.import-tab-content').forEach(c => {
        c.classList.add('hidden');
        c.style.display = 'none';
    });

    if (tab === 'text') {
        document.querySelector('.import-tab:first-child').classList.add('active');
        const textTab = document.getElementById('import-tab-text');
        textTab.classList.remove('hidden');
        textTab.style.display = 'block';
    } else {
        document.querySelector('.import-tab:last-child').classList.add('active');
        const fileTab = document.getElementById('import-tab-file');
        fileTab.classList.remove('hidden');
        fileTab.style.display = 'block';
    }
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        // Валидация размера файла (макс 5MB для GIFT)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            showError('Файл слишком большой. Максимальный размер: 5 МБ');
            event.target.value = '';
            return;
        }

        selectedImportFile = file;
        document.getElementById('file-upload-area').classList.add('has-file');
        document.querySelector('.file-upload-placeholder').style.display = 'none';
        const fileSelected = document.getElementById('file-selected');
        fileSelected.classList.remove('hidden');
        fileSelected.style.display = 'flex';
        document.getElementById('selected-file-name').textContent = file.name;
    }
}

function clearFileSelection() {
    selectedImportFile = null;
    const fileInput = document.getElementById('import-file');
    if (fileInput) fileInput.value = '';
    const uploadArea = document.getElementById('file-upload-area');
    if (uploadArea) uploadArea.classList.remove('has-file');
    const placeholder = document.querySelector('.file-upload-placeholder');
    if (placeholder) placeholder.style.display = 'flex';
    const fileSelected = document.getElementById('file-selected');
    if (fileSelected) {
        fileSelected.classList.add('hidden');
        fileSelected.style.display = 'none';
    }
}

async function importQuestions(e) {
    e.preventDefault();

    // Проверяем, что тест выбран
    if (!currentTestForQuestions) {
        await showError('Ошибка: тест не выбран. Пожалуйста, выберите тест снова.');
        console.error('currentTestForQuestions is null');
        return;
    }

    let content = '';
    const activeTab = document.querySelector('.import-tab.active');
    const isFileTab = activeTab && activeTab.textContent.includes('файл');

    if (isFileTab && selectedImportFile) {
        content = await readFileAsText(selectedImportFile);
    } else {
        content = document.getElementById('import-content').value;
    }

    if (!content.trim()) {
        await showError('Введите текст или выберите файл для импорта');
        return;
    }

    // Показываем индикатор загрузки
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
        submitBtn.textContent = 'Импортирую...';
        submitBtn.disabled = true;
    }

    try {
        // Получаем выбранный вариант если есть
        const variantSelect = document.getElementById('import-variant');
        const variant = variantSelect && variantSelect.value ? parseInt(variantSelect.value) : null;

        const data = {
            disciplineId: currentTestForQuestions.disciplineId,
            testId: currentTestForQuestions.id,
            format: 'gift',
            content: content,
            variant: variant
        };

        console.log('Importing questions for test:', currentTestForQuestions.id, 'variant:', variant);
        const result = await apiRequest('/questions/import', 'POST', data);

        // Выводим дебаг-информацию в консоль
        console.log('Import result:', result);
        if (result.debug) {
            console.log('Debug log:', result.debug);
        }

        if (result.success) {
            await showSuccess(`Импортировано ${result.imported} из ${result.total} вопросов`);
            hideImportForm();
            manageQuestions(currentTestForQuestions.id);
        } else {
            await showError(result.error || 'Ошибка импорта. Проверьте формат GIFT.');
            console.error('Import error:', result);
        }
    } catch (error) {
        await showError('Ошибка при импорте: ' + (error.message || 'Неизвестная ошибка'));
        console.error('Import exception:', error);
    } finally {
        if (submitBtn) {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }
}

// readFileAsText определена в utils.js

// ============================================
// МАССОВЫЕ ОПЕРАЦИИ С ВОПРОСАМИ
// ============================================

function toggleAllQuestions() {
    const selectAll = document.getElementById('select-all-questions');
    const checkboxes = document.querySelectorAll('.question-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll.checked);
    updateQuestionsSelection();
}

function updateQuestionsSelection() {
    const checkboxes = document.querySelectorAll('.question-checkbox');
    const checked = document.querySelectorAll('.question-checkbox:checked');
    const bulkButtons = document.getElementById('questions-bulk-buttons');
    const countSpan = document.getElementById('questions-selected-count');
    const selectAll = document.getElementById('select-all-questions');

    if (checked.length > 0) {
        bulkButtons.classList.remove('hidden');
        bulkButtons.style.display = 'flex';
        countSpan.textContent = `${checked.length} выбрано`;
    } else {
        bulkButtons.classList.add('hidden');
        bulkButtons.style.display = 'none';
    }

    // Обновляем состояние "Выбрать все"
    if (selectAll) {
        selectAll.checked = checkboxes.length > 0 && checked.length === checkboxes.length;
        selectAll.indeterminate = checked.length > 0 && checked.length < checkboxes.length;
    }
}

async function deleteSelectedQuestions() {
    const checked = document.querySelectorAll('.question-checkbox:checked');
    if (checked.length === 0) return;

    if (!await showConfirm(`Удалить ${checked.length} выбранных вопросов?`, 'Удаление вопросов')) return;

    showLoading(`Удаление ${checked.length} вопросов...`);

    try {
        const ids = Array.from(checked).map(cb => cb.dataset.id);

        // Используем bulk-delete - один запрос для всех вопросов
        const result = await apiRequest('/questions/bulk-delete', 'POST', { ids });

        hideLoading();

        if (result.success) {
            if (result.errors > 0) {
                await showWarning(`Удалено: ${result.deleted}, ошибок: ${result.errors}`);
            } else {
                await showSuccess(`Удалено ${result.deleted} вопросов`);
            }
        } else {
            await showError(result.error || 'Ошибка удаления');
        }

        await manageQuestions(currentTestForQuestions.id);
    } catch (error) {
        hideLoading();
        showError('Ошибка при удалении вопросов: ' + error.message);
    }
}

// ============================================
// РЕДАКТОР ТЕКСТА ВОПРОСА С КАРТИНКАМИ
// ============================================

// Инициализация редактора текста вопроса
function initQuestionTextEditor() {
    const editor = document.getElementById('question-text-editor');
    if (!editor) return;

    // Обработчик вставки (Ctrl+V) для картинок
    editor.addEventListener('paste', handleQuestionTextPaste);

    // Обработчик drag & drop для картинок
    editor.addEventListener('dragover', (e) => {
        e.preventDefault();
        editor.classList.add('dragover');
    });

    editor.addEventListener('dragleave', (e) => {
        e.preventDefault();
        editor.classList.remove('dragover');
    });

    editor.addEventListener('drop', (e) => {
        e.preventDefault();
        editor.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            insertImageFileToEditor(files[0]);
        }
    });

    // Синхронизация с hidden input при изменении
    editor.addEventListener('input', syncQuestionTextHidden);
    editor.addEventListener('blur', syncQuestionTextHidden);

    // Обработка удаления картинок
    editor.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            // Проверяем, выделена ли картинка
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const selectedNode = range.startContainer.parentElement;
                if (selectedNode && selectedNode.tagName === 'IMG') {
                    e.preventDefault();
                    selectedNode.remove();
                    syncQuestionTextHidden();
                }
            }
        }
    });
}

// Синхронизация contenteditable с hidden input
function syncQuestionTextHidden() {
    const editor = document.getElementById('question-text-editor');
    const hidden = document.getElementById('question-text');
    if (editor && hidden) {
        hidden.value = editor.innerHTML;
    }
}

// Получить текст из редактора
function getQuestionTextFromEditor() {
    const editor = document.getElementById('question-text-editor');
    return editor ? editor.innerHTML : '';
}

// Обработка вставки из буфера обмена
async function handleQuestionTextPaste(e) {
    const clipboardData = e.clipboardData || window.clipboardData;

    // Проверяем, есть ли картинка в буфере
    const items = clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            const file = items[i].getAsFile();
            await insertImageFileToEditor(file);
            return;
        }
    }

    // Если это HTML с картинкой
    const html = clipboardData.getData('text/html');
    if (html && html.includes('<img')) {
        // Разрешаем стандартную вставку, но обработаем картинки
        setTimeout(() => {
            processEditorImages();
            syncQuestionTextHidden();
        }, 0);
        return;
    }

    // Для обычного текста - стандартная вставка
    // Но очищаем форматирование, вставляем только текст
    const text = clipboardData.getData('text/plain');
    if (text) {
        e.preventDefault();
        document.execCommand('insertText', false, text);
        syncQuestionTextHidden();
    }
}

// Вставка файла картинки в редактор
async function insertImageFileToEditor(file) {
    // Проверка размера (2 МБ для inline картинок)
    if (file.size > 2 * 1024 * 1024) {
        await showError('Картинка слишком большая. Максимум 2 МБ для вставки в текст.');
        return;
    }

    try {
        const base64 = await fileToBase64(file);
        insertImageToEditor(base64);
    } catch (error) {
        await showError('Ошибка загрузки картинки');
    }
}

// Вставка base64 картинки в редактор
function insertImageToEditor(base64Src) {
    const editor = document.getElementById('question-text-editor');
    if (!editor) return;

    // Создаём элемент картинки
    const img = document.createElement('img');
    img.src = base64Src;
    img.className = 'inline-question-image';
    img.alt = 'Изображение';
    img.style.maxWidth = '100%';
    img.style.maxHeight = '300px';
    img.style.borderRadius = '8px';
    img.style.margin = '8px 0';
    img.style.display = 'block';
    img.style.cursor = 'pointer';

    // Клик для выделения/удаления
    img.onclick = function() {
        // Убираем выделение с других картинок
        editor.querySelectorAll('img.selected').forEach(i => i.classList.remove('selected'));
        this.classList.toggle('selected');
    };

    // Вставляем в текущую позицию курсора
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && editor.contains(selection.anchorNode)) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(img);

        // Перемещаем курсор после картинки
        range.setStartAfter(img);
        range.setEndAfter(img);
        selection.removeAllRanges();
        selection.addRange(range);
    } else {
        // Если курсор не в редакторе - добавляем в конец
        editor.appendChild(img);
    }

    // Добавляем перенос строки после картинки если его нет
    if (!img.nextSibling || img.nextSibling.nodeName !== 'BR') {
        const br = document.createElement('br');
        img.parentNode.insertBefore(br, img.nextSibling);
    }

    syncQuestionTextHidden();
    editor.focus();
}

// Обработка картинок в редакторе (ограничение размера, добавление стилей)
function processEditorImages() {
    const editor = document.getElementById('question-text-editor');
    if (!editor) return;

    editor.querySelectorAll('img').forEach(img => {
        if (!img.classList.contains('inline-question-image')) {
            img.className = 'inline-question-image';
            img.style.maxWidth = '100%';
            img.style.maxHeight = '300px';
            img.style.borderRadius = '8px';
            img.style.margin = '8px 0';
            img.style.display = 'block';
            img.style.cursor = 'pointer';

            img.onclick = function() {
                editor.querySelectorAll('img.selected').forEach(i => i.classList.remove('selected'));
                this.classList.toggle('selected');
            };
        }
    });
}

// Кнопка вставки картинки через диалог выбора файла
function insertImageToQuestionText() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            await insertImageFileToEditor(file);
        }
        input.remove();
    };

    document.body.appendChild(input);
    input.click();
}

// ============================================
// РЕДАКТОРЫ ОТВЕТОВ С ПОДДЕРЖКОЙ КАРТИНОК
// ============================================

// Инициализация всех редакторов ответов
function initAnswerEditors() {
    const editors = document.querySelectorAll('.answer-text-editor');
    editors.forEach(editor => {
        initSingleAnswerEditor(editor);
    });
}

// Инициализация одного редактора ответа
function initSingleAnswerEditor(editor) {
    if (!editor || editor.dataset.initialized) return;
    editor.dataset.initialized = 'true';

    // Обработчик вставки (Ctrl+V) для картинок
    editor.addEventListener('paste', handleAnswerPaste);

    // Обработчик drag & drop для картинок
    editor.addEventListener('dragover', (e) => {
        e.preventDefault();
        editor.classList.add('dragover');
    });

    editor.addEventListener('dragleave', (e) => {
        e.preventDefault();
        editor.classList.remove('dragover');
    });

    editor.addEventListener('drop', (e) => {
        e.preventDefault();
        editor.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            insertImageFileToAnswerEditor(editor, files[0]);
        }
    });

    // Обработка удаления картинок
    editor.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const selectedNode = range.startContainer.parentElement;
                if (selectedNode && selectedNode.tagName === 'IMG') {
                    e.preventDefault();
                    selectedNode.remove();
                }
            }
        }
    });
}

// Обработка вставки из буфера для ответа
async function handleAnswerPaste(e) {
    const editor = e.currentTarget;
    const clipboardData = e.clipboardData || window.clipboardData;

    // Проверяем, есть ли картинка в буфере
    const items = clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            const file = items[i].getAsFile();
            await insertImageFileToAnswerEditor(editor, file);
            return;
        }
    }

    // Если это HTML с картинкой
    const html = clipboardData.getData('text/html');
    if (html && html.includes('<img')) {
        setTimeout(() => {
            processAnswerEditorImages(editor);
        }, 0);
        return;
    }

    // Для обычного текста - стандартная вставка без форматирования
    const text = clipboardData.getData('text/plain');
    if (text) {
        e.preventDefault();
        document.execCommand('insertText', false, text);
    }
}

// Вставка файла картинки в редактор ответа
async function insertImageFileToAnswerEditor(editor, file) {
    // Проверка размера (1 МБ для картинок ответов)
    if (file.size > 1024 * 1024) {
        await showError('Картинка слишком большая. Максимум 1 МБ.');
        return;
    }

    try {
        const base64 = await fileToBase64(file);
        insertImageToAnswerEditor(editor, base64);
    } catch (error) {
        await showError('Ошибка загрузки картинки');
    }
}

// Вставка base64 картинки в редактор ответа
function insertImageToAnswerEditor(editor, base64Src) {
    if (!editor) return;

    // Создаём элемент картинки
    const img = document.createElement('img');
    img.src = base64Src;
    img.className = 'answer-inline-image';
    img.alt = 'Картинка';
    img.style.maxWidth = '100%';
    img.style.maxHeight = '150px';
    img.style.borderRadius = '6px';
    img.style.margin = '4px 0';
    img.style.display = 'inline-block';
    img.style.verticalAlign = 'middle';
    img.style.cursor = 'pointer';

    // Клик для выделения
    img.onclick = function() {
        editor.querySelectorAll('img.selected').forEach(i => i.classList.remove('selected'));
        this.classList.toggle('selected');
    };

    // Вставляем в текущую позицию курсора
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && editor.contains(selection.anchorNode)) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(img);

        // Перемещаем курсор после картинки
        range.setStartAfter(img);
        range.setEndAfter(img);
        selection.removeAllRanges();
        selection.addRange(range);
    } else {
        // Если курсор не в редакторе - добавляем в конец
        editor.appendChild(img);
    }

    editor.focus();
}

// Обработка картинок в редакторе ответа
function processAnswerEditorImages(editor) {
    if (!editor) return;

    editor.querySelectorAll('img').forEach(img => {
        if (!img.classList.contains('answer-inline-image')) {
            img.className = 'answer-inline-image';
            img.style.maxWidth = '100%';
            img.style.maxHeight = '150px';
            img.style.borderRadius = '6px';
            img.style.margin = '4px 0';
            img.style.display = 'inline-block';
            img.style.verticalAlign = 'middle';
            img.style.cursor = 'pointer';

            img.onclick = function() {
                editor.querySelectorAll('img.selected').forEach(i => i.classList.remove('selected'));
                this.classList.toggle('selected');
            };
        }
    });
}

// ============================================
// ДИНАМИЧЕСКИЕ ВАРИАНТЫ ОТВЕТОВ (до 25)
// ============================================

// Русские буквы для вариантов ответа (А-Я, без Ё)
const ANSWER_LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К', 'Л', 'М', 'Н', 'О', 'П', 'Р', 'С', 'Т', 'У', 'Ф', 'Х', 'Ц', 'Ч', 'Ш', 'Щ'];
const MAX_ANSWERS = 25;

// Генерация HTML для строк ответов
function renderAnswerRows(answers, correct, correctLetters, inputType, inputName, count) {
    let html = '';
    for (let i = 0; i < count; i++) {
        const letter = ANSWER_LETTERS[i];
        const answerObj = answers.find(a => a.letter === letter) || {};
        const isChecked = inputType === 'checkbox'
            ? correctLetters.includes(letter)
            : correct === letter;
        const answerImage = answerObj.image || '';
        html += renderSingleAnswerRow(letter, i, answerObj.text || '', answerImage, isChecked, inputType, inputName, count);
    }
    return html;
}

// Генерация одной строки ответа с contenteditable редактором
function renderSingleAnswerRow(letter, index, text, image, isChecked, inputType, inputName, totalCount) {
    const canDelete = totalCount > 2;
    // Если есть картинка отдельно, добавляем её в текст для отображения
    let displayContent = text || '';
    if (image && !displayContent.includes('<img')) {
        displayContent = (displayContent ? displayContent + ' ' : '') + `<img src="${image}" class="answer-inline-image" alt="Картинка">`;
    }
    return `
        <div class="answer-row-extended" data-letter="${letter}" data-index="${index}">
            <div class="answer-main-row">
                <input type="${inputType}" name="${inputName}" value="${letter}" ${isChecked ? 'checked' : ''}>
                <span class="answer-letter-label">${letter}</span>
                <div class="answer-text-editor"
                     id="answer-editor-${index}"
                     contenteditable="true"
                     data-placeholder="Текст ответа ${letter} (Ctrl+V для картинки)"
                     data-letter="${letter}"
                     data-index="${index}">${displayContent}</div>
                ${canDelete ? `<button type="button" class="btn-icon btn-danger-icon" onclick="removeAnswerOption(${index})" title="Удалить вариант">✕</button>` : ''}
            </div>
        </div>
    `;
}

// Добавить вариант ответа
function addAnswerOption() {
    const editor = document.getElementById('answers-editor');
    if (!editor) return;

    const currentRows = editor.querySelectorAll('.answer-row-extended');
    const currentCount = currentRows.length;

    if (currentCount >= MAX_ANSWERS) {
        showWarning(`Максимум ${MAX_ANSWERS} вариантов ответа`);
        return;
    }

    const newIndex = currentCount;
    const letter = ANSWER_LETTERS[newIndex];

    // Определяем тип input (radio/checkbox)
    const existingInput = editor.querySelector('input[name="correct"], input[name="correct-multiple"]');
    const inputType = existingInput ? existingInput.type : 'radio';
    const inputName = inputType === 'checkbox' ? 'correct-multiple' : 'correct';

    // Создаём новую строку
    const newRow = document.createElement('div');
    newRow.innerHTML = renderSingleAnswerRow(letter, newIndex, '', '', false, inputType, inputName, currentCount + 1);
    editor.appendChild(newRow.firstElementChild);

    // Обновляем кнопки удаления (теперь можно удалять все, кроме первых двух)
    updateDeleteButtons();

    // Инициализируем редактор для нового ответа
    const newEditor = document.getElementById(`answer-editor-${newIndex}`);
    if (newEditor) {
        initSingleAnswerEditor(newEditor);
        newEditor.focus();
    }
}

// Удалить вариант ответа
function removeAnswerOption(index) {
    const editor = document.getElementById('answers-editor');
    if (!editor) return;

    const rows = editor.querySelectorAll('.answer-row-extended');
    if (rows.length <= 2) {
        showWarning('Минимум 2 варианта ответа');
        return;
    }

    // Удаляем строку
    rows[index].remove();

    // Перенумеровываем оставшиеся
    renumberAnswerRows();
}

// Перенумеровать строки ответов после удаления
function renumberAnswerRows() {
    const editor = document.getElementById('answers-editor');
    if (!editor) return;

    const rows = editor.querySelectorAll('.answer-row-extended');
    const existingInput = editor.querySelector('input[name="correct"], input[name="correct-multiple"]');
    const inputType = existingInput ? existingInput.type : 'radio';
    const inputName = inputType === 'checkbox' ? 'correct-multiple' : 'correct';

    rows.forEach((row, i) => {
        const letter = ANSWER_LETTERS[i];
        const oldLetter = row.dataset.letter;

        // Обновляем data-атрибуты
        row.dataset.letter = letter;
        row.dataset.index = i;

        // Обновляем radio/checkbox
        const radioInput = row.querySelector(`input[type="${inputType}"]`);
        if (radioInput) radioInput.value = letter;

        // Обновляем букву
        const letterLabel = row.querySelector('.answer-letter-label');
        if (letterLabel) letterLabel.textContent = letter;

        // Обновляем contenteditable редактор ответа
        const textEditor = row.querySelector('.answer-text-editor');
        if (textEditor) {
            textEditor.id = `answer-editor-${i}`;
            textEditor.dataset.placeholder = `Текст ответа ${letter} (Ctrl+V для картинки)`;
            textEditor.dataset.letter = letter;
            textEditor.dataset.index = i;
        }

        // Обновляем кнопку удаления
        const delBtn = row.querySelector('.btn-danger-icon');
        if (delBtn) delBtn.setAttribute('onclick', `removeAnswerOption(${i})`);
    });

    updateDeleteButtons();
}

// Обновить кнопки удаления
function updateDeleteButtons() {
    const editor = document.getElementById('answers-editor');
    if (!editor) return;

    const rows = editor.querySelectorAll('.answer-row-extended');
    const canDelete = rows.length > 2;

    rows.forEach((row, i) => {
        const delBtn = row.querySelector('.btn-danger-icon');
        if (canDelete && !delBtn) {
            // Добавляем кнопку если её нет
            const mainRow = row.querySelector('.answer-main-row');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-icon btn-danger-icon';
            btn.title = 'Удалить вариант';
            btn.setAttribute('onclick', `removeAnswerOption(${i})`);
            btn.textContent = '✕';
            mainRow.appendChild(btn);
        } else if (!canDelete && delBtn) {
            // Убираем кнопку
            delBtn.remove();
        }
    });
}
