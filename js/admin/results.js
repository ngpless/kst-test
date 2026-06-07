// ============================================
// ТАБ: РЕЗУЛЬТАТЫ
// ============================================

// Переменные resultsAutoRefreshInterval, isRefreshingResults определены в state.js

// Инициализация debounced фильтрации
debouncedFilterResults = debounce(() => {
    filterResultsAdvanced();
}, 300);

function startResultsAutoRefresh() {
    // Останавливаем предыдущий интервал если был
    stopResultsAutoRefresh();

    // Обновляем каждые 10 секунд
    resultsAutoRefreshInterval = setInterval(async () => {
        // Предотвращаем параллельные запросы
        if (isRefreshingResults) return;

        isRefreshingResults = true;
        try {
            const newResults = await loadAllResults();
            if (newResults.length > 0) {
                const oldCount = adminState.results.length;
                adminState.results = newResults;

                // Если появились новые результаты - обновляем список с учётом фильтров
                if (adminState.results.length !== oldCount) {
                    // Применяем текущие фильтры без сброса страницы
                    filterResultsAdvanced(false);

                    // Показываем уведомление о новых результатах
                    if (adminState.results.length > oldCount) {
                        showNotification(`Получен новый результат! (всего: ${adminState.results.length})`);
                    }
                }
            }
        } catch (error) {
            console.error('Ошибка автообновления результатов:', error);
        } finally {
            isRefreshingResults = false;
        }
    }, 10000); // 10 секунд
}

function stopResultsAutoRefresh() {
    if (resultsAutoRefreshInterval) {
        clearInterval(resultsAutoRefreshInterval);
        resultsAutoRefreshInterval = null;
    }
}

// showNotification определена в modals.js

async function renderResultsTab() {
    const container = document.getElementById('tab-results');

    // Если данные ещё не загружены - показываем индикатор и загружаем
    if (!adminState.loaded.results) {
        container.innerHTML = `
            <div class="loading-tab">
                <div class="loading-spinner"></div>
                <p>Загрузка результатов...</p>
            </div>
        `;
        await loadResultsLazy();
    }

    // Запускаем автообновление
    startResultsAutoRefresh();

    // Собираем уникальные группы из результатов (нормализуем к верхнему регистру)
    const groups = [...new Set(adminState.results.map(r => (r.studentGroup || '').toUpperCase().trim()).filter(g => g))].sort();

    // Формируем опции для searchable dropdowns
    const groupOptions = groups.map(g => ({ value: g, label: g }));
    const disciplineOptions = [
        { value: '', label: 'Все дисциплины' },
        ...adminState.disciplines.map(d => ({ value: String(d.id), label: d.name }))
    ];
    const testOptions = [
        { value: '', label: 'Все тесты' },
        ...adminState.tests.map(t => {
            const disc = adminState.disciplines.find(d => String(d.id) === String(t.disciplineId));
            return {
                value: String(t.id),
                label: `${t.name}${disc ? ` (${disc.name})` : ''}`,
                disciplineId: t.disciplineId || ''
            };
        })
    ];
    const typeOptions = [
        { value: '', label: 'Все типы' },
        { value: 'exam', label: 'Зачёт' },
        { value: 'srez', label: 'Адм. срез' },
        { value: 'training', label: 'Тренировка' },
        { value: 'normal', label: 'Контрольная работа' }
    ];

    container.innerHTML = `
        <div class="admin-section">
            <div class="section-header">
                <h2>Результаты тестирования</h2>
                <div class="header-buttons">
                    <button class="btn btn-secondary" onclick="refreshResultsNow()">Обновить</button>
                    <button class="btn btn-secondary" onclick="exportResults()">Экспорт CSV</button>
                    <button class="btn btn-primary" onclick="exportGroupToExcel()">📊 Excel отчёт</button>
                    <button class="btn btn-success" onclick="exportToWord()">📄 Word (админ. срез)</button>
                    <button class="btn btn-secondary" onclick="printFilteredResults()">🖨️ Печать</button>
                </div>
            </div>

            <div class="results-filters">
                <div class="filter-row">
                    <div class="filter-group">
                        <label>Поиск по ФИО:</label>
                        <input type="text" id="results-fio-filter" placeholder="Введите фамилию или имя..." oninput="debouncedFilterResults()">
                    </div>
                    <div class="filter-group">
                        <label>Группы:</label>
                        ${createSearchableDropdown({
                            id: 'results-group-filter',
                            options: groupOptions,
                            value: [],
                            placeholder: 'Выбрано: 0',
                            multiple: true,
                            searchPlaceholder: 'Найти группу...'
                        })}
                    </div>
                    <div class="filter-group">
                        <label>Дисциплина:</label>
                        ${createSearchableDropdown({
                            id: 'results-discipline-filter',
                            options: disciplineOptions,
                            value: '',
                            placeholder: 'Все дисциплины',
                            multiple: false,
                            searchPlaceholder: 'Найти дисциплину...'
                        })}
                    </div>
                    <div class="filter-group">
                        <label>Тест:</label>
                        ${createSearchableDropdown({
                            id: 'results-test-filter',
                            options: testOptions,
                            value: '',
                            placeholder: 'Все тесты',
                            multiple: false,
                            searchPlaceholder: 'Найти тест...'
                        })}
                    </div>
                    <div class="filter-group">
                        <label>Тип:</label>
                        ${createSearchableDropdown({
                            id: 'results-type-filter',
                            options: typeOptions,
                            value: '',
                            placeholder: 'Все типы',
                            multiple: false,
                            searchPlaceholder: 'Найти тип...'
                        })}
                    </div>
                    <div class="filter-group filter-group-end">
                        <button class="btn btn-secondary btn-small" onclick="resetResultsFilters()">Сбросить фильтры</button>
                    </div>
                </div>
                <div class="filter-info">
                    <span id="results-count">Найдено: ${adminState.results.length}</span>
                    <span class="auto-refresh-indicator">Автообновление: каждые 10 сек</span>
                </div>
            </div>

            ${adminState.results.length > 0 && canEdit() ? `
            <div class="bulk-actions" id="results-bulk-actions">
                <label class="checkbox-label">
                    <input type="checkbox" id="select-all-results" onchange="toggleAllResults()">
                    <span>Выбрать все</span>
                </label>
                <div class="bulk-buttons hidden" id="results-bulk-buttons">
                    <span class="selected-count" id="results-selected-count">0 выбрано</span>
                    <button class="btn btn-danger btn-small" onclick="deleteSelectedResults()">🗑️ Удалить выбранные</button>
                </div>
            </div>
            ` : ''}

            <div id="results-list" class="results-list">
                <div class="empty-state"><p>Загрузка...</p></div>
            </div>
        </div>
    `;

    // Восстанавливаем сохранённые значения фильтров
    restoreResultsFilters();

    // Применяем фильтры (если есть сохранённые) или показываем всё
    const hasFilters = adminState.resultsFilters.fio ||
                       adminState.resultsFilters.groups.length > 0 ||
                       adminState.resultsFilters.discipline ||
                       adminState.resultsFilters.test ||
                       adminState.resultsFilters.testType;

    if (hasFilters) {
        // Применяем сохранённые фильтры без сброса страницы
        filterResultsAdvanced(false);
    } else {
        // Нет фильтров - показываем всё
        adminState.filteredResults = adminState.results;
        displayResultsWithPagination();
    }
}

// Сброс всех фильтров результатов
function resetResultsFilters() {
    // Очищаем сохранённые фильтры
    adminState.resultsFilters = {
        fio: '',
        groups: [],
        discipline: '',
        test: '',
        testType: ''
    };

    // Очищаем DOM элементы
    const fioEl = document.getElementById('results-fio-filter');
    if (fioEl) fioEl.value = '';

    // Очищаем searchable dropdowns
    searchableDropdownClearAll('results-group-filter');
    setSearchableDropdownValue('results-discipline-filter', '');
    setSearchableDropdownValue('results-test-filter', '');
    setSearchableDropdownValue('results-type-filter', '');

    // Сбрасываем на первую страницу и показываем всё
    adminState.resultsPage = 1;
    adminState.filteredResults = adminState.results;
    displayResultsWithPagination();

    showNotification('Фильтры сброшены', 'success');
}

// Восстановление значений фильтров в DOM элементы
function restoreResultsFilters() {
    const { fio, groups, discipline, test, testType } = adminState.resultsFilters;

    // ФИО
    const fioEl = document.getElementById('results-fio-filter');
    if (fioEl && fio) {
        fioEl.value = fio;
    }

    // Группы (множественный выбор) - searchable dropdown
    if (groups && groups.length > 0) {
        setSearchableDropdownValue('results-group-filter', groups);
    }

    // Дисциплина - searchable dropdown
    if (discipline) {
        setSearchableDropdownValue('results-discipline-filter', discipline);
    }

    // Тест - searchable dropdown
    if (test) {
        setSearchableDropdownValue('results-test-filter', test);
    }

    // Тип теста - searchable dropdown
    if (testType) {
        setSearchableDropdownValue('results-type-filter', testType);
    }
}

// Расширенная фильтрация результатов (локально на фронтенде)
function filterResultsAdvanced(resetPage = true) {
    const fioEl = document.getElementById('results-fio-filter');

    // Проверяем существование элементов
    if (!fioEl || !document.getElementById('results-group-filter')) {
        // Элементы ещё не созданы, используем сохранённые фильтры
        applyFiltersFromState();
        return;
    }

    const fioFilter = fioEl.value.toLowerCase().trim();

    // Получаем выбранные группы из searchable dropdown (множественный выбор)
    const selectedGroups = getSearchableDropdownValue('results-group-filter') || [];

    // Получаем остальные фильтры из searchable dropdowns
    const disciplineFilter = getSearchableDropdownValue('results-discipline-filter') || '';
    const testFilter = getSearchableDropdownValue('results-test-filter') || '';
    const typeFilter = getSearchableDropdownValue('results-type-filter') || '';

    // Сохраняем текущие фильтры в состояние
    adminState.resultsFilters = {
        fio: fioFilter,
        groups: selectedGroups,
        discipline: disciplineFilter,
        test: testFilter,
        testType: typeFilter
    };

    let filtered = adminState.results;

    // Фильтр по ФИО
    if (fioFilter) {
        filtered = filtered.filter(r => {
            const fullName = `${r.studentSurname || ''} ${r.studentName || ''}`.toLowerCase();
            return fullName.includes(fioFilter);
        });
    }

    // Фильтр по группам (точное совпадение, без учёта регистра)
    if (selectedGroups.length > 0) {
        filtered = filtered.filter(r => {
            const studentGroup = (r.studentGroup || '').toUpperCase().trim();
            return selectedGroups.includes(studentGroup);
        });
    }

    // Фильтр по дисциплине
    if (disciplineFilter) {
        const testsInDiscipline = adminState.tests
            .filter(t => String(t.disciplineId) === String(disciplineFilter))
            .map(t => String(t.id));
        filtered = filtered.filter(r => testsInDiscipline.includes(String(r.testId)));
    }

    // Фильтр по тесту
    if (testFilter) {
        filtered = filtered.filter(r => String(r.testId) === String(testFilter));
    }

    // Фильтр по типу теста (зачёт, адм. срез, тренировка, обычный)
    if (typeFilter) {
        filtered = filtered.filter(r => {
            const test = adminState.tests.find(t => String(t.id) === String(r.testId));
            if (!test) return false;

            switch (typeFilter) {
                case 'exam':
                    return test.isExamMode === true;
                case 'srez':
                    return test.isAdminSrezMode === true;
                case 'training':
                    return test.isTrainingMode === true;
                case 'normal':
                    return !test.isExamMode && !test.isAdminSrezMode && !test.isTrainingMode;
                default:
                    return true;
            }
        });
    }

    // Сохраняем отфильтрованные результаты
    adminState.filteredResults = filtered;

    // При новой фильтрации сбрасываем на первую страницу
    if (resetPage) {
        adminState.resultsPage = 1;
    }

    // Отображаем с пагинацией
    displayResultsWithPagination();
}

// При изменении группы - обновляем списки дисциплин и тестов
function onGroupFilterChange() {
    // Получаем выбранные группы из searchable dropdown
    const selectedGroups = (getSearchableDropdownValue('results-group-filter') || []).map(g => g.toUpperCase().trim());

    if (selectedGroups.length > 0) {
        // Находим все тесты, по которым есть результаты у выбранных групп
        const resultsForGroups = adminState.results.filter(r => {
            const studentGroup = (r.studentGroup || '').toUpperCase().trim();
            return selectedGroups.includes(studentGroup);
        });

        const testIdsForGroups = [...new Set(resultsForGroups.map(r => String(r.testId)))];
        const disciplineIdsForGroups = [...new Set(
            testIdsForGroups.map(testId => {
                const test = adminState.tests.find(t => String(t.id) === testId);
                return test?.disciplineId ? String(test.disciplineId) : null;
            }).filter(Boolean)
        )];

        // Обновляем опции дисциплин с флагом disabled
        const disciplineOptions = [
            { value: '', label: 'Все дисциплины', disabled: false },
            ...adminState.disciplines.map(d => ({
                value: String(d.id),
                label: d.name,
                disabled: !disciplineIdsForGroups.includes(String(d.id))
            }))
        ];
        updateSearchableDropdownOptions('results-discipline-filter', disciplineOptions);

        // Обновляем опции тестов с флагом disabled
        const testOptions = [
            { value: '', label: 'Все тесты', disabled: false },
            ...adminState.tests.map(t => {
                const disc = adminState.disciplines.find(d => String(d.id) === String(t.disciplineId));
                return {
                    value: String(t.id),
                    label: `${t.name}${disc ? ` (${disc.name})` : ''}`,
                    disabled: !testIdsForGroups.includes(String(t.id)),
                    disciplineId: t.disciplineId || ''
                };
            })
        ];
        updateSearchableDropdownOptions('results-test-filter', testOptions);
    } else {
        // Если группа не выбрана - показываем все без disabled
        const disciplineOptions = [
            { value: '', label: 'Все дисциплины' },
            ...adminState.disciplines.map(d => ({ value: String(d.id), label: d.name }))
        ];
        updateSearchableDropdownOptions('results-discipline-filter', disciplineOptions);

        const testOptions = [
            { value: '', label: 'Все тесты' },
            ...adminState.tests.map(t => {
                const disc = adminState.disciplines.find(d => String(d.id) === String(t.disciplineId));
                return {
                    value: String(t.id),
                    label: `${t.name}${disc ? ` (${disc.name})` : ''}`,
                    disciplineId: t.disciplineId || ''
                };
            })
        ];
        updateSearchableDropdownOptions('results-test-filter', testOptions);
    }

    // Применяем фильтр дисциплины (он ещё раз отфильтрует тесты)
    onDisciplineFilterChange();
}

// При изменении дисциплины - обновляем список тестов
function onDisciplineFilterChange() {
    const selectedGroups = (getSearchableDropdownValue('results-group-filter') || []).map(g => g.toUpperCase().trim());
    const selectedDiscipline = getSearchableDropdownValue('results-discipline-filter') || '';

    // Сначала определяем какие тесты доступны по группе
    let allowedTestIds = null;
    if (selectedGroups.length > 0) {
        const resultsForGroups = adminState.results.filter(r => {
            const studentGroup = (r.studentGroup || '').toUpperCase().trim();
            return selectedGroups.includes(studentGroup);
        });
        allowedTestIds = new Set(resultsForGroups.map(r => String(r.testId)));
    }

    // Обновляем опции тестов
    const testOptions = [
        { value: '', label: 'Все тесты', disabled: false },
        ...adminState.tests.map(t => {
            const disc = adminState.disciplines.find(d => String(d.id) === String(t.disciplineId));
            const matchesDiscipline = !selectedDiscipline || String(t.disciplineId) === selectedDiscipline;
            const matchesGroup = !allowedTestIds || allowedTestIds.has(String(t.id));

            return {
                value: String(t.id),
                label: `${t.name}${disc ? ` (${disc.name})` : ''}`,
                disabled: !matchesDiscipline || !matchesGroup,
                disciplineId: t.disciplineId || ''
            };
        })
    ];
    updateSearchableDropdownOptions('results-test-filter', testOptions);

    // Применяем фильтр
    filterResultsAdvanced();
}

// Применение сохранённых фильтров из состояния (без DOM элементов)
function applyFiltersFromState() {
    const { fio, groups, discipline, test, testType } = adminState.resultsFilters;

    let filtered = adminState.results;

    // Фильтр по ФИО
    if (fio) {
        filtered = filtered.filter(r => {
            const fullName = `${r.studentSurname || ''} ${r.studentName || ''}`.toLowerCase();
            return fullName.includes(fio);
        });
    }

    // Фильтр по группам
    if (groups.length > 0) {
        filtered = filtered.filter(r => {
            const studentGroup = (r.studentGroup || '').toUpperCase().trim();
            return groups.includes(studentGroup);
        });
    }

    // Фильтр по дисциплине
    if (discipline) {
        const testsInDiscipline = adminState.tests
            .filter(t => String(t.disciplineId) === String(discipline))
            .map(t => String(t.id));
        filtered = filtered.filter(r => testsInDiscipline.includes(String(r.testId)));
    }

    // Фильтр по тесту
    if (test) {
        filtered = filtered.filter(r => String(r.testId) === String(test));
    }

    // Фильтр по типу теста
    if (testType) {
        filtered = filtered.filter(r => {
            const testData = adminState.tests.find(t => String(t.id) === String(r.testId));
            if (!testData) return false;

            switch (testType) {
                case 'exam':
                    return testData.isExamMode === true;
                case 'srez':
                    return testData.isAdminSrezMode === true;
                case 'training':
                    return testData.isTrainingMode === true;
                case 'normal':
                    return !testData.isExamMode && !testData.isAdminSrezMode && !testData.isTrainingMode;
                default:
                    return true;
            }
        });
    }

    // Сохраняем отфильтрованные результаты
    adminState.filteredResults = filtered;
}

// Отображение результатов с пагинацией
function displayResultsWithPagination() {
    const filtered = adminState.filteredResults;
    const page = adminState.resultsPage;
    const perPage = adminState.resultsPerPage;
    const totalPages = Math.ceil(filtered.length / perPage);

    // Вычисляем срез для текущей страницы
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const pageResults = filtered.slice(start, end);

    // Обновляем счётчик
    const countText = filtered.length === 0
        ? 'Найдено: 0'
        : `Найдено: ${filtered.length} | Страница ${page} из ${totalPages}`;
    document.getElementById('results-count').textContent = countText;

    // Обновляем список
    const listEl = document.getElementById('results-list');
    listEl.innerHTML = pageResults.length === 0
        ? '<div class="empty-state"><p>Результаты не найдены</p></div>'
        : renderResultsList(pageResults);

    // Добавляем пагинацию
    if (totalPages > 1) {
        listEl.insertAdjacentHTML('beforeend', renderResultsPagination(page, totalPages));
    }
}

// Рендер кнопок пагинации
function renderResultsPagination(currentPage, totalPages) {
    let buttons = '';

    // Кнопка "Назад"
    buttons += `<button class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}"
        ${currentPage === 1 ? 'disabled' : ''} onclick="goToResultsPage(${currentPage - 1})">
        Назад
    </button>`;

    // Номера страниц
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
        buttons += `<button class="pagination-btn" onclick="goToResultsPage(1)">1</button>`;
        if (startPage > 2) {
            buttons += `<span class="pagination-ellipsis">...</span>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        buttons += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}"
            onclick="goToResultsPage(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            buttons += `<span class="pagination-ellipsis">...</span>`;
        }
        buttons += `<button class="pagination-btn" onclick="goToResultsPage(${totalPages})">${totalPages}</button>`;
    }

    // Кнопка "Вперёд"
    buttons += `<button class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}"
        ${currentPage === totalPages ? 'disabled' : ''} onclick="goToResultsPage(${currentPage + 1})">
        Вперёд
    </button>`;

    // Выбор количества на странице
    const perPageOptions = [10, 20, 50, 100];
    let perPageSelect = `<select class="pagination-per-page" onchange="changeResultsPerPage(this.value)">`;
    perPageOptions.forEach(n => {
        perPageSelect += `<option value="${n}" ${adminState.resultsPerPage === n ? 'selected' : ''}>${n} на странице</option>`;
    });
    perPageSelect += `</select>`;

    return `
        <div class="results-pagination">
            <div class="pagination-buttons">${buttons}</div>
            <div class="pagination-options">${perPageSelect}</div>
        </div>
    `;
}

// Переход на страницу
function goToResultsPage(page) {
    adminState.resultsPage = page;
    displayResultsWithPagination();
    // Прокрутка к началу списка
    document.getElementById('results-list').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Изменение количества на странице
function changeResultsPerPage(value) {
    adminState.resultsPerPage = parseInt(value);
    adminState.resultsPage = 1;
    displayResultsWithPagination();
}

// Ручное обновление результатов
async function refreshResultsNow(event) {
    const btn = event ? event.target : document.getElementById('btn-refresh-results');
    btn.disabled = true;
    btn.textContent = 'Обновление...';

    const newResults = await loadAllResults();
    if (newResults.length > 0 || adminState.results.length > 0) {
        adminState.results = newResults;
        // Применяем текущие фильтры и обновляем с пагинацией
        filterResultsAdvanced(false);
    }

    btn.disabled = false;
    btn.textContent = 'Обновить';
}

function renderResultsList(results) {
    // Группируем результаты по студентам (ФИО + группа + тест)
    const studentMap = {};
    results.forEach(r => {
        const key = `${(r.studentSurname || '').toLowerCase().trim()}_${(r.studentName || '').toLowerCase().trim()}_${(r.studentGroup || '').toUpperCase().trim()}_${r.testId}`;
        if (!studentMap[key]) {
            studentMap[key] = {
                studentName: r.studentName,
                studentSurname: r.studentSurname,
                studentGroup: r.studentGroup,
                testId: r.testId,
                testName: r.testName,
                photoUrl: r.studentPhotoUrl || null,
                attempts: []
            };
        }
        // Обновляем фото если есть более свежее
        if (r.studentPhotoUrl && !studentMap[key].photoUrl) {
            studentMap[key].photoUrl = r.studentPhotoUrl;
        }
        studentMap[key].attempts.push(r);
    });

    // Если фото нет в результатах - ищем в группах
    Object.values(studentMap).forEach(student => {
        if (!student.photoUrl) {
            const groupData = (adminState.groups || []).find(g =>
                g.name.toUpperCase() === (student.studentGroup || '').toUpperCase()
            );
            if (groupData && groupData.students) {
                const fullName = `${student.studentSurname} ${student.studentName}`.toLowerCase();
                const matchedStudent = groupData.students.find(s => {
                    const sFullName = (s.fullName || '').toLowerCase();
                    return sFullName === fullName || sFullName.startsWith(fullName);
                });
                if (matchedStudent && matchedStudent.photoUrl) {
                    student.photoUrl = matchedStudent.photoUrl;
                }
            }
        }
    });

    // Сортируем попытки по дате и находим лучшую
    Object.values(studentMap).forEach(student => {
        student.attempts.sort((a, b) => new Date(b.completedAt || b.submittedAt) - new Date(a.completedAt || a.submittedAt));
        student.bestAttempt = student.attempts.reduce((best, curr) =>
            curr.percentage > best.percentage ? curr : best, student.attempts[0]);
    });

    // Сортируем студентов по дате последней попытки
    const sortedStudents = Object.values(studentMap).sort((a, b) => {
        const dateA = new Date(a.attempts[0].completedAt || a.attempts[0].submittedAt);
        const dateB = new Date(b.attempts[0].completedAt || b.attempts[0].submittedAt);
        return dateB - dateA;
    });

    return sortedStudents.map(student => {
        const best = student.bestAttempt;
        const attemptsCount = student.attempts.length;

        // Находим дисциплину через тест
        const test = adminState.tests.find(t => String(t.id) === String(student.testId));
        const discipline = test ? adminState.disciplines.find(d => String(d.id) === String(test.disciplineId)) : null;
        const disciplineName = discipline ? discipline.name : '';

        // Определяем тип теста для бейджа - берём из результата (лучшей попытки), а не из теста
        // Это важно, т.к. тип теста мог измениться после прохождения
        let testTypeBadge = '';
        if (best.isExamMode) {
            testTypeBadge = '<span class="test-type-badge exam">Зачёт</span>';
        } else if (best.isAdminSrezMode) {
            testTypeBadge = '<span class="test-type-badge srez">Адм. срез</span>';
        } else if (best.isTrainingMode) {
            testTypeBadge = '<span class="test-type-badge training">Тренировка</span>';
        } else if (test) {
            // Fallback для старых результатов без сохранённого типа - берём из теста
            if (test.isExamMode) {
                testTypeBadge = '<span class="test-type-badge exam">Зачёт</span>';
            } else if (test.isAdminSrezMode) {
                testTypeBadge = '<span class="test-type-badge srez">Адм. срез</span>';
            } else if (test.isTrainingMode) {
                testTypeBadge = '<span class="test-type-badge training">Тренировка</span>';
            }
        }

        // Считаем общее количество нарушений по всем попыткам
        const totalViolations = student.attempts.reduce((sum, a) => sum + (a.violationsCount || 0), 0);
        const hasViolations = totalViolations > 0;

        // Считаем общее количество штрафов преподавателя по всем попыткам
        const totalTeacherPenalties = student.attempts.reduce((sum, a) => sum + (a.teacherPenaltyCount || (a.teacherNotes ? a.teacherNotes.length : 0)), 0);
        const hasTeacherPenalties = totalTeacherPenalties > 0;

        // Генерируем строки попыток
        const attemptsHtml = student.attempts.map((attempt, idx) => {
            const isBest = attempt.id === best.id;
            const attemptViolations = attempt.violationsCount || 0;
            const attemptTeacherPenalties = attempt.teacherPenaltyCount || (attempt.teacherNotes ? attempt.teacherNotes.length : 0);
            const attemptDate = new Date(attempt.completedAt || attempt.submittedAt);
            return `
                <div class="attempt-row ${isBest ? 'best-attempt' : ''}" data-id="${attempt.id}">
                    <span class="attempt-num">${attemptsCount > 1 ? `#${attemptsCount - idx}` : ''}${isBest && attemptsCount > 1 ? ' ★' : ''}</span>
                    <span class="attempt-score">${attempt.correctCount}/${attempt.totalQuestions}</span>
                    <span class="attempt-percent">${attempt.percentage}%</span>
                    <span class="attempt-grade ${getGradeCssClass(attempt.grade)}">${attempt.grade}</span>
                    <span class="attempt-violations ${attemptViolations > 0 ? 'has-v' : ''}">${attemptViolations > 0 ? attemptViolations : 'ок'}</span>
                    <span class="attempt-teacher-penalty ${attemptTeacherPenalties > 0 ? 'has-penalty' : ''}">${attemptTeacherPenalties > 0 ? attemptTeacherPenalties : '-'}</span>
                    <span class="attempt-date">${attemptDate.toLocaleDateString('ru-RU')} ${attemptDate.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})}</span>
                    <span class="attempt-actions">
                        ${canEdit() ? `<button class="btn-small btn-text btn-teacher" onclick="showTeacherNotesModal('${attempt.id}')" title="Отметки преподавателя">Отметки</button>` : ''}
                        <button class="btn-small btn-text" onclick="downloadResultReport('${attempt.id}')" title="Скачать HTML отчёт">Отчёт</button>
                        ${canEdit() ? `<button class="btn-small btn-text btn-danger" onclick="deleteResult('${attempt.id}')" title="Удалить попытку">Удалить</button>` : ''}
                    </span>
                </div>
            `;
        }).join('');

        return `
        <div class="result-card-grouped ${getGradeCssClass(best.grade)} ${hasViolations ? 'has-violations' : ''}" data-student-key="${student.studentSurname}_${student.studentName}_${student.studentGroup}">
            <div class="result-card-header">
                ${canEdit() ? `<input type="checkbox" class="result-checkbox-group" data-ids="${student.attempts.map(a => a.id).join(',')}" onchange="updateResultsSelection()">` : ''}
                <div class="result-photo">
                    ${student.photoUrl
                        ? `<img src="${student.photoUrl}" alt="Фото" class="result-photo-img">`
                        : `<span class="result-photo-placeholder">👤</span>`}
                </div>
                <div class="result-student">
                    <strong>${escapeHtml(student.studentSurname)} ${escapeHtml(student.studentName)}</strong>
                    <span class="result-group">${escapeHtml(student.studentGroup)}</span>
                </div>
                <div class="result-test-info">
                    <div class="result-test">${student.testName} ${testTypeBadge}</div>
                    ${disciplineName ? `<div class="result-discipline">${disciplineName}</div>` : ''}
                </div>
                <div class="result-best">
                    <span class="best-label">Лучший:</span>
                    <span class="best-score">${best.correctCount}/${best.totalQuestions}</span>
                    <span class="best-percent">${best.percentage}%</span>
                </div>
                <div class="result-grade-best">${best.grade}</div>
                <div class="result-attempts-count ${attemptsCount > 1 ? 'multiple' : ''}">
                    ${attemptsCount > 1 ? `${attemptsCount} попыток` : '1 попытка'}
                </div>
                <div class="result-violations-summary ${hasViolations ? 'danger' : 'safe'}">
                    ${hasViolations ? totalViolations : 'ок'}
                </div>
                <div class="result-teacher-penalty-summary ${hasTeacherPenalties ? 'warning' : 'safe'}">
                    ${hasTeacherPenalties ? totalTeacherPenalties : '-'}
                </div>
            </div>
            <div class="result-attempts-list">
                <div class="attempts-header">
                    <span>№</span>
                    <span>Баллы</span>
                    <span>%</span>
                    <span>Оценка</span>
                    <span>Нар.</span>
                    <span>Штр.</span>
                    <span>Дата</span>
                    <span>Действия</span>
                </div>
                ${attemptsHtml}
            </div>
        </div>
    `}).join('');
}

// ============================================
// МАССОВЫЕ ОПЕРАЦИИ С РЕЗУЛЬТАТАМИ
// ============================================

function toggleAllResults() {
    const selectAll = document.getElementById('select-all-results');
    const checkboxes = document.querySelectorAll('.result-checkbox-group');
    checkboxes.forEach(cb => cb.checked = selectAll.checked);
    updateResultsSelection();
}

function updateResultsSelection() {
    const checkboxes = document.querySelectorAll('.result-checkbox-group');
    const checked = document.querySelectorAll('.result-checkbox-group:checked');
    const bulkButtons = document.getElementById('results-bulk-buttons');
    const countSpan = document.getElementById('results-selected-count');
    const selectAll = document.getElementById('select-all-results');

    // Считаем общее количество попыток в выбранных группах
    let totalAttempts = 0;
    checked.forEach(cb => {
        const ids = cb.dataset.ids.split(',');
        totalAttempts += ids.length;
    });

    if (bulkButtons) {
        if (checked.length > 0) {
            showElement(bulkButtons);
            countSpan.textContent = `${checked.length} студентов (${totalAttempts} попыток)`;
        } else {
            hideElement(bulkButtons);
        }
    }

    // Обновляем состояние "Выбрать все"
    if (selectAll) {
        selectAll.checked = checkboxes.length > 0 && checked.length === checkboxes.length;
        selectAll.indeterminate = checked.length > 0 && checked.length < checkboxes.length;
    }
}

async function deleteSelectedResults() {
    const checked = document.querySelectorAll('.result-checkbox-group:checked');
    if (checked.length === 0) return;

    // Собираем все ID попыток из выбранных групп
    const allIds = [];
    checked.forEach(cb => {
        const ids = cb.dataset.ids.split(',');
        allIds.push(...ids);
    });

    if (!await showConfirm(`Удалить ${allIds.length} результатов (${checked.length} студентов)?`, 'Удаление результатов')) return;

    // Показываем индикатор загрузки
    showLoading(`Удаление ${allIds.length} результатов...`);

    // Массовое удаление одним запросом
    const result = await apiRequest('/results/bulk-delete', 'POST', { ids: allIds });
    hideLoading();

    if (result.success) {
        // Удаляем из локального состояния
        const idsSet = new Set(allIds.map(String));
        adminState.results = adminState.results.filter(r => !idsSet.has(String(r.id)));

        if (result.noAccess > 0) {
            await showWarning(`Удалено: ${result.deleted}, нет доступа: ${result.noAccess}`);
        } else {
            await showSuccess(`Удалено ${result.deleted} результатов`);
        }
    } else {
        await showError('Ошибка при удалении: ' + (result.error || 'неизвестная ошибка'));
    }

    // Сбрасываем чекбокс "Выбрать все" и скрываем кнопки
    const selectAll = document.getElementById('select-all-results');
    if (selectAll) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
    }
    const bulkButtons = document.getElementById('results-bulk-buttons');
    if (bulkButtons) hideElement(bulkButtons);

    // Применяем текущие фильтры без сброса (фильтры сохраняются)
    filterResultsAdvanced(false);
}

// Генерация SVG круговой диаграммы (размер: 'small', 'large')
function generatePieChart(correct, incorrect, chartSize = 'small') {
    const total = correct + incorrect;
    if (total === 0) return '<div style="text-align:center;color:#999;">Нет данных</div>';

    const correctPercent = (correct / total) * 100;

    // SVG параметры в зависимости от размера
    const isLarge = chartSize === 'large';
    const size = isLarge ? 280 : 150;
    const cx = size / 2;
    const cy = size / 2;
    const r = isLarge ? 110 : 60;
    const innerR = isLarge ? 70 : 35;
    const fontSize = isLarge ? 42 : 24;
    const legendSize = isLarge ? 16 : 12;

    // Вычисляем углы для секторов
    const correctAngle = (correct / total) * 360;

    // Функция для создания пути сектора
    function describeArc(startAngle, endAngle, color) {
        const start = polarToCartesian(cx, cy, r, endAngle);
        const end = polarToCartesian(cx, cy, r, startAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

        return `<path d="M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z" fill="${color}"/>`;
    }

    function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
        const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
        return {
            x: centerX + (radius * Math.cos(angleInRadians)),
            y: centerY + (radius * Math.sin(angleInRadians))
        };
    }

    // Создаём секторы
    let paths = '';
    if (correct > 0 && incorrect > 0) {
        paths = describeArc(0, correctAngle, '#059669') + describeArc(correctAngle, 360, '#dc2626');
    } else if (correct > 0) {
        paths = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#059669"/>`;
    } else {
        paths = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#dc2626"/>`;
    }

    // Текст с процентом в центре
    const percentText = `<text x="${cx}" y="${cy + fontSize/4}" text-anchor="middle" font-size="${fontSize}" font-weight="bold" fill="#1a1a2e">${correctPercent.toFixed(0)}%</text>`;

    return `
        <div style="text-align: center;">
            <svg class="pie-chart" style="width: ${size}px; height: ${size}px;" viewBox="0 0 ${size} ${size}">
                ${paths}
                <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="white"/>
                ${percentText}
            </svg>
            <div class="chart-legend" style="font-size: ${legendSize}px; margin-top: ${isLarge ? 15 : 10}px;">
                <div class="legend-item"><span class="legend-dot" style="background:#059669; width: ${isLarge ? 16 : 12}px; height: ${isLarge ? 16 : 12}px;"></span> Верно (${correct})</div>
                <div class="legend-item"><span class="legend-dot" style="background:#dc2626; width: ${isLarge ? 16 : 12}px; height: ${isLarge ? 16 : 12}px;"></span> Ошибки (${incorrect})</div>
            </div>
        </div>
    `;
}

// Генерация трёхцветной диаграммы (зелёный - чистые правильные, жёлтый - с нарушениями, красный - неправильные)
function generateThreeColorPieChart(cleanCorrect, suspectCorrect, incorrect, chartSize = 'small') {
    const total = cleanCorrect + suspectCorrect + incorrect;
    if (total === 0) return '<div style="text-align:center;color:#999;">Нет данных</div>';

    const totalCorrect = cleanCorrect + suspectCorrect;
    const correctPercent = (totalCorrect / total) * 100;

    // SVG параметры в зависимости от размера
    const isLarge = chartSize === 'large';
    const size = isLarge ? 280 : 150;
    const cx = size / 2;
    const cy = size / 2;
    const r = isLarge ? 110 : 60;
    const innerR = isLarge ? 70 : 35;
    const fontSize = isLarge ? 42 : 24;
    const legendSize = isLarge ? 16 : 12;

    function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
        const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
        return {
            x: centerX + (radius * Math.cos(angleInRadians)),
            y: centerY + (radius * Math.sin(angleInRadians))
        };
    }

    function describeArc(startAngle, endAngle, color) {
        if (endAngle - startAngle >= 360) {
            return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`;
        }
        if (endAngle <= startAngle) return '';

        const start = polarToCartesian(cx, cy, r, endAngle);
        const end = polarToCartesian(cx, cy, r, startAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

        return `<path d="M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z" fill="${color}"/>`;
    }

    // Вычисляем углы для секторов
    const cleanAngle = (cleanCorrect / total) * 360;
    const suspectAngle = (suspectCorrect / total) * 360;
    const incorrectAngle = (incorrect / total) * 360;

    // Создаём секторы
    let paths = '';
    let currentAngle = 0;

    if (cleanCorrect > 0) {
        paths += describeArc(currentAngle, currentAngle + cleanAngle, '#059669');
        currentAngle += cleanAngle;
    }
    if (suspectCorrect > 0) {
        paths += describeArc(currentAngle, currentAngle + suspectAngle, '#eab308');
        currentAngle += suspectAngle;
    }
    if (incorrect > 0) {
        paths += describeArc(currentAngle, currentAngle + incorrectAngle, '#dc2626');
    }

    // Если только один сегмент занимает всё
    if (!paths) {
        if (cleanCorrect > 0) paths = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#059669"/>`;
        else if (suspectCorrect > 0) paths = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#eab308"/>`;
        else paths = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#dc2626"/>`;
    }

    // Текст с процентом в центре
    const percentText = `<text x="${cx}" y="${cy + fontSize/4}" text-anchor="middle" font-size="${fontSize}" font-weight="bold" fill="#1a1a2e">${correctPercent.toFixed(0)}%</text>`;

    // Легенда с тремя элементами
    let legendItems = '';
    if (cleanCorrect > 0) {
        legendItems += `<div class="legend-item"><span class="legend-dot" style="background:#059669; width: ${isLarge ? 16 : 12}px; height: ${isLarge ? 16 : 12}px;"></span> Верно (${cleanCorrect})</div>`;
    }
    if (suspectCorrect > 0) {
        legendItems += `<div class="legend-item"><span class="legend-dot" style="background:#eab308; width: ${isLarge ? 16 : 12}px; height: ${isLarge ? 16 : 12}px;"></span> Подозр. (${suspectCorrect})</div>`;
    }
    if (incorrect > 0) {
        legendItems += `<div class="legend-item"><span class="legend-dot" style="background:#dc2626; width: ${isLarge ? 16 : 12}px; height: ${isLarge ? 16 : 12}px;"></span> Ошибки (${incorrect})</div>`;
    }

    return `
        <div style="text-align: center;">
            <svg class="pie-chart" style="width: ${size}px; height: ${size}px;" viewBox="0 0 ${size} ${size}">
                ${paths}
                <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="white"/>
                ${percentText}
            </svg>
            <div class="chart-legend" style="font-size: ${legendSize}px; margin-top: ${isLarge ? 15 : 10}px;">
                ${legendItems}
            </div>
        </div>
    `;
}

// Скачать HTML-отчёт по результату
async function downloadResultReport(resultId) {
    try {
        // Загружаем полные данные результата с сервера (включая details и violations)
        const response = await apiRequest(`/results/${resultId}`);
        if (!response.success || !response.result) {
            await showError('Не удалось загрузить данные результата: ' + (response.error || 'неизвестная ошибка'));
            return;
        }

        const result = response.result;

        // DEBUG: логирование данных штрафов преподавателя
        console.log('[downloadResultReport] resultId:', resultId);
        console.log('[downloadResultReport] teacherNotes:', result.teacherNotes);
        console.log('[downloadResultReport] teacherPenaltyCount:', result.teacherPenaltyCount);
        console.log('[downloadResultReport] violations:', result.violations?.length || 0);

        const test = adminState.tests.find(t => String(t.id) === String(result.testId));
        const testName = test ? test.name : result.testName || 'Тест';
        const discipline = test ? adminState.disciplines.find(d => String(d.id) === String(test.disciplineId)) : null;
        const disciplineName = discipline ? discipline.name : '';
        const violations = result.violations || [];
        const details = result.details || [];

        // === АНТИЧИТ: автоматические нарушения от системы ===
        const anticheatTypes = {
            // Скриншоты
            'screenshot': '📸 Попытка скриншота',
            'snipping_tool': '✂️ Использование Ножниц (Snipping Tool)',

            // Переключение вкладок/окон
            'tab_switch': '🔄 Переключение вкладки',
            'window_blur': '🪟 Переключение окна (Alt+Tab)',
            'alt_tab': '🪟 Попытка Alt+Tab',
            'alt_esc': '🪟 Попытка Alt+Esc',
            'win_tab': '🪟 Попытка Win+Tab',
            'cmd_tab': '🍎 Попытка Cmd+Tab (Mac)',
            'ctrl_tab': '🔄 Попытка Ctrl+Tab',
            'ctrl_shift_tab': '🔄 Попытка Ctrl+Shift+Tab',
            'virtual_desktop': '🖥️ Переключение рабочего стола',
            'win_d': '🖥️ Попытка Win+D (рабочий стол)',
            'win_m': '🖥️ Попытка Win+M (свернуть)',
            'ctrl_w': '❌ Попытка Ctrl+W (закрыть)',
            'ctrl_t': '➕ Попытка Ctrl+T (новая вкладка)',
            'ctrl_n': '➕ Попытка Ctrl+N (новое окно)',
            'app_switch': '📲 Переключение приложения',
            'multiple_tabs': '📑 Множественные вкладки',

            // Экран и окно
            'fullscreen_exit': '🖥️ Выход из полноэкранного режима',
            'split_screen': '📱 Split-screen режим',
            'window_resize': '📐 Изменение размера окна',

            // Picture-in-Picture
            'pip': '🎬 Попытка Picture-in-Picture',
            'pip_attempt': '🎬 Попытка Picture-in-Picture',

            // DevTools
            'devtools': '🔧 Открытие DevTools',
            'console_access': '🔧 Доступ к консоли',
            'code_injection': '💉 Попытка инъекции кода',

            // Копирование
            'copy': '📋 Попытка копирования',
            'cut': '✂️ Попытка вырезания',
            'context_menu': '🖱️ Попытка контекстного меню',

            // Печать/сохранение
            'print': '🖨️ Попытка печати',
            'save': '💾 Попытка сохранения',

            // Мобильные
            'pinch_zoom': '🔍 Попытка Pinch Zoom',
            'gesture_zoom': '🔍 Попытка масштабирования жестом',
            'double_tap_zoom': '👆 Двойное касание (zoom)',
            'ctrl_wheel_zoom': '🔍 Ctrl+колёсико (zoom)',
            'device_shake': '📳 Встряхивание устройства',
            'frequent_rotation': '🔄 Частая смена ориентации',
            'touch_interrupt': '👆 Прерывание касания',

            // Прочее
            'page_reload': '🔄 Перезагрузка страницы',
            'screen_share': '🖥️ Демонстрация экрана'
        };

    let anticheatRows = '';
    violations.forEach((v, idx) => {
        const violationTime = v.timestamp ? new Date(v.timestamp).toLocaleTimeString("ru-RU") : '-';
        anticheatRows += `
            <tr class="violation-row">
                <td>${idx + 1}</td>
                <td>${anticheatTypes[v.type] || v.type}</td>
                <td>Вопрос ${v.questionNumber || '-'}</td>
                <td>${v.questionText ? v.questionText.substring(0, 50) + '...' : '-'}</td>
                <td>${violationTime}</td>
            </tr>`;
    });

    const hasAnticheatViolations = violations.length > 0;
    const anticheatSection = `
        <div class="anticheat-section ${hasAnticheatViolations ? 'has-violations' : 'clean'}">
            <h2>🤖 Система Античит (автоматический контроль)</h2>
            ${hasAnticheatViolations ? `
                <div class="anticheat-summary">
                    <p class="anticheat-warning">⚠️ Зафиксировано нарушений: <strong>${violations.length}</strong></p>
                </div>
                <table class="violations-table">
                    <thead>
                        <tr>
                            <th>№</th>
                            <th>Тип нарушения</th>
                            <th>На вопросе</th>
                            <th>Текст вопроса</th>
                            <th>Время</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${anticheatRows}
                    </tbody>
                </table>
            ` : '<p class="anticheat-clean">✅ Система не зафиксировала нарушений</p>'}
        </div>
    `;

    // === ПРЕПОДАВАТЕЛЬ: ручные отметки от преподавателя ===
    const teacherNotes = result.teacherNotes || [];
    console.log('[ОТЧЁТ] teacherNotes массив:', teacherNotes);
    console.log('[ОТЧЁТ] teacherNotes длина:', teacherNotes.length);
    console.log('[ОТЧЁТ] hasTeacherNotes будет:', teacherNotes.length > 0);
    const teacherNoteTypes = {
        'cheating': '📋 Списывание',
        'phone': '📱 Использование телефона',
        'talking': '💬 Разговор',
        'notes': '📝 Использование шпаргалки',
        'help': '🤝 Получал подсказки',
        'other': '📌 Другое'
    };

    let teacherNotesRows = '';
    teacherNotes.forEach((note, idx) => {
        const noteTime = note.timestamp ? new Date(note.timestamp).toLocaleString("ru-RU") : '-';
        teacherNotesRows += `
            <tr class="teacher-note-row">
                <td>${idx + 1}</td>
                <td>${teacherNoteTypes[note.type] || note.type}</td>
                <td>${note.description || '-'}</td>
                <td>${note.addedBy || '-'}</td>
                <td>${noteTime}</td>
            </tr>`;
    });

    const hasTeacherNotes = teacherNotes.length > 0;

    // === ШТРАФЫ ВО ВРЕМЯ ТЕСТА (penalties) ===
    const testPenalties = result.penalties || [];
    const testPenaltyCount = result.penaltyCount || testPenalties.length;
    const testPenaltyTypes = {
        'phone': '📱 Использование мобильного устройства',
        'talking': '💬 Общение с другими обучающимися',
        'cheatsheet': '📝 Использование справочных материалов',
        'hint': '🤝 Получение подсказки',
        'leaving': '🚪 Несанкционированный выход из аудитории',
        'copyscreen': '📋 Попытка копирования материалов',
        'other': '📌 Иное нарушение'
    };

    let testPenaltiesRows = '';
    testPenalties.forEach((p, idx) => {
        const penaltyTime = p.timestamp ? new Date(p.timestamp).toLocaleTimeString("ru-RU") : (p.time || '-');
        testPenaltiesRows += `
            <tr class="penalty-row">
                <td>${idx + 1}</td>
                <td>${testPenaltyTypes[p.type] || p.label || p.type}</td>
                <td>${penaltyTime}</td>
            </tr>`;
    });

    const hasTestPenalties = testPenaltyCount > 0;
    const testPenaltiesSection = `
        <div class="penalties-section ${hasTestPenalties ? 'has-penalties' : 'clean'}">
            <h2>⚠️ Штрафы во время теста (от преподавателя)</h2>
            ${hasTestPenalties ? `
                <div class="penalties-summary">
                    <p class="penalties-warning">📋 Штрафов назначено: <strong>${testPenaltyCount}</strong></p>
                    <p style="color: #dc2626; font-weight: 600; margin-top: 8px;">
                        Снято баллов: <strong>-${testPenaltyCount}</strong>
                    </p>
                </div>
                <table class="penalties-table">
                    <thead>
                        <tr>
                            <th>№</th>
                            <th>Причина штрафа</th>
                            <th>Время</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${testPenaltiesRows}
                    </tbody>
                </table>
            ` : '<p class="penalties-clean">✅ Штрафов во время теста не было</p>'}
        </div>
    `;

    // === ОТМЕТКИ ПРЕПОДАВАТЕЛЯ ПОСЛЕ ТЕСТА (teacherNotes) ===
    const teacherPenaltyCount = result.teacherPenaltyCount || teacherNotes.length;

    // Показываем влияние штрафов на баллы
    const originalPoints = result.earnedPoints || result.correctCount || 0;
    const totalPenalties = testPenaltyCount + teacherPenaltyCount;
    const adjustedPoints = result.adjustedEarnedPoints !== undefined ? result.adjustedEarnedPoints : Math.max(0, originalPoints - totalPenalties);

    const teacherSection = `
        <div class="teacher-section ${hasTeacherNotes ? 'has-notes' : 'clean'}">
            <h2>👨‍🏫 Отметки преподавателя (после теста)</h2>
            ${hasTeacherNotes ? `
                <div class="teacher-summary">
                    <p class="teacher-warning">📝 Отметок: <strong>${teacherNotes.length}</strong></p>
                    <p class="teacher-penalty" style="color: #dc2626; font-weight: 600; margin-top: 8px;">
                        ⚠️ Штраф: <strong>-${teacherPenaltyCount}</strong> балл(ов)
                    </p>
                </div>
                <table class="teacher-table">
                    <thead>
                        <tr>
                            <th>№</th>
                            <th>Тип</th>
                            <th>Описание</th>
                            <th>Добавил</th>
                            <th>Время</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${teacherNotesRows}
                    </tbody>
                </table>
            ` : '<p class="teacher-clean">✅ Отметок после теста нет</p>'}
        </div>
    `;

    // === ИТОГ ПО ШТРАФАМ ===
    const penaltiesSummarySection = (hasTestPenalties || hasTeacherNotes) ? `
        <div class="penalties-total-section">
            <h3>📊 Итог по штрафам</h3>
            <table class="penalties-summary-table">
                <tr>
                    <td>Набрано баллов (до штрафов):</td>
                    <td><strong>${originalPoints}</strong></td>
                </tr>
                ${hasTestPenalties ? `<tr>
                    <td>Штрафы во время теста:</td>
                    <td style="color: #dc2626;"><strong>-${testPenaltyCount}</strong></td>
                </tr>` : ''}
                ${hasTeacherNotes ? `<tr>
                    <td>Штрафы после теста:</td>
                    <td style="color: #dc2626;"><strong>-${teacherPenaltyCount}</strong></td>
                </tr>` : ''}
                <tr style="border-top: 2px solid #333; font-size: 1.1rem;">
                    <td>Итого баллов:</td>
                    <td><strong>${adjustedPoints}</strong></td>
                </tr>
            </table>
        </div>
    ` : '';

    // Общий итог
    const totalViolationsCount = violations.length + teacherNotes.length;
    const hasAnyViolations = totalViolationsCount > 0;

    // Собираем номера вопросов с нарушениями
    const violationQuestions = new Set();
    violations.forEach(v => {
        if (v.questionNumber) {
            violationQuestions.add(v.questionNumber);
        }
    });

    // Подсчитываем статистику для трёхцветной диаграммы
    let cleanCorrectCount = 0;  // Правильные БЕЗ нарушений
    let suspectCorrectCount = 0; // Правильные С нарушениями
    let incorrectCount = 0;      // Неправильные

    details.forEach((d, idx) => {
        const questionNumber = idx + 1;
        const hasViolation = violationQuestions.has(questionNumber);

        if (!d.isCorrect) {
            incorrectCount++;
        } else if (hasViolation) {
            suspectCorrectCount++;
        } else {
            cleanCorrectCount++;
        }
    });

    // Генерируем таблицу ответов
    let detailsRows = '';
    details.forEach((d, idx) => {
        const questionNumber = idx + 1;
        const hasViolationOnQuestion = violationQuestions.has(questionNumber);

        // Логика цветов:
        // - Зелёный (correct): правильный ответ БЕЗ нарушений
        // - Жёлтый (suspect): правильный ответ С нарушениями (подозрительно)
        // - Красный (incorrect): неправильный ответ (всегда)
        let statusClass, statusIcon;
        if (!d.isCorrect) {
            statusClass = 'incorrect';
            statusIcon = '✗';
        } else if (hasViolationOnQuestion) {
            statusClass = 'suspect';
            statusIcon = '⚠️';
        } else {
            statusClass = 'correct';
            statusIcon = '✓';
        }

        // Показываем текст ответа если есть, иначе букву
        const userAnswerDisplay = d.userAnswerText || d.userAnswer || '-';
        const correctAnswerDisplay = d.correctAnswerText || d.correctAnswer || '-';

        // Время на вопрос
        const timeSpent = d.timeSpent || 0;
        const timeMinutes = Math.floor(timeSpent / 60);
        const timeSeconds = timeSpent % 60;
        const timeStr = timeMinutes > 0 ? `${timeMinutes}м ${timeSeconds}с` : `${timeSeconds}с`;

        // Картинка вопроса (если есть)
        let questionImageHtml = '';
        if (d.questionImage) {
            questionImageHtml = `<div class="question-image-report"><img src="${d.questionImage}" alt="Изображение к вопросу" style="max-width: 200px; max-height: 150px; border-radius: 4px; margin-top: 8px;"></div>`;
        }

        // Для match вопросов показываем картинки из пар
        let pairsImagesHtml = '';
        if (d.questionType === 'match' && d.pairs && d.pairs.length > 0) {
            const pairsWithImages = d.pairs.filter(p => p.leftImage || p.rightImage);
            if (pairsWithImages.length > 0) {
                pairsImagesHtml = '<div class="pairs-images-report" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">';
                pairsWithImages.forEach(p => {
                    if (p.leftImage) {
                        pairsImagesHtml += `<img src="${p.leftImage}" alt="Левая часть" style="max-width: 80px; max-height: 60px; border-radius: 4px; border: 1px solid #ddd;">`;
                    }
                    if (p.rightImage) {
                        pairsImagesHtml += `<img src="${p.rightImage}" alt="Правая часть" style="max-width: 80px; max-height: 60px; border-radius: 4px; border: 1px solid #ddd;">`;
                    }
                });
                pairsImagesHtml += '</div>';
            }
        }

        // Картинки ответов (если есть)
        let answersImagesHtml = '';
        if (d.answers && d.answers.length > 0) {
            const answersWithImages = d.answers.filter(a => a.image);
            if (answersWithImages.length > 0) {
                answersImagesHtml = '<div class="answers-images-report" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">';
                answersWithImages.forEach(a => {
                    const isCorrectAnswer = a.letter === d.correctAnswer || (Array.isArray(d.correctAnswer) && d.correctAnswer.includes(a.letter));
                    const isUserAnswer = a.letter === d.userAnswer || (Array.isArray(d.userAnswer) && d.userAnswer.includes(a.letter));
                    const borderColor = isCorrectAnswer ? '#22c55e' : (isUserAnswer && !d.isCorrect ? '#dc2626' : '#ddd');
                    answersImagesHtml += `<div style="text-align: center;"><img src="${a.image}" alt="${a.letter}" style="max-width: 80px; max-height: 60px; border-radius: 4px; border: 2px solid ${borderColor};"><div style="font-size: 10px; color: #666;">${a.letter}</div></div>`;
                });
                answersImagesHtml += '</div>';
            }
        }

        detailsRows += `
            <tr class="${statusClass}">
                <td>${questionNumber}</td>
                <td>
                    ${d.questionText || '-'}
                    ${questionImageHtml}
                    ${pairsImagesHtml}
                    ${answersImagesHtml}
                </td>
                <td class="answer" title="${userAnswerDisplay}">${userAnswerDisplay}</td>
                <td class="answer" title="${correctAnswerDisplay}">${correctAnswerDisplay}</td>
                <td class="time-cell">${timeStr}</td>
                <td class="status">${statusIcon}</td>
            </tr>`;
    });

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Отчёт: ${escapeHtml(result.studentSurname)} ${escapeHtml(result.studentName)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #1a1a2e; margin-bottom: 10px; }
        h2 { color: #1a1a2e; margin-top: 30px; margin-bottom: 15px; }
        .subtitle { color: #666; margin-bottom: 30px; }
        .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .info-card { background: #f8f9fa; padding: 15px; border-radius: 8px; }
        .info-card label { font-size: 12px; color: #666; display: block; margin-bottom: 5px; }
        .info-card value { font-size: 16px; font-weight: bold; color: #1a1a2e; }
        .info-card.danger { background: #fef2f2; border: 2px solid #dc2626; }
        .info-card.danger value { color: #dc2626; }
        .grade { font-size: 36px; text-align: center; }
        .grade-5 { color: #059669; }
        .grade-4 { color: #2563eb; }
        .grade-3 { color: #d97706; }
        .grade-2 { color: #dc2626; }
        .grade-pass { color: #059669; }
        .grade-fail { color: #dc2626; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
        th { background: #1a1a2e; color: white; padding: 10px 6px; text-align: left; }
        td { padding: 8px 6px; border-bottom: 1px solid #eee; }
        tr:hover { background: #f8f9fa; }
        tr.correct { background: #ecfdf5; }
        tr.incorrect { background: #fef2f2; }
        tr.suspect { background: #fefce8; }
        .answer { text-align: center; font-weight: bold; }
        .time-cell { text-align: center; color: #64748b; font-size: 12px; white-space: nowrap; }
        .status { text-align: center; font-size: 16px; }
        tr.correct .status { color: #059669; }
        tr.incorrect .status { color: #dc2626; }
        tr.suspect .status { color: #ca8a04; }
        /* Секция Античит */
        .anticheat-section { margin-top: 30px; padding: 20px; border-radius: 8px; }
        .anticheat-section.has-violations { background: #fef2f2; border: 2px solid #dc2626; }
        .anticheat-section.clean { background: #f0fdf4; border: 2px solid #22c55e; }
        .anticheat-section h2 { color: #1a1a2e; margin-bottom: 15px; margin-top: 0; display: flex; align-items: center; gap: 10px; }
        .anticheat-warning { color: #dc2626; font-weight: 600; }
        .anticheat-clean { color: #16a34a; font-weight: 600; font-size: 1.1rem; }
        .violations-table th { background: #dc2626; }
        .violation-row { background: #fff5f5; }
        .violation-row:hover { background: #fee2e2; }

        /* Секция Штрафы во время теста */
        .penalties-section { margin-top: 20px; padding: 20px; border-radius: 8px; }
        .penalties-section.has-penalties { background: #fef2f2; border: 2px solid #dc2626; }
        .penalties-section.clean { background: #f0fdf4; border: 2px solid #22c55e; }
        .penalties-section h2 { color: #1a1a2e; margin-bottom: 15px; margin-top: 0; display: flex; align-items: center; gap: 10px; }
        .penalties-warning { color: #dc2626; font-weight: 600; }
        .penalties-clean { color: #16a34a; font-weight: 600; font-size: 1.1rem; }
        .penalties-table th { background: #dc2626; color: white; }
        .penalty-row { background: #fff5f5; }
        .penalty-row:hover { background: #fee2e2; }

        /* Секция Отметки преподавателя после теста */
        .teacher-section { margin-top: 20px; padding: 20px; border-radius: 8px; }
        .teacher-section.has-notes { background: #fffbeb; border: 2px solid #f59e0b; }
        .teacher-section.clean { background: #f0fdf4; border: 2px solid #22c55e; }
        .teacher-section h2 { color: #1a1a2e; margin-bottom: 15px; margin-top: 0; display: flex; align-items: center; gap: 10px; }
        .teacher-warning { color: #d97706; font-weight: 600; }
        .teacher-clean { color: #16a34a; font-weight: 600; font-size: 1.1rem; }
        .teacher-table th { background: #f59e0b; color: white; }
        .teacher-note-row { background: #fffef5; }
        .teacher-note-row:hover { background: #fef3c7; }

        /* Итог по штрафам */
        .penalties-total-section { margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px; border: 2px solid #e5e7eb; }
        .penalties-total-section h3 { margin: 0 0 15px 0; color: #1a1a2e; }
        .penalties-summary-table { width: 100%; max-width: 400px; border-collapse: collapse; }
        .penalties-summary-table td { padding: 8px 12px; }
        .penalties-summary-table tr:nth-child(odd) { background: white; }

        /* Общие стили */
        .no-violations-section { margin-top: 30px; padding: 20px; background: #ecfdf5; border-radius: 8px; border: 2px solid #059669; text-align: center; }
        .no-violations-section h2 { color: #059669; margin: 0; }
        .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 80px; color: rgba(0,0,0,0.03); pointer-events: none; z-index: -1; white-space: nowrap; }
        .summary { margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; }
        .summary h3 { margin-bottom: 15px; }
        .summary p { margin: 5px 0; }
        .summary-content { display: flex; align-items: center; gap: 30px; flex-wrap: wrap; }
        .summary-chart { flex-shrink: 0; }
        .summary-stats { flex: 1; min-width: 200px; }
        .pie-chart { width: 150px; height: 150px; }
        .chart-legend { display: flex; gap: 15px; justify-content: center; margin-top: 10px; font-size: 12px; }
        .legend-item { display: flex; align-items: center; gap: 5px; }
        .legend-dot { width: 12px; height: 12px; border-radius: 50%; }
        @media print { .watermark { display: none; } }
        @media (max-width: 600px) {
            .summary-content { flex-direction: column; text-align: center; }
            .info-grid { grid-template-columns: repeat(2, 1fr); }
        }
    </style>
</head>
<body>
    <div class="watermark">${escapeHtml(result.studentSurname)} ${escapeHtml(result.studentName)} | ${escapeHtml(result.studentGroup)}</div>
    <div class="container">
        <h1>📝 Отчёт о тестировании</h1>
        <p class="subtitle">${disciplineName ? `<strong>${disciplineName}</strong> — ` : ''}${testName}</p>

        <!-- Большой график результата вверху -->
        <div class="main-result-section" style="display: flex; align-items: center; justify-content: center; gap: 40px; padding: 30px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 16px; margin-bottom: 30px; flex-wrap: wrap;">
            ${result.studentPhotoUrl ? `
            <div class="student-photo-report" style="flex-shrink: 0;">
                <img src="${result.studentPhotoUrl}" alt="Фото студента" style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 4px solid #e5e7eb; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            </div>
            ` : ''}
            <div class="main-chart">
                ${generateThreeColorPieChart(cleanCorrectCount, suspectCorrectCount, incorrectCount, 'large')}
            </div>
            <div class="main-stats" style="text-align: left;">
                <div class="grade-badge ${getGradeCssClass(result.grade)}" style="font-size: 72px; font-weight: 800; margin-bottom: 15px; text-align: center;">${result.grade}</div>
                <p style="font-size: 1.4rem; margin: 8px 0;"><strong>${escapeHtml(result.studentSurname)} ${escapeHtml(result.studentName)}</strong></p>
                <p style="font-size: 1.1rem; color: #666; margin: 5px 0;">${escapeHtml(result.studentGroup)}</p>
                <p style="font-size: 1.2rem; margin: 15px 0;"><span style="color: #059669; font-weight: 600;">${result.correctCount}</span> из <span style="font-weight: 600;">${result.totalQuestions}</span> правильно</p>
                ${hasAnyViolations ? `<p style="font-size: 1rem; color: #dc2626; margin: 5px 0;">⚠️ Нарушений: ${totalViolationsCount}</p>` : '<p style="font-size: 1rem; color: #059669; margin: 5px 0;">✅ Без нарушений</p>'}
            </div>
        </div>

        <div class="info-grid">
            <div class="info-card">
                <label>Студент</label>
                <value>${escapeHtml(result.studentSurname)} ${escapeHtml(result.studentName)}</value>
            </div>
            <div class="info-card">
                <label>Группа</label>
                <value>${escapeHtml(result.studentGroup)}</value>
            </div>
            ${disciplineName ? `<div class="info-card">
                <label>Дисциплина</label>
                <value>${disciplineName}</value>
            </div>` : ''}
            <div class="info-card">
                <label>Тест</label>
                <value>${testName}</value>
            </div>
            <div class="info-card">
                <label>Дата</label>
                <value>${new Date(result.completedAt || result.submittedAt).toLocaleString('ru-RU')}</value>
            </div>
            <div class="info-card">
                <label>Время</label>
                <value>${formatTimeTaken(result.timeTaken)}</value>
            </div>
            <div class="info-card">
                <label>Результат</label>
                <value>${result.correctCount} из ${result.totalQuestions} (${result.percentage}%)</value>
            </div>
            <div class="info-card ${(result.tabSwitchCount || 0) > 0 ? 'danger' : ''}">
                <label>Переключений</label>
                <value>${result.tabSwitchCount || 0}</value>
            </div>
            <div class="info-card ${(result.fullscreenExitCount || 0) > 0 ? 'danger' : ''}">
                <label>Выходов из полноэкр.</label>
                <value>${result.fullscreenExitCount || 0}</value>
            </div>
            <div class="info-card ${(result.screenshotAttempts || 0) > 0 ? 'danger' : ''}">
                <label>Скриншотов</label>
                <value>${result.screenshotAttempts || 0}</value>
            </div>
            <div class="info-card">
                <label>Устройство</label>
                <value>${result.deviceType === 'mobile' ? '📱 Мобильное' : '💻 Компьютер'}</value>
            </div>
            <div class="info-card">
                <label>Оценка</label>
                <div class="grade ${getGradeCssClass(result.grade)}">${result.grade}</div>
            </div>
        </div>

        ${anticheatSection}
        ${testPenaltiesSection}
        ${teacherSection}
        ${penaltiesSummarySection}

        ${details.length > 0 ? `
        <h2>📋 Детализация ответов</h2>
        <table>
            <thead>
                <tr>
                    <th>№</th>
                    <th>Вопрос</th>
                    <th>Ответ студента</th>
                    <th>Правильный ответ</th>
                    <th>⏱ Время</th>
                    <th>Статус</th>
                </tr>
            </thead>
            <tbody>
                ${detailsRows}
            </tbody>
        </table>
        ` : '<p style="color: #666; margin-top: 20px;">Детализация ответов недоступна</p>'}

        <div class="summary">
            <h3>📊 Итог</h3>
            <div class="summary-content">
                <div class="summary-chart">
                    ${generateThreeColorPieChart(cleanCorrectCount, suspectCorrectCount, incorrectCount)}
                </div>
                <div class="summary-stats">
                    <p>✓ Правильных (чистые): <strong style="color: #059669">${cleanCorrectCount}</strong></p>
                    ${suspectCorrectCount > 0 ? `<p>⚠️ Правильных (с нарушениями): <strong style="color: #ca8a04">${suspectCorrectCount}</strong></p>` : ''}
                    <p>✗ Неправильных: <strong style="color: #dc2626">${incorrectCount}</strong></p>
                    <p>📈 Процент: <strong>${result.percentage}%</strong></p>
                    <p>🚨 Нарушений: <strong style="color: ${hasAnyViolations ? '#dc2626' : '#059669'}">${totalViolationsCount}</strong></p>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;

    // Скачиваем файл
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Отчёт_${result.studentSurname}_${result.studentName}_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    } catch (error) {
        console.error('Ошибка при скачивании отчёта:', error);
        await showError('Ошибка при формировании отчёта: ' + error.message);
    }
}

async function filterResults() {
    const testId = document.getElementById('results-test-filter').value;
    let url = '/results';
    if (testId) url += `?testId=${testId}`;

    const result = await apiRequest(url);
    if (result.success) {
        document.getElementById('results-list').innerHTML = result.results.length === 0
            ? '<div class="empty-state"><p>Результатов нет</p></div>'
            : renderResultsList(result.results);
    }
}

async function deleteResult(id) {
    if (await showConfirm('Удалить этот результат?', 'Удаление результата')) {
        const result = await apiRequest(`/results/${id}`, 'DELETE');
        if (result.success) {
            // Удаляем из локального состояния без сброса фильтров
            adminState.results = adminState.results.filter(r => String(r.id) !== String(id));
            // Применяем текущие фильтры без сброса страницы
            filterResultsAdvanced(false);
            showNotification('Результат удалён', 'success');
        }
    }
}

// Печать отфильтрованных результатов
function printFilteredResults() {
    const filtered = adminState.filteredResults || [];

    if (filtered.length === 0) {
        showNotification('Нет результатов для печати', 'warning');
        return;
    }

    // Группируем результаты по студентам
    const studentMap = {};
    filtered.forEach(r => {
        const key = `${(r.studentSurname || '').toLowerCase().trim()}_${(r.studentName || '').toLowerCase().trim()}_${(r.studentGroup || '').toUpperCase().trim()}_${r.testId}`;
        if (!studentMap[key]) {
            studentMap[key] = {
                studentName: r.studentName,
                studentSurname: r.studentSurname,
                studentGroup: r.studentGroup,
                testId: r.testId,
                testName: r.testName,
                attempts: []
            };
        }
        studentMap[key].attempts.push(r);
    });

    // Находим лучшую попытку для каждого студента
    Object.values(studentMap).forEach(student => {
        student.attempts.sort((a, b) => new Date(b.completedAt || b.submittedAt) - new Date(a.completedAt || a.submittedAt));
        student.bestAttempt = student.attempts.reduce((best, curr) =>
            curr.percentage > best.percentage ? curr : best, student.attempts[0]);
    });

    // Сортируем по группе и фамилии
    const sortedStudents = Object.values(studentMap).sort((a, b) => {
        const groupCompare = (a.studentGroup || '').localeCompare(b.studentGroup || '');
        if (groupCompare !== 0) return groupCompare;
        return (a.studentSurname || '').localeCompare(b.studentSurname || '');
    });

    // Получаем информацию о применённых фильтрах
    const { fio, groups, discipline, test, testType } = adminState.resultsFilters;
    let filterInfo = [];
    if (fio) filterInfo.push(`ФИО: "${fio}"`);
    if (groups.length > 0) filterInfo.push(`Группы: ${groups.join(', ')}`);
    if (discipline) {
        const disc = adminState.disciplines.find(d => String(d.id) === String(discipline));
        if (disc) filterInfo.push(`Дисциплина: ${disc.name}`);
    }
    if (test) {
        const t = adminState.tests.find(t => String(t.id) === String(test));
        if (t) filterInfo.push(`Тест: ${t.name}`);
    }
    if (testType) {
        const typeNames = { exam: 'Зачёт', srez: 'Адм. срез', training: 'Тренировка', normal: 'Контрольная' };
        filterInfo.push(`Тип: ${typeNames[testType] || testType}`);
    }

    // Генерируем строки таблицы
    let tableRows = '';
    sortedStudents.forEach((student, idx) => {
        const best = student.bestAttempt;
        const test = adminState.tests.find(t => String(t.id) === String(student.testId));
        const discipline = test ? adminState.disciplines.find(d => String(d.id) === String(test.disciplineId)) : null;

        let testType = '';
        if (best.isExamMode || (test && test.isExamMode)) testType = 'Зачёт';
        else if (best.isAdminSrezMode || (test && test.isAdminSrezMode)) testType = 'Адм. срез';
        else if (best.isTrainingMode || (test && test.isTrainingMode)) testType = 'Тренировка';

        const violations = best.violationsCount || 0;
        const date = new Date(best.completedAt || best.submittedAt);

        tableRows += `
            <tr>
                <td>${idx + 1}</td>
                <td>${escapeHtml(student.studentSurname)} ${escapeHtml(student.studentName)}</td>
                <td>${escapeHtml(student.studentGroup)}</td>
                <td>${discipline ? discipline.name : '-'}</td>
                <td>${student.testName}${testType ? ` (${testType})` : ''}</td>
                <td>${best.correctCount}/${best.totalQuestions}</td>
                <td>${best.percentage}%</td>
                <td class="${getGradeCssClass(best.grade)}">${best.grade}</td>
                <td class="${violations > 0 ? 'violations' : ''}">${violations > 0 ? violations : '-'}</td>
                <td>${date.toLocaleDateString('ru-RU')} ${date.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})}</td>
            </tr>
        `;
    });

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Результаты тестирования</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; font-size: 12px; }
        h1 { font-size: 18px; margin-bottom: 10px; text-align: center; }
        .filter-info { font-size: 11px; color: #666; margin-bottom: 15px; text-align: center; }
        .stats { font-size: 11px; margin-bottom: 10px; text-align: center; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #1a1a2e; color: white; padding: 8px 5px; text-align: left; font-weight: 600; }
        td { padding: 6px 5px; border-bottom: 1px solid #ddd; }
        tr:nth-child(even) { background: #f8f9fa; }
        .grade-5 { color: #059669; font-weight: bold; }
        .grade-4 { color: #2563eb; font-weight: bold; }
        .grade-3 { color: #d97706; font-weight: bold; }
        .grade-2 { color: #dc2626; font-weight: bold; }
        .grade-pass { color: #059669; font-weight: bold; }
        .grade-fail { color: #dc2626; font-weight: bold; }
        .violations { color: #dc2626; font-weight: bold; }
        .print-date { font-size: 10px; color: #999; text-align: right; margin-top: 15px; }
        @media print {
            body { padding: 10px; }
            th { background: #333 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    <h1>Результаты тестирования</h1>
    ${filterInfo.length > 0 ? `<div class="filter-info">Фильтры: ${filterInfo.join(' | ')}</div>` : ''}
    <div class="stats">Всего записей: ${sortedStudents.length} (студентов: ${sortedStudents.length}, попыток: ${filtered.length})</div>

    <table>
        <thead>
            <tr>
                <th>№</th>
                <th>ФИО</th>
                <th>Группа</th>
                <th>Дисциплина</th>
                <th>Тест</th>
                <th>Баллы</th>
                <th>%</th>
                <th>Оценка</th>
                <th>Нар.</th>
                <th>Дата</th>
            </tr>
        </thead>
        <tbody>
            ${tableRows}
        </tbody>
    </table>

    <div class="print-date">Распечатано: ${new Date().toLocaleString('ru-RU')}</div>

    <script>
        window.onload = function() {
            window.print();
        };
    </script>
</body>
</html>`;

    // Открываем окно печати
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
}

// ============================================
// ОБРАБОТЧИКИ СОБЫТИЙ SEARCHABLE DROPDOWN ДЛЯ ФИЛЬТРОВ
// ============================================

// Callback для изменения группы
window.onSearchableDropdownChange_results_group_filter = function(value) {
    onGroupFilterChange();
};
// Исправляем имя функции (с дефисами)
window['onSearchableDropdownChange_results-group-filter'] = function(value) {
    onGroupFilterChange();
};

// Callback для изменения дисциплины
window['onSearchableDropdownChange_results-discipline-filter'] = function(value) {
    onDisciplineFilterChange();
};

// Callback для изменения теста
window['onSearchableDropdownChange_results-test-filter'] = function(value) {
    filterResultsAdvanced();
};

// Callback для изменения типа
window['onSearchableDropdownChange_results-type-filter'] = function(value) {
    filterResultsAdvanced();
};

// ============================================
