// ============================================
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ АДМИН-ПАНЕЛИ
// ============================================

const adminState = {
    token: localStorage.getItem('admin_token') || null,
    user: JSON.parse(localStorage.getItem('admin_user') || 'null'),
    disciplines: [],
    topics: [],
    tests: [],
    questions: [],
    results: [],
    users: [],
    allUsers: [], // Все пользователи для отображения авторов
    groups: [], // Группы студентов
    folders: [], // Папки для дисциплин и групп
    folderItems: [], // Привязки элементов к папкам (персональные)
    currentDiscipline: null,
    currentTopic: null,
    currentGroup: null, // Текущая выбранная группа
    currentDisciplineFolder: null, // Текущая папка дисциплин
    currentGroupFolder: null, // Текущая папка групп
    // Пагинация результатов
    resultsPage: 1,
    resultsPerPage: 20,
    filteredResults: [],
    // Сохранённые фильтры результатов (чтобы не сбрасывались при действиях)
    resultsFilters: {
        fio: '',
        groups: [],
        discipline: '',
        test: '',
        testType: ''  // 'exam', 'srez', 'training', 'normal' или '' для всех
    },
    // Флаги ленивой загрузки данных
    loaded: {
        disciplines: false,
        results: false,
        groups: false,
        users: false
    },
    loading: {
        results: false,
        groups: false,
        users: false
    }
};

// ============================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ МОДУЛЕЙ
// ============================================

// Дисциплины
let editingDisciplineId = null;

// Темы
let editingTopicId = null;

// Тесты
let editingTestId = null;
let importedSrezVariants = {};
let selectedGroupsTemp = [];
let duplicatingTestId = null;
let deletingTestId = null;

// Вопросы
let currentTestForQuestions = null;
let currentQuestionsData = []; // Храним загруженные вопросы
let currentVariantFilter = 'all'; // Фильтр по вариантам
let editingQuestionId = null;
let editingQuestionData = null;
let lastEditedQuestionId = null; // Для подсветки отредактированного вопроса
let selectedImportFile = null;
let currentQuestionImage = null;

// Результаты
let resultsAutoRefreshInterval = null;
let isRefreshingResults = false; // Флаг для предотвращения race condition

// Аналитика - определяется в analytics.js с правильной структурой

// Группы
let groupsFilterTimeout = null;
let webcamStream = null;

// Пользователи
let usersFilterTimeout = null;

// Профиль
let avatarImageData = null;
let avatarStream = null;

// Участники зачёта
let currentExamTestId = null;
let examParticipants = [];

// Участники среза
let currentSrezTestId = null;
let srezParticipants = [];

// Debounced версия фильтрации результатов - определяется в results.js
let debouncedFilterResults = null;
