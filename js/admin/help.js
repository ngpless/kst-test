// ============================================
// СПРАВКА - НОВЫЙ ДИЗАЙН
// ============================================

function showHelpModal() {
    let helpModal = document.getElementById('help-modal');
    if (!helpModal) {
        helpModal = document.createElement('div');
        helpModal.id = 'help-modal';
        helpModal.className = 'modal';
        document.body.appendChild(helpModal);
    }

    helpModal.innerHTML = `
        <div class="modal-content help-modal-new">
            <button class="help-close-btn" onclick="hideHelpModal()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            </button>

            <div class="help-layout">
                <!-- Боковая навигация -->
                <aside class="help-sidebar">
                    <div class="help-logo">
                        <div class="help-logo-icon">?</div>
                        <span>Справка</span>
                    </div>

                    <nav class="help-nav">
                        <div class="help-nav-group">
                            <div class="help-nav-label">Быстрый старт</div>
                            <a href="#" class="help-nav-item active" data-section="welcome">
                                <span class="nav-icon">🏠</span>
                                <span>Добро пожаловать</span>
                            </a>
                            <a href="#" class="help-nav-item" data-section="first-steps">
                                <span class="nav-icon">🚀</span>
                                <span>Первые шаги</span>
                            </a>
                        </div>

                        <div class="help-nav-group">
                            <div class="help-nav-label">Интерфейс</div>
                            <a href="#" class="help-nav-item" data-section="header">
                                <span class="nav-icon">📌</span>
                                <span>Шапка и меню</span>
                            </a>
                            <a href="#" class="help-nav-item" data-section="tabs">
                                <span class="nav-icon">📑</span>
                                <span>Вкладки</span>
                            </a>
                            <a href="#" class="help-nav-item" data-section="cards">
                                <span class="nav-icon">🃏</span>
                                <span>Карточки</span>
                            </a>
                        </div>

                        <div class="help-nav-group">
                            <div class="help-nav-label">Работа с тестами</div>
                            <a href="#" class="help-nav-item" data-section="disciplines">
                                <span class="nav-icon">📚</span>
                                <span>Дисциплины</span>
                            </a>
                            <a href="#" class="help-nav-item" data-section="topics">
                                <span class="nav-icon">📂</span>
                                <span>Темы</span>
                            </a>
                            <a href="#" class="help-nav-item" data-section="tests">
                                <span class="nav-icon">📝</span>
                                <span>Тесты</span>
                            </a>
                            <a href="#" class="help-nav-item" data-section="questions">
                                <span class="nav-icon">❓</span>
                                <span>Вопросы</span>
                            </a>
                            <a href="#" class="help-nav-item" data-section="gift">
                                <span class="nav-icon">📥</span>
                                <span>Импорт GIFT</span>
                            </a>
                        </div>

                        <div class="help-nav-group">
                            <div class="help-nav-label">Проведение</div>
                            <a href="#" class="help-nav-item" data-section="access">
                                <span class="nav-icon">🔗</span>
                                <span>Ссылка студентам</span>
                            </a>
                            <a href="#" class="help-nav-item" data-section="training">
                                <span class="nav-icon">🎯</span>
                                <span>Тренировка</span>
                            </a>
                            <a href="#" class="help-nav-item" data-section="exam">
                                <span class="nav-icon">🎓</span>
                                <span>Зачёт</span>
                            </a>
                            <a href="#" class="help-nav-item" data-section="srez">
                                <span class="nav-icon">📊</span>
                                <span>Срез</span>
                            </a>
                        </div>

                        <div class="help-nav-group">
                            <div class="help-nav-label">Дополнительно</div>
                            <a href="#" class="help-nav-item" data-section="groups">
                                <span class="nav-icon">👥</span>
                                <span>Группы</span>
                            </a>
                            <a href="#" class="help-nav-item" data-section="results">
                                <span class="nav-icon">📋</span>
                                <span>Результаты</span>
                            </a>
                            <a href="#" class="help-nav-item" data-section="export">
                                <span class="nav-icon">💾</span>
                                <span>Экспорт</span>
                            </a>
                            <a href="#" class="help-nav-item" data-section="anticheat">
                                <span class="nav-icon">🛡️</span>
                                <span>Антисписывание</span>
                            </a>
                        </div>

                        <div class="help-nav-group">
                            <div class="help-nav-label">Для студентов</div>
                            <a href="#" class="help-nav-item" data-section="student-start">
                                <span class="nav-icon">🎒</span>
                                <span>Как начать тест</span>
                            </a>
                            <a href="#" class="help-nav-item" data-section="student-interface">
                                <span class="nav-icon">🖥️</span>
                                <span>Интерфейс теста</span>
                            </a>
                        </div>
                    </nav>
                </aside>

                <!-- Основной контент -->
                <main class="help-main">
                    <div class="help-content" id="help-content">
                        <!-- Контент загружается динамически -->
                    </div>
                </main>
            </div>
        </div>
    `;

    helpModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Инициализация навигации
    initHelpNavigation();

    // Показать первый раздел
    showHelpSection('welcome');
}

function hideHelpModal() {
    const helpModal = document.getElementById('help-modal');
    if (helpModal) {
        helpModal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function initHelpNavigation() {
    document.querySelectorAll('.help-nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;

            // Убираем активный класс у всех
            document.querySelectorAll('.help-nav-item').forEach(i => i.classList.remove('active'));
            // Добавляем активный класс текущему
            item.classList.add('active');

            // Показываем секцию
            showHelpSection(section);
        });
    });
}

function showHelpSection(sectionId) {
    const content = document.getElementById('help-content');
    const sections = getHelpSections();

    if (sections[sectionId]) {
        content.innerHTML = sections[sectionId];
        content.scrollTop = 0;
    }
}

function getHelpSections() {
    return {
        // ==========================================
        // ДОБРО ПОЖАЛОВАТЬ
        // ==========================================
        'welcome': `
            <div class="help-section">
                <div class="help-hero">
                    <div class="help-hero-icon">👋</div>
                    <h1>Добро пожаловать!</h1>
                    <p class="help-hero-text">Это система онлайн-тестирования. Здесь вы можете создавать тесты, проводить зачёты и следить за успеваемостью студентов.</p>
                </div>

                <div class="help-features">
                    <div class="help-feature">
                        <div class="help-feature-icon">📝</div>
                        <h3>Создавайте тесты</h3>
                        <p>Разные типы вопросов: выбор ответа, сопоставление, ввод текста, расстановка по порядку</p>
                    </div>
                    <div class="help-feature">
                        <div class="help-feature-icon">🎓</div>
                        <h3>Проводите зачёты</h3>
                        <p>Каждому студенту выдаётся персональный код. Никто не зайдёт под чужим именем</p>
                    </div>
                    <div class="help-feature">
                        <div class="help-feature-icon">🛡️</div>
                        <h3>Защита от списывания</h3>
                        <p>Система видит, когда студент переключается на другие вкладки или приложения</p>
                    </div>
                    <div class="help-feature">
                        <div class="help-feature-icon">📊</div>
                        <h3>Смотрите статистику</h3>
                        <p>Кто прошёл, какие оценки, какие вопросы самые сложные — всё как на ладони</p>
                    </div>
                </div>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Совет для начинающих</strong>
                        <p>Начните с раздела «Первые шаги» в меню слева. Там пошаговая инструкция как создать ваш первый тест за 5 минут.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ПЕРВЫЕ ШАГИ
        // ==========================================
        'first-steps': `
            <div class="help-section">
                <h1>🚀 Первые шаги</h1>
                <p class="help-subtitle">Создайте свой первый тест за 5 минут. Следуйте этим простым шагам.</p>

                <div class="help-steps">
                    <div class="help-step">
                        <div class="help-step-num">1</div>
                        <div class="help-step-content">
                            <h3>Создайте дисциплину</h3>
                            <p>Дисциплина — это ваш предмет. Например: «Математика», «История», «Программирование».</p>
                            <div class="help-action">
                                <span class="help-action-label">Где это:</span>
                                <span class="help-action-path">Вкладка «Дисциплины» → кнопка «+ Создать дисциплину»</span>
                            </div>
                        </div>
                    </div>

                    <div class="help-step">
                        <div class="help-step-num">2</div>
                        <div class="help-step-content">
                            <h3>Создайте тему</h3>
                            <p>Тема — это раздел внутри дисциплины. Например: «Глава 1», «Введение», «Линейные уравнения».</p>
                            <div class="help-action">
                                <span class="help-action-label">Где это:</span>
                                <span class="help-action-path">Нажмите на дисциплину → кнопка «+ Создать тему»</span>
                            </div>
                        </div>
                    </div>

                    <div class="help-step">
                        <div class="help-step-num">3</div>
                        <div class="help-step-content">
                            <h3>Создайте тест</h3>
                            <p>Укажите название теста, время на прохождение и другие настройки.</p>
                            <div class="help-action">
                                <span class="help-action-label">Где это:</span>
                                <span class="help-action-path">Нажмите на тему → кнопка «+ Создать тест»</span>
                            </div>
                        </div>
                    </div>

                    <div class="help-step">
                        <div class="help-step-num">4</div>
                        <div class="help-step-content">
                            <h3>Добавьте вопросы</h3>
                            <p>Напечатайте вопросы вручную или загрузите готовые из файла GIFT.</p>
                            <div class="help-action">
                                <span class="help-action-label">Где это:</span>
                                <span class="help-action-path">На карточке теста → кнопка «Вопросы»</span>
                            </div>
                        </div>
                    </div>

                    <div class="help-step">
                        <div class="help-step-num">5</div>
                        <div class="help-step-content">
                            <h3>Раздайте ссылку</h3>
                            <p>Скопируйте ссылку на тест и отправьте студентам. Они смогут пройти тест в браузере.</p>
                            <div class="help-action">
                                <span class="help-action-label">Где это:</span>
                                <span class="help-action-path">На карточке теста → кнопка «Доступ»</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="help-note-box">
                    <div class="help-note-icon">📝</div>
                    <div class="help-note-content">
                        <strong>Структура такая:</strong>
                        <div class="help-structure">
                            <div class="help-structure-item level-1">
                                <span class="structure-icon">📚</span>
                                <span>Дисциплина (предмет)</span>
                            </div>
                            <div class="help-structure-item level-2">
                                <span class="structure-icon">📂</span>
                                <span>Тема (раздел)</span>
                            </div>
                            <div class="help-structure-item level-3">
                                <span class="structure-icon">📝</span>
                                <span>Тест</span>
                            </div>
                            <div class="help-structure-item level-4">
                                <span class="structure-icon">❓</span>
                                <span>Вопросы</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ШАПКА И МЕНЮ
        // ==========================================
        'header': `
            <div class="help-section">
                <h1>📌 Шапка и меню</h1>
                <p class="help-subtitle">Наведите на элементы чтобы узнать что они делают</p>

                <div class="interactive-demo-container">
                    <div class="interactive-header-wrapper">
                        <div class="real-header">
                            <div class="real-header-left">
                                <div class="interactive-element" data-tooltip-pos="bottom">
                                    <div class="real-logo">🎓</div>
                                    <div class="interactive-tooltip">
                                        <div class="tooltip-content">
                                            <span class="tooltip-icon">🏠</span>
                                            <strong>Логотип</strong>
                                            <p>Нажмите чтобы вернуться к списку дисциплин</p>
                                        </div>
                                        <div class="tooltip-arrow"></div>
                                    </div>
                                    <div class="interactive-pulse"></div>
                                </div>
                                <div class="interactive-element" data-tooltip-pos="bottom">
                                    <div class="real-header-text">
                                        <span class="real-header-title">Панель управления</span>
                                        <span class="real-header-subtitle">Добро пожаловать, Иван Иванович</span>
                                    </div>
                                    <div class="interactive-tooltip">
                                        <div class="tooltip-content">
                                            <span class="tooltip-icon">👤</span>
                                            <strong>Ваш профиль</strong>
                                            <p>Показывает имя авторизованного пользователя</p>
                                        </div>
                                        <div class="tooltip-arrow"></div>
                                    </div>
                                </div>
                            </div>
                            <div class="real-header-right">
                                <div class="interactive-element" data-tooltip-pos="bottom">
                                    <div class="real-theme-toggle">
                                        <div class="real-theme-circle"></div>
                                    </div>
                                    <div class="interactive-tooltip">
                                        <div class="tooltip-content">
                                            <span class="tooltip-icon">🌙</span>
                                            <strong>Тема оформления</strong>
                                            <p>Переключить светлую / тёмную тему</p>
                                        </div>
                                        <div class="tooltip-arrow"></div>
                                    </div>
                                    <div class="interactive-pulse"></div>
                                </div>
                                <div class="interactive-element" data-tooltip-pos="bottom">
                                    <button class="real-help-btn">?</button>
                                    <div class="interactive-tooltip">
                                        <div class="tooltip-content">
                                            <span class="tooltip-icon">📖</span>
                                            <strong>Справка</strong>
                                            <p>Открыть это руководство</p>
                                        </div>
                                        <div class="tooltip-arrow"></div>
                                    </div>
                                    <div class="interactive-pulse"></div>
                                </div>
                                <div class="interactive-element" data-tooltip-pos="bottom">
                                    <button class="real-logout-btn">Выйти</button>
                                    <div class="interactive-tooltip">
                                        <div class="tooltip-content">
                                            <span class="tooltip-icon">🚪</span>
                                            <strong>Выход</strong>
                                            <p>Завершить сеанс работы</p>
                                        </div>
                                        <div class="tooltip-arrow"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="interactive-hint">
                        <div class="hint-pulse"></div>
                        <span class="hint-icon">👆</span>
                        <span class="hint-text">Наведите курсор на элементы</span>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ВКЛАДКИ
        // ==========================================
        'tabs': `
            <div class="help-section">
                <h1>📑 Вкладки</h1>
                <p class="help-subtitle">Наведите на вкладку чтобы узнать что она содержит</p>

                <div class="interactive-demo-container">
                    <div class="interactive-tabs-wrapper">
                        <div class="interactive-element" data-tab="disciplines">
                            <button class="real-tab active">Дисциплины</button>
                            <div class="interactive-tooltip tooltip-large">
                                <div class="tooltip-content">
                                    <span class="tooltip-icon">📚</span>
                                    <strong>Дисциплины</strong>
                                    <p>Главная вкладка. Создание и редактирование тестов</p>
                                    <span class="tooltip-tag">Основная работа</span>
                                </div>
                                <div class="tooltip-arrow"></div>
                            </div>
                            <div class="interactive-pulse"></div>
                        </div>
                        <div class="interactive-element" data-tab="results">
                            <button class="real-tab">Результаты</button>
                            <div class="interactive-tooltip tooltip-large">
                                <div class="tooltip-content">
                                    <span class="tooltip-icon">📋</span>
                                    <strong>Результаты</strong>
                                    <p>Просмотр оценок студентов и фильтрация</p>
                                    <span class="tooltip-tag">Просмотр оценок</span>
                                </div>
                                <div class="tooltip-arrow"></div>
                            </div>
                        </div>
                        <div class="interactive-element" data-tab="analytics">
                            <button class="real-tab">📊 Аналитика</button>
                            <div class="interactive-tooltip tooltip-large">
                                <div class="tooltip-content">
                                    <span class="tooltip-icon">📊</span>
                                    <strong>Аналитика</strong>
                                    <p>Графики, статистика, сложные вопросы</p>
                                    <span class="tooltip-tag">Статистика</span>
                                </div>
                                <div class="tooltip-arrow"></div>
                            </div>
                        </div>
                        <div class="interactive-element" data-tab="groups">
                            <button class="real-tab">Группы</button>
                            <div class="interactive-tooltip tooltip-large">
                                <div class="tooltip-content">
                                    <span class="tooltip-icon">👥</span>
                                    <strong>Группы</strong>
                                    <p>Списки студентов для зачётов</p>
                                    <span class="tooltip-tag">Списки студентов</span>
                                </div>
                                <div class="tooltip-arrow"></div>
                            </div>
                        </div>
                        <div class="interactive-element" data-tab="profile">
                            <button class="real-tab">Личный кабинет</button>
                            <div class="interactive-tooltip tooltip-large">
                                <div class="tooltip-content">
                                    <span class="tooltip-icon">👤</span>
                                    <strong>Личный кабинет</strong>
                                    <p>Настройки профиля, смена пароля</p>
                                    <span class="tooltip-tag">Ваш профиль</span>
                                </div>
                                <div class="tooltip-arrow"></div>
                            </div>
                        </div>
                    </div>
                    <div class="interactive-hint">
                        <div class="hint-pulse"></div>
                        <span class="hint-icon">👆</span>
                        <span class="hint-text">Наведите на вкладки</span>
                    </div>
                </div>

                <h2 style="margin-top: 32px;">Подробнее о каждой вкладке</h2>

                <div class="help-tabs-explain">
                    <div class="help-tab-card interactive-card">
                        <div class="tab-card-icon">📚</div>
                        <div class="tab-card-content">
                            <h3>Дисциплины</h3>
                            <p>Главная вкладка. Здесь вы создаёте и редактируете всё: дисциплины, темы, тесты, вопросы. Отсюда же раздаёте ссылки студентам.</p>
                            <span class="tab-card-tag">Основная работа</span>
                        </div>
                        <div class="card-arrow">→</div>
                    </div>

                    <div class="help-tab-card interactive-card">
                        <div class="tab-card-icon">📋</div>
                        <div class="tab-card-content">
                            <h3>Результаты</h3>
                            <p>Все результаты тестов. Видно кто прошёл, когда, какая оценка, сколько правильных ответов. Можно фильтровать по группе, тесту, дате.</p>
                            <span class="tab-card-tag">Просмотр оценок</span>
                        </div>
                        <div class="card-arrow">→</div>
                    </div>

                    <div class="help-tab-card interactive-card">
                        <div class="tab-card-icon">📊</div>
                        <div class="tab-card-content">
                            <h3>Аналитика</h3>
                            <p>Статистика и графики. Средний балл по тесту, распределение оценок, самые сложные вопросы. Помогает понять что студенты не усвоили.</p>
                            <span class="tab-card-tag">Статистика</span>
                        </div>
                        <div class="card-arrow">→</div>
                    </div>

                    <div class="help-tab-card interactive-card">
                        <div class="tab-card-icon">👥</div>
                        <div class="tab-card-content">
                            <h3>Группы</h3>
                            <p>Списки студентов с фотографиями. Можно загружать списки из Excel. Нужны для зачётов — чтобы выдавать персональные коды.</p>
                            <span class="tab-card-tag">Списки студентов</span>
                        </div>
                        <div class="card-arrow">→</div>
                    </div>

                    <div class="help-tab-card">
                        <div class="tab-card-icon">👤</div>
                        <div class="tab-card-content">
                            <h3>Личный кабинет</h3>
                            <p>Ваш профиль. Можно сменить пароль, имя, загрузить фото. Также здесь настройки Telegram-уведомлений.</p>
                            <span class="tab-card-tag">Настройки профиля</span>
                        </div>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // КАРТОЧКИ
        // ==========================================
        'cards': `
            <div class="help-section">
                <h1>🃏 Карточки</h1>
                <p class="help-subtitle">Всё в системе показано карточками. Вот как их читать.</p>

                <h2>Карточка дисциплины</h2>
                <p class="help-text">Именно так выглядит карточка дисциплины на сайте:</p>

                <div class="help-ui-demo">
                    <div class="real-discipline-card">
                        <div class="real-discipline-card-inner">
                            <div class="real-discipline-header">
                                <h3>Информатика</h3>
                                <span class="real-discipline-group">КС-21</span>
                            </div>
                            <div class="real-discipline-stats">
                                <div class="real-stat-item">
                                    <span class="real-stat-value">5</span>
                                    <span class="real-stat-label">тем</span>
                                </div>
                                <div class="real-stat-item">
                                    <span class="real-stat-value">12</span>
                                    <span class="real-stat-label">тестов</span>
                                </div>
                                <div class="real-stat-item">
                                    <span class="real-stat-value">156</span>
                                    <span class="real-stat-label">вопросов</span>
                                </div>
                            </div>
                        </div>
                        <div class="real-discipline-actions">
                            <button class="real-btn-icon" title="Редактировать">✏️</button>
                            <button class="real-btn-icon" title="Удалить">🗑️</button>
                        </div>
                    </div>
                </div>

                <div class="help-explain-list">
                    <div class="help-explain-item">
                        <span class="explain-dot purple"></span>
                        <span><strong>Цветная полоса сверху</strong> — показывает что карточка активна</span>
                    </div>
                    <div class="help-explain-item">
                        <span class="explain-dot blue"></span>
                        <span><strong>Название</strong> — как называется ваш предмет</span>
                    </div>
                    <div class="help-explain-item">
                        <span class="explain-dot green"></span>
                        <span><strong>Группа</strong> — к какой группе привязана дисциплина</span>
                    </div>
                    <div class="help-explain-item">
                        <span class="explain-dot gray"></span>
                        <span><strong>Статистика внизу</strong> — сколько тем, тестов и вопросов внутри</span>
                    </div>
                </div>

                <h2>Карточка теста</h2>
                <p class="help-text">А вот так выглядит карточка теста:</p>

                <div class="help-ui-demo">
                    <div class="real-test-card">
                        <div class="real-test-header">
                            <h3 class="real-test-title">Тест по главе 1</h3>
                            <span class="real-test-badge">20 вопросов</span>
                        </div>
                        <div class="real-test-info">
                            <div class="real-test-param">
                                <span class="param-icon">⏱</span>
                                <span>30 минут</span>
                            </div>
                            <div class="real-test-param">
                                <span class="param-icon">🔀</span>
                                <span>Случайный порядок</span>
                            </div>
                            <div class="real-test-param">
                                <span class="param-icon">📊</span>
                                <span>Показывать результат</span>
                            </div>
                        </div>
                        <div class="real-test-actions">
                            <button class="real-btn real-btn-primary">Вопросы</button>
                            <button class="real-btn real-btn-secondary">Доступ</button>
                            <button class="real-btn real-btn-secondary">👁 Просмотр</button>
                        </div>
                    </div>
                </div>

                <div class="help-buttons-explain">
                    <h3>Кнопки на карточке теста:</h3>
                    <div class="help-btn-item">
                        <span class="btn-name primary">Вопросы</span>
                        <span class="btn-desc">Открыть список вопросов. Здесь добавляете, редактируете, удаляете вопросы.</span>
                    </div>
                    <div class="help-btn-item">
                        <span class="btn-name">Доступ</span>
                        <span class="btn-desc">Получить ссылку для студентов. Также здесь настраивается режим зачёта.</span>
                    </div>
                    <div class="help-btn-item">
                        <span class="btn-name">👁 Просмотр</span>
                        <span class="btn-desc">Посмотреть тест глазами студента. Полезно для проверки перед раздачей.</span>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ДИСЦИПЛИНЫ
        // ==========================================
        'disciplines': `
            <div class="help-section">
                <h1>📚 Дисциплины</h1>
                <p class="help-subtitle">Дисциплина — это ваш предмет. С неё всё начинается.</p>

                <h2>Как создать дисциплину</h2>
                <div class="help-steps-mini">
                    <div class="step-mini">
                        <span class="step-mini-num">1</span>
                        <span>Нажмите кнопку <strong>«+ Создать дисциплину»</strong> вверху страницы</span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">2</span>
                        <span>Введите название (например: «Информатика»)</span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">3</span>
                        <span>Нажмите <strong>«Сохранить»</strong></span>
                    </div>
                </div>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Совет</strong>
                        <p>Называйте дисциплины понятно. Если ведёте у разных групп — можно добавить год или семестр: «Математика 2024» или «Физика (1 семестр)».</p>
                    </div>
                </div>

                <h2>Что можно делать с дисциплиной</h2>
                <div class="help-actions-grid">
                    <div class="help-action-card">
                        <span class="action-icon">✏️</span>
                        <strong>Редактировать</strong>
                        <p>Изменить название</p>
                    </div>
                    <div class="help-action-card">
                        <span class="action-icon">🗑️</span>
                        <strong>Удалить</strong>
                        <p>Удалит вместе со всеми темами и тестами!</p>
                    </div>
                    <div class="help-action-card">
                        <span class="action-icon">📂</span>
                        <strong>Открыть</strong>
                        <p>Нажмите на карточку чтобы увидеть темы внутри</p>
                    </div>
                </div>

                <div class="help-warning-box">
                    <div class="help-warning-icon">⚠️</div>
                    <div class="help-warning-content">
                        <strong>Осторожно с удалением!</strong>
                        <p>При удалении дисциплины удалятся ВСЕ темы, тесты и вопросы внутри неё. Это действие нельзя отменить.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ТЕМЫ
        // ==========================================
        'topics': `
            <div class="help-section">
                <h1>📂 Темы</h1>
                <p class="help-subtitle">Тема — это раздел внутри дисциплины. Помогает организовать тесты по главам или разделам.</p>

                <h2>Как создать тему</h2>
                <div class="help-steps-mini">
                    <div class="step-mini">
                        <span class="step-mini-num">1</span>
                        <span>Откройте дисциплину (нажмите на её карточку)</span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">2</span>
                        <span>Нажмите кнопку <strong>«+ Создать тему»</strong></span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">3</span>
                        <span>Введите название темы</span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">4</span>
                        <span>Нажмите <strong>«Сохранить»</strong></span>
                    </div>
                </div>

                <h2>Примеры названий тем</h2>
                <div class="help-examples">
                    <div class="example-item">Глава 1. Введение</div>
                    <div class="example-item">Раздел 2. Линейные уравнения</div>
                    <div class="example-item">Тема 3. Циклы в программировании</div>
                    <div class="example-item">Контрольная работа №1</div>
                </div>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Удобная навигация</strong>
                        <p>В верхней части страницы есть «хлебные крошки» — они показывают где вы находитесь: Дисциплина → Тема. Нажмите на название чтобы вернуться назад.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ТЕСТЫ
        // ==========================================
        'tests': `
            <div class="help-section">
                <h1>📝 Тесты</h1>
                <p class="help-subtitle">Тест — это набор вопросов для студентов. Самая важная часть системы.</p>

                <h2>Как создать тест</h2>
                <div class="help-steps-mini">
                    <div class="step-mini">
                        <span class="step-mini-num">1</span>
                        <span>Откройте нужную тему</span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">2</span>
                        <span>Нажмите <strong>«+ Создать тест»</strong></span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">3</span>
                        <span>Заполните настройки (см. ниже)</span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">4</span>
                        <span>Нажмите <strong>«Сохранить»</strong></span>
                    </div>
                </div>

                <h2>Настройки теста</h2>
                <div class="help-settings-list">
                    <div class="help-setting">
                        <div class="setting-name">Название теста</div>
                        <div class="setting-desc">Как будет называться тест. Студенты увидят это название.</div>
                    </div>
                    <div class="help-setting">
                        <div class="setting-name">Время на прохождение</div>
                        <div class="setting-desc">Сколько минут даётся на тест. Когда время выйдет — тест автоматически завершится.</div>
                    </div>
                    <div class="help-setting">
                        <div class="setting-name">Количество вопросов</div>
                        <div class="setting-desc">Сколько вопросов показать студенту. Если у вас 50 вопросов, а вы укажете 20 — система выберет 20 случайных.</div>
                    </div>
                    <div class="help-setting">
                        <div class="setting-name">Случайный порядок</div>
                        <div class="setting-desc">Если включено — вопросы и варианты ответов будут перемешаны. Так сложнее списать у соседа.</div>
                    </div>
                    <div class="help-setting">
                        <div class="setting-name">Показывать результат</div>
                        <div class="setting-desc">Если включено — студент сразу увидит оценку после теста. Если выключено — узнает только от вас.</div>
                    </div>
                </div>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Кнопка «Просмотр»</strong>
                        <p>Позволяет пройти тест как студент. Используйте чтобы проверить всё ли правильно настроено перед раздачей ссылки.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ВОПРОСЫ
        // ==========================================
        'questions': `
            <div class="help-section">
                <h1>❓ Вопросы</h1>
                <p class="help-subtitle">Вопросы — сердце любого теста. Вот как с ними работать.</p>

                <h2>Как добавить вопрос</h2>
                <div class="help-steps-mini">
                    <div class="step-mini">
                        <span class="step-mini-num">1</span>
                        <span>На карточке теста нажмите <strong>«Вопросы»</strong></span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">2</span>
                        <span>Нажмите <strong>«+ Добавить вопрос»</strong></span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">3</span>
                        <span>Выберите тип вопроса</span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">4</span>
                        <span>Введите текст вопроса и варианты ответов</span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">5</span>
                        <span>Отметьте правильный ответ</span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">6</span>
                        <span>Нажмите <strong>«Сохранить»</strong></span>
                    </div>
                </div>

                <h2>Типы вопросов</h2>
                <div class="help-question-types">
                    <div class="qtype-card">
                        <div class="qtype-icon">🔘</div>
                        <div class="qtype-content">
                            <h3>Один правильный ответ</h3>
                            <p>Студент выбирает один вариант из нескольких. Самый популярный тип.</p>
                            <div class="qtype-example">
                                <div class="qtype-q">Сколько будет 2+2?</div>
                                <div class="qtype-answers">
                                    <label><input type="radio" disabled> 3</label>
                                    <label><input type="radio" checked disabled> 4</label>
                                    <label><input type="radio" disabled> 5</label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="qtype-card">
                        <div class="qtype-icon">☑️</div>
                        <div class="qtype-content">
                            <h3>Несколько правильных ответов</h3>
                            <p>Студент должен отметить все правильные варианты.</p>
                            <div class="qtype-example">
                                <div class="qtype-q">Какие числа чётные?</div>
                                <div class="qtype-answers">
                                    <label><input type="checkbox" checked disabled> 2</label>
                                    <label><input type="checkbox" disabled> 3</label>
                                    <label><input type="checkbox" checked disabled> 4</label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="qtype-card">
                        <div class="qtype-icon">✏️</div>
                        <div class="qtype-content">
                            <h3>Короткий ответ</h3>
                            <p>Студент печатает ответ. Можно задать несколько правильных вариантов (разные формулировки).</p>
                            <div class="qtype-example">
                                <div class="qtype-q">Столица России?</div>
                                <div class="qtype-input">
                                    <input type="text" placeholder="Введите ответ..." disabled>
                                </div>
                                <div class="qtype-hint">Правильные варианты: Москва, москва</div>
                            </div>
                        </div>
                    </div>

                    <div class="qtype-card">
                        <div class="qtype-icon">🔗</div>
                        <div class="qtype-content">
                            <h3>Сопоставление</h3>
                            <p>Студент соединяет элементы из левого столбца с элементами правого.</p>
                            <div class="qtype-example">
                                <div class="qtype-q">Соотнесите страны и столицы:</div>
                                <div class="qtype-matching">
                                    <span>Россия</span> ↔ <span>Москва</span>
                                    <span>Франция</span> ↔ <span>Париж</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="qtype-card">
                        <div class="qtype-icon">📋</div>
                        <div class="qtype-content">
                            <h3>Последовательность</h3>
                            <p>Студент расставляет элементы в правильном порядке перетаскиванием.</p>
                            <div class="qtype-example">
                                <div class="qtype-q">Расположите числа по возрастанию:</div>
                                <div class="qtype-sequence">
                                    <span>1</span> → <span>2</span> → <span>3</span> → <span>4</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Формулы LaTeX</strong>
                        <p>Можно вставлять математические формулы. Оберните формулу в \\( ... \\) для inline или \\[ ... \\] для отдельной строки. Пример: \\(x^2 + y^2 = z^2\\)</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ИМПОРТ GIFT
        // ==========================================
        'gift': `
            <div class="help-section">
                <h1>📥 Импорт из GIFT</h1>
                <p class="help-subtitle">GIFT — это текстовый формат для вопросов. Позволяет быстро загрузить много вопросов сразу.</p>

                <h2>Как импортировать</h2>
                <div class="help-steps-mini">
                    <div class="step-mini">
                        <span class="step-mini-num">1</span>
                        <span>Откройте вопросы теста (кнопка «Вопросы»)</span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">2</span>
                        <span>Нажмите <strong>«Импорт GIFT»</strong></span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">3</span>
                        <span>Вставьте текст в формате GIFT</span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">4</span>
                        <span>Нажмите <strong>«Импортировать»</strong></span>
                    </div>
                </div>

                <h2>Примеры формата GIFT</h2>

                <div class="help-code-block">
                    <div class="code-title">Один правильный ответ:</div>
                    <pre>Сколько будет 2+2? {
    =4
    ~3
    ~5
    ~6
}</pre>
                </div>

                <div class="help-code-block">
                    <div class="code-title">Несколько правильных ответов:</div>
                    <pre>Выберите чётные числа {
    ~%50%2
    ~%-50%3
    ~%50%4
    ~%-50%5
}</pre>
                </div>

                <div class="help-code-block">
                    <div class="code-title">Короткий ответ:</div>
                    <pre>Столица России? {=Москва =москва}</pre>
                </div>

                <div class="help-code-block">
                    <div class="code-title">Сопоставление:</div>
                    <pre>Соотнесите страны и столицы {
    =Россия -> Москва
    =Франция -> Париж
    =Германия -> Берлин
}</pre>
                </div>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Где взять GIFT?</strong>
                        <p>Многие системы умеют экспортировать в GIFT: Moodle, iSpring и др. Также можно найти готовые вопросы в интернете или написать самому в текстовом редакторе.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ССЫЛКА СТУДЕНТАМ
        // ==========================================
        'access': `
            <div class="help-section">
                <h1>🔗 Доступ к тестам</h1>
                <p class="help-subtitle">Одна страница для всех тестов — студенты вводят код и система сама определяет режим.</p>

                <div class="help-mode-info" style="margin-bottom: 24px;">
                    <div class="mode-icon blue">🚀</div>
                    <div class="mode-details">
                        <h3>Единая ссылка для студентов:</h3>
                        <div class="mode-url-big">kst-test.ru/start</div>
                        <ul>
                            <li>Студент вводит <strong>любой код</strong> (5 цифр или 6 цифр)</li>
                            <li>Система <strong>автоматически</strong> определяет тип теста</li>
                            <li>Не нужно запоминать разные ссылки</li>
                        </ul>
                    </div>
                </div>

                <h2>Четыре режима тестирования</h2>
                <div class="help-modes-comparison">
                    <div class="mode-compare-card">
                        <div class="mode-header green">
                            <span class="mode-icon">📖</span>
                            <h3>Тренировка</h3>
                        </div>
                        <div class="mode-body">
                            <ul>
                                <li>Студент вводит <strong>код теста</strong> (6 цифр)</li>
                                <li>Сразу видит <strong>правильные ответы</strong></li>
                                <li>Для самоподготовки дома</li>
                            </ul>
                        </div>
                    </div>

                    <div class="mode-compare-card">
                        <div class="mode-header blue">
                            <span class="mode-icon">📝</span>
                            <h3>Контрольная работа</h3>
                        </div>
                        <div class="mode-body">
                            <ul>
                                <li>Студент вводит <strong>код теста</strong> (6 цифр)</li>
                                <li>Полноценный тест <strong>с античитами</strong></li>
                                <li>Для проверки знаний на занятии</li>
                            </ul>
                        </div>
                    </div>

                    <div class="mode-compare-card">
                        <div class="mode-header orange">
                            <span class="mode-icon">🎓</span>
                            <h3>Зачёт</h3>
                        </div>
                        <div class="mode-body">
                            <ul>
                                <li>Студент вводит <strong>персональный код</strong> (5 цифр)</li>
                                <li>ФИО определяется автоматически</li>
                                <li>Для официальных зачётов</li>
                            </ul>
                        </div>
                    </div>

                    <div class="mode-compare-card">
                        <div class="mode-header red">
                            <span class="mode-icon">📊</span>
                            <h3>Срез</h3>
                        </div>
                        <div class="mode-body">
                            <ul>
                                <li>Студент вводит <strong>персональный код</strong> (5 цифр)</li>
                                <li>У каждого свой <strong>вариант</strong></li>
                                <li>Для массовых контрольных работ</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <h2>Как раздать тест студентам</h2>
                <div class="help-steps-mini">
                    <div class="step-mini">
                        <span class="step-mini-num">1</span>
                        <span>На карточке теста нажмите <strong>«Доступ»</strong></span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">2</span>
                        <span>Скопируйте <strong>короткий код</strong> (6 цифр, например: 847291)</span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">3</span>
                        <span>Скажите студентам: «Откройте <strong>kst-test.ru/start</strong> и введите код»</span>
                    </div>
                </div>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Универсальная ссылка</strong>
                        <p>Студентам достаточно запомнить одну ссылку <strong>kst-test.ru/start</strong> — она работает для всех режимов: тренировки, контрольной, зачёта и среза.</p>
                    </div>
                </div>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>QR-код и полная ссылка</strong>
                        <p>В окне «Доступ» также есть QR-код и полная ссылка. Можно отправить ссылку в мессенджер или показать QR-код на проекторе.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ТРЕНИРОВКА И КОНТРОЛЬНАЯ РАБОТА
        // ==========================================
        'training': `
            <div class="help-section">
                <h1>📝 Тренировка и контрольная работа</h1>
                <p class="help-subtitle">Оба режима используют одну ссылку <strong>/test</strong>, но отличаются настройками.</p>

                <div class="help-modes-comparison" style="margin-bottom: 24px;">
                    <div class="mode-compare-card">
                        <div class="mode-header green">
                            <span class="mode-icon">📖</span>
                            <h3>Тренировка</h3>
                        </div>
                        <div class="mode-body">
                            <ul>
                                <li>Студент видит <strong>правильные ответы</strong> после каждого вопроса</li>
                                <li>Для самоподготовки дома</li>
                                <li>Можно проходить много раз</li>
                                <li>Включите галочку «Показывать правильные ответы»</li>
                            </ul>
                        </div>
                    </div>

                    <div class="mode-compare-card">
                        <div class="mode-header blue">
                            <span class="mode-icon">📝</span>
                            <h3>Контрольная работа</h3>
                        </div>
                        <div class="mode-body">
                            <ul>
                                <li>Полноценный тест <strong>со всеми античитами</strong></li>
                                <li>Правильные ответы <strong>скрыты</strong></li>
                                <li>Для проверки знаний на занятии</li>
                                <li>Без персональных кодов (в отличие от зачёта)</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div class="help-mode-info">
                    <div class="mode-icon blue">📝</div>
                    <div class="mode-details">
                        <h3>Ссылка для студентов:</h3>
                        <div class="mode-url-big">kst-test.ru/start</div>
                        <ul>
                            <li>Студент вводит <strong>код теста</strong> (6 цифр)</li>
                            <li>Сам указывает своё ФИО и группу</li>
                            <li>Работают все античиты (таймер, перемешивание, отслеживание)</li>
                        </ul>
                    </div>
                </div>

                <h2>Как раздать тест студентам</h2>
                <div class="help-steps-mini">
                    <div class="step-mini">
                        <span class="step-mini-num">1</span>
                        <span>На карточке теста нажмите <strong>«Доступ»</strong></span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">2</span>
                        <span>Скопируйте <strong>короткий код</strong> (6 цифр)</span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">3</span>
                        <span>Скажите студентам: «Откройте <strong>kst-test.ru/start</strong> и введите код»</span>
                    </div>
                </div>

                <h2>Когда использовать</h2>
                <div class="help-use-cases">
                    <div class="use-case">
                        <span class="use-icon">✅</span>
                        <span><strong>Тренировка:</strong> Самоподготовка дома, домашние задания</span>
                    </div>
                    <div class="use-case">
                        <span class="use-icon">✅</span>
                        <span><strong>Контрольная работа:</strong> Проверка знаний на уроке, контрольные без вариантов</span>
                    </div>
                    <div class="use-case">
                        <span class="use-icon">❌</span>
                        <span>Нужен персональный вход — используйте <strong>/exam</strong></span>
                    </div>
                    <div class="use-case">
                        <span class="use-icon">❌</span>
                        <span>Контрольные по вариантам — используйте <strong>/srez</strong></span>
                    </div>
                </div>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Как включить тренировку?</strong>
                        <p>В настройках теста поставьте галочку «Показывать правильные ответы». Тогда студент после каждого вопроса будет видеть правильный ответ.</p>
                    </div>
                </div>

                <div class="help-note-box">
                    <div class="help-note-icon">📝</div>
                    <div class="help-note-content">
                        <strong>Это режим по умолчанию</strong>
                        <p>Когда вы создаёте тест — он автоматически доступен по ссылке /test. Все античиты работают, правильные ответы скрыты.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ЗАЧЁТ
        // ==========================================
        'exam': `
            <div class="help-section">
                <h1>🎓 Зачёт</h1>
                <p class="help-subtitle">Для официальных зачётов и экзаменов. У каждого студента персональный код — нельзя зайти под чужим именем.</p>

                <div class="help-mode-info">
                    <div class="mode-icon orange">🎓</div>
                    <div class="mode-details">
                        <h3>Ссылка для студентов:</h3>
                        <div class="mode-url-big">kst-test.ru/start</div>
                        <ul>
                            <li>Студент вводит <strong>персональный код</strong> (5 цифр)</li>
                            <li>ФИО определяется <strong>автоматически</strong> по коду</li>
                            <li>Можно пройти <strong>только один раз</strong></li>
                            <li>Вы контролируете кто может войти</li>
                        </ul>
                    </div>
                </div>

                <h2>Как подготовить зачёт</h2>
                <div class="help-steps-mini">
                    <div class="step-mini">
                        <span class="step-mini-num">1</span>
                        <span>Создайте группу студентов (вкладка «Группы»)</span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">2</span>
                        <span>На карточке теста нажмите <strong>«Зачёт»</strong></span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">3</span>
                        <span>Выберите группу и нажмите <strong>«Сгенерировать коды»</strong></span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">4</span>
                        <span>Распечатайте коды или держите на экране</span>
                    </div>
                </div>

                <h2>Как проводить</h2>
                <div class="help-exam-flow">
                    <div class="exam-step">
                        <div class="exam-step-icon">1️⃣</div>
                        <div class="exam-step-content">
                            <strong>Студент открывает kst-test.ru/start</strong>
                            <p>Напишите ссылку на доске или продиктуйте.</p>
                        </div>
                    </div>
                    <div class="exam-step">
                        <div class="exam-step-icon">2️⃣</div>
                        <div class="exam-step-content">
                            <strong>Вы называете код студенту</strong>
                            <p>Код из 5 цифр. Каждому свой код!</p>
                        </div>
                    </div>
                    <div class="exam-step">
                        <div class="exam-step-icon">3️⃣</div>
                        <div class="exam-step-content">
                            <strong>Студент вводит код и видит своё ФИО</strong>
                            <p>Если ФИО правильное — нажимает «Начать зачёт».</p>
                        </div>
                    </div>
                </div>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Чем отличается от тренировки?</strong>
                        <p>В тренировке студент сам вводит ФИО (может ввести чужое). В зачёте — ФИО определяется автоматически по коду. Подмена невозможна.</p>
                    </div>
                </div>

                <div class="help-warning-box">
                    <div class="help-warning-icon">⚠️</div>
                    <div class="help-warning-content">
                        <strong>Код одноразовый!</strong>
                        <p>Каждый код работает только один раз. Если студент случайно закрыл браузер — сгенерируйте ему новый код.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // СРЕЗ
        // ==========================================
        'srez': `
            <div class="help-section">
                <h1>📊 Административный срез</h1>
                <p class="help-subtitle">Как зачёт, но с вариантами. Каждый студент получает свой вариант контрольной.</p>

                <div class="help-mode-info">
                    <div class="mode-icon red">📊</div>
                    <div class="mode-details">
                        <h3>Ссылка для студентов:</h3>
                        <div class="mode-url-big">kst-test.ru/start</div>
                        <ul>
                            <li>Студент вводит <strong>персональный код</strong> (5 цифр)</li>
                            <li>ФИО и <strong>вариант</strong> определяются автоматически</li>
                            <li>Можно пройти <strong>только один раз</strong></li>
                            <li>Для массовых контрольных работ</li>
                        </ul>
                    </div>
                </div>

                <h2>Чем отличается от зачёта?</h2>
                <div class="help-comparison">
                    <div class="compare-item">
                        <span class="compare-label">Зачёт:</span>
                        <span>Все студенты отвечают на одни и те же вопросы</span>
                    </div>
                    <div class="compare-item">
                        <span class="compare-label">Срез:</span>
                        <span>У каждого студента <strong>свой вариант</strong> с разными вопросами</span>
                    </div>
                </div>

                <h2>Как подготовить срез</h2>
                <div class="help-steps-mini">
                    <div class="step-mini">
                        <span class="step-mini-num">1</span>
                        <span>Создайте группу студентов (вкладка «Группы»)</span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">2</span>
                        <span>На карточке теста нажмите <strong>«Срез»</strong></span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">3</span>
                        <span>Выберите группу и укажите <strong>сколько вариантов</strong></span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">4</span>
                        <span>Студенты автоматически распределятся по вариантам</span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">5</span>
                        <span>Нажмите <strong>«Сгенерировать коды»</strong></span>
                    </div>
                </div>

                <h2>Как проводить</h2>
                <div class="help-exam-flow">
                    <div class="exam-step">
                        <div class="exam-step-icon">1️⃣</div>
                        <div class="exam-step-content">
                            <strong>Студент открывает kst-test.ru/start</strong>
                            <p>Напишите ссылку на доске.</p>
                        </div>
                    </div>
                    <div class="exam-step">
                        <div class="exam-step-icon">2️⃣</div>
                        <div class="exam-step-content">
                            <strong>Вы называете код студенту</strong>
                            <p>Код из 5 цифр. Вариант привязан к коду.</p>
                        </div>
                    </div>
                    <div class="exam-step">
                        <div class="exam-step-icon">3️⃣</div>
                        <div class="exam-step-content">
                            <strong>Студент видит ФИО и свой вариант</strong>
                            <p>Например: «Иванов Иван — Вариант 2».</p>
                        </div>
                    </div>
                </div>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Откуда берутся варианты?</strong>
                        <p>Вопросы для вариантов берутся из пула вопросов теста и распределяются случайным образом. Или вы можете создать отдельные тесты для каждого варианта.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ГРУППЫ
        // ==========================================
        'groups': `
            <div class="help-section">
                <h1>👥 Группы студентов</h1>
                <p class="help-subtitle">Списки студентов с фотографиями. Нужны для зачётов и срезов.</p>

                <h2>Как создать группу</h2>
                <div class="help-steps-mini">
                    <div class="step-mini">
                        <span class="step-mini-num">1</span>
                        <span>Перейдите на вкладку <strong>«Группы»</strong></span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">2</span>
                        <span>Нажмите <strong>«+ Создать группу»</strong></span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">3</span>
                        <span>Введите название группы (например: «ИС-21»)</span>
                    </div>
                </div>

                <h2>Как добавить студентов</h2>
                <div class="help-methods">
                    <div class="method-card">
                        <div class="method-icon">👤</div>
                        <div class="method-content">
                            <h3>Вручную</h3>
                            <p>Нажмите «+ Добавить студента» и введите ФИО.</p>
                        </div>
                    </div>
                    <div class="method-card">
                        <div class="method-icon">📄</div>
                        <div class="method-content">
                            <h3>Из Excel</h3>
                            <p>Нажмите «Импорт» и загрузите файл Excel со списком студентов.</p>
                        </div>
                    </div>
                </div>

                <h2>Фотографии студентов</h2>
                <p>Можно загрузить фото каждого студента. Это помогает на очном зачёте — сразу видно кто перед вами.</p>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Зачем нужны группы?</strong>
                        <p>Для обычной тренировки группы не нужны. Но для зачёта — обязательны! Без группы нельзя сгенерировать персональные коды.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // РЕЗУЛЬТАТЫ
        // ==========================================
        'results': `
            <div class="help-section">
                <h1>📋 Результаты</h1>
                <p class="help-subtitle">Здесь все результаты тестов ваших студентов.</p>

                <h2>Как смотреть результаты</h2>
                <div class="help-steps-mini">
                    <div class="step-mini">
                        <span class="step-mini-num">1</span>
                        <span>Перейдите на вкладку <strong>«Результаты»</strong></span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">2</span>
                        <span>Используйте фильтры: по группе, дисциплине, тесту</span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">3</span>
                        <span>Нажмите на строку чтобы увидеть детали</span>
                    </div>
                </div>

                <h2>Что видно в результатах</h2>
                <div class="help-results-info">
                    <div class="result-item">
                        <span class="result-icon">👤</span>
                        <span><strong>ФИО студента</strong> — кто проходил</span>
                    </div>
                    <div class="result-item">
                        <span class="result-icon">📅</span>
                        <span><strong>Дата и время</strong> — когда проходил</span>
                    </div>
                    <div class="result-item">
                        <span class="result-icon">✅</span>
                        <span><strong>Правильных ответов</strong> — сколько из скольки</span>
                    </div>
                    <div class="result-item">
                        <span class="result-icon">📊</span>
                        <span><strong>Процент</strong> — в процентах</span>
                    </div>
                    <div class="result-item">
                        <span class="result-icon">🎓</span>
                        <span><strong>Оценка</strong> — автоматически по шкале</span>
                    </div>
                    <div class="result-item">
                        <span class="result-icon">⏱</span>
                        <span><strong>Время</strong> — сколько потратил на тест</span>
                    </div>
                </div>

                <h2>Шкала оценок</h2>
                <div class="help-grades-table">
                    <div class="grade-row">
                        <span class="grade-badge g5">5 (отлично)</span>
                        <span>85% и выше</span>
                    </div>
                    <div class="grade-row">
                        <span class="grade-badge g4">4 (хорошо)</span>
                        <span>70% — 84%</span>
                    </div>
                    <div class="grade-row">
                        <span class="grade-badge g3">3 (удовл.)</span>
                        <span>50% — 69%</span>
                    </div>
                    <div class="grade-row">
                        <span class="grade-badge g2">2 (неуд.)</span>
                        <span>ниже 50%</span>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ЭКСПОРТ
        // ==========================================
        'export': `
            <div class="help-section">
                <h1>💾 Экспорт результатов</h1>
                <p class="help-subtitle">Выгрузка результатов в Excel или Word.</p>

                <h2>Как экспортировать</h2>
                <div class="help-steps-mini">
                    <div class="step-mini">
                        <span class="step-mini-num">1</span>
                        <span>Перейдите на вкладку <strong>«Результаты»</strong></span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">2</span>
                        <span>Отфильтруйте нужные результаты</span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">3</span>
                        <span>Нажмите <strong>«Экспорт»</strong></span>
                    </div>
                    <div class="step-mini">
                        <span class="step-mini-num">4</span>
                        <span>Выберите формат: Excel или Word</span>
                    </div>
                </div>

                <h2>Форматы</h2>
                <div class="help-export-formats">
                    <div class="export-format-card">
                        <div class="format-icon excel">📊</div>
                        <div class="format-content">
                            <h3>Excel (.xlsx)</h3>
                            <p>Таблица со всеми данными. Удобно для анализа, сортировки, построения графиков.</p>
                        </div>
                    </div>
                    <div class="export-format-card">
                        <div class="format-icon word">📄</div>
                        <div class="format-content">
                            <h3>Word (.docx)</h3>
                            <p>Готовая ведомость для печати. Можно распечатать и подписать.</p>
                        </div>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // АНТИСПИСЫВАНИЕ
        // ==========================================
        'anticheat': `
            <div class="help-section">
                <h1>🛡️ Защита от списывания</h1>
                <p class="help-subtitle">Система следит за честностью прохождения теста.</p>

                <h2>Как это работает</h2>
                <div class="help-anticheat-features">
                    <div class="anticheat-card">
                        <div class="anticheat-icon">👁️</div>
                        <div class="anticheat-content">
                            <h3>Отслеживание вкладок</h3>
                            <p>Система видит, когда студент переключается на другую вкладку или приложение. Каждое переключение записывается.</p>
                        </div>
                    </div>
                    <div class="anticheat-card">
                        <div class="anticheat-icon">🔀</div>
                        <div class="anticheat-content">
                            <h3>Случайный порядок</h3>
                            <p>Вопросы и варианты ответов перемешиваются для каждого студента. Нельзя просто списать номера ответов.</p>
                        </div>
                    </div>
                    <div class="anticheat-card">
                        <div class="anticheat-icon">⏱️</div>
                        <div class="anticheat-content">
                            <h3>Ограничение времени</h3>
                            <p>Таймер не остановить. Когда время выйдет — тест завершится автоматически.</p>
                        </div>
                    </div>
                    <div class="anticheat-card">
                        <div class="anticheat-icon">🔐</div>
                        <div class="anticheat-content">
                            <h3>Персональные коды</h3>
                            <p>В режиме зачёта каждый входит под своим кодом. Нельзя зайти под чужим именем.</p>
                        </div>
                    </div>
                </div>

                <h2>Что видит преподаватель</h2>
                <p>В результатах теста показано количество переключений на другие вкладки. Если там большое число — возможно студент искал ответы в интернете.</p>

                <div class="help-warning-box">
                    <div class="help-warning-icon">⚠️</div>
                    <div class="help-warning-content">
                        <strong>Предупреждение для студентов</strong>
                        <p>Студенты видят предупреждение что система отслеживает переключения. Это само по себе снижает желание списывать.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ДЛЯ СТУДЕНТОВ - КАК НАЧАТЬ
        // ==========================================
        'student-start': `
            <div class="help-section">
                <h1>🎒 Для студентов: как начать тест</h1>
                <p class="help-subtitle">Покажите этот раздел студентам или перескажите своими словами.</p>

                <div class="help-mode-info" style="margin-bottom: 24px;">
                    <div class="mode-icon blue">🚀</div>
                    <div class="mode-details">
                        <h3>Единая ссылка для всех тестов:</h3>
                        <div class="mode-url-big">kst-test.ru/start</div>
                    </div>
                </div>

                <div class="help-student-box blue">
                    <h2>📝 Как начать тест</h2>
                    <div class="help-steps-mini">
                        <div class="step-mini">
                            <span class="step-mini-num">1</span>
                            <span>Откройте <strong>kst-test.ru/start</strong></span>
                        </div>
                        <div class="step-mini">
                            <span class="step-mini-num">2</span>
                            <span>Введите <strong>код</strong> — его скажет преподаватель</span>
                        </div>
                        <div class="step-mini">
                            <span class="step-mini-num">3</span>
                            <span>Система <strong>автоматически</strong> определит тип теста и откроет нужную страницу</span>
                        </div>
                        <div class="step-mini">
                            <span class="step-mini-num">4</span>
                            <span>Следуйте инструкциям на экране</span>
                        </div>
                    </div>
                </div>

                <div class="help-summary-table">
                    <h3>Какие бывают коды</h3>
                    <table>
                        <tr>
                            <th>Режим</th>
                            <th>Код</th>
                            <th>Особенности</th>
                        </tr>
                        <tr>
                            <td>📖 Тренировка</td>
                            <td>6 цифр</td>
                            <td>Видны правильные ответы, нужно ввести ФИО</td>
                        </tr>
                        <tr>
                            <td>📝 Контрольная работа</td>
                            <td>6 цифр</td>
                            <td>С античитами, нужно ввести ФИО</td>
                        </tr>
                        <tr>
                            <td>🎓 Зачёт</td>
                            <td>5 цифр</td>
                            <td>Персональный код, ФИО определяется автоматически</td>
                        </tr>
                        <tr>
                            <td>📊 Срез</td>
                            <td>5 цифр</td>
                            <td>Персональный код + свой вариант</td>
                        </tr>
                    </table>
                </div>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Просто запомните одну ссылку</strong>
                        <p>Студентам достаточно знать только <strong>kst-test.ru/start</strong> — система сама разберётся, куда направить по введённому коду.</p>
                    </div>
                </div>

                <div class="help-warning-box">
                    <div class="help-warning-icon">⚠️</div>
                    <div class="help-warning-content">
                        <strong>Персональный код (5 цифр) — одноразовый!</strong>
                        <p>Если вы закроете браузер во время зачёта или среза — попросите новый код у преподавателя.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ДЛЯ СТУДЕНТОВ - ИНТЕРФЕЙС
        // ==========================================
        'student-interface': `
            <div class="help-section">
                <h1>🖥️ Для студентов: интерфейс теста</h1>
                <p class="help-subtitle">Как выглядит тест и что делать.</p>

                <div class="help-ui-demo">
                    <div class="demo-test-interface">
                        <div class="demo-test-top">
                            <div class="demo-test-title">Тест по математике</div>
                            <div class="demo-test-timer">⏱ 25:43</div>
                        </div>
                        <div class="demo-test-nav">
                            <span class="q-btn done">1</span>
                            <span class="q-btn done">2</span>
                            <span class="q-btn current">3</span>
                            <span class="q-btn">4</span>
                            <span class="q-btn">5</span>
                        </div>
                        <div class="demo-test-question">
                            <div class="demo-q-text">Вопрос 3 из 5</div>
                            <div class="demo-q-content">Чему равен интеграл от cos(x)?</div>
                            <div class="demo-q-answers">
                                <label><input type="radio" name="demo"> sin(x) + C</label>
                                <label><input type="radio" name="demo"> -sin(x) + C</label>
                                <label><input type="radio" name="demo"> cos(x) + C</label>
                            </div>
                        </div>
                        <div class="demo-test-bottom">
                            <button class="demo-nav-btn">← Назад</button>
                            <button class="demo-nav-btn primary">Далее →</button>
                        </div>
                    </div>
                </div>

                <h2>Элементы интерфейса</h2>
                <div class="help-legend">
                    <div class="help-legend-item">
                        <span class="legend-icon">⏱</span>
                        <div class="legend-content">
                            <strong>Таймер</strong>
                            <p>Показывает сколько времени осталось. Когда время выйдет — тест завершится автоматически!</p>
                        </div>
                    </div>
                    <div class="help-legend-item">
                        <span class="legend-icon">🔢</span>
                        <div class="legend-content">
                            <strong>Номера вопросов</strong>
                            <p>Можно нажать на любой номер чтобы перейти к вопросу. Зелёные — уже отвечены.</p>
                        </div>
                    </div>
                    <div class="help-legend-item">
                        <span class="legend-icon">➡️</span>
                        <div class="legend-content">
                            <strong>Кнопки навигации</strong>
                            <p>«Назад» и «Далее» переключают вопросы. Можно вернуться к любому вопросу.</p>
                        </div>
                    </div>
                </div>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Как завершить тест</strong>
                        <p>После последнего вопроса появится кнопка «Завершить тест». Нажмите её когда ответите на все вопросы. Или подождите пока закончится время.</p>
                    </div>
                </div>

                <div class="help-warning-box">
                    <div class="help-warning-icon">⚠️</div>
                    <div class="help-warning-content">
                        <strong>Не переключайтесь на другие вкладки!</strong>
                        <p>Система видит когда вы уходите с теста. Преподаватель увидит сколько раз вы переключались.</p>
                    </div>
                </div>
            </div>
        `
    };
}

// Проверка первого визита - показываем справку новым пользователям
function checkFirstVisit() {
    const hasVisited = localStorage.getItem('admin_visited');
    if (!hasVisited) {
        // Первый визит - показываем справку
        setTimeout(() => {
            showHelpModal();
        }, 500);
        localStorage.setItem('admin_visited', 'true');
    }
}

// Экспортируем для использования
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { showHelpModal, hideHelpModal, checkFirstVisit };
}
