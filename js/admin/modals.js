// ============================================
// СИСТЕМА МОДАЛЬНЫХ ДИАЛОГОВ
// Замена alert/confirm на красивые модалки
// ============================================

function showSystemModal(options) {
    return new Promise((resolve) => {
        const {
            type = 'info', // info, success, warning, error, confirm
            title = '',
            message = '',
            confirmText = 'OK',
            cancelText = 'Отмена',
            showCancel = false
        } = options;

        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            confirm: '❓'
        };

        const titles = {
            info: title || 'Информация',
            success: title || 'Успешно',
            warning: title || 'Внимание',
            error: title || 'Ошибка',
            confirm: title || 'Подтверждение'
        };

        // Экранируем все пользовательские данные для защиты от XSS
        const safeMessage = escapeHtml(message);
        const safeTitle = escapeHtml(titles[type]);
        const safeConfirmText = escapeHtml(confirmText);
        const safeCancelText = escapeHtml(cancelText);

        const overlay = document.createElement('div');
        overlay.className = 'system-modal-overlay';
        overlay.innerHTML = `
            <div class="system-modal" role="dialog" aria-modal="true">
                <div class="system-modal-header">
                    <span class="system-modal-icon ${type}">${icons[type]}</span>
                    <h3 class="system-modal-title">${safeTitle}</h3>
                </div>
                <div class="system-modal-body">
                    <p class="system-modal-message">${safeMessage}</p>
                </div>
                <div class="system-modal-footer">
                    ${showCancel ? `<button class="btn btn-secondary modal-cancel">${safeCancelText}</button>` : ''}
                    <button class="btn btn-primary modal-confirm">${safeConfirmText}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const confirmBtn = overlay.querySelector('.modal-confirm');
        const cancelBtn = overlay.querySelector('.modal-cancel');

        const close = (result) => {
            overlay.remove();
            resolve(result);
        };

        confirmBtn.addEventListener('click', () => close(true));
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => close(false));
        }

        // Закрытие по Escape
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', handleEscape);
                close(showCancel ? false : true);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Закрытие по клику вне модалки
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                close(showCancel ? false : true);
            }
        });

        // Фокус на кнопке подтверждения
        confirmBtn.focus();
    });
}

// Удобные обёртки
async function showAlert(message, type = 'info') {
    return showSystemModal({ type, message });
}

async function showSuccess(message) {
    return showSystemModal({ type: 'success', message });
}

async function showError(message) {
    return showSystemModal({ type: 'error', message });
}

async function showWarning(message) {
    return showSystemModal({ type: 'warning', message });
}

async function showConfirm(message, title = '') {
    return showSystemModal({
        type: 'confirm',
        title,
        message,
        showCancel: true,
        confirmText: 'Да',
        cancelText: 'Отмена'
    });
}

// Показать индикатор загрузки
function showLoading(text = 'Загрузка...') {
    // Проверяем, нет ли уже индикатора
    const existing = document.getElementById('loading-overlay');
    if (existing) {
        // Обновляем текст если индикатор уже есть
        const textEl = existing.querySelector('.loading-text');
        if (textEl) textEl.textContent = text;
        return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'loading-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <span class="loading-text">${escapeHtml(text)}</span>
        </div>
    `;
    document.body.appendChild(overlay);
}

// Скрыть индикатор загрузки
function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.remove();
}

// Показать уведомление (toast)
function showNotification(message, type = 'info') {
    // Удаляем предыдущее уведомление если есть
    const existingToast = document.querySelector('.results-notification');
    if (existingToast) {
        existingToast.remove();
    }

    const icons = {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌'
    };

    const toast = document.createElement('div');
    toast.className = `results-notification notification-${type}`;
    toast.innerHTML = `
        <span class="notification-icon">${icons[type] || '🔔'}</span>
        <span class="notification-text">${escapeHtml(message)}</span>
    `;
    document.body.appendChild(toast);

    // Анимация появления
    setTimeout(() => toast.classList.add('show'), 10);

    // Удаляем через 5 секунд (3 секунды для success)
    const duration = type === 'success' ? 3000 : 5000;
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ============================================
// TOAST С КНОПКОЙ ОТМЕНЫ (для удаления)
// ============================================

let undoToastTimeout = null;
let undoCallback = null;

// Показать toast с возможностью отмены действия
function showUndoToast(message, onUndo, duration = 5000) {
    // Очищаем предыдущий toast если есть
    clearUndoToast();

    const toast = document.createElement('div');
    toast.className = 'undo-toast';
    toast.id = 'undo-toast';
    toast.innerHTML = `
        <span class="undo-toast-icon">🗑️</span>
        <span class="undo-toast-message">${escapeHtml(message)}</span>
        <button class="undo-toast-btn" onclick="executeUndo()">Отменить</button>
        <div class="undo-toast-progress">
            <div class="undo-toast-progress-bar" style="animation-duration: ${duration}ms;"></div>
        </div>
    `;
    document.body.appendChild(toast);

    // Сохраняем callback для отмены
    undoCallback = onUndo;

    // Анимация появления
    setTimeout(() => toast.classList.add('show'), 10);

    // Автоматическое закрытие
    undoToastTimeout = setTimeout(() => {
        clearUndoToast();
    }, duration);

    return toast;
}

// Выполнить отмену
function executeUndo() {
    if (undoCallback) {
        undoCallback();
        undoCallback = null;
    }
    clearUndoToast();
    showNotification('Действие отменено', 'success');
}

// Очистить toast отмены
function clearUndoToast() {
    if (undoToastTimeout) {
        clearTimeout(undoToastTimeout);
        undoToastTimeout = null;
    }
    undoCallback = null;

    const toast = document.getElementById('undo-toast');
    if (toast) {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }
}
