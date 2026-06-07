// ============================================
// УТИЛИТЫ И ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

const API_BASE = 'api';

// Получить CSS-класс для оценки (поддержка числовых и текстовых "Сдал/Не сдал")
function getGradeCssClass(grade) {
    if (grade === 'Сдал') return 'grade-pass';
    if (grade === 'Не сдал') return 'grade-fail';
    return `grade-${grade}`;
}

// Debounce функция для оптимизации частых вызовов
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Форматирование времени выполнения: MM:SS или HH:MM:SS
function formatTimeTaken(timeTaken) {
    if (!timeTaken && timeTaken !== 0) return '-';

    // Если это уже строка формата "MM:SS" или "HH:MM:SS"
    if (typeof timeTaken === 'string' && timeTaken.includes(':')) {
        // Проверяем, нужно ли добавить часы
        const parts = timeTaken.split(':');
        if (parts.length === 2) {
            const mins = parseInt(parts[0]);
            const secs = parseInt(parts[1]);
            if (mins >= 60) {
                const hours = Math.floor(mins / 60);
                const remainMins = mins % 60;
                return `${hours}:${String(remainMins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            }
            return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        return timeTaken;
    }

    // Если это число (секунды)
    const totalSeconds = parseInt(timeTaken);
    if (isNaN(totalSeconds)) return '-';

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Экранирование HTML для защиты от XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Экранирование для отчётов
function escapeHtmlReport(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Форматирование даты и времени
function formatDateTime(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Получить имя автора по ID
// Примечание: использует глобальный adminState, определённый в state.js
function getAuthorName(userId) {
    if (!userId) return 'Администратор';
    if (typeof adminState === 'undefined') return 'Администратор';

    // Сначала проверяем текущего пользователя (работает для всех ролей)
    // Проверяем и id, и userId (разные API возвращают по-разному)
    const currentUserId = adminState.user?.id || adminState.user?.userId;

    if (currentUserId && String(userId) === String(currentUserId)) {
        return escapeHtml(adminState.user?.name || adminState.user?.username || 'Вы');
    }

    // Ищем в списке всех пользователей
    if (adminState.allUsers && adminState.allUsers.length > 0) {
        const user = adminState.allUsers.find(u => String(u.id) === String(userId));
        if (user) {
            return escapeHtml(user.name || user.username);
        }
    }

    // Также проверяем в adminState.users (для обратной совместимости)
    if (adminState.users && adminState.users.length > 0) {
        const user = adminState.users.find(u => String(u.id) === String(userId));
        if (user) {
            return escapeHtml(user.name || user.username);
        }
    }

    // Если пользователь не найден - значит удалён, показываем "Администратор"
    return 'Администратор';
}

// Получить название типа вопроса
function getQuestionTypeLabel(type) {
    switch (type) {
        case 'single': return 'Одиночный выбор';
        case 'multiple': return 'Множественный выбор';
        case 'match': return 'Сопоставление';
        case 'sequence': return 'Последовательность';
        case 'short_answer': return 'Короткий ответ';
        case 'fill_blanks': return 'Пропуски';
        default: return 'Неизвестный тип';
    }
}

// Получить название сложности
function getDifficultyLabel(difficulty) {
    switch (difficulty) {
        case 'hard': return 'Сложный';
        case 'medium': return 'Средний';
        case 'easy': return 'Лёгкий';
        default: return '-';
    }
}

// Проверка, является ли режим только для чтения
function isReadOnly() {
    if (typeof adminState === 'undefined') return false;
    return adminState.user?.role === 'education_dept';
}

// Проверка, может ли пользователь редактировать
function canEdit() {
    if (typeof adminState === 'undefined') return true;
    return adminState.user?.role !== 'education_dept';
}

// Инициализация темы
function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
}

// Переключение темы
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    if (current === 'dark') {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
}

// Получить инициалы из имени
function getInitials(name) {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
}

// Конвертация файла в Base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// Чтение файла как текст (с явным указанием UTF-8)
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file, 'UTF-8');
    });
}

// Экранирование для GIFT формата
function escapeGIFT(text) {
    if (!text) return '';
    return text
        .replace(/\\/g, '\\\\')
        .replace(/~/g, '\\~')
        .replace(/=/g, '\\=')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/#/g, '\\#')
        .replace(/:/g, '\\:');
}

// ============================================
// DOM УТИЛИТЫ
// ============================================

// Показать элемент (убрать класс hidden)
function showElement(elementOrId) {
    const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
    if (el) el.classList.remove('hidden');
}

// Скрыть элемент (добавить класс hidden)
function hideElement(elementOrId) {
    const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
    if (el) el.classList.add('hidden');
}

// Показать модальное окно (добавить display: flex)
function showModal(elementOrId) {
    const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
    if (el) {
        el.classList.remove('hidden');
        el.style.display = 'flex';
    }
}

// Скрыть модальное окно
function hideModal(elementOrId) {
    const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
    if (el) {
        el.classList.add('hidden');
        el.style.display = 'none';
    }
}

// Переключить видимость элемента
function toggleElement(elementOrId, show) {
    const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
    if (el) {
        if (show) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    }
}

// ============================================
// РЕЖИМ ТЕХНИЧЕСКИХ РАБОТ
// ============================================

// Проверка и отображение баннера техработ
async function checkMaintenanceMode() {
    try {
        const res = await fetch('api/maintenance');
        const data = await res.json();

        if (data.enabled) {
            // Если мы в админке и это админ - не показываем баннер
            if (typeof currentUser !== 'undefined' && currentUser?.role === 'admin') {
                return { enabled: true, isAdmin: true };
            }

            // Показываем баннер для всех остальных
            showMaintenanceBanner(data.message);
            return { enabled: true, isAdmin: false };
        }

        // Убираем баннер если выключен
        hideMaintenanceBanner();
        return { enabled: false };
    } catch (e) {
        console.log('Не удалось проверить режим техработ');
        return { enabled: false };
    }
}

// Показать баннер технических работ
function showMaintenanceBanner(message) {
    // Убираем старый баннер если есть
    hideMaintenanceBanner();

    const banner = document.createElement('div');
    banner.id = 'maintenance-banner';
    banner.className = 'maintenance-banner';
    banner.innerHTML = `
        <div class="maintenance-banner-content">
            <div class="maintenance-banner-icon">&#128679;</div>
            <div class="maintenance-banner-text">
                <div class="maintenance-banner-title">Технические работы</div>
                <div class="maintenance-banner-message">${escapeHtml(message)}</div>
            </div>
        </div>
    `;

    document.body.insertBefore(banner, document.body.firstChild);
    document.body.classList.add('maintenance-active');
}

// Скрыть баннер
function hideMaintenanceBanner() {
    const banner = document.getElementById('maintenance-banner');
    if (banner) {
        banner.remove();
    }
    document.body.classList.remove('maintenance-active');
}

// Переключить режим техработ (только для админа)
async function toggleMaintenanceMode(enabled, message = 'Ведутся технические работы. Пожалуйста, подождите.') {
    try {
        const res = await fetch('api/maintenance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
            },
            body: JSON.stringify({ enabled, message })
        });
        const data = await res.json();
        return data;
    } catch (e) {
        console.error('Ошибка при переключении режима техработ:', e);
        return { success: false, error: e.message };
    }
}

// ============================================
// SEARCHABLE DROPDOWN (Выпадающий список с поиском)
// ============================================

/**
 * Создаёт выпадающий список с поиском
 * @param {Object} config - Конфигурация
 * @param {string} config.id - ID элемента
 * @param {Array} config.options - Массив опций [{value: '', label: '', disabled: false}]
 * @param {string|Array} config.value - Текущее значение (строка или массив для multiple)
 * @param {string} config.placeholder - Placeholder текст
 * @param {boolean} config.multiple - Множественный выбор
 * @param {Function} config.onChange - Callback при изменении
 * @param {string} config.searchPlaceholder - Placeholder для поиска
 * @returns {string} HTML строка
 */
function createSearchableDropdown(config) {
    const {
        id,
        options = [],
        value = config.multiple ? [] : '',
        placeholder = 'Выберите...',
        multiple = false,
        searchPlaceholder = 'Поиск...'
    } = config;

    const selectedValues = multiple ? (Array.isArray(value) ? value : []) : [value].filter(Boolean);

    // Формируем текст для отображения
    let displayText = placeholder;
    let isPlaceholder = true;

    if (selectedValues.length > 0) {
        if (multiple) {
            const selectedLabels = options
                .filter(opt => selectedValues.includes(String(opt.value)))
                .map(opt => opt.label);
            displayText = selectedLabels.length > 2
                ? `${selectedLabels.slice(0, 2).join(', ')} и ещё ${selectedLabels.length - 2}`
                : selectedLabels.join(', ') || placeholder;
        } else {
            const selectedOpt = options.find(opt => String(opt.value) === String(selectedValues[0]));
            displayText = selectedOpt ? selectedOpt.label : placeholder;
        }
        isPlaceholder = false;
    }

    const optionsHtml = options.map(opt => {
        const isSelected = selectedValues.includes(String(opt.value));
        const disabledClass = opt.disabled ? 'disabled' : '';

        if (multiple) {
            return `
                <div class="searchable-dropdown-item ${isSelected ? 'selected' : ''} ${disabledClass}"
                     data-value="${escapeHtml(String(opt.value))}"
                     ${opt.disabled ? 'data-disabled="true"' : ''}>
                    <input type="checkbox" ${isSelected ? 'checked' : ''} ${opt.disabled ? 'disabled' : ''}>
                    <span>${escapeHtml(opt.label)}</span>
                </div>
            `;
        } else {
            return `
                <div class="searchable-dropdown-item ${isSelected ? 'selected' : ''} ${disabledClass}"
                     data-value="${escapeHtml(String(opt.value))}"
                     ${opt.disabled ? 'data-disabled="true"' : ''}>
                    <span>${escapeHtml(opt.label)}</span>
                </div>
            `;
        }
    }).join('');

    const countBadge = multiple && selectedValues.length > 0
        ? `<span class="searchable-dropdown-count">${selectedValues.length}</span>`
        : '';

    const actionsHtml = multiple ? `
        <div class="searchable-dropdown-actions">
            <button type="button" onclick="searchableDropdownSelectAll('${id}')">Выбрать все</button>
            <button type="button" onclick="searchableDropdownClearAll('${id}')">Очистить</button>
        </div>
    ` : '';

    return `
        <div class="searchable-dropdown" id="${id}" data-multiple="${multiple}">
            <div class="searchable-dropdown-toggle" onclick="toggleSearchableDropdown('${id}')">
                <span class="searchable-dropdown-text ${isPlaceholder ? 'placeholder' : ''}">${escapeHtml(displayText)}</span>
                ${countBadge}
                <span class="searchable-dropdown-arrow">▼</span>
            </div>
            <div class="searchable-dropdown-menu">
                <div class="searchable-dropdown-search">
                    <input type="text" placeholder="${escapeHtml(searchPlaceholder)}"
                           oninput="filterSearchableDropdown('${id}', this.value)"
                           onclick="event.stopPropagation()">
                </div>
                ${actionsHtml}
                <div class="searchable-dropdown-list">
                    ${optionsHtml || '<div class="searchable-dropdown-empty">Нет опций</div>'}
                </div>
            </div>
        </div>
    `;
}

// Переключить открытие/закрытие dropdown
function toggleSearchableDropdown(id) {
    const dropdown = document.getElementById(id);
    if (!dropdown) return;

    // Закрываем все остальные dropdowns
    document.querySelectorAll('.searchable-dropdown.open').forEach(d => {
        if (d.id !== id) d.classList.remove('open');
    });

    dropdown.classList.toggle('open');

    if (dropdown.classList.contains('open')) {
        // Фокус на поле поиска
        const searchInput = dropdown.querySelector('.searchable-dropdown-search input');
        if (searchInput) {
            setTimeout(() => searchInput.focus(), 50);
        }
    }
}

// Закрыть все dropdowns при клике вне
document.addEventListener('click', function(e) {
    if (!e.target.closest('.searchable-dropdown')) {
        document.querySelectorAll('.searchable-dropdown.open').forEach(d => {
            d.classList.remove('open');
        });
    }
});

// Фильтрация опций по поиску
function filterSearchableDropdown(id, query) {
    const dropdown = document.getElementById(id);
    if (!dropdown) return;

    const items = dropdown.querySelectorAll('.searchable-dropdown-item');
    const lowerQuery = query.toLowerCase().trim();
    let visibleCount = 0;

    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (lowerQuery === '' || text.includes(lowerQuery)) {
            item.classList.remove('hidden');
            visibleCount++;
        } else {
            item.classList.add('hidden');
        }
    });

    // Показать сообщение "ничего не найдено"
    let emptyMsg = dropdown.querySelector('.searchable-dropdown-empty');
    if (visibleCount === 0) {
        if (!emptyMsg) {
            emptyMsg = document.createElement('div');
            emptyMsg.className = 'searchable-dropdown-empty';
            emptyMsg.textContent = 'Ничего не найдено';
            dropdown.querySelector('.searchable-dropdown-list').appendChild(emptyMsg);
        }
        emptyMsg.style.display = 'block';
    } else if (emptyMsg) {
        emptyMsg.style.display = 'none';
    }
}

// Выбор элемента в dropdown
function selectSearchableDropdownItem(id, value, item) {
    const dropdown = document.getElementById(id);
    if (!dropdown) return;

    if (item && item.dataset.disabled === 'true') return;

    const isMultiple = dropdown.dataset.multiple === 'true';

    if (isMultiple) {
        // Множественный выбор - переключаем состояние
        item.classList.toggle('selected');
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = item.classList.contains('selected');
    } else {
        // Одиночный выбор
        dropdown.querySelectorAll('.searchable-dropdown-item').forEach(i => {
            i.classList.remove('selected');
        });
        if (item) item.classList.add('selected');
        dropdown.classList.remove('open');
    }

    updateSearchableDropdownDisplay(id);
    triggerSearchableDropdownChange(id);
}

// Обновить отображаемый текст
function updateSearchableDropdownDisplay(id) {
    const dropdown = document.getElementById(id);
    if (!dropdown) return;

    const isMultiple = dropdown.dataset.multiple === 'true';
    const selected = dropdown.querySelectorAll('.searchable-dropdown-item.selected');
    const textEl = dropdown.querySelector('.searchable-dropdown-text');
    const countEl = dropdown.querySelector('.searchable-dropdown-count');

    if (selected.length === 0) {
        textEl.textContent = dropdown.dataset.placeholder || 'Выберите...';
        textEl.classList.add('placeholder');
        if (countEl) countEl.remove();
    } else {
        textEl.classList.remove('placeholder');

        if (isMultiple) {
            const labels = Array.from(selected).map(s => s.textContent.trim());
            textEl.textContent = labels.length > 2
                ? `${labels.slice(0, 2).join(', ')} и ещё ${labels.length - 2}`
                : labels.join(', ');

            // Обновляем или создаём badge с количеством
            let badge = dropdown.querySelector('.searchable-dropdown-count');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'searchable-dropdown-count';
                dropdown.querySelector('.searchable-dropdown-toggle').insertBefore(
                    badge,
                    dropdown.querySelector('.searchable-dropdown-arrow')
                );
            }
            badge.textContent = selected.length;
        } else {
            textEl.textContent = selected[0].textContent.trim();
        }
    }
}

// Получить выбранные значения
function getSearchableDropdownValue(id) {
    const dropdown = document.getElementById(id);
    if (!dropdown) return dropdown?.dataset.multiple === 'true' ? [] : '';

    const isMultiple = dropdown.dataset.multiple === 'true';
    const selected = dropdown.querySelectorAll('.searchable-dropdown-item.selected');

    if (isMultiple) {
        return Array.from(selected).map(s => s.dataset.value);
    } else {
        return selected.length > 0 ? selected[0].dataset.value : '';
    }
}

// Установить значения программно
function setSearchableDropdownValue(id, value) {
    const dropdown = document.getElementById(id);
    if (!dropdown) return;

    const isMultiple = dropdown.dataset.multiple === 'true';
    const values = isMultiple ? (Array.isArray(value) ? value : [value]) : [value];

    dropdown.querySelectorAll('.searchable-dropdown-item').forEach(item => {
        const shouldSelect = values.includes(item.dataset.value);
        item.classList.toggle('selected', shouldSelect);
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = shouldSelect;
    });

    updateSearchableDropdownDisplay(id);
}

// Выбрать все (для множественного выбора)
function searchableDropdownSelectAll(id) {
    const dropdown = document.getElementById(id);
    if (!dropdown) return;

    dropdown.querySelectorAll('.searchable-dropdown-item:not(.hidden):not([data-disabled="true"])').forEach(item => {
        item.classList.add('selected');
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = true;
    });

    updateSearchableDropdownDisplay(id);
    triggerSearchableDropdownChange(id);
}

// Очистить все
function searchableDropdownClearAll(id) {
    const dropdown = document.getElementById(id);
    if (!dropdown) return;

    dropdown.querySelectorAll('.searchable-dropdown-item').forEach(item => {
        item.classList.remove('selected');
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = false;
    });

    updateSearchableDropdownDisplay(id);
    triggerSearchableDropdownChange(id);
}

// Вызвать событие изменения
function triggerSearchableDropdownChange(id) {
    const dropdown = document.getElementById(id);
    if (!dropdown) return;

    // Вызываем кастомное событие
    const event = new CustomEvent('searchableDropdownChange', {
        detail: { id, value: getSearchableDropdownValue(id) }
    });
    dropdown.dispatchEvent(event);

    // Вызываем глобальный callback если определён
    const callbackName = `onSearchableDropdownChange_${id}`;
    if (typeof window[callbackName] === 'function') {
        window[callbackName](getSearchableDropdownValue(id));
    }
}

// Инициализация кликов по элементам (делегирование)
document.addEventListener('click', function(e) {
    const item = e.target.closest('.searchable-dropdown-item');
    if (item) {
        const dropdown = item.closest('.searchable-dropdown');
        if (dropdown) {
            selectSearchableDropdownItem(dropdown.id, item.dataset.value, item);
        }
    }
});

// Обновить опции в существующем dropdown
function updateSearchableDropdownOptions(id, options, keepValue = true) {
    const dropdown = document.getElementById(id);
    if (!dropdown) return;

    const currentValue = keepValue ? getSearchableDropdownValue(id) : (dropdown.dataset.multiple === 'true' ? [] : '');
    const isMultiple = dropdown.dataset.multiple === 'true';
    const list = dropdown.querySelector('.searchable-dropdown-list');

    const optionsHtml = options.map(opt => {
        const isSelected = isMultiple
            ? currentValue.includes(String(opt.value))
            : String(currentValue) === String(opt.value);
        const disabledClass = opt.disabled ? 'disabled' : '';

        if (isMultiple) {
            return `
                <div class="searchable-dropdown-item ${isSelected ? 'selected' : ''} ${disabledClass}"
                     data-value="${escapeHtml(String(opt.value))}"
                     ${opt.disabled ? 'data-disabled="true"' : ''}>
                    <input type="checkbox" ${isSelected ? 'checked' : ''} ${opt.disabled ? 'disabled' : ''}>
                    <span>${escapeHtml(opt.label)}</span>
                </div>
            `;
        } else {
            return `
                <div class="searchable-dropdown-item ${isSelected ? 'selected' : ''} ${disabledClass}"
                     data-value="${escapeHtml(String(opt.value))}"
                     ${opt.disabled ? 'data-disabled="true"' : ''}>
                    <span>${escapeHtml(opt.label)}</span>
                </div>
            `;
        }
    }).join('');

    list.innerHTML = optionsHtml || '<div class="searchable-dropdown-empty">Нет опций</div>';

    // Очищаем поиск
    const searchInput = dropdown.querySelector('.searchable-dropdown-search input');
    if (searchInput) searchInput.value = '';

    updateSearchableDropdownDisplay(id);
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ
// ============================================

// Инициализация темы при загрузке
initTheme();

// Обработка горячих клавиш
document.addEventListener('keydown', function(e) {
    // Win+Ctrl+S - скриншот (не блокируем)
    if (e.key === 's' && e.ctrlKey && e.metaKey) {
        return true;
    }
    // Ctrl+S - предотвращаем сохранение страницы
    if (e.key === 's' && e.ctrlKey && !e.metaKey) {
        e.preventDefault();
    }
});
