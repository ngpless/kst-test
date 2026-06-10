// ============================================
// СПРАВКА — ПОЛНАЯ ДОКУМЕНТАЦИЯ СИСТЕМЫ ТЕСТИРОВАНИЯ
// ============================================

function showHelpModal() {
    let helpModal = document.getElementById('help-modal');
    if (!helpModal) {
        helpModal = document.createElement('div');
        helpModal.id = 'help-modal';
        helpModal.className = 'modal';
        document.body.appendChild(helpModal);
    }

    // Static hardcoded help content - no user input, safe for innerHTML
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
                            <div class="help-nav-label">БЫСТРЫЙ СТАРТ</div>
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
                            <div class="help-nav-label">РАБОТА С ТЕСТАМИ</div>
                            <a href="#" class="help-nav-item" data-section="disciplines">
                                <span class="nav-icon">📚</span>
                                <span>Дисциплины и папки</span>
                            </a>
                            <a href="#" class="help-nav-item" data-section="tests">
                                <span class="nav-icon">📝</span>
                                <span>Тесты и настройки</span>
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
                            <div class="help-nav-label">ПРОВЕДЕНИЕ</div>
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
                            <div class="help-nav-label">АНАЛИТИКА И ДАННЫЕ</div>
                            <a href="#" class="help-nav-item" data-section="results">
                                <span class="nav-icon">📋</span>
                                <span>Результаты</span>
                            </a>
                            <a href="#" class="help-nav-item" data-section="analytics">
                                <span class="nav-icon">📈</span>
                                <span>Аналитика</span>
                            </a>
                            <a href="#" class="help-nav-item" data-section="groups">
                                <span class="nav-icon">👥</span>
                                <span>Группы</span>
                            </a>
                            <a href="#" class="help-nav-item" data-section="export">
                                <span class="nav-icon">💾</span>
                                <span>Экспорт</span>
                            </a>
                        </div>

                        <div class="help-nav-group">
                            <div class="help-nav-label">БЕЗОПАСНОСТЬ</div>
                            <a href="#" class="help-nav-item" data-section="anticheat">
                                <span class="nav-icon">🛡️</span>
                                <span>Антисписывание</span>
                            </a>
                            <a href="#" class="help-nav-item" data-section="monitoring">
                                <span class="nav-icon">📡</span>
                                <span>Мониторинг</span>
                            </a>
                        </div>

                        <div class="help-nav-group">
                            <div class="help-nav-label">НАСТРОЙКИ</div>
                            <a href="#" class="help-nav-item" data-section="profile">
                                <span class="nav-icon">👤</span>
                                <span>Личный кабинет</span>
                            </a>
                            <a href="#" class="help-nav-item" data-section="telegram">
                                <span class="nav-icon">📱</span>
                                <span>Telegram-уведомления</span>
                            </a>
                            <a href="#" class="help-nav-item" data-section="pwa">
                                <span class="nav-icon">📲</span>
                                <span>Мобильное приложение</span>
                            </a>
                        </div>

                        <div class="help-nav-group">
                            <div class="help-nav-label">ДЛЯ СТУДЕНТОВ</div>
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

    initHelpNavigation();
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
            document.querySelectorAll('.help-nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            showHelpSection(section);
        });
    });
}

function showHelpSection(sectionId) {
    const content = document.getElementById('help-content');
    const sections = getHelpSections();
    if (sections[sectionId]) {
        // All section content is static hardcoded HTML, safe for innerHTML
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
                    <div class="help-hero-text">
                        <h1>Добро пожаловать в систему тестирования!</h1>
                        <p>Здесь вы можете создавать тесты, проводить зачёты и срезы, отслеживать результаты студентов — всё в одном месте.</p>
                    </div>
                </div>

                <div class="help-features">
                    <div class="help-feature">
                        <div class="help-feature-icon">📝</div>
                        <h3>Создавайте тесты</h3>
                        <p>Пять типов вопросов: одиночный выбор, множественный выбор, сопоставление, расстановка по порядку, короткий ответ. Поддержка формул LaTeX и изображений.</p>
                    </div>
                    <div class="help-feature">
                        <div class="help-feature-icon">🎓</div>
                        <h3>Проводите зачёты</h3>
                        <p>Персональные 5-значные коды для каждого студента, контроль попыток, печать карточек с кодами — полная организация экзаменационного процесса.</p>
                    </div>
                    <div class="help-feature">
                        <div class="help-feature-icon">🛡️</div>
                        <h3>Защита от списывания</h3>
                        <p>Отслеживание переключений вкладок, перемешивание вопросов и ответов, штрафное время, персональные коды. Списать будет непросто.</p>
                    </div>
                    <div class="help-feature">
                        <div class="help-feature-icon">📊</div>
                        <h3>Смотрите статистику</h3>
                        <p>Подробная аналитика по каждому тесту: распределение оценок, средний балл, самые сложные вопросы, экспорт в Excel и Word.</p>
                    </div>
                </div>

                <img src="/help-img/02-disciplines.png" alt="Главная страница — список дисциплин" class="help-screenshot" style="width:100%;border-radius:12px;border:1px solid #e5e5e5;margin:16px 0;">

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>С чего начать?</strong>
                        <p>Перейдите в раздел <strong>«Первые шаги»</strong> — там пошаговая инструкция, как создать свой первый тест за 5 минут.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ПЕРВЫЕ ШАГИ
        // ==========================================
        'first-steps': `
            <div class="help-section">
                <h2 class="help-subtitle">🚀 Первые шаги</h2>
                <p class="help-text">От регистрации до первого теста — всего 5 шагов. Следуйте инструкции, и через несколько минут ваши студенты смогут пройти тест.</p>

                <div class="help-steps">
                    <div class="help-step">
                        <div class="help-step-num">1</div>
                        <div class="help-step-content">
                            <h3>Создайте дисциплину</h3>
                            <p>На главной странице нажмите кнопку <strong>«+ Дисциплина»</strong>. Введите название (например, «Информатика») и при необходимости привяжите группы.</p>
                            <div class="help-action">
                                <span class="help-action-label">Где найти:</span>
                                <span class="help-action-path">Главная → кнопка «+ Дисциплина»</span>
                            </div>
                        </div>
                    </div>
                    <div class="help-step">
                        <div class="help-step-num">2</div>
                        <div class="help-step-content">
                            <h3>Создайте тему</h3>
                            <p>Откройте дисциплину и нажмите <strong>«+ Тема»</strong>. Темы помогают структурировать тесты: «Глава 1», «Модуль 2», «Итоговый» и т.д.</p>
                            <div class="help-action">
                                <span class="help-action-label">Где найти:</span>
                                <span class="help-action-path">Дисциплина → кнопка «+ Тема»</span>
                            </div>
                        </div>
                    </div>
                    <div class="help-step">
                        <div class="help-step-num">3</div>
                        <div class="help-step-content">
                            <h3>Создайте тест</h3>
                            <p>Внутри темы нажмите <strong>«+ Тест»</strong>. Укажите название, лимит времени, количество вопросов и режим работы (тренировка, контрольная, зачёт или срез).</p>
                            <div class="help-action">
                                <span class="help-action-label">Где найти:</span>
                                <span class="help-action-path">Тема → кнопка «+ Тест»</span>
                            </div>
                        </div>
                    </div>
                    <div class="help-step">
                        <div class="help-step-num">4</div>
                        <div class="help-step-content">
                            <h3>Добавьте вопросы</h3>
                            <p>Создавайте вопросы вручную или импортируйте из файла в формате GIFT. Поддерживается 5 типов вопросов, можно прикреплять изображения и формулы LaTeX.</p>
                            <div class="help-action">
                                <span class="help-action-label">Где найти:</span>
                                <span class="help-action-path">Тест → вкладка «Вопросы» → «+ Вопрос» или «Импорт GIFT»</span>
                            </div>
                        </div>
                    </div>
                    <div class="help-step">
                        <div class="help-step-num">5</div>
                        <div class="help-step-content">
                            <h3>Раздайте код или ссылку</h3>
                            <p>У каждого теста есть короткий код (6 цифр для обычного теста, 5 для зачёта/среза). Студенты вводят код на <strong>kst-test.ru/start</strong> — и начинают тест.</p>
                            <div class="help-action">
                                <span class="help-action-label">Где найти:</span>
                                <span class="help-action-path">Карточка теста → код доступа / кнопка «Скопировать ссылку»</span>
                            </div>
                        </div>
                    </div>
                </div>

                <h3 class="help-subtitle">📂 Структура системы</h3>
                <div class="help-structure">
                    <div class="help-structure-item level-1">📚 Дисциплина (например, «Информатика»)</div>
                    <div class="help-structure-item level-2">📂 Тема (например, «Глава 1. Основы»)</div>
                    <div class="help-structure-item level-3">📝 Тест (например, «Тест по главе 1»)</div>
                    <div class="help-structure-item level-4">❓ Вопросы (до 500 штук в одном тесте)</div>
                </div>

                <img src="/help-img/03-topics.png" alt="Темы внутри дисциплины" class="help-screenshot" style="width:100%;border-radius:12px;border:1px solid #e5e5e5;margin:16px 0;">

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Совет</strong>
                        <p>Начните с тренировочного режима — так вы сможете проверить тест на себе, прежде чем давать его студентам.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ДИСЦИПЛИНЫ И ПАПКИ
        // ==========================================
        'disciplines': `
            <div class="help-section">
                <h2 class="help-subtitle">📚 Дисциплины и папки</h2>
                <p class="help-text">Дисциплина — это основная единица организации. Внутри дисциплины находятся темы, а внутри тем — тесты. Дисциплины можно группировать по папкам.</p>

                <h3 class="help-subtitle">Создание дисциплины</h3>
                <div class="help-steps-mini">
                    <div class="step-mini">
                        <div class="step-mini-num">1</div>
                        <span>На главной странице нажмите кнопку <strong>«+ Дисциплина»</strong></span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">2</div>
                        <span>Введите название дисциплины</span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">3</div>
                        <span>При необходимости привяжите группы — так результаты будут автоматически распределяться по группам</span>
                    </div>
                </div>

                <h3 class="help-subtitle">📁 Папки</h3>
                <p class="help-text">Если у вас много дисциплин, используйте папки для организации. Нажмите кнопку <strong>«+ Папка»</strong> на главной странице, задайте название и перетащите в неё нужные дисциплины.</p>

                <h3 class="help-subtitle">🔍 Поиск и сортировка</h3>
                <p class="help-text">На странице дисциплин есть строка поиска и варианты сортировки:</p>
                <div class="help-legend">
                    <div class="help-legend-item">
                        <div class="legend-icon">🔤</div>
                        <div class="legend-content"><strong>По названию</strong> — алфавитный порядок</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">📂</div>
                        <div class="legend-content"><strong>По темам</strong> — сколько тем в дисциплине</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">📝</div>
                        <div class="legend-content"><strong>По тестам</strong> — общее количество тестов</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">👥</div>
                        <div class="legend-content"><strong>По группам</strong> — количество привязанных групп</div>
                    </div>
                </div>

                <h3 class="help-subtitle">☑️ Массовые операции</h3>
                <p class="help-text">Отмечайте дисциплины галочками (чекбоксами) для массовых действий: удаление нескольких дисциплин одновременно, перемещение в папку.</p>

                <h3 class="help-subtitle">📂 Темы внутри дисциплины</h3>
                <p class="help-text">Откройте дисциплину, чтобы увидеть её темы. Каждая тема — контейнер для тестов. Для навигации используйте хлебные крошки в верхней части страницы.</p>

                <img src="/help-img/02-disciplines.png" alt="Список дисциплин" class="help-screenshot" style="width:100%;border-radius:12px;border:1px solid #e5e5e5;margin:16px 0;">

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Совет</strong>
                        <p>Привязывайте группы к дисциплинам — тогда в результатах можно будет фильтровать по группам, а аналитика станет более точной.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ТЕСТЫ И НАСТРОЙКИ
        // ==========================================
        'tests': `
            <div class="help-section">
                <h2 class="help-subtitle">📝 Тесты и настройки</h2>
                <p class="help-text">Тест создаётся внутри темы. У каждого теста есть гибкие настройки: режим работы, ограничение по времени, перемешивание и многое другое.</p>

                <h3 class="help-subtitle">Создание теста</h3>
                <div class="help-steps-mini">
                    <div class="step-mini">
                        <div class="step-mini-num">1</div>
                        <span>Откройте нужную тему</span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">2</div>
                        <span>Нажмите <strong>«+ Тест»</strong></span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">3</div>
                        <span>Заполните настройки: название, лимит времени, количество вопросов, режим</span>
                    </div>
                </div>

                <h3 class="help-subtitle">⚙️ Настройки теста</h3>
                <div class="help-summary-table">
                    <table>
                        <thead>
                            <tr><th>Параметр</th><th>Описание</th></tr>
                        </thead>
                        <tbody>
                            <tr><td><strong>Название</strong></td><td>Отображается студенту при прохождении теста</td></tr>
                            <tr><td><strong>Лимит времени</strong></td><td>Время в минутах. По истечении тест завершается автоматически</td></tr>
                            <tr><td><strong>Кол-во вопросов</strong></td><td>Сколько вопросов показывать из общего банка (случайная выборка)</td></tr>
                            <tr><td><strong>Перемешивание вопросов</strong></td><td>Каждый студент получает вопросы в случайном порядке</td></tr>
                            <tr><td><strong>Перемешивание ответов</strong></td><td>Варианты ответов перемешиваются для каждого студента</td></tr>
                            <tr><td><strong>Штрафное время</strong></td><td>Минуты, которые списываются при переключении вкладки</td></tr>
                        </tbody>
                    </table>
                </div>

                <h3 class="help-subtitle">🎮 Режимы теста</h3>
                <div class="help-mode-info">
                    <div class="mode-icon">🎯</div>
                    <div class="mode-details">
                        <h4>Тренировка</h4>
                        <p>Студент видит правильные ответы после каждого вопроса. Подходит для самоподготовки. Код — 6 цифр.</p>
                    </div>
                </div>
                <div class="help-mode-info">
                    <div class="mode-icon">📝</div>
                    <div class="mode-details">
                        <h4>Контрольная (обычный режим)</h4>
                        <p>Стандартный тест без показа ответов. Результат виден после завершения. Код — 6 цифр.</p>
                    </div>
                </div>
                <div class="help-mode-info">
                    <div class="mode-icon">🎓</div>
                    <div class="mode-details">
                        <h4>Зачёт</h4>
                        <p>Требует списка участников. Каждому выдаётся персональный 5-значный код. Можно задать проходной балл и макс. количество попыток.</p>
                    </div>
                </div>
                <div class="help-mode-info">
                    <div class="mode-icon">📊</div>
                    <div class="mode-details">
                        <h4>Срез</h4>
                        <p>Административный срез с вариантами. Персональные 5-значные коды. Поддержка мониторинга в реальном времени.</p>
                    </div>
                </div>

                <h3 class="help-subtitle">🔢 Коды доступа</h3>
                <p class="help-text">Каждому тесту автоматически присваивается короткий код:</p>
                <div class="help-summary-table">
                    <table>
                        <thead>
                            <tr><th>Режим</th><th>Длина кода</th><th>Тип</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>Тренировка</td><td>6 цифр</td><td>Общий (один для всех)</td></tr>
                            <tr><td>Контрольная</td><td>6 цифр</td><td>Общий (один для всех)</td></tr>
                            <tr><td>Зачёт</td><td>5 цифр</td><td>Персональный (у каждого свой)</td></tr>
                            <tr><td>Срез</td><td>5 цифр</td><td>Персональный (у каждого свой)</td></tr>
                        </tbody>
                    </table>
                </div>

                <h3 class="help-subtitle">📐 Дополнительные возможности</h3>
                <div class="help-legend">
                    <div class="help-legend-item">
                        <div class="legend-icon">🧮</div>
                        <div class="legend-content"><strong>LaTeX-формулы</strong> — используйте KaTeX для математических формул прямо в вопросах и ответах</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">🖼️</div>
                        <div class="legend-content"><strong>Изображения</strong> — прикрепляйте картинки к вопросам и ответам</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">⚡</div>
                        <div class="legend-content"><strong>Массовая настройка</strong> — применяйте параметры сразу к нескольким тестам</div>
                    </div>
                </div>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Совет</strong>
                        <p>Включите перемешивание вопросов и ответов — это самый простой способ снизить списывание на контрольных.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ВОПРОСЫ
        // ==========================================
        'questions': `
            <div class="help-section">
                <h2 class="help-subtitle">❓ Вопросы</h2>
                <p class="help-text">Система поддерживает 5 типов вопросов. Каждый вопрос можно сопроводить изображением, формулой или подсказкой.</p>

                <h3 class="help-subtitle">📋 Типы вопросов</h3>

                <div class="help-tabs-explain">
                    <div class="help-tab-card">
                        <div class="tab-card-icon">🔘</div>
                        <div class="tab-card-content">
                            <h4>Одиночный выбор</h4>
                            <p>Один правильный ответ из нескольких вариантов. Самый распространённый тип — подходит для проверки знания фактов, определений, формул.</p>
                        </div>
                        <span class="tab-card-tag">radio</span>
                    </div>
                    <div class="help-tab-card">
                        <div class="tab-card-icon">☑️</div>
                        <div class="tab-card-content">
                            <h4>Множественный выбор</h4>
                            <p>Несколько правильных ответов. Студент должен отметить все верные варианты. Частичный балл не начисляется — нужно выбрать все правильные.</p>
                        </div>
                        <span class="tab-card-tag">checkbox</span>
                    </div>
                    <div class="help-tab-card">
                        <div class="tab-card-icon">🔗</div>
                        <div class="tab-card-content">
                            <h4>Сопоставление</h4>
                            <p>Соединение элементов из двух колонок. Например: термин — определение, дата — событие, автор — произведение. Перетаскивание drag-and-drop.</p>
                        </div>
                        <span class="tab-card-tag">matching</span>
                    </div>
                    <div class="help-tab-card">
                        <div class="tab-card-icon">🔢</div>
                        <div class="tab-card-content">
                            <h4>Расстановка по порядку</h4>
                            <p>Расположите элементы в правильной последовательности. Подходит для алгоритмов, хронологии, этапов процесса.</p>
                        </div>
                        <span class="tab-card-tag">sequence</span>
                    </div>
                    <div class="help-tab-card">
                        <div class="tab-card-icon">✏️</div>
                        <div class="tab-card-content">
                            <h4>Короткий ответ</h4>
                            <p>Студент вводит ответ текстом. Проверка без учёта регистра. Можно задать несколько допустимых вариантов ответа.</p>
                        </div>
                        <span class="tab-card-tag">text</span>
                    </div>
                </div>

                <h3 class="help-subtitle">🖼️ Изображения</h3>
                <p class="help-text">К вопросу и к каждому варианту ответа можно прикрепить изображение. Поддерживаются форматы JPG, PNG, GIF. Максимальный размер — 5 МБ.</p>

                <h3 class="help-subtitle">📂 Разделы вопросов</h3>
                <p class="help-text">Вопросы можно группировать по разделам (секциям). Это удобно, когда в одном тесте собраны вопросы из разных тем или глав.</p>

                <h3 class="help-subtitle">🎲 Варианты для среза</h3>
                <p class="help-text">В режиме среза вопросы можно распределить по вариантам. Каждый студент получит вопросы только своего варианта.</p>

                <h3 class="help-subtitle">🗑️ Массовое удаление</h3>
                <p class="help-text">Отметьте несколько вопросов чекбоксами и удалите одним нажатием. Удобно при очистке банка вопросов.</p>

                <h3 class="help-subtitle">📊 Уровни сложности</h3>
                <p class="help-text">Каждому вопросу можно назначить уровень сложности. Это влияет на аналитику — вы увидите, какие уровни студенты осваивают хуже.</p>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Совет</strong>
                        <p>Создавайте больше вопросов, чем нужно для одного теста. Если в тесте 20 вопросов, а в банке 50 — каждый студент получит уникальный набор.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ИМПОРТ GIFT
        // ==========================================
        'gift': `
            <div class="help-section">
                <h2 class="help-subtitle">📥 Импорт GIFT</h2>
                <p class="help-text">GIFT — текстовый формат для описания тестовых вопросов, изначально разработанный для Moodle. Он позволяет быстро создавать десятки вопросов в обычном текстовом файле.</p>

                <h3 class="help-subtitle">📄 Что такое формат GIFT</h3>
                <p class="help-text">Каждый вопрос записывается в несколько строк. Правильный ответ помечается символом <code>=</code>, неправильный — символом <code>~</code>. Вопросы разделяются пустой строкой.</p>

                <h3 class="help-subtitle">✍️ Примеры синтаксиса</h3>

                <div class="help-note-box">
                    <div class="help-note-icon">📝</div>
                    <div class="help-note-content">
                        <strong>Одиночный выбор:</strong>
<pre style="background:#f5f5f5;padding:12px;border-radius:8px;margin:8px 0;overflow-x:auto;">Столица России? {
    =Москва
    ~Санкт-Петербург
    ~Новосибирск
    ~Казань
}</pre>
                    </div>
                </div>

                <div class="help-note-box">
                    <div class="help-note-icon">📝</div>
                    <div class="help-note-content">
                        <strong>Множественный выбор:</strong>
<pre style="background:#f5f5f5;padding:12px;border-radius:8px;margin:8px 0;overflow-x:auto;">Какие из этих языков компилируемые? {
    ~%50%C++
    ~%50%Rust
    ~%-50%Python
    ~%-50%JavaScript
}</pre>
                    </div>
                </div>

                <div class="help-note-box">
                    <div class="help-note-icon">📝</div>
                    <div class="help-note-content">
                        <strong>Короткий ответ:</strong>
<pre style="background:#f5f5f5;padding:12px;border-radius:8px;margin:8px 0;overflow-x:auto;">Как называется протокол передачи гипертекста? {
    =HTTP
    =http
}</pre>
                    </div>
                </div>

                <h3 class="help-subtitle">📤 Как импортировать</h3>
                <div class="help-steps-mini">
                    <div class="step-mini">
                        <div class="step-mini-num">1</div>
                        <span>Откройте тест, в который хотите добавить вопросы</span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">2</div>
                        <span>Нажмите кнопку <strong>«Импорт GIFT»</strong></span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">3</div>
                        <span>Вставьте текст в формате GIFT или загрузите файл <code>.gift</code> / <code>.txt</code></span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">4</div>
                        <span>Система покажет предпросмотр распознанных вопросов — проверьте и нажмите <strong>«Импортировать»</strong></span>
                    </div>
                </div>

                <h3 class="help-subtitle">✅ Поддерживаемые типы</h3>
                <div class="help-legend">
                    <div class="help-legend-item">
                        <div class="legend-icon">🔘</div>
                        <div class="legend-content">Одиночный выбор (один ответ с <code>=</code>)</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">☑️</div>
                        <div class="legend-content">Множественный выбор (проценты <code>%50%</code>)</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">✏️</div>
                        <div class="legend-content">Короткий ответ (текстовый ввод)</div>
                    </div>
                </div>

                <div class="help-warning-box">
                    <div class="help-warning-icon">⚠️</div>
                    <div class="help-warning-content">
                        <strong>Обратите внимание</strong>
                        <p>Сопоставление и расстановка по порядку через GIFT не импортируются — их нужно создавать вручную.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ССЫЛКА СТУДЕНТАМ
        // ==========================================
        'access': `
            <div class="help-section">
                <h2 class="help-subtitle">🔗 Ссылка студентам</h2>
                <p class="help-text">Есть несколько способов дать студентам доступ к тесту. Выберите наиболее удобный.</p>

                <h3 class="help-subtitle">🌐 Универсальная ссылка</h3>
                <div class="help-student-box">
                    <p>Все студенты заходят на один адрес:</p>
                    <h3 style="text-align:center;color:#4f46e5;margin:12px 0;">kst-test.ru/start</h3>
                    <p>Там вводят код теста (5 или 6 цифр) — и попадают прямо в тест.</p>
                </div>

                <h3 class="help-subtitle">🔢 Короткие коды</h3>
                <p class="help-text">Код отображается на карточке теста в интерфейсе преподавателя. Для обычных тестов и тренировок — это общий 6-значный код. Для зачётов и срезов — персональные 5-значные коды, выдаваемые каждому участнику.</p>

                <h3 class="help-subtitle">🔗 Прямая ссылка</h3>
                <p class="help-text">На карточке теста есть кнопка <strong>«Скопировать ссылку»</strong>. Она генерирует прямую ссылку вида <code>kst-test.ru/start?code=123456</code>, которую можно отправить в чат, мессенджер или на почту.</p>

                <h3 class="help-subtitle">📱 QR-код</h3>
                <p class="help-text">Для каждого теста можно сгенерировать QR-код. Распечатайте его и повесьте в аудитории — студенты отсканируют камерой телефона и сразу попадут в тест.</p>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Совет для очных занятий</strong>
                        <p>Напишите код на доске крупными цифрами или выведите QR-код через проектор — так все студенты подключатся за минуту.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ТРЕНИРОВКА
        // ==========================================
        'training': `
            <div class="help-section">
                <h2 class="help-subtitle">🎯 Тренировка</h2>
                <p class="help-text">Режим тренировки — это практика перед настоящим тестом. Студент сразу видит, правильно ли он ответил, и какой ответ был верным.</p>

                <div class="help-mode-info">
                    <div class="mode-icon">🎯</div>
                    <div class="mode-details">
                        <h4>Как это работает</h4>
                        <p>После ответа на каждый вопрос студент видит результат: зелёным подсвечивается правильный ответ, красным — ошибочный. Можно сразу понять свои пробелы.</p>
                    </div>
                </div>

                <h3 class="help-subtitle">Когда использовать</h3>
                <div class="help-legend">
                    <div class="help-legend-item">
                        <div class="legend-icon">✅</div>
                        <div class="legend-content">Самоподготовка студентов перед контрольной</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">✅</div>
                        <div class="legend-content">Домашнее задание — студенты могут проходить тренировку сколько угодно раз</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">✅</div>
                        <div class="legend-content">Проверка теста преподавателем перед контрольной</div>
                    </div>
                </div>

                <h3 class="help-subtitle">⚙️ Как включить</h3>
                <p class="help-text">При создании или редактировании теста выберите режим <strong>«Тренировка»</strong> (параметр isTrainingMode). Код доступа — 6 цифр, общий для всех студентов.</p>

                <div class="help-note-box">
                    <div class="help-note-icon">📌</div>
                    <div class="help-note-content">
                        <strong>Примечание</strong>
                        <p>Результаты тренировок тоже сохраняются — вы сможете видеть, кто тренировался и какие баллы набирал.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ЗАЧЁТ
        // ==========================================
        'exam': `
            <div class="help-section">
                <h2 class="help-subtitle">🎓 Зачёт</h2>
                <p class="help-text">Зачёт — самый серьёзный режим. Каждый студент получает персональный 5-значный код, количество попыток ограничено, есть проходной балл.</p>

                <h3 class="help-subtitle">📋 Список участников</h3>
                <p class="help-text">Перед проведением зачёта нужно сформировать список участников. Это можно сделать тремя способами:</p>

                <div class="help-steps-mini">
                    <div class="step-mini">
                        <div class="step-mini-num">1</div>
                        <span><strong>Вручную</strong> — добавьте студентов по ФИО</span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">2</div>
                        <span><strong>Из группы</strong> — выберите группу, и все её студенты будут добавлены</span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">3</div>
                        <span><strong>Из Excel</strong> — загрузите файл со списком (ФИО в одном столбце)</span>
                    </div>
                </div>

                <h3 class="help-subtitle">🎫 Карточки с кодами</h3>
                <p class="help-text">После добавления участников система автоматически генерирует персональный 5-значный код для каждого студента. Вы можете:</p>
                <div class="help-legend">
                    <div class="help-legend-item">
                        <div class="legend-icon">🖨️</div>
                        <div class="legend-content"><strong>Распечатать PDF-карточки</strong> — красивые карточки с ФИО и кодом для раздачи в аудитории</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">📋</div>
                        <div class="legend-content"><strong>Скопировать список</strong> — таблица ФИО + код для отправки в чат</div>
                    </div>
                </div>

                <h3 class="help-subtitle">⚙️ Дополнительные настройки</h3>
                <div class="help-summary-table">
                    <table>
                        <thead>
                            <tr><th>Параметр</th><th>Описание</th></tr>
                        </thead>
                        <tbody>
                            <tr><td><strong>Макс. попыток</strong></td><td>Сколько раз студент может пройти зачёт (по умолчанию — 1)</td></tr>
                            <tr><td><strong>Проходной балл</strong></td><td>Минимальный процент для получения «зачтено»</td></tr>
                        </tbody>
                    </table>
                </div>

                <h3 class="help-subtitle">📡 Мониторинг зачёта</h3>
                <p class="help-text">Во время проведения зачёта вы видите в реальном времени: кто начал, кто проходит, кто завершил. Это помогает контролировать процесс прямо из кабинета.</p>

                <div class="help-warning-box">
                    <div class="help-warning-icon">⚠️</div>
                    <div class="help-warning-content">
                        <strong>Важно</strong>
                        <p>Не забудьте добавить участников до начала зачёта — без персонального кода студент не сможет войти в тест.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // СРЕЗ
        // ==========================================
        'srez': `
            <div class="help-section">
                <h2 class="help-subtitle">📊 Срез</h2>
                <p class="help-text">Административный срез — расширенный вариант зачёта с поддержкой вариантов. Используется для масштабных проверок, когда нужно разделить студентов по вариантам.</p>

                <h3 class="help-subtitle">📝 Чем срез отличается от зачёта</h3>
                <div class="help-legend">
                    <div class="help-legend-item">
                        <div class="legend-icon">📊</div>
                        <div class="legend-content"><strong>Варианты</strong> — вопросы распределяются по вариантам, каждый студент получает свой</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">📡</div>
                        <div class="legend-content"><strong>Мониторинг</strong> — расширенная вкладка отслеживания прогресса в реальном времени</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">📄</div>
                        <div class="legend-content"><strong>Отчёты</strong> — экспорт в Word для официальных отчётов</div>
                    </div>
                </div>

                <h3 class="help-subtitle">🎲 Назначение вариантов</h3>
                <p class="help-text">Варианты можно назначить двумя способами:</p>
                <div class="help-steps-mini">
                    <div class="step-mini">
                        <div class="step-mini-num">А</div>
                        <span><strong>Автоматически</strong> — система сама распределит студентов по вариантам равномерно</span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">Б</div>
                        <span><strong>Вручную</strong> — вы сами указываете, кому какой вариант достанется</span>
                    </div>
                </div>

                <h3 class="help-subtitle">📡 Вкладка мониторинга</h3>
                <p class="help-text">Во время среза откройте вкладку <strong>«Мониторинг»</strong>. Вы увидите:</p>
                <div class="help-legend">
                    <div class="help-legend-item">
                        <div class="legend-icon">🟢</div>
                        <div class="legend-content">Кто уже начал тест</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">🔵</div>
                        <div class="legend-content">Кто проходит прямо сейчас (с прогрессом в процентах)</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">✅</div>
                        <div class="legend-content">Кто завершил и с каким результатом</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">⚪</div>
                        <div class="legend-content">Кто ещё не начал</div>
                    </div>
                </div>

                <img src="/help-img/09-monitoring.png" alt="Вкладка мониторинга среза" class="help-screenshot" style="width:100%;border-radius:12px;border:1px solid #e5e5e5;margin:16px 0;">

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Совет</strong>
                        <p>Откройте мониторинг на отдельном экране или планшете — так вы будете видеть прогресс студентов, не переключаясь между вкладками.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // РЕЗУЛЬТАТЫ
        // ==========================================
        'results': `
            <div class="help-section">
                <h2 class="help-subtitle">📋 Результаты</h2>
                <p class="help-text">Все результаты тестирования сохраняются автоматически. Вы можете просмотреть их, отфильтровать, изучить подробности каждого прохождения.</p>

                <img src="/help-img/04-results.png" alt="Вкладка результатов" class="help-screenshot" style="width:100%;border-radius:12px;border:1px solid #e5e5e5;margin:16px 0;">

                <h3 class="help-subtitle">🔍 Фильтры</h3>
                <p class="help-text">Используйте фильтры, чтобы быстро найти нужные результаты:</p>
                <div class="help-legend">
                    <div class="help-legend-item">
                        <div class="legend-icon">👥</div>
                        <div class="legend-content"><strong>По группе</strong> — покажет только студентов выбранной группы</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">📚</div>
                        <div class="legend-content"><strong>По дисциплине</strong> — фильтр по предмету</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">📝</div>
                        <div class="legend-content"><strong>По тесту</strong> — конкретный тест</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">📅</div>
                        <div class="legend-content"><strong>По дате</strong> — период прохождения</div>
                    </div>
                </div>

                <h3 class="help-subtitle">📄 Подробный отчёт</h3>
                <p class="help-text">Нажмите на строку результата, чтобы открыть подробный отчёт. Там видно:</p>
                <div class="help-steps-mini">
                    <div class="step-mini">
                        <div class="step-mini-num">•</div>
                        <span>Каждый вопрос и ответ студента</span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">•</div>
                        <span>Правильный ответ для сравнения</span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">•</div>
                        <span>Время на каждый вопрос</span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">•</div>
                        <span>Нарушения антисписывания (переключения вкладок)</span>
                    </div>
                </div>

                <h3 class="help-subtitle">📝 Заметки преподавателя</h3>
                <p class="help-text">В каждом результате можно оставить заметку или начислить штраф. Например, если вы заметили, что студент пользовался телефоном — добавьте нарушение и снижение балла.</p>

                <h3 class="help-subtitle">⚙️ Управление</h3>
                <div class="help-legend">
                    <div class="help-legend-item">
                        <div class="legend-icon">📊</div>
                        <div class="legend-content"><strong>Постраничное отображение</strong> — настройте количество записей на страницу</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">🔄</div>
                        <div class="legend-content"><strong>Автообновление</strong> — результаты обновляются автоматически</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">🗑️</div>
                        <div class="legend-content"><strong>Удаление</strong> — удалите отдельный результат или несколько сразу (массовое удаление)</div>
                    </div>
                </div>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Совет</strong>
                        <p>Обращайте внимание на столбец «Переключения вкладок» — если у студента 5+ переключений, стоит присмотреться внимательнее.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // АНАЛИТИКА
        // ==========================================
        'analytics': `
            <div class="help-section">
                <h2 class="help-subtitle">📈 Аналитика</h2>
                <p class="help-text">Аналитика помогает понять, как студенты справляются с тестами, какие вопросы самые сложные и как распределяются оценки.</p>

                <img src="/help-img/05-analytics.png" alt="Вкладка аналитики" class="help-screenshot" style="width:100%;border-radius:12px;border:1px solid #e5e5e5;margin:16px 0;">

                <h3 class="help-subtitle">📊 Что показывает аналитика</h3>
                <div class="help-tabs-explain">
                    <div class="help-tab-card">
                        <div class="tab-card-icon">🥧</div>
                        <div class="tab-card-content">
                            <h4>Распределение оценок</h4>
                            <p>Круговая диаграмма: сколько «отлично», «хорошо», «удовл.» и «неуд.». Быстро видно общую картину.</p>
                        </div>
                    </div>
                    <div class="help-tab-card">
                        <div class="tab-card-icon">📏</div>
                        <div class="tab-card-content">
                            <h4>Средний балл</h4>
                            <p>Общий средний балл по тесту и по каждой группе отдельно.</p>
                        </div>
                    </div>
                    <div class="help-tab-card">
                        <div class="tab-card-icon">🔴</div>
                        <div class="tab-card-content">
                            <h4>Самые сложные вопросы</h4>
                            <p>Вопросы, на которые ответили хуже всего. Полезно для корректировки учебного материала.</p>
                        </div>
                    </div>
                </div>

                <h3 class="help-subtitle">🔍 Фильтрация</h3>
                <p class="help-text">Выберите дисциплину и конкретный тест, чтобы увидеть аналитику по нему. Можно сравнивать результаты разных групп.</p>

                <h3 class="help-subtitle">📥 Скачать отчёт</h3>
                <p class="help-text">Нажмите кнопку <strong>«Скачать отчёт»</strong>, чтобы получить аналитику в виде файла — удобно для отчётов на кафедру.</p>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Совет</strong>
                        <p>Если большинство студентов ошибается в одном и том же вопросе — возможно, стоит перепроверить формулировку или вернуться к этой теме на занятии.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ГРУППЫ
        // ==========================================
        'groups': `
            <div class="help-section">
                <h2 class="help-subtitle">👥 Группы</h2>
                <p class="help-text">Управление группами студентов. Создавайте группы, добавляйте студентов вручную или из Excel, загружайте фото.</p>

                <img src="/help-img/06-groups.png" alt="Вкладка групп" class="help-screenshot" style="width:100%;border-radius:12px;border:1px solid #e5e5e5;margin:16px 0;">

                <h3 class="help-subtitle">➕ Создание группы</h3>
                <div class="help-steps-mini">
                    <div class="step-mini">
                        <div class="step-mini-num">1</div>
                        <span>Перейдите на вкладку <strong>«Группы»</strong></span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">2</div>
                        <span>Нажмите <strong>«+ Группа»</strong></span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">3</div>
                        <span>Введите название группы (например, «ИС-21»)</span>
                    </div>
                </div>

                <h3 class="help-subtitle">👤 Добавление студентов</h3>
                <p class="help-text">Студентов можно добавить двумя способами:</p>
                <div class="help-legend">
                    <div class="help-legend-item">
                        <div class="legend-icon">✏️</div>
                        <div class="legend-content"><strong>Вручную</strong> — введите ФИО каждого студента по одному</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">📊</div>
                        <div class="legend-content"><strong>Из Excel</strong> — скачайте шаблон, заполните ФИО и загрузите обратно. Все студенты добавятся разом</div>
                    </div>
                </div>

                <h3 class="help-subtitle">📷 Фото студентов</h3>
                <p class="help-text">Для каждого студента можно загрузить фото. Это помогает при мониторинге зачётов и срезов — вы точно видите, кто проходит тест.</p>

                <h3 class="help-subtitle">🏢 Автоопределение курса и корпуса</h3>
                <p class="help-text">Система автоматически определяет курс и корпус из названия группы. Например, из «ИС-21» понятно, что это 2-й курс, 1-я подгруппа.</p>

                <h3 class="help-subtitle">📁 Папки для групп</h3>
                <p class="help-text">Если групп много, организуйте их по папкам: «1 курс», «2 курс» и т.д.</p>

                <h3 class="help-subtitle">🔍 Поиск и сортировка</h3>
                <p class="help-text">Быстро находите нужную группу по названию. Сортируйте по алфавиту, количеству студентов или дате создания.</p>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Совет</strong>
                        <p>Скачайте шаблон Excel и заполните его один раз — так вы добавите всех студентов за пару минут.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ЭКСПОРТ
        // ==========================================
        'export': `
            <div class="help-section">
                <h2 class="help-subtitle">💾 Экспорт</h2>
                <p class="help-text">Система позволяет экспортировать данные в различных форматах для отчётности, анализа и архивирования.</p>

                <h3 class="help-subtitle">📊 Форматы экспорта результатов</h3>
                <div class="help-tabs-explain">
                    <div class="help-tab-card">
                        <div class="tab-card-icon">📗</div>
                        <div class="tab-card-content">
                            <h4>Excel (.xlsx)</h4>
                            <p>Красиво оформленная таблица с результатами: ФИО, группа, балл, оценка, дата, время прохождения. Готовая для печати и отчётов.</p>
                        </div>
                    </div>
                    <div class="help-tab-card">
                        <div class="tab-card-icon">📄</div>
                        <div class="tab-card-content">
                            <h4>CSV</h4>
                            <p>Универсальный формат для импорта в любые программы: Excel, Google Sheets, базы данных. Подходит для массовой обработки.</p>
                        </div>
                    </div>
                    <div class="help-tab-card">
                        <div class="tab-card-icon">📝</div>
                        <div class="tab-card-content">
                            <h4>Word (.docx)</h4>
                            <p>Оформленный документ для официальных отчётов по административному срезу. Готов к печати и подписи.</p>
                        </div>
                    </div>
                </div>

                <h3 class="help-subtitle">📋 Другие виды экспорта</h3>
                <div class="help-legend">
                    <div class="help-legend-item">
                        <div class="legend-icon">🎫</div>
                        <div class="legend-content"><strong>PDF-карточки</strong> — карточки с персональными кодами участников зачёта/среза для печати</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">👥</div>
                        <div class="legend-content"><strong>Участники зачёта в Excel</strong> — список участников с кодами</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">📊</div>
                        <div class="legend-content"><strong>Участники среза в Excel</strong> — список участников с вариантами и кодами</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">📥</div>
                        <div class="legend-content"><strong>Вопросы в GIFT</strong> — экспорт вопросов теста в формат GIFT для переноса в другие системы</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">🖨️</div>
                        <div class="legend-content"><strong>Предпросмотр для печати</strong> — версия теста для печати на бумаге</div>
                    </div>
                </div>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Совет</strong>
                        <p>Для официальных отчётов на кафедру используйте экспорт в Word — документ уже содержит шапку, таблицу и место для подписи.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // АНТИСПИСЫВАНИЕ
        // ==========================================
        'anticheat': `
            <div class="help-section">
                <h2 class="help-subtitle">🛡️ Антисписывание</h2>
                <p class="help-text">Система предлагает несколько уровней защиты от нечестного прохождения тестов. Комбинируйте их для максимальной эффективности.</p>

                <h3 class="help-subtitle">🔒 Средства защиты</h3>

                <div class="anticheat-card">
                    <div class="anticheat-icon">👁️</div>
                    <div class="anticheat-content">
                        <h4>Отслеживание переключений вкладок</h4>
                        <p>Система фиксирует каждый момент, когда студент уходит с вкладки теста. Преподаватель видит количество переключений в результатах. Можно настроить штрафное время — при каждом переключении у студента отнимаются минуты.</p>
                    </div>
                </div>

                <div class="anticheat-card">
                    <div class="anticheat-icon">🔀</div>
                    <div class="anticheat-content">
                        <h4>Перемешивание вопросов и ответов</h4>
                        <p>Каждый студент получает вопросы в уникальном порядке, а варианты ответов тоже перемешаны. Подсмотреть у соседа становится бессмысленно — у него другой порядок.</p>
                    </div>
                </div>

                <div class="anticheat-card">
                    <div class="anticheat-icon">⏱️</div>
                    <div class="anticheat-content">
                        <h4>Ограничение времени</h4>
                        <p>Жёсткий таймер не оставляет времени на поиск ответов в интернете. Когда время истекает — тест завершается автоматически.</p>
                    </div>
                </div>

                <div class="anticheat-card">
                    <div class="anticheat-icon">🔑</div>
                    <div class="anticheat-content">
                        <h4>Персональные коды</h4>
                        <p>В режимах зачёта и среза каждый студент получает уникальный 5-значный код. Нельзя войти чужим кодом или пройти тест за другого.</p>
                    </div>
                </div>

                <h3 class="help-subtitle">📝 Заметки преподавателя</h3>
                <p class="help-text">Во время мониторинга вы можете вручную добавить нарушение к любому студенту. Типы нарушений:</p>

                <div class="help-summary-table">
                    <table>
                        <thead>
                            <tr><th>Нарушение</th><th>Описание</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>📱 Использование телефона</td><td>Студент пользовался мобильным устройством</td></tr>
                            <tr><td>👀 Подсматривание</td><td>Студент смотрел в экран или работу соседа</td></tr>
                            <tr><td>📒 Использование конспектов</td><td>Студент пользовался записями или шпаргалками</td></tr>
                            <tr><td>⚠️ Другое</td><td>Любое другое нарушение с комментарием</td></tr>
                        </tbody>
                    </table>
                </div>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Совет</strong>
                        <p>Самая эффективная комбинация: перемешивание + ограничение времени + персональные коды. Используйте все три — и списать станет практически невозможно.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // МОНИТОРИНГ
        // ==========================================
        'monitoring': `
            <div class="help-section">
                <h2 class="help-subtitle">📡 Мониторинг</h2>
                <p class="help-text">Мониторинг позволяет в реальном времени наблюдать за ходом тестирования. Особенно полезен при проведении срезов и зачётов в аудитории.</p>

                <img src="/help-img/09-monitoring.png" alt="Мониторинг в реальном времени" class="help-screenshot" style="width:100%;border-radius:12px;border:1px solid #e5e5e5;margin:16px 0;">

                <h3 class="help-subtitle">👁️ Что видит преподаватель</h3>
                <div class="help-legend">
                    <div class="help-legend-item">
                        <div class="legend-icon">⚪</div>
                        <div class="legend-content"><strong>Ожидает</strong> — студент ещё не начал тест</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">🔵</div>
                        <div class="legend-content"><strong>В процессе</strong> — студент проходит тест прямо сейчас</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">🟢</div>
                        <div class="legend-content"><strong>Завершил</strong> — тест пройден, виден результат</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">🔴</div>
                        <div class="legend-content"><strong>Ошибка</strong> — возникла техническая проблема</div>
                    </div>
                </div>

                <h3 class="help-subtitle">👥 Группировка по группам</h3>
                <p class="help-text">Студенты группируются по учебным группам. Нажмите на группу, чтобы развернуть список и увидеть статус каждого студента.</p>

                <h3 class="help-subtitle">🔄 Автообновление</h3>
                <p class="help-text">Данные обновляются автоматически каждые 30 секунд. Вам не нужно перезагружать страницу.</p>

                <h3 class="help-subtitle">⚙️ Управление</h3>
                <div class="help-legend">
                    <div class="help-legend-item">
                        <div class="legend-icon">🔄</div>
                        <div class="legend-content"><strong>Сброс попытки</strong> — если у студента произошёл сбой, можно сбросить его попытку, чтобы он начал заново</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">🚨</div>
                        <div class="legend-content"><strong>Отслеживание ошибок</strong> — система показывает технические проблемы, если они возникли</div>
                    </div>
                </div>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Совет</strong>
                        <p>Откройте мониторинг на отдельном устройстве (планшете или втором мониторе) — так вы будете видеть прогресс студентов в реальном времени, не отвлекаясь от наблюдения за аудиторией.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ЛИЧНЫЙ КАБИНЕТ
        // ==========================================
        'profile': `
            <div class="help-section">
                <h2 class="help-subtitle">👤 Личный кабинет</h2>
                <p class="help-text">В личном кабинете можно изменить свои данные, загрузить аватар и настроить уведомления.</p>

                <img src="/help-img/08-profile.png" alt="Личный кабинет" class="help-screenshot" style="width:100%;border-radius:12px;border:1px solid #e5e5e5;margin:16px 0;">

                <h3 class="help-subtitle">✏️ Основные настройки</h3>
                <div class="help-legend">
                    <div class="help-legend-item">
                        <div class="legend-icon">👤</div>
                        <div class="legend-content"><strong>Имя</strong> — измените отображаемое имя (видно студентам)</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">🔒</div>
                        <div class="legend-content"><strong>Пароль</strong> — смените пароль для входа в систему</div>
                    </div>
                </div>

                <h3 class="help-subtitle">📷 Аватар</h3>
                <p class="help-text">Загрузите своё фото или сделайте снимок с веб-камеры прямо в системе. Доступны инструменты обрезки и масштабирования.</p>

                <div class="help-steps-mini">
                    <div class="step-mini">
                        <div class="step-mini-num">1</div>
                        <span>Нажмите на область аватара</span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">2</div>
                        <span>Выберите файл или используйте веб-камеру</span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">3</div>
                        <span>Обрежьте и отмасштабируйте изображение</span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">4</div>
                        <span>Сохраните</span>
                    </div>
                </div>

                <h3 class="help-subtitle">📱 Telegram-уведомления</h3>
                <p class="help-text">В личном кабинете также настраиваются Telegram-уведомления. Подробнее — в разделе <strong>«Telegram-уведомления»</strong>.</p>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Совет</strong>
                        <p>Загрузите аватар — так студенты будут видеть, кто их преподаватель, а интерфейс станет более персональным.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // TELEGRAM-УВЕДОМЛЕНИЯ
        // ==========================================
        'telegram': `
            <div class="help-section">
                <h2 class="help-subtitle">📱 Telegram-уведомления</h2>
                <p class="help-text">Подключите Telegram-бота, чтобы получать уведомления о результатах тестирования прямо в мессенджер.</p>

                <h3 class="help-subtitle">📋 Что приходит в уведомлениях</h3>
                <div class="help-legend">
                    <div class="help-legend-item">
                        <div class="legend-icon">✅</div>
                        <div class="legend-content">Студент завершил тест — ФИО, группа, результат</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">📊</div>
                        <div class="legend-content">Оценка и процент правильных ответов</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">⚠️</div>
                        <div class="legend-content">Предупреждения о нарушениях (переключения вкладок)</div>
                    </div>
                </div>

                <h3 class="help-subtitle">🔧 Пошаговая настройка</h3>
                <div class="help-steps">
                    <div class="help-step">
                        <div class="help-step-num">1</div>
                        <div class="help-step-content">
                            <h3>Создайте бота</h3>
                            <p>Откройте Telegram и найдите <strong>@BotFather</strong>. Отправьте команду <code>/newbot</code>, придумайте имя и получите <strong>токен</strong> (длинная строка вида <code>123456:ABC-DEF...</code>).</p>
                        </div>
                    </div>
                    <div class="help-step">
                        <div class="help-step-num">2</div>
                        <div class="help-step-content">
                            <h3>Узнайте свой chat_id</h3>
                            <p>Найдите бота <strong>@userinfobot</strong> и нажмите «Start». Он покажет ваш числовой <strong>chat_id</strong>. Скопируйте его.</p>
                        </div>
                    </div>
                    <div class="help-step">
                        <div class="help-step-num">3</div>
                        <div class="help-step-content">
                            <h3>Введите данные в профиле</h3>
                            <p>Перейдите в <strong>Личный кабинет</strong> и вставьте токен бота и chat_id в соответствующие поля. Нажмите «Сохранить».</p>
                        </div>
                    </div>
                    <div class="help-step">
                        <div class="help-step-num">4</div>
                        <div class="help-step-content">
                            <h3>Готово!</h3>
                            <p>Теперь при каждом завершении теста вам придёт сообщение в Telegram с результатом студента.</p>
                        </div>
                    </div>
                </div>

                <h3 class="help-subtitle">⚙️ Управление уведомлениями</h3>
                <p class="help-text">В профиле можно включить или выключить уведомления в любой момент. Токен и chat_id сохраняются — при повторном включении настраивать заново не нужно.</p>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Совет</strong>
                        <p>Создайте отдельного бота специально для уведомлений — так они не потеряются среди других сообщений.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // МОБИЛЬНОЕ ПРИЛОЖЕНИЕ (PWA)
        // ==========================================
        'pwa': `
            <div class="help-section">
                <h2 class="help-subtitle">📲 Мобильное приложение</h2>
                <p class="help-text">Система тестирования — это PWA (Progressive Web App). Это значит, что её можно установить на телефон или планшет как обычное приложение, без скачивания из App Store или Google Play.</p>

                <h3 class="help-subtitle">📱 Что такое PWA</h3>
                <p class="help-text">PWA — это сайт, который работает как приложение. Он открывается в полноэкранном режиме, имеет свою иконку на рабочем столе и может работать при слабом интернете благодаря кешированию.</p>

                <h3 class="help-subtitle">🍎 Установка на iPhone / iPad</h3>
                <div class="help-steps-mini">
                    <div class="step-mini">
                        <div class="step-mini-num">1</div>
                        <span>Откройте <strong>kst-test.ru</strong> в Safari</span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">2</div>
                        <span>Нажмите кнопку <strong>«Поделиться»</strong> (квадрат со стрелкой вверх)</span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">3</div>
                        <span>Выберите <strong>«На экран Домой»</strong></span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">4</div>
                        <span>Нажмите <strong>«Добавить»</strong> — готово!</span>
                    </div>
                </div>

                <h3 class="help-subtitle">🤖 Установка на Android</h3>
                <div class="help-steps-mini">
                    <div class="step-mini">
                        <div class="step-mini-num">1</div>
                        <span>Откройте <strong>kst-test.ru</strong> в Chrome</span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">2</div>
                        <span>Нажмите <strong>меню (три точки)</strong> в правом верхнем углу</span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">3</div>
                        <span>Выберите <strong>«Установить приложение»</strong> или <strong>«Добавить на главный экран»</strong></span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">4</div>
                        <span>Подтвердите установку</span>
                    </div>
                </div>

                <h3 class="help-subtitle">✨ Преимущества PWA</h3>
                <div class="help-legend">
                    <div class="help-legend-item">
                        <div class="legend-icon">⚡</div>
                        <div class="legend-content"><strong>Быстрый доступ</strong> — иконка на рабочем столе, один тап для входа</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">📡</div>
                        <div class="legend-content"><strong>Работает оффлайн</strong> — кешированные страницы доступны без интернета</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">🔄</div>
                        <div class="legend-content"><strong>Автообновление</strong> — всегда актуальная версия без ручного обновления</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">📱</div>
                        <div class="legend-content"><strong>Полноэкранный режим</strong> — выглядит как настоящее приложение</div>
                    </div>
                </div>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Совет для преподавателей</strong>
                        <p>Установите PWA на планшет — так будет удобно мониторить зачёты и срезы, ходя по аудитории.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // КАК НАЧАТЬ ТЕСТ (ДЛЯ СТУДЕНТОВ)
        // ==========================================
        'student-start': `
            <div class="help-section">
                <h2 class="help-subtitle">🎒 Как начать тест</h2>
                <p class="help-text">Эта инструкция для студентов. Расскажите им, как войти в тест — или покажите эту страницу.</p>

                <div class="help-student-box">
                    <h3 style="text-align:center;margin-bottom:12px;">Для начала перейдите по ссылке:</h3>
                    <h2 style="text-align:center;color:#4f46e5;margin:8px 0;">kst-test.ru/start</h2>
                    <p style="text-align:center;color:#666;">Введите код, который дал преподаватель, и нажмите «Начать»</p>
                </div>

                <img src="/help-img/10-student-start.png" alt="Страница входа студента" class="help-screenshot" style="width:100%;border-radius:12px;border:1px solid #e5e5e5;margin:16px 0;">

                <h3 class="help-subtitle">🔢 Типы кодов</h3>
                <div class="help-summary-table">
                    <table>
                        <thead>
                            <tr><th>Режим</th><th>Код</th><th>Описание</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>🎯 Тренировка</td><td>6 цифр (общий)</td><td>Практика — сразу видны правильные ответы</td></tr>
                            <tr><td>📝 Контрольная</td><td>6 цифр (общий)</td><td>Обычный тест — результат в конце</td></tr>
                            <tr><td>🎓 Зачёт</td><td>5 цифр (личный)</td><td>Персональный код от преподавателя</td></tr>
                            <tr><td>📊 Срез</td><td>5 цифр (личный)</td><td>Персональный код с привязкой к варианту</td></tr>
                        </tbody>
                    </table>
                </div>

                <h3 class="help-subtitle">📋 Как определить тип теста</h3>
                <p class="help-text">Система автоматически определяет тип теста по коду. Студенту не нужно ничего выбирать — просто введите код и нажмите «Начать».</p>

                <div class="help-steps-mini">
                    <div class="step-mini">
                        <div class="step-mini-num">1</div>
                        <span>Откройте <strong>kst-test.ru/start</strong></span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">2</div>
                        <span>Введите код (5 или 6 цифр)</span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">3</div>
                        <span>Для зачёта/среза введите ФИО (для контрольной — не обязательно)</span>
                    </div>
                    <div class="step-mini">
                        <div class="step-mini-num">4</div>
                        <span>Нажмите <strong>«Начать тест»</strong></span>
                    </div>
                </div>

                <div class="help-warning-box">
                    <div class="help-warning-icon">⚠️</div>
                    <div class="help-warning-content">
                        <strong>Важно для студентов!</strong>
                        <p>Не делитесь своим персональным кодом с другими. Код привязан к вашему имени — если кто-то войдёт под вашим кодом, его результат запишется на вас.</p>
                    </div>
                </div>
            </div>
        `,

        // ==========================================
        // ИНТЕРФЕЙС ТЕСТА (ДЛЯ СТУДЕНТОВ)
        // ==========================================
        'student-interface': `
            <div class="help-section">
                <h2 class="help-subtitle">🖥️ Интерфейс теста</h2>
                <p class="help-text">Когда тест начнётся, вы увидите интерфейс с вопросом, вариантами ответа и кнопками навигации. Вот что означает каждый элемент.</p>

                <h3 class="help-subtitle">⏱️ Таймер</h3>
                <p class="help-text">В верхней части экрана отображается оставшееся время. Когда время подходит к концу, таймер становится красным. По истечении времени тест завершается автоматически — ваши ответы сохранятся.</p>

                <h3 class="help-subtitle">🔢 Навигация по вопросам</h3>
                <p class="help-text">Пронумерованные кнопки позволяют переключаться между вопросами. Отвеченные вопросы помечаются цветом. Можно возвращаться к предыдущим вопросам и менять ответы.</p>

                <h3 class="help-subtitle">📋 Типы ответов</h3>
                <div class="help-tabs-explain">
                    <div class="help-tab-card">
                        <div class="tab-card-icon">🔘</div>
                        <div class="tab-card-content">
                            <h4>Одиночный выбор</h4>
                            <p>Нажмите на один вариант ответа (радиокнопка).</p>
                        </div>
                    </div>
                    <div class="help-tab-card">
                        <div class="tab-card-icon">☑️</div>
                        <div class="tab-card-content">
                            <h4>Множественный выбор</h4>
                            <p>Отметьте все правильные варианты (чекбоксы). Можно выбрать несколько.</p>
                        </div>
                    </div>
                    <div class="help-tab-card">
                        <div class="tab-card-icon">🔗</div>
                        <div class="tab-card-content">
                            <h4>Сопоставление</h4>
                            <p>Перетащите элементы из правой колонки к соответствующим элементам левой (drag-and-drop).</p>
                        </div>
                    </div>
                    <div class="help-tab-card">
                        <div class="tab-card-icon">🔢</div>
                        <div class="tab-card-content">
                            <h4>Расстановка по порядку</h4>
                            <p>Перетащите элементы в правильной последовательности (drag-and-drop).</p>
                        </div>
                    </div>
                    <div class="help-tab-card">
                        <div class="tab-card-icon">✏️</div>
                        <div class="tab-card-content">
                            <h4>Текстовый ответ</h4>
                            <p>Введите ответ в поле ввода. Регистр не учитывается.</p>
                        </div>
                    </div>
                </div>

                <h3 class="help-subtitle">🔀 Навигация</h3>
                <div class="help-legend">
                    <div class="help-legend-item">
                        <div class="legend-icon">⬅️</div>
                        <div class="legend-content"><strong>Назад</strong> — вернуться к предыдущему вопросу</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">➡️</div>
                        <div class="legend-content"><strong>Вперёд</strong> — перейти к следующему вопросу</div>
                    </div>
                    <div class="help-legend-item">
                        <div class="legend-icon">✅</div>
                        <div class="legend-content"><strong>Завершить тест</strong> — отправить все ответы (кнопка появляется на последнем вопросе или доступна в меню)</div>
                    </div>
                </div>

                <h3 class="help-subtitle">🎯 Режим тренировки</h3>
                <p class="help-text">Если тест в режиме тренировки — после каждого ответа вы сразу увидите, правильно ли ответили. Правильный ответ подсвечивается зелёным, ваш ошибочный — красным.</p>

                <div class="help-warning-box">
                    <div class="help-warning-icon">⚠️</div>
                    <div class="help-warning-content">
                        <strong>Не переключайтесь на другие вкладки!</strong>
                        <p>Система фиксирует каждое переключение на другую вкладку или окно. Преподаватель видит количество переключений в результатах. При настроенном штрафе у вас будет отниматься время.</p>
                    </div>
                </div>

                <div class="help-tip-box">
                    <div class="help-tip-icon">💡</div>
                    <div class="help-tip-content">
                        <strong>Совет</strong>
                        <p>Отвечайте на все вопросы, даже если не уверены — за неотвеченный вопрос баллов точно не будет, а угадать можно.</p>
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
