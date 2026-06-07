// ============================================
// ТАБ: ЛИЧНЫЙ КАБИНЕТ
// ============================================

function renderProfileTab() {
    const container = document.getElementById('tab-profile');
    const user = adminState.user;

    container.innerHTML = `
        <div class="admin-section">
            <div class="section-header">
                <h2>Личный кабинет</h2>
            </div>

            <div class="profile-grid">
                <div class="profile-card">
                    <h3>Профиль</h3>
                    <div class="profile-info">
                        <div class="profile-avatar clickable" onclick="showAvatarModal()" title="Изменить аватарку">
                            ${user?.avatarUrl
                                ? `<img src="${user.avatarUrl}" alt="Аватар">`
                                : `<span class="avatar-initials">${getInitials(user?.name || user?.username || 'U')}</span>`
                            }
                            <div class="avatar-overlay">📷</div>
                        </div>
                        <div class="profile-details">
                            <p class="profile-name">${escapeHtml(user?.name || 'Пользователь')}</p>
                            <p class="profile-role">${user?.role === 'admin' ? 'Администратор' : user?.role === 'education_dept' ? 'Учебный отдел' : 'Преподаватель'}</p>
                            <p class="profile-login">Логин: ${escapeHtml(user?.username || '')}</p>
                        </div>
                    </div>

                    <div class="password-section">
                        <h4>Изменить пароль</h4>
                        <form id="password-change-form" class="password-form">
                            <div class="form-group">
                                <label>Текущий пароль</label>
                                <input type="password" id="current-password" required placeholder="Введите текущий пароль">
                            </div>
                            <div class="form-group">
                                <label>Новый пароль</label>
                                <input type="password" id="new-password" required minlength="6" placeholder="Минимум 6 символов">
                            </div>
                            <div class="form-group">
                                <label>Подтверждение пароля</label>
                                <input type="password" id="confirm-password" required placeholder="Повторите новый пароль">
                            </div>
                            <div class="form-actions">
                                <button type="submit" class="btn btn-primary">Изменить пароль</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="profile-card">
                    <h3>Уведомления в Telegram</h3>
                    <p class="card-description">Получайте отчёты о результатах тестирования прямо в Telegram</p>

                    <form id="telegram-settings-form" class="telegram-form">
                        <div class="form-group">
                            <label>Токен бота</label>
                            <input type="text" id="telegram-token" placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz" value="${user?.telegramToken || ''}">
                            <small>Получите у @BotFather в Telegram</small>
                        </div>
                        <div class="form-group">
                            <label>Chat ID</label>
                            <input type="text" id="telegram-chat-id" placeholder="123456789" value="${user?.telegramChatId || ''}">
                            <small>Узнайте у @userinfobot или @getmyid_bot</small>
                        </div>
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="telegram-enabled" ${user?.telegramEnabled ? 'checked' : ''}>
                                Включить уведомления
                            </label>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="testTelegram()">Тест</button>
                            <button type="submit" class="btn btn-primary">Сохранить</button>
                        </div>
                    </form>
                </div>

${adminState.user?.role === 'admin' ? `
                <div class="profile-card">
                    <h3>🔧 Режим технических работ</h3>
                    <p class="card-description">Временно закрыть доступ к системе для студентов</p>

                    <div class="maintenance-controls">
                        <div id="maintenance-status" class="maintenance-status">
                            <span class="maintenance-indicator"></span>
                            <span class="maintenance-status-text">Загрузка...</span>
                        </div>

                        <div class="form-group" style="margin-top: 16px;">
                            <label>Сообщение для пользователей</label>
                            <input type="text" id="maintenance-message" class="form-control"
                                   placeholder="Ведутся технические работы. Пожалуйста, подождите."
                                   value="">
                        </div>

                        <div class="form-actions" style="margin-top: 16px;">
                            <button type="button" id="maintenance-toggle-btn" class="btn btn-warning" onclick="toggleMaintenanceModeUI()">
                                Включить режим техработ
                            </button>
                        </div>
                    </div>
                </div>

                <div class="profile-card">
                    <h3>⚡ Массовая настройка тестов</h3>
                    <p class="card-description">Автоматически настроить все тесты и зачислить студентов</p>

                    <div class="bulk-setup-info" style="margin: 16px 0; padding: 12px; background: #f0f9ff; border-radius: 8px; font-size: 0.9rem;">
                        <p style="margin: 0 0 8px 0;"><strong>Что будет сделано:</strong></p>
                        <ul style="margin: 0; padding-left: 20px;">
                            <li>Для всех тестов включится "Скрыть результаты"</li>
                            <li>Для срезов/зачётов - автозачисление студентов из привязанных групп</li>
                            <li>Варианты распределятся автоматически (1, 2, 3...)</li>
                        </ul>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn btn-primary" onclick="runBulkTestSetup()">
                            🚀 Запустить настройку
                        </button>
                    </div>
                </div>

                <div class="profile-card">
                    <h3>📁 Выгрузка кодов доступа</h3>
                    <p class="card-description">Скачать карточки с кодами для всех административных срезов</p>

                    <div class="bulk-setup-info" style="margin: 16px 0; padding: 12px; background: #fff7ed; border-radius: 8px; font-size: 0.9rem;">
                        <p style="margin: 0 0 8px 0;"><strong>Структура архива:</strong></p>
                        <ul style="margin: 0; padding-left: 20px;">
                            <li>Один файл на группу</li>
                            <li>Все дисциплины студента в одной карточке</li>
                            <li>Открыть в браузере → Ctrl+P → Сохранить как PDF</li>
                        </ul>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn btn-success" onclick="exportAllSrezAccessCodesToZip()">
                            📥 Скачать ZIP архив
                        </button>
                    </div>
                </div>

                <div class="profile-card">
                    <h3>🗑️ Очистка участников срезов</h3>
                    <p class="card-description">Удалить всех участников из всех административных срезов для перегенерации вариантов</p>

                    <div class="bulk-setup-info" style="margin: 16px 0; padding: 12px; background: #fef2f2; border-radius: 8px; font-size: 0.9rem;">
                        <p style="margin: 0 0 8px 0;"><strong>⚠️ Внимание:</strong></p>
                        <ul style="margin: 0; padding-left: 20px;">
                            <li>Все участники будут удалены из всех срезов</li>
                            <li>После этого запустите "Массовую настройку" для перегенерации</li>
                            <li>Новые варианты будут назначены случайно</li>
                        </ul>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn btn-danger" onclick="clearAllSrezParticipantsGlobal()">
                            🗑️ Удалить всех участников
                        </button>
                    </div>
                </div>

                <div class="profile-card">
                    <h3>📄 Выгрузка Word отчётов</h3>
                    <p class="card-description">Скачать отчёты по всем группам и дисциплинам (админ. срезы) в ZIP архиве</p>

                    <div class="bulk-setup-info" style="margin: 16px 0; padding: 12px; background: #eff6ff; border-radius: 8px; font-size: 0.9rem;">
                        <p style="margin: 0 0 8px 0;"><strong>Структура архива:</strong></p>
                        <ul style="margin: 0; padding-left: 20px;">
                            <li>Папка на каждую дисциплину</li>
                            <li>Файл .docx на каждую группу</li>
                            <li>Если результатов нет - файл будет пустым</li>
                        </ul>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn btn-primary" onclick="exportAllSrezReportsToZip()">
                            📄 Скачать Word отчёты (ZIP)
                        </button>
                    </div>
                </div>

                <div class="profile-card">
                    <h3>🎓 Интеграция с Moodle (LTI)</h3>
                    <p class="card-description">Подключите систему тестирования к СДО Moodle</p>

                    <form id="lti-settings-form" class="telegram-form">
                        <div class="form-group">
                            <label>Consumer Key</label>
                            <input type="text" id="lti-consumer-key" placeholder="Ключ из Moodle">
                        </div>
                        <div class="form-group">
                            <label>Consumer Secret</label>
                            <input type="password" id="lti-consumer-secret" placeholder="Секрет из Moodle">
                        </div>
                        <div class="form-group">
                            <label class="checkbox-inline">
                                <input type="checkbox" id="lti-enabled">
                                <span>Включить LTI</span>
                            </label>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn btn-primary" onclick="saveLtiSettings()">Сохранить</button>
                        </div>
                    </form>

                    <div class="bulk-setup-info" style="margin: 16px 0; padding: 12px; background: #f0f9ff; border-radius: 8px; font-size: 0.85rem;">
                        <p style="margin: 0 0 8px 0;"><strong>Настройка в Moodle:</strong></p>
                        <ol style="margin: 0; padding-left: 20px;">
                            <li>Администрирование → Плагины → Модули занятий → Внешний инструмент</li>
                            <li>Добавьте инструмент:<br>
                                URL: <code>https://kst-test.ru/lti/launch</code><br>
                                Consumer Key и Secret — из полей выше</li>
                            <li>В настройках можно добавить:<br>
                                <code>custom_test_link</code> = ссылка на конкретный тест</li>
                        </ol>
                    </div>
                </div>
` : ''}

                <div class="profile-card profile-card-wide">
                    <h3>Как подключить Telegram-бота</h3>
                    <div class="telegram-instructions">
                        <div class="instruction-step">
                            <div class="step-number">1</div>
                            <div class="step-content">
                                <h4>Создайте бота</h4>
                                <p>Откройте Telegram и найдите <a href="https://t.me/BotFather" target="_blank">@BotFather</a></p>
                                <p>Отправьте команду <code>/newbot</code></p>
                                <p>Введите имя бота (например: "Мои тесты")</p>
                                <p>Введите username бота (например: my_tests_bot)</p>
                                <p>Скопируйте полученный <strong>токен</strong></p>
                            </div>
                        </div>

                        <div class="instruction-step">
                            <div class="step-number">2</div>
                            <div class="step-content">
                                <h4>Узнайте свой Chat ID</h4>
                                <p>Найдите бота <a href="https://t.me/userinfobot" target="_blank">@userinfobot</a></p>
                                <p>Нажмите "Start" или отправьте любое сообщение</p>
                                <p>Скопируйте число из строки <strong>Id</strong></p>
                            </div>
                        </div>

                        <div class="instruction-step">
                            <div class="step-number">3</div>
                            <div class="step-content">
                                <h4>Активируйте своего бота</h4>
                                <p>Найдите созданного бота по username</p>
                                <p>Нажмите <strong>"Start"</strong> или отправьте <code>/start</code></p>
                                <p class="warning">Без этого шага бот не сможет отправлять вам сообщения!</p>
                            </div>
                        </div>

                        <div class="instruction-step">
                            <div class="step-number">4</div>
                            <div class="step-content">
                                <h4>Настройте и проверьте</h4>
                                <p>Вставьте токен и Chat ID в форму слева</p>
                                <p>Включите галочку "Включить уведомления"</p>
                                <p>Нажмите <strong>"Тест"</strong> — должно прийти сообщение</p>
                                <p>Нажмите <strong>"Сохранить"</strong></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('telegram-settings-form').addEventListener('submit', saveTelegramSettings);
    document.getElementById('password-change-form').addEventListener('submit', changePassword);

    // Загружаем статус режима техработ и LTI для админа
    if (adminState.user?.role === 'admin') {
        loadMaintenanceStatus();
        loadLtiSettings();
    }
}

// getInitials определена в utils.js

// Состояние редактора аватарки
let avatarEditorState = {
    image: null,
    scale: 1,
    minScale: 0.5,
    maxScale: 3,
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0
};

// Модальное окно загрузки аватарки
function showAvatarModal() {
    // Сбрасываем состояние
    avatarEditorState = {
        image: null, scale: 1, minScale: 0.5, maxScale: 3,
        offsetX: 0, offsetY: 0, isDragging: false, dragStartX: 0, dragStartY: 0
    };

    const overlay = document.createElement('div');
    overlay.className = 'system-modal-overlay';
    overlay.id = 'avatar-modal-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) closeAvatarModal(); };
    overlay.innerHTML = `
        <div class="system-modal photo-modal-modern" style="max-width: 480px;">
            <div class="system-modal-header" style="flex-direction: row; padding: 20px 24px;">
                <span class="system-modal-icon info" style="width: 48px; height: 48px; font-size: 1.3rem;">🖼️</span>
                <div style="flex: 1; text-align: left; margin-left: 16px;">
                    <h3 class="system-modal-title" style="margin: 0;">Изменить аватарку</h3>
                    <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: var(--text-light);">Загрузите фото или сделайте снимок</p>
                </div>
                <button class="btn-close" onclick="closeAvatarModal()" style="position: relative; right: auto; top: auto; transform: none;">&times;</button>
            </div>
            <div class="system-modal-body" style="padding: 0 24px 24px;">
                <div class="photo-actions-modern photo-upload-options" id="avatar-upload-options" style="margin-bottom: 20px;">
                    <label class="photo-action-btn">
                        <span class="photo-action-icon">📁</span>
                        <span class="photo-action-text">Загрузить файл</span>
                        <input type="file" id="avatar-file-input" accept=".jpg,.jpeg,.png,.gif,.webp" class="hidden" onchange="handleAvatarFile(event)">
                    </label>
                    <button class="photo-action-btn" type="button" onclick="startAvatarWebcam()">
                        <span class="photo-action-icon">📸</span>
                        <span class="photo-action-text">Камера</span>
                    </button>
                </div>

                <div id="avatar-webcam-container" class="hidden">
                    <video id="avatar-webcam-video" autoplay playsinline style="width: 100%; max-height: 300px; border-radius: 12px; border: 2px solid var(--border);"></video>
                    <div class="webcam-controls" style="margin-top: 12px; display: flex; gap: 10px; justify-content: center;">
                        <button class="btn btn-primary" type="button" onclick="captureAvatarPhoto()">📸 Снять</button>
                        <button class="btn btn-secondary" type="button" onclick="stopAvatarWebcam()">Отмена</button>
                    </div>
                </div>

                <div id="avatar-editor-container" class="hidden">
                    <div class="avatar-crop-area" id="avatar-crop-area">
                        <canvas id="avatar-editor-canvas" width="280" height="280"></canvas>
                        <div class="avatar-crop-circle"></div>
                    </div>
                    <div class="avatar-zoom-controls">
                        <span class="zoom-icon">🔍−</span>
                        <input type="range" id="avatar-zoom-slider" min="50" max="300" value="100" oninput="updateAvatarZoom(this.value)">
                        <span class="zoom-icon">🔍+</span>
                    </div>
                    <p class="avatar-hint">Перетащите изображение для позиционирования</p>
                </div>
            </div>
            <div class="system-modal-footer hidden" id="avatar-modal-footer" style="padding: 16px 24px; border-top: 1px solid var(--border);">
                <button class="btn btn-secondary" type="button" onclick="resetAvatarModal()">Отмена</button>
                <button class="btn btn-primary" type="button" onclick="saveAvatar()">Сохранить</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function closeAvatarModal() {
    stopAvatarWebcam();
    const overlay = document.getElementById('avatar-modal-overlay');
    if (overlay) overlay.remove();
}

// avatarImageData, avatarStream определены в state.js

function selectAvatarFile() {
    document.getElementById('avatar-file-input').click();
}

function handleAvatarFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            avatarEditorState.image = img;

            // Вычисляем начальный масштаб чтобы изображение заполнило круг
            const canvasSize = 280;
            const minDim = Math.min(img.width, img.height);
            avatarEditorState.scale = canvasSize / minDim;
            avatarEditorState.minScale = avatarEditorState.scale * 0.5;
            avatarEditorState.maxScale = avatarEditorState.scale * 3;
            avatarEditorState.offsetX = 0;
            avatarEditorState.offsetY = 0;

            // Обновляем слайдер
            const slider = document.getElementById('avatar-zoom-slider');
            if (slider) {
                slider.min = Math.round(avatarEditorState.minScale * 100);
                slider.max = Math.round(avatarEditorState.maxScale * 100);
                slider.value = Math.round(avatarEditorState.scale * 100);
            }

            // Показываем редактор
            const editorContainer = document.getElementById('avatar-editor-container');
            const modalFooter = document.getElementById('avatar-modal-footer');
            const uploadOptions = document.getElementById('avatar-upload-options');

            if (editorContainer) editorContainer.classList.remove('hidden');
            if (modalFooter) modalFooter.classList.remove('hidden');
            if (uploadOptions) uploadOptions.classList.add('hidden');

            // Инициализируем canvas
            initAvatarEditor();
            renderAvatarCanvas();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Инициализация редактора (drag события)
function initAvatarEditor() {
    const canvas = document.getElementById('avatar-editor-canvas');
    if (!canvas) return;

    // Mouse events
    canvas.onmousedown = (e) => {
        avatarEditorState.isDragging = true;
        avatarEditorState.dragStartX = e.clientX - avatarEditorState.offsetX;
        avatarEditorState.dragStartY = e.clientY - avatarEditorState.offsetY;
        canvas.style.cursor = 'grabbing';
    };

    canvas.onmousemove = (e) => {
        if (!avatarEditorState.isDragging) return;
        avatarEditorState.offsetX = e.clientX - avatarEditorState.dragStartX;
        avatarEditorState.offsetY = e.clientY - avatarEditorState.dragStartY;
        renderAvatarCanvas();
    };

    canvas.onmouseup = () => {
        avatarEditorState.isDragging = false;
        canvas.style.cursor = 'grab';
    };

    canvas.onmouseleave = () => {
        avatarEditorState.isDragging = false;
        canvas.style.cursor = 'grab';
    };

    // Touch events
    canvas.ontouchstart = (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        avatarEditorState.isDragging = true;
        avatarEditorState.dragStartX = touch.clientX - avatarEditorState.offsetX;
        avatarEditorState.dragStartY = touch.clientY - avatarEditorState.offsetY;
    };

    canvas.ontouchmove = (e) => {
        e.preventDefault();
        if (!avatarEditorState.isDragging) return;
        const touch = e.touches[0];
        avatarEditorState.offsetX = touch.clientX - avatarEditorState.dragStartX;
        avatarEditorState.offsetY = touch.clientY - avatarEditorState.dragStartY;
        renderAvatarCanvas();
    };

    canvas.ontouchend = () => {
        avatarEditorState.isDragging = false;
    };

    canvas.style.cursor = 'grab';
}

// Отрисовка canvas
function renderAvatarCanvas() {
    const canvas = document.getElementById('avatar-editor-canvas');
    const ctx = canvas.getContext('2d');
    const img = avatarEditorState.image;

    if (!canvas || !ctx || !img) return;

    const canvasSize = 280;

    // Очищаем
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    // Рисуем изображение с учётом масштаба и смещения
    const scale = avatarEditorState.scale;
    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;
    const drawX = (canvasSize - drawWidth) / 2 + avatarEditorState.offsetX;
    const drawY = (canvasSize - drawHeight) / 2 + avatarEditorState.offsetY;

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
}

// Обновление зума
function updateAvatarZoom(value) {
    avatarEditorState.scale = value / 100;
    renderAvatarCanvas();
}

function startAvatarWebcam() {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        .then(stream => {
            avatarStream = stream;
            const video = document.getElementById('avatar-webcam-video');
            video.srcObject = stream;

            const webcamContainer = document.getElementById('avatar-webcam-container');
            const uploadOptions = document.getElementById('avatar-upload-options');

            if (webcamContainer) webcamContainer.classList.remove('hidden');
            if (uploadOptions) uploadOptions.classList.add('hidden');
        })
        .catch(err => {
            showError('Не удалось получить доступ к камере');
            console.error(err);
        });
}

function stopAvatarWebcam() {
    if (avatarStream) {
        avatarStream.getTracks().forEach(track => track.stop());
        avatarStream = null;
    }

    const webcamContainer = document.getElementById('avatar-webcam-container');
    const uploadOptions = document.getElementById('avatar-upload-options');

    if (webcamContainer) webcamContainer.classList.add('hidden');
    if (uploadOptions) uploadOptions.classList.remove('hidden');
}

function captureAvatarPhoto() {
    const video = document.getElementById('avatar-webcam-video');

    // Создаём временное изображение из видео
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(video, 0, 0);

    const img = new Image();
    img.onload = () => {
        avatarEditorState.image = img;

        // Вычисляем начальный масштаб
        const canvasSize = 280;
        const minDim = Math.min(img.width, img.height);
        avatarEditorState.scale = canvasSize / minDim;
        avatarEditorState.minScale = avatarEditorState.scale * 0.5;
        avatarEditorState.maxScale = avatarEditorState.scale * 3;
        avatarEditorState.offsetX = 0;
        avatarEditorState.offsetY = 0;

        // Обновляем слайдер
        const slider = document.getElementById('avatar-zoom-slider');
        if (slider) {
            slider.min = Math.round(avatarEditorState.minScale * 100);
            slider.max = Math.round(avatarEditorState.maxScale * 100);
            slider.value = Math.round(avatarEditorState.scale * 100);
        }

        stopAvatarWebcam();

        // Показываем редактор
        const editorContainer = document.getElementById('avatar-editor-container');
        const modalFooter = document.getElementById('avatar-modal-footer');

        if (editorContainer) editorContainer.classList.remove('hidden');
        if (modalFooter) modalFooter.classList.remove('hidden');

        initAvatarEditor();
        renderAvatarCanvas();
    };
    img.src = tempCanvas.toDataURL('image/jpeg', 0.9);
}

function resetAvatarModal() {
    avatarImageData = null;
    avatarEditorState.image = null;
    stopAvatarWebcam();

    const editorContainer = document.getElementById('avatar-editor-container');
    const modalFooter = document.getElementById('avatar-modal-footer');
    const uploadOptions = document.getElementById('avatar-upload-options');

    if (editorContainer) editorContainer.classList.add('hidden');
    if (modalFooter) modalFooter.classList.add('hidden');
    if (uploadOptions) uploadOptions.classList.remove('hidden');
}

// Генерация финального изображения из редактора
function generateAvatarFromEditor() {
    const img = avatarEditorState.image;
    if (!img) return null;

    const outputSize = 200;
    const canvasSize = 280;

    // Создаём выходной canvas
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = outputSize;
    outputCanvas.height = outputSize;
    const ctx = outputCanvas.getContext('2d');

    // Вычисляем какая часть изображения попадает в круг
    const scale = avatarEditorState.scale;
    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;
    const drawX = (canvasSize - drawWidth) / 2 + avatarEditorState.offsetX;
    const drawY = (canvasSize - drawHeight) / 2 + avatarEditorState.offsetY;

    // Масштабируем к выходному размеру
    const ratio = outputSize / canvasSize;
    ctx.drawImage(img, drawX * ratio, drawY * ratio, drawWidth * ratio, drawHeight * ratio);

    return outputCanvas.toDataURL('image/jpeg', 0.85);
}

async function saveAvatar() {
    if (!avatarEditorState.image) {
        showError('Нет изображения для сохранения');
        return;
    }

    avatarImageData = generateAvatarFromEditor();

    // Сохраняем через API профиля
    const result = await apiRequest('/auth/profile', 'PUT', {
        avatarUrl: avatarImageData
    });

    if (result.success) {
        adminState.user.avatarUrl = avatarImageData;
        localStorage.setItem('admin_user', JSON.stringify(adminState.user));
        closeAvatarModal();
        renderProfileTab();
        showSuccess('Аватарка сохранена!');
    } else {
        showError(result.error || 'Ошибка сохранения аватарки');
    }
}

async function saveTelegramSettings(e) {
    e.preventDefault();

    const token = document.getElementById('telegram-token').value.trim();
    const chatId = document.getElementById('telegram-chat-id').value.trim();
    const enabled = document.getElementById('telegram-enabled').checked;

    // Используем /auth/profile для сохранения своего профиля (не требует admin)
    const result = await apiRequest('/auth/profile', 'PUT', {
        telegramToken: token,
        telegramChatId: chatId,
        telegramEnabled: enabled
    });

    if (result.success) {
        adminState.user.telegramToken = token;
        adminState.user.telegramChatId = chatId;
        adminState.user.telegramEnabled = enabled;
        localStorage.setItem('admin_user', JSON.stringify(adminState.user));
        await showSuccess('Настройки Telegram сохранены!');
    } else {
        await showError(result.error || 'Ошибка сохранения настроек');
    }
}

async function changePassword(e) {
    e.preventDefault();

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword !== confirmPassword) {
        await showError('Пароли не совпадают!');
        return;
    }

    if (newPassword.length < 6) {
        await showError('Новый пароль должен быть минимум 6 символов');
        return;
    }

    const result = await apiRequest('/auth/change-password', 'POST', {
        currentPassword,
        newPassword
    });

    if (result.success) {
        await showSuccess('Пароль успешно изменён!');
        document.getElementById('password-change-form').reset();
    } else {
        await showError(result.error || 'Ошибка изменения пароля');
    }
}

async function testTelegram() {
    const token = document.getElementById('telegram-token').value.trim();
    const chatId = document.getElementById('telegram-chat-id').value.trim();

    if (!token || !chatId) {
        await showError('Введите токен и Chat ID');
        return;
    }

    try {
        const message = `✅ Тестовое сообщение!\n\nВаш бот успешно подключен к системе тестирования.\n\nВремя: ${new Date().toLocaleString('ru-RU')}`;

        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            })
        });

        const data = await response.json();

        if (data.ok) {
            await showSuccess('Сообщение отправлено! Проверьте Telegram.');
        } else {
            await showError('Ошибка: ' + (data.description || 'Неизвестная ошибка'));
        }
    } catch (error) {
        await showError('Ошибка подключения: ' + error.message);
    }
}

// ============================================
// РЕЖИМ ТЕХНИЧЕСКИХ РАБОТ (UI)
// ============================================

// LTI Settings
async function loadLtiSettings() {
    try {
        const result = await apiRequest('/lti/settings', 'GET');
        if (result.success) {
            document.getElementById('lti-consumer-key').value = result.settings.consumerKey || '';
            document.getElementById('lti-consumer-secret').placeholder = result.settings.consumerSecret ? 'Настроен (скрыт)' : 'Секрет из Moodle';
            document.getElementById('lti-enabled').checked = result.settings.enabled || false;
        }
    } catch (e) { console.log('LTI settings not available'); }
}

async function saveLtiSettings() {
    const data = {
        consumerKey: document.getElementById('lti-consumer-key').value.trim(),
        consumerSecret: document.getElementById('lti-consumer-secret').value.trim() || '***',
        enabled: document.getElementById('lti-enabled').checked
    };
    const result = await apiRequest('/lti/settings', 'PUT', data);
    if (result.success) {
        await showSuccess('Настройки LTI сохранены!');
    } else {
        showNotification(result.error || 'Ошибка', 'error');
    }
}

// Загрузить статус режима техработ
async function loadMaintenanceStatus() {
    const statusEl = document.getElementById('maintenance-status');
    const messageInput = document.getElementById('maintenance-message');
    const toggleBtn = document.getElementById('maintenance-toggle-btn');

    if (!statusEl || !toggleBtn) return;

    try {
        const res = await fetch('api/maintenance', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
            }
        });
        const data = await res.json();

        if (data.enabled) {
            statusEl.innerHTML = `
                <span class="maintenance-indicator active"></span>
                <span class="maintenance-status-text">Режим техработ <b>ВКЛЮЧЁН</b></span>
            `;
            toggleBtn.textContent = 'Выключить режим техработ';
            toggleBtn.classList.remove('btn-warning');
            toggleBtn.classList.add('btn-success');
            if (messageInput && data.message) {
                messageInput.value = data.message;
            }
        } else {
            statusEl.innerHTML = `
                <span class="maintenance-indicator"></span>
                <span class="maintenance-status-text">Система работает в штатном режиме</span>
            `;
            toggleBtn.textContent = 'Включить режим техработ';
            toggleBtn.classList.remove('btn-success');
            toggleBtn.classList.add('btn-warning');
        }
    } catch (e) {
        statusEl.innerHTML = `
            <span class="maintenance-indicator error"></span>
            <span class="maintenance-status-text">Не удалось получить статус</span>
        `;
    }
}

// Переключить режим техработ (UI)
async function toggleMaintenanceModeUI() {
    const toggleBtn = document.getElementById('maintenance-toggle-btn');
    const messageInput = document.getElementById('maintenance-message');
    const message = messageInput?.value.trim() || 'Ведутся технические работы. Пожалуйста, подождите.';

    // Определяем текущее состояние по кнопке
    const isCurrentlyEnabled = toggleBtn.classList.contains('btn-success');
    const newEnabled = !isCurrentlyEnabled;

    toggleBtn.disabled = true;
    toggleBtn.textContent = 'Сохранение...';

    try {
        const result = await toggleMaintenanceMode(newEnabled, message);

        if (result.success) {
            await loadMaintenanceStatus();
            showNotification(
                newEnabled ? 'Режим технических работ включён' : 'Режим технических работ выключен',
                'success'
            );
        } else {
            showNotification(result.error || 'Ошибка переключения режима', 'error');
            await loadMaintenanceStatus();
        }
    } catch (e) {
        showNotification('Ошибка: ' + e.message, 'error');
        await loadMaintenanceStatus();
    }

    toggleBtn.disabled = false;
}

// ============================================
// МАССОВАЯ НАСТРОЙКА ТЕСТОВ
// ============================================

async function runBulkTestSetup() {
    const confirmed = await showConfirm(
        'Вы уверены?\n\nЭто действие:\n• Включит "Скрыть результаты" для ВСЕХ тестов\n• Зачислит студентов из привязанных групп в срезы/зачёты\n\nПродолжить?',
        'Массовая настройка тестов'
    );

    if (!confirmed) return;

    showNotification('Выполняется настройка... Пожалуйста, подождите.', 'info');

    try {
        const result = await apiRequest('/tests/bulk-setup', 'POST');

        if (result.success) {
            await showSuccess(result.message || 'Настройка выполнена успешно!');
            // Перезагружаем данные
            await loadAllData();
        } else {
            await showError(result.error || 'Ошибка выполнения');
        }
    } catch (error) {
        console.error('Ошибка массовой настройки:', error);
        await showError('Ошибка: ' + error.message);
    }
}

// ============================================
// ЭКСПОРТ ВОПРОСОВ В GIFT ФОРМАТ
// ============================================

