// ============================================
// СЕРВЕР ТЕСТИРОВАНИЯ ДЛЯ VPS (PostgreSQL TimewEB)
// ОПТИМИЗИРОВАНО ДЛЯ 1500+ ПОЛЬЗОВАТЕЛЕЙ
// ============================================

// Загрузка переменных окружения из .env файла
require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { Pool } = require('pg');
// cluster/numCPUs не нужны — PM2 управляет воркерами

// ============================================
// КЛАСТЕРИЗАЦИЯ ОТКЛЮЧЕНА (для стабильности)
// PM2 сам управляет несколькими инстансами
// ============================================

// ============================================
// ГЛОБАЛЬНАЯ ОБРАБОТКА ОШИБОК (предотвращение падений)
// ============================================
process.on('uncaughtException', (err) => {
    console.error('[CRITICAL] Необработанное исключение:', err.message);
    console.error(err.stack);
    // НЕ завершаем процесс - продолжаем работу
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRITICAL] Необработанный Promise rejection:', reason);
    // НЕ завершаем процесс - продолжаем работу
});

// Graceful shutdown — обработчики внизу файла (после создания server и pool)

// ============================================
// КОНФИГУРАЦИЯ
// ============================================
const PORT = process.env.PORT || 3000;
// Слушаем только localhost: наружу ходит nginx (proxy_pass 127.0.0.1:3001). Прямой доступ к
// порту приложения по plain HTTP в обход nginx/TLS закрыт (аудит 2026-06-10). Переопределяется HOST.
const HOST = process.env.HOST || '127.0.0.1';
const SESSION_TTL = 4 * 60 * 60 * 1000; // 4 часа (для работы преподавателей в админке)

// ============================================
// POSTGRESQL TIMEWEB
// ============================================
// ВАЖНО: Все credentials теперь в .env файле!
const DB_CONFIG = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
};

// Проверка наличия обязательных переменных
if (!DB_CONFIG.host || !DB_CONFIG.database || !DB_CONFIG.user || !DB_CONFIG.password) {
    console.error('[FATAL] Отсутствуют обязательные переменные окружения для БД!');
    console.error('Проверьте наличие .env файла и переменных: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD');
    process.exit(1);
}

const pool = new Pool({
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    database: DB_CONFIG.database,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
    ssl: {
        rejectUnauthorized: process.env.DB_SSL_VERIFY === 'true'
    },
    // ОПТИМИЗАЦИЯ: 4 воркера PM2 × 10 соединений = 40 макс к БД (безопасно для PostgreSQL)
    max: 10,                         // 10 соед на воркер (было 30)
    min: 2,                          // Минимум готовых соединений
    idleTimeoutMillis: 60000,        // Держим соединения 1 минуту под нагрузкой
    connectionTimeoutMillis: 15000,  // Таймаут подключения
    acquireTimeoutMillis: 30000,     // Больше времени на ожидание соединения
    allowExitOnIdle: false,          // Не закрывать пул при простое
    statement_timeout: 30000,        // Таймаут запросов 30 сек
    query_timeout: 30000
});

// Обработка ошибок пула PostgreSQL (предотвращение падений)
pool.on('error', (err, client) => {
    console.error('[DB ERROR] Ошибка PostgreSQL пула:', err.message);
    // НЕ падаем - пул автоматически переподключится
});

pool.on('connect', (client) => {
    console.log('[DB] Новое соединение с PostgreSQL установлено');
});

pool.on('remove', (client) => {
    console.log('[DB] Соединение с PostgreSQL закрыто');
});

// ============================================
// DEBOUNCE ДЛЯ СОХРАНЕНИЯ В БД (оптимизация)
// ============================================
const saveDebounceTimers = {};
const SAVE_DEBOUNCE_MS = 500; // Задержка 0.5 секунды (ускорено для высокой нагрузки)

// Сохранение с debounce - группирует множественные записи
function saveDBDebounced(table, data) {
    dataCache[table] = data;

    // Отменяем предыдущий таймер
    if (saveDebounceTimers[table]) {
        clearTimeout(saveDebounceTimers[table]);
    }

    // Устанавливаем новый таймер
    saveDebounceTimers[table] = setTimeout(() => {
        saveToDB(table, dataCache[table]).catch(err => {
            console.error(`[DEBOUNCE] Ошибка сохранения ${table}:`, err.message);
        });
        delete saveDebounceTimers[table];
    }, SAVE_DEBOUNCE_MS);

    return true;
}

// ============================================
// RATE LIMITING (защита от перебора паролей)
// ============================================
const rateLimitStore = {
    login: {},      // IP -> { count, lastAttempt, blockedUntil }
    examCode: {}    // IP -> { count, lastAttempt, blockedUntil }
};

const RATE_LIMIT_CONFIG = {
    login: {
        maxAttempts: 5,          // Максимум попыток
        windowMs: 15 * 60 * 1000, // 15 минут окно
        blockDurationMs: 30 * 60 * 1000 // Блокировка на 30 минут
    },
    examCode: {
        maxAttempts: 10,         // Максимум попыток (больше т.к. студенты могут ошибаться)
        windowMs: 5 * 60 * 1000,  // 5 минут окно
        blockDurationMs: 15 * 60 * 1000 // Блокировка на 15 минут
    }
};

function checkRateLimit(type, ip) {
    const config = RATE_LIMIT_CONFIG[type];
    if (!config) return { allowed: true };
    const store = rateLimitStore[type];
    if (!store[ip]) return { allowed: true };

    const record = store[ip];
    const now = Date.now();

    // Если блокировка истекла — сбрасываем
    if (record.blockedUntil > 0 && now > record.blockedUntil) {
        store[ip] = { count: 0, lastAttempt: now, blockedUntil: 0 };
        return { allowed: true };
    }

    // Если заблокирован
    if (record.blockedUntil > now) {
        const minutesLeft = Math.ceil((record.blockedUntil - now) / 60000);
        return { allowed: false, error: `Слишком много попыток. Подождите ${minutesLeft} мин.` };
    }

    // Если окно истекло — сбрасываем счётчик
    if (now - record.lastAttempt > config.windowMs) {
        store[ip] = { count: 0, lastAttempt: now, blockedUntil: 0 };
        return { allowed: true };
    }

    return { allowed: true };
}

function recordFailedAttempt(type, ip) {
    const config = RATE_LIMIT_CONFIG[type];
    const store = rateLimitStore[type];
    const now = Date.now();

    if (!store[ip]) {
        store[ip] = { count: 0, lastAttempt: now, blockedUntil: 0 };
    }

    const record = store[ip];
    record.count++;
    record.lastAttempt = now;

    // Блокируем если превышен лимит
    if (record.count >= config.maxAttempts) {
        record.blockedUntil = now + config.blockDurationMs;
        console.log(`[RATE LIMIT] IP ${ip} заблокирован для ${type} до ${new Date(record.blockedUntil).toISOString()}`);
    }
}

function resetRateLimit(type, ip) {
    if (rateLimitStore[type][ip]) {
        rateLimitStore[type][ip] = { count: 0, lastAttempt: Date.now(), blockedUntil: 0 };
    }
}

// Очистка старых записей каждые 10 минут
const RATE_LIMIT_MAX_SIZE = 10000;
setInterval(() => {
    const now = Date.now();
    for (const type of Object.keys(rateLimitStore)) {
        const config = RATE_LIMIT_CONFIG[type];
        for (const ip of Object.keys(rateLimitStore[type])) {
            const record = rateLimitStore[type][ip];
            // Удаляем записи старше часа и не заблокированные
            if (now - record.lastAttempt > 3600000 && record.blockedUntil < now) {
                delete rateLimitStore[type][ip];
            }
        }
        // Evict oldest entries if store exceeds max size
        const store = rateLimitStore[type];
        const keys = Object.keys(store);
        if (keys.length > RATE_LIMIT_MAX_SIZE) {
            const sorted = keys.sort((a, b) => store[a].lastAttempt - store[b].lastAttempt);
            const toRemove = sorted.slice(0, keys.length - RATE_LIMIT_MAX_SIZE);
            for (const ip of toRemove) {
                delete store[ip];
            }
            console.log(`[RATE LIMIT] Evicted ${toRemove.length} oldest entries from ${type} store`);
        }
    }
}, 10 * 60 * 1000);

// ============================================
// AUDIT LOG (журнал действий, с персистентностью в БД)
// ============================================
const MAX_AUDIT_LOG_SIZE = 5000; // Максимум записей в БД
const auditSaveDebounceTimer = { ref: null };

function logAudit(action, userId, userName, details) {
    const entry = {
        timestamp: new Date().toISOString(),
        action,
        userId,
        userName,
        details,
        id: crypto.randomBytes(8).toString('hex')
    };

    // Добавляем в кэш
    if (!dataCache['audit_log']) dataCache['audit_log'] = [];
    dataCache['audit_log'].unshift(entry);

    // Ограничиваем размер
    if (dataCache['audit_log'].length > MAX_AUDIT_LOG_SIZE) {
        dataCache['audit_log'] = dataCache['audit_log'].slice(0, MAX_AUDIT_LOG_SIZE);
    }

    // Debounce сохранение в БД (раз в 5 секунд)
    if (auditSaveDebounceTimer.ref) clearTimeout(auditSaveDebounceTimer.ref);
    auditSaveDebounceTimer.ref = setTimeout(() => {
        saveToDB('audit_log', dataCache['audit_log']).catch(err => {
            console.error('[AUDIT] Ошибка сохранения в БД:', err.message);
        });
    }, 5000);

    console.log(`[AUDIT] ${entry.timestamp} | ${userName || 'system'} | ${action} | ${JSON.stringify(details)}`);
    return entry;
}

function getAuditLog(filters = {}) {
    let result = [...(dataCache['audit_log'] || [])];

    if (filters.action) {
        result = result.filter(e => e.action === filters.action);
    }
    if (filters.userId) {
        result = result.filter(e => e.userId === filters.userId);
    }
    if (filters.limit) {
        result = result.slice(0, filters.limit);
    }

    return result;
}

// Кэш данных в памяти для быстрого доступа
const dataCache = {};
let cacheInitialized = false;

// ============================================
// ПЕРИОДИЧЕСКАЯ СИНХРОНИЗАЦИЯ КЭША ИЗ БД
// (Критично для PM2 cluster mode: каждый воркер имеет свой кэш!)
// ============================================
const CACHE_SYNC_INTERVAL = 5000; // 5 секунд
// ПРИМЕЧАНИЕ: 'results' НАМЕРЕННО исключён из частой синхронизации — это самый большой блоб (десятки МБ),
// и его повторный парсинг каждые 5с впустую блокировал event loop. Запись результатов сразу обновляет кэш,
// а при единственном инстансе кэш авторитетен. (При переходе в cluster mode нужна построчная модель results.)
const CACHE_SYNC_TABLES = ['tests', 'questions', 'exam_participants', 'disciplines', 'groups'];
let lastCacheSyncTime = 0;

async function syncCacheFromDB() {
    try {
        const result = await pool.query(
            "SELECT store_name, data, EXTRACT(EPOCH FROM updated_at) as updated_epoch FROM app_data WHERE store_name = ANY($1)",
            [CACHE_SYNC_TABLES]
        );
        for (const row of result.rows) {
            try {
                dataCache[row.store_name] = JSON.parse(row.data || '[]');
            } catch (e) {
                // Не перезаписываем при ошибке парсинга
            }
        }
        lastCacheSyncTime = Date.now();
    } catch (err) {
        console.error('[CACHE-SYNC] Ошибка синхронизации кэша:', err.message);
    }
}

// Запуск периодической синхронизации (после инициализации)
function startCacheSync() {
    setInterval(syncCacheFromDB, CACHE_SYNC_INTERVAL);
    console.log(`[CACHE-SYNC] Синхронизация кэша каждые ${CACHE_SYNC_INTERVAL / 1000}с для: ${CACHE_SYNC_TABLES.join(', ')}`);
}

// Инициализация кэша из БД
async function initCache() {
    if (cacheInitialized) return;
    try {
        const result = await pool.query('SELECT store_name, data FROM app_data');
        for (const row of result.rows) {
            try {
                dataCache[row.store_name] = JSON.parse(row.data || '[]');
            } catch (e) {
                dataCache[row.store_name] = [];
            }
        }
        cacheInitialized = true;
        console.log('Кэш инициализирован из PostgreSQL:', Object.keys(dataCache).join(', '));

        // Миграция: исправляем вопросы sequence (answers -> items)
        if (dataCache.questions) {
            let migrated = 0;
            dataCache.questions = dataCache.questions.map(q => {
                if (q.type === 'sequence' && q.answers && !q.items) {
                    q.items = q.answers.map(a => typeof a === 'string' ? a : (a.text || ''));
                    q.correctOrder = q.answers.map((_, i) => i);
                    delete q.answers;
                    delete q.correct;
                    migrated++;
                }
                return q;
            });
            if (migrated > 0) {
                console.log(`[МИГРАЦИЯ] Исправлено ${migrated} вопросов sequence`);
                saveDB('questions', dataCache.questions);
            }
        }
    } catch (err) {
        console.error('Ошибка инициализации кэша:', err.message);
        throw err;
    }
}

// Загрузка данных (из кэша)
function loadDB(table) {
    if (dataCache[table] !== undefined) {
        return dataCache[table];
    }
    return getDefaultData(table);
}

// Сохранение данных (в кэш и асинхронно в БД)
// ВАЖНО: Кэш обновляется сразу, БД - асинхронно. При ошибке БД данные могут быть потеряны при перезапуске!
function saveDB(table, data) {
    dataCache[table] = data;
    // Асинхронное сохранение в PostgreSQL с повторной попыткой
    saveToDB(table, data).catch(async (err) => {
        console.error(`[ОШИБКА БД] Не удалось сохранить ${table}:`, err.message);
        // Повторная попытка через 2 секунды
        setTimeout(async () => {
            try {
                await saveToDB(table, data);
                console.log(`[БД] Повторное сохранение ${table} успешно`);
            } catch (retryErr) {
                console.error(`[КРИТИЧЕСКАЯ ОШИБКА БД] Повторное сохранение ${table} не удалось:`, retryErr.message);
            }
        }, 2000);
    });
    return true;
}

// Синхронное сохранение данных (ожидает завершения записи в БД)
// Используется для критических операций: импорт вопросов, массовые операции
async function saveDBSync(table, data) {
    dataCache[table] = data;
    try {
        await saveToDB(table, data);
        console.log(`[БД SYNC] ${table} сохранено успешно`);
        return true;
    } catch (err) {
        console.error(`[ОШИБКА БД SYNC] Не удалось сохранить ${table}:`, err.message);
        // Повторная попытка
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            await saveToDB(table, data);
            console.log(`[БД SYNC] Повторное сохранение ${table} успешно`);
            return true;
        } catch (retryErr) {
            console.error(`[КРИТИЧЕСКАЯ ОШИБКА БД SYNC] ${table}:`, retryErr.message);
            return false;
        }
    }
}

// ============================================
// ПОСТРОЧНОЕ ХРАНЕНИЕ РЕЗУЛЬТАТОВ (нагрузка!)
// Раньше вся таблица results хранилась одним JSON-блобом (десятки МБ) и переписывалась
// ЦЕЛИКОМ при каждой сдаче — это не давало держать нагрузку на массовых экзаменах.
// Теперь каждый результат — отдельная строка results_rows; сдача = одна быстрая вставка.
// Чтение по-прежнему идёт из in-memory кэша (loadDB('results')), поэтому все читатели не меняются.
// ============================================
let resultsRowMode = false; // включается после успешной инициализации таблицы

async function ensureResultsTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS results_rows (
            id TEXT PRIMARY KEY,
            test_id TEXT,
            submitted_at TIMESTAMPTZ DEFAULT NOW(),
            data JSONB NOT NULL
        )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_results_rows_test ON results_rows(test_id)`);
}

// Однократная миграция существующих результатов из старого блоба в строки (идемпотентно)
async function migrateResultsToRows() {
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM results_rows');
    if (rows[0].n > 0) {
        console.log(`[RESULTS] Построчное хранилище уже заполнено (${rows[0].n} строк) — миграция не нужна`);
        return;
    }
    const legacy = Array.isArray(dataCache['results']) ? dataCache['results'] : [];
    if (legacy.length === 0) { console.log('[RESULTS] Нет старых результатов для миграции'); return; }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const r of legacy) {
            await client.query(
                `INSERT INTO results_rows (id, test_id, submitted_at, data) VALUES ($1,$2,$3,$4)
                 ON CONFLICT (id) DO NOTHING`,
                [String(r.id), String(r.testId || ''), r.submittedAt || r.completedAt || new Date().toISOString(), JSON.stringify(r)]
            );
        }
        await client.query('COMMIT');
        console.log(`[RESULTS] Мигрировано ${legacy.length} результатов в построчное хранилище (старый блоб сохранён как бэкап)`);
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

async function loadResultsFromRows() {
    const { rows } = await pool.query('SELECT data FROM results_rows ORDER BY submitted_at ASC');
    return rows.map(r => (typeof r.data === 'string' ? JSON.parse(r.data) : r.data));
}

// Вставка ОДНОГО результата (горячий путь сдачи) + обновление кэша. Без переписывания всего блоба.
async function insertResultRow(result) {
    await pool.query(
        `INSERT INTO results_rows (id, test_id, submitted_at, data) VALUES ($1,$2,$3,$4)
         ON CONFLICT (id) DO UPDATE SET data = $4, test_id = $2, submitted_at = $3`,
        [String(result.id), String(result.testId || ''), result.submittedAt || result.completedAt || new Date().toISOString(), JSON.stringify(result)]
    );
}

// Мьютекс записи результатов: сериализует вставки и ресинк, чтобы они не пересекались
// (иначе полный ресинк мог бы затронуть строки, добавленные параллельной сдачей).
let _resultsWriteChain = Promise.resolve();
function withResultsWrite(fn) {
    const run = _resultsWriteChain.then(fn, fn);
    _resultsWriteChain = run.then(() => {}, () => {});
    return run;
}

async function appendResult(result) {
    return withResultsWrite(async () => {
        if (!Array.isArray(dataCache['results'])) dataCache['results'] = [];
        if (!dataCache['results'].some(r => String(r.id) === String(result.id))) {
            dataCache['results'].push(result);
        }
        await runResilient(() => insertResultRow(result), 'results_rows.insert');
        return result;
    });
}

// Полная синхронизация строк с переданным массивом (редкий путь: админ удалил/изменил результаты).
// Сериализуется мьютексом записи, чтобы не пересекаться с параллельными вставками сдач.
async function resyncResultsRows(arr) {
  return withResultsWrite(async () => {
    const ids = arr.map(r => String(r.id));
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        if (ids.length > 0) {
            await client.query('DELETE FROM results_rows WHERE id <> ALL($1::text[])', [ids]);
        } else {
            await client.query('DELETE FROM results_rows');
        }
        for (const r of arr) {
            await client.query(
                `INSERT INTO results_rows (id, test_id, submitted_at, data) VALUES ($1,$2,$3,$4)
                 ON CONFLICT (id) DO UPDATE SET data = $4, test_id = $2, submitted_at = $3`,
                [String(r.id), String(r.testId || ''), r.submittedAt || r.completedAt || new Date().toISOString(), JSON.stringify(r)]
            );
        }
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
  });
}

// Универсальный устойчивый ретрай для произвольной записи
async function runResilient(fn, label, attempts = 5) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
        try { return await fn(); }
        catch (err) {
            lastErr = err;
            const delay = Math.min(4000, 400 * Math.pow(2, i));
            console.error(`[RESILIENT] ${label} ошибка (попытка ${i + 1}/${attempts}): ${err.message}; повтор через ${delay}мс`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    throw lastErr;
}

// Сохранение в PostgreSQL
async function saveToDB(table, data) {
    // Результаты хранятся построчно — НЕ переписываем гигантский блоб.
    // Этот путь срабатывает только на редких админских операциях (удаление/правка результатов).
    if (table === 'results' && resultsRowMode) {
        await resyncResultsRows(Array.isArray(data) ? data : []);
        return;
    }
    const jsonData = JSON.stringify(data);
    await pool.query(
        `INSERT INTO app_data (store_name, data_key, data, updated_at)
         VALUES ($1, 'data', $2, NOW())
         ON CONFLICT (store_name, data_key)
         DO UPDATE SET data = $2, updated_at = NOW()`,
        [table, jsonData]
    );
}

// Мьютексы для атомарных операций с таблицами (promise-based, без busy-wait)
const tableLocks = {};
const TABLE_LOCK_TIMEOUT = 15000; // 15 секунд макс ожидание

async function acquireTableLock(table) {
    if (!tableLocks[table]) {
        tableLocks[table] = { locked: false, queue: [] };
    }
    const lock = tableLocks[table];

    if (!lock.locked) {
        lock.locked = true;
        return;
    }

    // Ожидаем в очереди с таймаутом
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            const idx = lock.queue.indexOf(entry);
            if (idx !== -1) lock.queue.splice(idx, 1);
            reject(new Error(`[LOCK] Таймаут ожидания блокировки таблицы ${table}`));
        }, TABLE_LOCK_TIMEOUT);

        const entry = { resolve, timeout };
        lock.queue.push(entry);
    });
}

function releaseTableLock(table) {
    const lock = tableLocks[table];
    if (!lock) return;

    if (lock.queue.length > 0) {
        const next = lock.queue.shift();
        clearTimeout(next.timeout);
        next.resolve();
    } else {
        lock.locked = false;
    }
}

// Устойчивая запись в БД: несколько повторов с нарастающей задержкой.
// Переживает кратковременную недоступность PostgreSQL (рестарт/maintenance),
// чтобы запись результата не терялась и не превращалась в ошибку 500 для студента.
async function saveToDBResilient(table, data, attempts = 5) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
        try {
            await saveToDB(table, data);
            if (i > 0) console.log(`[БД RESILIENT] ${table} сохранено с попытки ${i + 1}`);
            return true;
        } catch (err) {
            lastErr = err;
            const delay = Math.min(4000, 400 * Math.pow(2, i)); // 400, 800, 1600, 3200, 4000 мс
            console.error(`[БД RESILIENT] Ошибка сохранения ${table} (попытка ${i + 1}/${attempts}): ${err.message}; повтор через ${delay}мс`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    // Данные уже в кэше (dataCache обновлён вызывающим кодом) — они сохранятся при следующей успешной записи
    // или периодическим флэшем. Бросаем, чтобы вызывающий мог решить, как реагировать.
    throw lastErr;
}

// Атомарное добавление элемента в таблицу (защита от гонки данных)
async function addToTable(table, item) {
    await acquireTableLock(table);
    try {
        const data = loadDB(table);
        data.push(item);
        dataCache[table] = data;
        await saveToDBResilient(table, data);
        return item;
    } finally {
        releaseTableLock(table);
    }
}

// Атомарное обновление элемента в таблице
async function updateInTable(table, id, updateFn) {
    await acquireTableLock(table);
    try {
        const data = loadDB(table);
        const idx = data.findIndex(item => String(item.id) === String(id));
        if (idx !== -1) {
            data[idx] = updateFn(data[idx]);
            dataCache[table] = data;
            await saveToDB(table, data);
            return data[idx];
        }
        return null;
    } finally {
        releaseTableLock(table);
    }
}

function getDefaultData(table) {
    const defaults = {
        users: [{
            id: '1',
            username: process.env.ADMIN_USERNAME || 'admin',
            password: hashPassword(process.env.ADMIN_DEFAULT_PASSWORD || 'ChangeMe123!'),
            role: 'admin',
            name: 'Администратор',
            email: '',
            createdAt: new Date().toISOString()
        }]
    };
    return defaults[table] || [];
}

function generateId() {
    return crypto.randomUUID();
}

function generateToken() {
    return 'tk_' + crypto.randomBytes(32).toString('hex');
}

// Секретный ключ для подписи сессий экзамена
// ВАЖНО: Должен быть одинаковым для всех воркеров PM2 cluster mode!
// Используем фиксированный ключ из .env, а не рандомный (иначе разные воркеры генерируют разные подписи)
const EXAM_SESSION_SECRET = process.env.EXAM_SESSION_SECRET || crypto.createHash('sha256').update(DB_CONFIG.password + DB_CONFIG.database + 'exam-session-key').digest('hex');

function signExamSession(participantId, testId) {
    const data = `${participantId}:${testId}`;
    return crypto.createHmac('sha256', EXAM_SESSION_SECRET).update(data).digest('hex');
}

function verifyExamSession(participantId, testId, signature) {
    if (!signature) return false;
    const expected = signExamSession(participantId, testId);
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature);
    if (expectedBuf.length !== signatureBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

const MIN_PASSWORD_LENGTH = 6;

function validatePassword(password) {
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
        return `Пароль должен быть не менее ${MIN_PASSWORD_LENGTH} символов`;
    }
    return null;
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
    if (!storedHash || !storedHash.includes(':')) {
        console.warn('[SECURITY] Попытка входа с plaintext паролем, отклонено');
        return false;
    }
    try {
        const [salt, hash] = storedHash.split(':');
        if (!salt || !hash) return false;
        const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
        const hashBuf = Buffer.from(hash, 'hex');
        const verifyBuf = Buffer.from(verifyHash, 'hex');
        if (hashBuf.length !== verifyBuf.length) return false;
        return crypto.timingSafeEqual(hashBuf, verifyBuf);
    } catch (e) {
        console.error('[SECURITY] Ошибка проверки пароля:', e.message);
        return false;
    }
}

function generateExamPassword(existingPasswords) {
    const used = new Set(existingPasswords.map(p => String(p)));
    let password;
    let attempts = 0;
    do {
        password = String(crypto.randomInt(10000, 100000));
        attempts++;
    } while (used.has(password) && attempts < 10000);
    if (used.has(password)) {
        throw new Error('Невозможно сгенерировать уникальный пароль: все коды заняты');
    }
    return password;
}

// Генерация уникального короткого кода для теста (6-8 цифр)
function generateTestShortCode(existingCodes) {
    const used = new Set(existingCodes.map(c => String(c)));

    // Пробуем разную длину кодов: 6, 7, 8 цифр
    for (let digits = 6; digits <= 8; digits++) {
        const min = Math.pow(10, digits - 1);  // 100000 для 6 цифр
        const max = Math.pow(10, digits);       // 1000000 для 6 цифр
        const maxPossible = max - min;

        // Проверяем, есть ли свободные коды этой длины
        let usedInRange = 0;
        used.forEach(code => {
            const num = parseInt(code);
            if (num >= min && num < max) usedInRange++;
        });

        // Если использовано меньше 90% кодов этой длины, генерируем здесь
        if (usedInRange < maxPossible * 0.9) {
            let code;
            let attempts = 0;
            do {
                code = String(crypto.randomInt(min, max));
                attempts++;
            } while (used.has(code) && attempts < 10000);

            if (!used.has(code)) {
                return code;
            }
        }
    }

    // Если все короткие коды заняты, генерируем 9-значный
    let code;
    let attempts = 0;
    do {
        code = String(crypto.randomInt(100000000, 1000000000));
        attempts++;
    } while (used.has(code) && attempts < 10000);
    return code;
}

// ============================================
// TELEGRAM УВЕДОМЛЕНИЯ
// ============================================

const https = require('https');

async function sendTelegramNotification(token, chatId, message) {
    if (!token || !chatId) return false;

    return new Promise((resolve) => {
        const data = JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
        });

        const options = {
            hostname: 'api.telegram.org',
            port: 443,
            path: `/bot${token}/sendMessage`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(responseData);
                    if (!result.ok) {
                        console.error('Telegram API error:', result.description);
                    }
                    resolve(result.ok);
                } catch {
                    resolve(false);
                }
            });
        });

        req.on('error', (err) => {
            console.error('Telegram request error:', err.message);
            resolve(false);
        });

        req.setTimeout(10000, () => {
            req.destroy();
            resolve(false);
        });

        req.write(data);
        req.end();
    });
}

// Отправка документа в Telegram
async function sendTelegramDocument(token, chatId, fileBuffer, filename, caption) {
    return new Promise((resolve) => {
        const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);

        let body = '';
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`;
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`;
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="parse_mode"\r\n\r\nHTML\r\n`;
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="document"; filename="${filename}"\r\n`;
        body += `Content-Type: text/html\r\n\r\n`;

        const bodyStart = Buffer.from(body, 'utf8');
        const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
        const fullBody = Buffer.concat([bodyStart, fileBuffer, bodyEnd]);

        const options = {
            hostname: 'api.telegram.org',
            port: 443,
            path: `/bot${token}/sendDocument`,
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': fullBody.length
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(responseData);
                    resolve(result.ok);
                } catch {
                    resolve(false);
                }
            });
        });

        req.on('error', () => resolve(false));
        req.setTimeout(30000, () => { req.destroy(); resolve(false); });
        req.write(fullBody);
        req.end();
    });
}

// Защита от XSS в HTML-отчётах
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Генерация HTML отчёта для результата теста
// Функция генерации SVG круговой диаграммы для отчёта
function generateThreeColorPieChart(cleanCorrect, suspectCorrect, incorrect, chartSize = 'small') {
    const total = cleanCorrect + suspectCorrect + incorrect;
    if (total === 0) return '<div style="text-align:center;color:#999;">Нет данных</div>';

    const totalCorrect = cleanCorrect + suspectCorrect;
    const correctPercent = (totalCorrect / total) * 100;

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

    const cleanAngle = (cleanCorrect / total) * 360;
    const suspectAngle = (suspectCorrect / total) * 360;
    const incorrectAngle = (incorrect / total) * 360;

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

    if (!paths) {
        if (cleanCorrect > 0) paths = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#059669"/>`;
        else if (suspectCorrect > 0) paths = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#eab308"/>`;
        else paths = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#dc2626"/>`;
    }

    const percentText = `<text x="${cx}" y="${cy + fontSize/4}" text-anchor="middle" font-size="${fontSize}" font-weight="bold" fill="#1a1a2e">${correctPercent.toFixed(0)}%</text>`;

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

// Форматирование времени прохождения
function formatTimeTaken(timeTaken) {
    if (!timeTaken && timeTaken !== 0) return '-';
    if (typeof timeTaken === 'string' && timeTaken.includes(':')) return timeTaken;
    const totalSeconds = parseInt(timeTaken) || 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// Генерация полноценного HTML отчёта (как на сайте)
function generateResultHtmlReport(result, test, disciplineName) {
    const testName = test ? test.name : result.testName || 'Тест';
    const violations = result.violations || [];
    const details = result.details || [];
    const teacherNotes = result.teacherNotes || [];

    // DEBUG: логирование данных для отчёта
    console.log('[generateResultHtmlReport] result.id:', result.id);
    console.log('[generateResultHtmlReport] teacherNotes:', teacherNotes.length, 'шт');
    console.log('[generateResultHtmlReport] violations:', violations.length, 'шт');

    // Типы нарушений античита
    const anticheatTypes = {
        'screenshot': '📸 Попытка скриншота',
        'tab_switch': '🔄 Переключение вкладки',
        'fullscreen_exit': '🖥️ Выход из полноэкранного режима',
        'split_screen': '📱 Split-screen режим',
        'app_switch': '📲 Переключение приложения',
        'devtools': '🔧 Открытие DevTools'
    };

    // Секция античита
    let anticheatRows = '';
    violations.forEach((v, idx) => {
        const violationTime = v.timestamp ? new Date(v.timestamp).toLocaleTimeString("ru-RU") : '-';
        anticheatRows += `
            <tr class="violation-row">
                <td>${idx + 1}</td>
                <td>${anticheatTypes[v.type] || v.type}</td>
                <td>Вопрос ${v.questionNumber || '-'}</td>
                <td>${v.questionText ? escapeHtml(v.questionText.substring(0, 50)) + '...' : '-'}</td>
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

    // Секция отметок преподавателя после теста
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
                <td>${escapeHtml(note.description) || '-'}</td>
                <td>${escapeHtml(note.addedBy) || '-'}</td>
                <td>${noteTime}</td>
            </tr>`;
    });

    const hasTeacherNotes = teacherNotes.length > 0;
    // Показываем влияние штрафов на баллы
    const originalPointsSrv = result.earnedPoints || result.correctCount || 0;
    const teacherPenaltyCountSrv = result.teacherPenaltyCount || teacherNotes.length;
    const totalPenaltiesSrv = testPenaltyCount + teacherPenaltyCountSrv;
    const adjustedPointsSrv = result.adjustedEarnedPoints !== undefined ? result.adjustedEarnedPoints : Math.max(0, originalPointsSrv - totalPenaltiesSrv);

    const teacherSection = `
        <div class="teacher-section ${hasTeacherNotes ? 'has-notes' : 'clean'}">
            <h2>👨‍🏫 Отметки преподавателя (после теста)</h2>
            ${hasTeacherNotes ? `
                <div class="teacher-summary">
                    <p class="teacher-warning">📝 Отметок: <strong>${teacherNotes.length}</strong></p>
                    <p class="teacher-penalty" style="color: #dc2626; font-weight: 600; margin-top: 8px;">
                        ⚠️ Штраф: <strong>-${teacherPenaltyCountSrv}</strong> балл(ов)
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
                    <td><strong>${originalPointsSrv}</strong></td>
                </tr>
                ${hasTestPenalties ? `<tr>
                    <td>Штрафы во время теста:</td>
                    <td style="color: #dc2626;"><strong>-${testPenaltyCount}</strong></td>
                </tr>` : ''}
                ${hasTeacherNotes ? `<tr>
                    <td>Штрафы после теста:</td>
                    <td style="color: #dc2626;"><strong>-${teacherPenaltyCountSrv}</strong></td>
                </tr>` : ''}
                <tr style="border-top: 2px solid #333; font-size: 1.1rem;">
                    <td>Итого баллов:</td>
                    <td><strong>${adjustedPointsSrv}</strong></td>
                </tr>
            </table>
        </div>
    ` : '';

    // Подсчёт статистики
    const totalViolationsCount = violations.length + teacherNotes.length;
    const hasAnyViolations = totalViolationsCount > 0;

    const violationQuestions = new Set();
    violations.forEach(v => {
        if (v.questionNumber) violationQuestions.add(v.questionNumber);
    });

    let cleanCorrectCount = 0;
    let suspectCorrectCount = 0;
    let incorrectCount = 0;

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

    // Генерация таблицы ответов
    let detailsRows = '';
    details.forEach((d, idx) => {
        const questionNumber = idx + 1;
        const hasViolationOnQuestion = violationQuestions.has(questionNumber);

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

        const userAnswerDisplay = d.userAnswerText || d.userAnswer || '-';
        const correctAnswerDisplay = d.correctAnswerText || d.correctAnswer || '-';

        const timeSpent = d.timeSpent || 0;
        const timeMinutes = Math.floor(timeSpent / 60);
        const timeSeconds = timeSpent % 60;
        const timeStr = timeMinutes > 0 ? `${timeMinutes}м ${timeSeconds}с` : `${timeSeconds}с`;

        // Картинка вопроса (если есть)
        let questionImageHtml = '';
        if (d.questionImage) {
            questionImageHtml = `<div class="question-image-report"><img src="${escapeHtml(d.questionImage)}" alt="Изображение к вопросу" style="max-width: 200px; max-height: 150px; border-radius: 4px; margin-top: 8px;"></div>`;
        }

        // Для match вопросов показываем картинки из пар
        let pairsImagesHtml = '';
        if (d.questionType === 'match' && d.pairs && d.pairs.length > 0) {
            const pairsWithImages = d.pairs.filter(p => p.leftImage || p.rightImage);
            if (pairsWithImages.length > 0) {
                pairsImagesHtml = '<div class="pairs-images-report" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">';
                pairsWithImages.forEach(p => {
                    if (p.leftImage) {
                        pairsImagesHtml += `<img src="${escapeHtml(p.leftImage)}" alt="Левая часть" style="max-width: 80px; max-height: 60px; border-radius: 4px; border: 1px solid #ddd;">`;
                    }
                    if (p.rightImage) {
                        pairsImagesHtml += `<img src="${escapeHtml(p.rightImage)}" alt="Правая часть" style="max-width: 80px; max-height: 60px; border-radius: 4px; border: 1px solid #ddd;">`;
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
                    answersImagesHtml += `<div style="text-align: center;"><img src="${escapeHtml(a.image)}" alt="${escapeHtml(a.letter)}" style="max-width: 80px; max-height: 60px; border-radius: 4px; border: 2px solid ${borderColor};"><div style="font-size: 10px; color: #666;">${escapeHtml(a.letter)}</div></div>`;
                });
                answersImagesHtml += '</div>';
            }
        }

        detailsRows += `
            <tr class="${statusClass}">
                <td>${questionNumber}</td>
                <td>
                    ${escapeHtml(d.questionText) || '-'}
                    ${questionImageHtml}
                    ${pairsImagesHtml}
                    ${answersImagesHtml}
                </td>
                <td class="answer" title="${escapeHtml(userAnswerDisplay)}">${escapeHtml(userAnswerDisplay)}</td>
                <td class="answer" title="${escapeHtml(correctAnswerDisplay)}">${escapeHtml(correctAnswerDisplay)}</td>
                <td class="time-cell">${timeStr}</td>
                <td class="status">${statusIcon}</td>
            </tr>`;
    });

    // Дата прохождения
    const completedDate = new Date(result.completedAt || result.submittedAt || Date.now());
    const dateStr = isNaN(completedDate.getTime()) ? new Date().toLocaleString('ru-RU') : completedDate.toLocaleString('ru-RU');

    return `<!DOCTYPE html>
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
        .grade-badge { border-radius: 12px; display: inline-block; }
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
        .anticheat-section { margin-top: 30px; padding: 20px; border-radius: 8px; }
        .anticheat-section.has-violations { background: #fef2f2; border: 2px solid #dc2626; }
        .anticheat-section.clean { background: #f0fdf4; border: 2px solid #22c55e; }
        .anticheat-section h2 { color: #1a1a2e; margin-bottom: 15px; margin-top: 0; display: flex; align-items: center; gap: 10px; }
        .anticheat-warning { color: #dc2626; font-weight: 600; }
        .anticheat-clean { color: #16a34a; font-weight: 600; font-size: 1.1rem; }
        .violations-table th { background: #dc2626; }
        .violation-row { background: #fff5f5; }
        .violation-row:hover { background: #fee2e2; }
        .penalties-section { margin-top: 20px; padding: 20px; border-radius: 8px; }
        .penalties-section.has-penalties { background: #fef2f2; border: 2px solid #dc2626; }
        .penalties-section.clean { background: #f0fdf4; border: 2px solid #22c55e; }
        .penalties-section h2 { color: #1a1a2e; margin-bottom: 15px; margin-top: 0; display: flex; align-items: center; gap: 10px; }
        .penalties-warning { color: #dc2626; font-weight: 600; }
        .penalties-clean { color: #16a34a; font-weight: 600; font-size: 1.1rem; }
        .penalties-table th { background: #dc2626; color: white; }
        .penalty-row { background: #fff5f5; }
        .penalty-row:hover { background: #fee2e2; }
        .teacher-section { margin-top: 20px; padding: 20px; border-radius: 8px; }
        .teacher-section.has-notes { background: #fffbeb; border: 2px solid #f59e0b; }
        .teacher-section.clean { background: #f0fdf4; border: 2px solid #22c55e; }
        .teacher-section h2 { color: #1a1a2e; margin-bottom: 15px; margin-top: 0; display: flex; align-items: center; gap: 10px; }
        .teacher-warning { color: #d97706; font-weight: 600; }
        .teacher-clean { color: #16a34a; font-weight: 600; font-size: 1.1rem; }
        .teacher-table th { background: #f59e0b; color: white; }
        .teacher-note-row { background: #fffef5; }
        .teacher-note-row:hover { background: #fef3c7; }
        .penalties-total-section { margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px; border: 2px solid #e5e7eb; }
        .penalties-total-section h3 { margin: 0 0 15px 0; color: #1a1a2e; }
        .penalties-summary-table { width: 100%; max-width: 400px; border-collapse: collapse; }
        .penalties-summary-table td { padding: 8px 12px; }
        .penalties-summary-table tr:nth-child(odd) { background: white; }
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
        .legend-dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
        @media print { .watermark { display: none; } }
    </style>
</head>
<body>
    <div class="watermark">${escapeHtml(result.studentSurname)} ${escapeHtml(result.studentName)} | ${escapeHtml(result.studentGroup)}</div>
    <div class="container">
        <h1>📝 Отчёт о тестировании</h1>
        <p class="subtitle">${disciplineName ? `<strong>${escapeHtml(disciplineName)}</strong> — ` : ''}${escapeHtml(testName)}</p>

        <div class="main-result-section" style="display: flex; align-items: center; justify-content: center; gap: 40px; padding: 30px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 16px; margin-bottom: 30px; flex-wrap: wrap;">
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
                <value>${escapeHtml(disciplineName)}</value>
            </div>` : ''}
            <div class="info-card">
                <label>Тест</label>
                <value>${escapeHtml(testName)}</value>
            </div>
            <div class="info-card">
                <label>Дата</label>
                <value>${dateStr}</value>
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
}

// Отправка уведомления о новом результате теста
async function notifyTestResult(testId, result) {
    try {
        const tests = loadDB('tests');
        const test = tests.find(t => String(t.id) === String(testId));
        if (!test) return;

        const users = loadDB('users');
        const creator = users.find(u => String(u.id) === String(test.createdBy));

        if (!creator || !creator.telegramEnabled || !creator.telegramToken || !creator.telegramChatId) {
            return;
        }

        const disciplines = loadDB('disciplines');
        const discipline = disciplines.find(d => String(d.id) === String(test.disciplineId));
        const disciplineName = discipline ? discipline.name : '';

        const gradeEmoji = result.grade === 'Сдал' ? '✅' : result.grade === 'Не сдал' ? '❌' : (result.grade >= 4 ? '✅' : (result.grade >= 3 ? '⚠️' : '❌'));
        const message = `📝 <b>Новый результат теста</b>\n\n` +
            `👤 Студент: <b>${escapeHtml(result.studentSurname)} ${escapeHtml(result.studentName)}</b>\n` +
            `📚 Группа: ${escapeHtml(result.studentGroup)}\n` +
            (disciplineName ? `📖 Дисциплина: ${escapeHtml(disciplineName)}\n` : '') +
            `📋 Тест: ${escapeHtml(test.name)}\n\n` +
            `${gradeEmoji} Оценка: <b>${result.grade}</b>\n` +
            `📊 Результат: ${result.percentage}% (${result.earnedPoints}/${result.maxPoints})\n` +
            `✓ Правильных: ${result.correctCount} из ${result.totalQuestions}\n` +
            (result.penaltyCount > 0 ? `⚠️ Штраф: -${result.penaltyCount}\n` : '') +
            `⏱ Время: ${Math.floor(result.timeTaken / 60)}:${String(result.timeTaken % 60).padStart(2, '0')}`;

        // Отправляем HTML-отчёт как документ с полным сообщением в caption
        try {
            const htmlReport = generateResultHtmlReport(result, test, disciplineName);
            const fileBuffer = Buffer.from(htmlReport, 'utf8');
            // Оценка словом для имени файла
            const gradeWords = { 5: 'отлично', 4: 'хорошо', 3: 'удовл', 2: 'неуд', 'Сдал': 'сдал', 'Не сдал': 'не_сдал' };
            const gradeWord = gradeWords[result.grade] || result.grade;
            const filename = `${result.studentSurname}_${result.studentName}_${gradeWord}.html`;

            await sendTelegramDocument(creator.telegramToken, creator.telegramChatId, fileBuffer, filename, message);
        } catch (docErr) {
            console.error('Error sending telegram document:', docErr.message);
            // Если не удалось отправить файл, отправим хотя бы сообщение
            await sendTelegramNotification(creator.telegramToken, creator.telegramChatId, message);
        }
    } catch (err) {
        console.error('Error sending telegram notification:', err.message);
    }
}

// ============================================
// АВТОРИЗАЦИЯ
// ============================================

function getUserByToken(token) {
    if (!token) return null;
    const sessions = loadDB('sessions');
    const session = sessions.find(s => s.token === token && new Date(s.expiresAt) > new Date());
    if (!session) return null;
    const users = loadDB('users');
    const user = users.find(u => String(u.id) === String(session.userId));
    if (user) {
        return { ...session, ...user };
    }
    return session;
}

// ============================================
// GIFT ПАРСЕР
// ============================================

function parseGIFT(giftText) {
    const questions = [];
    const lines = giftText.split('\n');
    let currentCategory = '';
    let currentLines = [];
    let braceCount = 0;

    for (let line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('//')) continue;
        if (trimmedLine.startsWith('$CATEGORY:')) {
            currentCategory = trimmedLine.substring(10).trim().replace(/^\$course\$\/?/, '');
            continue;
        }

        if (trimmedLine.includes('::') && currentLines.length === 0) {
            currentLines = [trimmedLine];
            braceCount = (trimmedLine.match(/\{/g) || []).length - (trimmedLine.match(/\}/g) || []).length;
            if (braceCount === 0 && trimmedLine.includes('{')) {
                const q = parseQuestionLine(currentLines.join(' '), currentCategory);
                if (q) questions.push(q);
                currentLines = [];
            }
            continue;
        }

        if (currentLines.length > 0) {
            if (trimmedLine) {
                currentLines.push(trimmedLine);
                braceCount += (trimmedLine.match(/\{/g) || []).length - (trimmedLine.match(/\}/g) || []).length;
            }
            if (braceCount === 0) {
                const q = parseQuestionLine(currentLines.join(' '), currentCategory);
                if (q) questions.push(q);
                currentLines = [];
            }
        }
    }

    if (currentLines.length > 0) {
        const q = parseQuestionLine(currentLines.join(' '), currentCategory);
        if (q) questions.push(q);
    }

    return questions;
}

function parseQuestionLine(line, category) {
    const titleMatch = line.match(/::([^:]+)::([\s\S]*)/);
    if (!titleMatch) return null;
    const title = titleMatch[1].trim();
    const content = titleMatch[2].trim();

    // Проверяем соответствие (match) - содержит ->
    if (content.includes(' -> ')) {
        return parseMatchQuestion(title, content, category);
    }

    // Ищем блок ответов {....} - берём от первой { до последней }
    const braceStart = content.indexOf('{');
    const braceEnd = content.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) {
        const beforeText = content.substring(0, braceStart).trim();
        const answersBlock = content.substring(braceStart + 1, braceEnd).trim();

        // Проверяем на последовательность (sequence) - содержит #1, #2, ...
        if (answersBlock.match(/#\d+\s+/)) {
            return parseSequenceQuestion(title, beforeText || title, answersBlock, category);
        }

        return parseStandardQuestion(title, beforeText || title, answersBlock, category);
    }
    return null;
}

// Парсинг вопроса типа "последовательность" (sequence)
// Формат: #1 Первый элемент #2 Второй элемент #3 Третий
function parseSequenceQuestion(title, questionText, answersBlock, category) {
    const items = [];
    // Ищем все элементы вида #N текст
    const itemRegex = /#(\d+)\s+([^#]+)/g;
    let match;
    while ((match = itemRegex.exec(answersBlock)) !== null) {
        const order = parseInt(match[1]);
        const text = match[2].trim();
        if (text) {
            items.push({ order, text });
        }
    }

    if (items.length < 2) return null;

    // Сортируем по порядку и создаём массив ответов
    items.sort((a, b) => a.order - b.order);
    const answers = items.map((item, idx) => ({
        text: item.text,
        isCorrect: true,
        correctPosition: idx
    }));

    return {
        title,
        text: questionText,
        answers,
        type: 'sequence',
        section: category
    };
}

function parseMatchQuestion(title, content, category) {
    const pairs = [];
    const blockMatch = content.match(/^(.*?)\s*\{([\s\S]*)\}\s*$/);
    if (!blockMatch) return null;
    const questionText = blockMatch[1].trim() || title;
    const answersBlock = blockMatch[2];
    const pairRegex = /=([^=~]+?)\s*->\s*([^=~\n]+)/g;
    let match;
    while ((match = pairRegex.exec(answersBlock)) !== null) {
        pairs.push({ left: match[1].trim(), right: match[2].trim() });
    }
    if (pairs.length < 2) return null;
    return { title, text: questionText, pairs, type: 'match', section: category };
}

function parseStandardQuestion(title, questionText, answersBlock, category) {
    const answers = [];
    const correctAnswersOnly = []; // Для короткого ответа (КО)

    // Парсим ответы построчно или по маркерам
    // Поддержка: =Ответ, ~Ответ, %50%Ответ, %-50%Ответ

    // Разбиваем по маркерам ответов, сохраняя маркер
    const parts = answersBlock.split(/(?=\s*(?:=|~|%[-]?\d+(?:\.\d+)?%))/);

    let hasWrongAnswers = false;

    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        // Проверка на процентный вес: %33.33%Ответ или %-50%Ответ
        const percentMatch = trimmed.match(/^%(-?\d+(?:\.\d+)?)%\s*(.+)$/);
        if (percentMatch) {
            const weight = parseFloat(percentMatch[1]);
            const answerText = percentMatch[2].trim();
            if (answerText) {
                const isCorrect = weight > 0;
                answers.push({ text: answerText, isCorrect: isCorrect, weight: Math.abs(weight) });
                if (!isCorrect) hasWrongAnswers = true;
            }
            continue;
        }

        // Стандартные маркеры = и ~
        const marker = trimmed.charAt(0);
        const answerText = trimmed.substring(1).trim();
        if (!answerText) continue;

        if (marker === '=') {
            answers.push({ text: answerText, isCorrect: true });
            correctAnswersOnly.push(answerText);
        } else if (marker === '~') {
            answers.push({ text: answerText, isCorrect: false });
            hasWrongAnswers = true;
        }
    }

    // Если есть только правильные ответы без неправильных - это короткий ответ (КО)
    if (!hasWrongAnswers && correctAnswersOnly.length >= 1) {
        return {
            title,
            text: questionText,
            type: 'short_answer',
            section: category,
            correctAnswers: correctAnswersOnly // Несколько допустимых вариантов ответа
        };
    }

    if (answers.length >= 2) {
        const correctCount = answers.filter(a => a.isCorrect).length;
        const type = correctCount > 1 ? 'multiple' : 'single';
        return {
            title, text: questionText, answers, type: type, section: category,
            correctAnswer: type === 'single' ? answers.findIndex(a => a.isCorrect) : null
        };
    }
    return null;
}

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Prepare a single question for sending to the client (strip correct answers, shuffle)
function prepareQuestionForClient(q, isTrainingMode) {
    const letters = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К', 'Л', 'М', 'Н', 'О', 'П', 'Р', 'С', 'Т', 'У', 'Ф', 'Х', 'Ц', 'Ч', 'Ш', 'Щ', 'Ъ', 'Ы', 'Ь', 'Э', 'Ю', 'Я'];
    const questionType = q.type || 'single';
    if (questionType === 'match') {
        return { id: q.id, text: q.text, image: q.image || null, section: q.section, type: 'match', pairs: q.pairs || [] };
    }
    if (questionType === 'short_answer') {
        return { id: q.id, text: q.text, image: q.image || null, section: q.section, type: 'short_answer' };
    }
    if (questionType === 'sequence') {
        const items = q.items || [];
        return { id: q.id, text: q.text, image: q.image || null, section: q.section, type: 'sequence', items: [...items] };
    }
    if (!q.answers || !Array.isArray(q.answers)) {
        return { id: q.id, text: q.text, image: q.image || null, section: q.section, type: questionType, answers: [] };
    }
    const shuffledAnswers = shuffleArray(q.answers.map(a => ({ text: a.text, image: a.image || null, _origLetter: a.letter })));
    const base = {
        id: q.id, text: q.text, image: q.image || null, section: q.section, type: questionType,
        answers: shuffledAnswers.map((a, i) => ({ letter: letters[i], originalLetter: a._origLetter, text: a.text, image: a.image || null }))
    };
    if (isTrainingMode) base.correct = q.correct;
    return base;
}

// Grade a single answer against a question (returns boolean)
function gradeAnswer(question, userAnswer) {
    const questionType = question.type || 'single';
    if (questionType === 'match') {
        const correctPairs = question.correct;
        if (userAnswer && typeof userAnswer === 'object' && correctPairs && typeof correctPairs === 'object') {
            return Object.keys(correctPairs).every(key => String(userAnswer[key]) === String(correctPairs[key]));
        }
        return false;
    } else if (questionType === 'short_answer') {
        if (userAnswer) {
            const correctAnswers = question.correctAnswers
                || (Array.isArray(question.correct) ? question.correct : [question.correct]);
            return correctAnswers.some(ans => ans != null && String(ans).toLowerCase() === String(userAnswer).trim().toLowerCase());
        }
        return false;
    } else if (questionType === 'multiple') {
        const correctArr = Array.isArray(question.correct) ? question.correct : [question.correct];
        const userArr = Array.isArray(userAnswer) ? userAnswer : (userAnswer ? [userAnswer] : []);
        const sortedUser = [...userArr].sort();
        const sortedCorrect = [...correctArr].sort();
        return sortedUser.length === sortedCorrect.length && sortedUser.every((v, i) => v === sortedCorrect[i]);
    } else if (questionType === 'sequence') {
        if (Array.isArray(userAnswer)) {
            const correctOrder = question.correctOrder || (question.items ? question.items.map((_, i) => i) : null);
            if (correctOrder) {
                return userAnswer.length === correctOrder.length && userAnswer.every((val, idx) => val === correctOrder[idx]);
            }
        }
        return false;
    } else {
        // single: correct может храниться строкой-буквой ИЛИ массивом из одной буквы
        const correctVal = Array.isArray(question.correct) ? question.correct[0] : question.correct;
        return userAnswer != null && correctVal != null && String(correctVal) === String(userAnswer);
    }
}

function calculateGrade(percentage, gradeScale) {
    const scale = gradeScale || { grade5: 90, grade4: 75, grade3: 51 };
    // Режим "Сдал/Не сдал"
    if (scale.passPercent !== undefined) {
        return percentage >= scale.passPercent ? 'Сдал' : 'Не сдал';
    }
    if (percentage >= scale.grade5) return 5;
    if (percentage >= scale.grade4) return 4;
    if (percentage >= scale.grade3) return 3;
    return 2;
}

// Получить CSS-класс для оценки (поддержка числовых и текстовых оценок)
function getGradeCssClass(grade) {
    if (grade === 'Сдал') return 'grade-pass';
    if (grade === 'Не сдал') return 'grade-fail';
    return `grade-${grade}`;
}

// ============================================
// LTI 1.1 ИНТЕГРАЦИЯ С MOODLE
// ============================================

// LTI конфигурация (настраивается в админке)
function getLtiConfig() {
    const settings = loadDB('settings') || [];
    const ltiSettings = settings.find(s => s.id === 'lti') || {};
    return {
        consumerKey: ltiSettings.consumerKey || process.env.LTI_CONSUMER_KEY || '',
        consumerSecret: ltiSettings.consumerSecret || process.env.LTI_CONSUMER_SECRET || '',
        enabled: ltiSettings.enabled || false
    };
}

// OAuth 1.0 подпись для LTI
function verifyLtiSignature(method, url, params, consumerSecret) {
    // Собираем все параметры кроме oauth_signature
    const sortedParams = Object.keys(params)
        .filter(k => k !== 'oauth_signature')
        .sort()
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
        .join('&');

    const baseString = [
        method.toUpperCase(),
        encodeURIComponent(url),
        encodeURIComponent(sortedParams)
    ].join('&');

    const signingKey = encodeURIComponent(consumerSecret) + '&'; // token secret пустой
    const expectedSig = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    const actualBuf = Buffer.from(String(params.oauth_signature || ''), 'utf8');
    if (expectedBuf.length !== actualBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

// Отправка оценки обратно в Moodle (LTI Outcomes)
async function postGradeToMoodle(outcomeUrl, sourcedId, score, consumerKey, consumerSecret) {
    if (!outcomeUrl || !sourcedId) return false;

    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomUUID();
    const messageId = crypto.randomUUID();

    // XML тело для замены результата
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<imsx_POXEnvelopeRequest xmlns="http://www.imsglobal.org/services/ltiv1p1/xsd/imsoms_v1p0">
  <imsx_POXHeader>
    <imsx_POXRequestHeaderInfo>
      <imsx_version>V1.0</imsx_version>
      <imsx_messageIdentifier>${messageId}</imsx_messageIdentifier>
    </imsx_POXRequestHeaderInfo>
  </imsx_POXHeader>
  <imsx_POXBody>
    <replaceResultRequest>
      <resultRecord>
        <sourcedGUID>
          <sourcedId>${sourcedId}</sourcedId>
        </sourcedGUID>
        <result>
          <resultScore>
            <language>en</language>
            <textString>${score}</textString>
          </resultScore>
        </result>
      </resultRecord>
    </replaceResultRequest>
  </imsx_POXBody>
</imsx_POXEnvelopeRequest>`;

    // Генерируем OAuth подпись для запроса
    const bodyHash = crypto.createHash('sha1').update(xmlBody).digest('base64');
    const oauthParams = {
        oauth_consumer_key: consumerKey,
        oauth_nonce: nonce,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: String(timestamp),
        oauth_version: '1.0',
        oauth_body_hash: bodyHash
    };

    const sortedParams = Object.keys(oauthParams).sort()
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
        .join('&');

    const baseString = ['POST', encodeURIComponent(outcomeUrl), encodeURIComponent(sortedParams)].join('&');
    const signingKey = encodeURIComponent(consumerSecret) + '&';
    const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

    const authHeader = 'OAuth ' + Object.entries({ ...oauthParams, oauth_signature: signature })
        .map(([k, v]) => `${k}="${encodeURIComponent(v)}"`)
        .join(', ');

    try {
        const parsedUrl = new URL(outcomeUrl);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/xml',
                'Authorization': authHeader,
                'Content-Length': Buffer.byteLength(xmlBody)
            }
        };

        const httpModule = parsedUrl.protocol === 'https:' ? require('https') : http;

        return new Promise((resolve) => {
            const req = httpModule.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    const success = data.includes('success') || res.statusCode === 200;
                    console.log(`[LTI] Grade posted to Moodle: score=${score}, status=${res.statusCode}, success=${success}`);
                    resolve(success);
                });
            });
            req.on('error', (err) => {
                console.error('[LTI] Error posting grade to Moodle:', err.message);
                resolve(false);
            });
            req.write(xmlBody);
            req.end();
        });
    } catch (err) {
        console.error('[LTI] Error posting grade:', err.message);
        return false;
    }
}

// ============================================
// API РОУТЫ
// ============================================

async function handleAPI(method, pathname, body, token, query, clientIp = 'unknown') {
    // DEBUG: логируем все запросы к results
    if (pathname.includes('/results')) {
        console.log(`[API DEBUG] ${method} ${pathname}`);
    }
    const session = getUserByToken(token);

    // ===== Хелперы контроля доступа по владению тестом (аудит 2026-06-10) =====
    // canViewTest: чтение данных теста — админ, учебный отдел или владелец-преподаватель.
    // canManageTest: правка/удаление/сброс — только админ или владелец-преподаватель.
    function canViewTest(sess, testId) {
        if (!sess) return false;
        if (sess.role === 'admin' || sess.role === 'education_dept') return true;
        const t = loadDB('tests').find(x => String(x.id) === String(testId));
        return !!(t && String(t.createdBy) === String(sess.userId));
    }
    function canManageTest(sess, testId) {
        if (!sess) return false;
        if (sess.role === 'admin') return true;
        const t = loadDB('tests').find(x => String(x.id) === String(testId));
        return !!(t && String(t.createdBy) === String(sess.userId));
    }

    // ========== AUTH ==========
    if (pathname === '/api/auth/login' && method === 'POST') {
        // Rate limiting
        const rateLimitCheck = checkRateLimit('login', clientIp);
        if (!rateLimitCheck.allowed) {
            return { success: false, error: rateLimitCheck.error, statusCode: 429 };
        }

        const { username, password } = body;
        const users = loadDB('users');
        // Поиск без учёта регистра для удобства пользователей
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (!user || !verifyPassword(password, user.password)) {
            recordFailedAttempt('login', clientIp);
            logAudit('LOGIN_FAILED', null, username || 'unknown', { ip: clientIp, reason: 'invalid_credentials' });
            return { success: false, error: 'Неверный логин или пароль', statusCode: 401 };
        }

        // Успешный вход - сбрасываем счётчик
        resetRateLimit('login', clientIp);
        logAudit('LOGIN_SUCCESS', user.id, user.name || user.username, { ip: clientIp });

        const newToken = generateToken();
        const sessions = loadDB('sessions');
        const cleanedSessions = sessions.filter(s => s.userId !== user.id);
        cleanedSessions.push({
            token: newToken, userId: user.id, username: user.username, role: user.role,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + SESSION_TTL).toISOString()
        });
        saveDB('sessions', cleanedSessions);
        return {
            success: true, token: newToken,
            user: { id: user.id, username: user.username, role: user.role, name: user.name }
        };
    }

    if (pathname === '/api/auth/check' && method === 'GET') {
        if (!session) return { success: false, error: 'Не авторизован' };
        // Продлеваем сессию при каждой проверке
        let sessions = loadDB('sessions');
        const sessionIdx = sessions.findIndex(s => s.token === token);
        if (sessionIdx !== -1) {
            sessions[sessionIdx].expiresAt = new Date(Date.now() + SESSION_TTL).toISOString();
            saveDB('sessions', sessions);
        }
        // Возвращаем полные данные пользователя
        const users = loadDB('users');
        const user = users.find(u => String(u.id) === String(session.userId));
        return {
            success: true,
            user: {
                id: session.userId,
                username: session.username,
                role: session.role,
                name: user?.name || session.name,
                email: user?.email,
                avatarUrl: user?.avatarUrl,
                telegramToken: user?.telegramToken ? '***настроен***' : '',
                telegramChatId: user?.telegramChatId || '',
                telegramEnabled: user?.telegramEnabled
            }
        };
    }

    if (pathname === '/api/auth/logout' && method === 'GET') {
        if (token) {
            let sessions = loadDB('sessions');
            sessions = sessions.filter(s => s.token !== token);
            saveDB('sessions', sessions);
        }
        return { success: true };
    }

    // ========== AUDIT LOG ==========
    if (pathname === '/api/audit' && method === 'GET') {
        if (!session || session.role !== 'admin') {
            return { success: false, error: 'Только для администратора', statusCode: 403 };
        }
        const limit = parseInt(query.limit) || 100;
        const action = query.action || null;
        const logs = getAuditLog({ action, limit });
        return { success: true, logs, total: (dataCache['audit_log'] || []).length };
    }

    // ========== USERS ==========
    if (pathname === '/api/users' && method === 'GET') {
        // Список всех учётных записей — только админ/учебный отдел (аудит 2026-06-10):
        // раньше любой аккаунт мог перечислить логины админов для подбора пароля.
        if (!session || (session.role !== 'admin' && session.role !== 'education_dept')) {
            return { success: false, error: 'Нет доступа', statusCode: 403 };
        }
        const users = loadDB('users').map(u => ({
            id: u.id, username: u.username, role: u.role, name: u.name, email: u.email || '', createdAt: u.createdAt, avatarUrl: u.avatarUrl || null
        }));
        return { success: true, users };
    }

    if (pathname === '/api/users' && method === 'POST') {
        if (!session || session.role !== 'admin') return { success: false, error: 'Нет доступа' };
        const { username, password, role, name, email } = body;
        if (!username || !password) return { success: false, error: 'Логин и пароль обязательны' };
        const pwdError = validatePassword(password);
        if (pwdError) return { success: false, error: pwdError };
        const users = loadDB('users');
        if (users.find(u => u.username === username)) return { success: false, error: 'Пользователь уже существует' };
        const newUser = {
            id: generateId(), username, password: hashPassword(password),
            role: role || 'teacher', name: name || username, email: email || '',
            createdAt: new Date().toISOString()
        };
        users.push(newUser);
        saveDB('users', users);
        return { success: true, user: { id: newUser.id, username: newUser.username, role: newUser.role, name: newUser.name } };
    }

    if (pathname.startsWith('/api/users/') && method === 'DELETE') {
        if (!session || session.role !== 'admin') return { success: false, error: 'Нет доступа' };
        const userId = pathname.split('/')[3];
        if (userId === '1') return { success: false, error: 'Нельзя удалить главного админа' };
        let users = loadDB('users');
        const userToDelete = users.find(u => String(u.id) === userId);
        // Audit log
        if (userToDelete) {
            logAudit('DELETE_USER', session.userId, session.username, {
                deletedUserId: userId,
                deletedUsername: userToDelete.username,
                deletedUserName: userToDelete.name,
                deletedUserRole: userToDelete.role
            });
        }
        users = users.filter(u => String(u.id) !== userId);
        saveDB('users', users);
        return { success: true };
    }

    // ========== DISCIPLINES ==========
    if (pathname === '/api/disciplines' && method === 'GET') {
        if (!session) return { success: false, error: 'Не авторизован' };
        let disciplines = loadDB('disciplines');
        const topics = loadDB('topics');
        const tests = loadDB('tests');
        // Админ и учебный отдел видят все дисциплины, преподаватель - только свои
        if (session.role !== 'admin' && session.role !== 'education_dept') {
            disciplines = disciplines.filter(d => d.createdBy === session.userId || d.ownerId === session.userId);
        }
        const result = disciplines.map(d => ({
            ...d,
            topicsCount: topics.filter(t => String(t.disciplineId) === String(d.id)).length,
            testsCount: tests.filter(t => String(t.disciplineId) === String(d.id)).length
        }));
        return { success: true, disciplines: result };
    }

    if (pathname === '/api/disciplines' && method === 'POST') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const { name, code, description, groupName } = body;
        let disciplines = loadDB('disciplines');
        const newDiscipline = {
            id: generateId(), name, code: code || '', description: description || '',
            groupName: groupName || '', ownerId: session.userId, createdBy: session.userId,
            createdAt: new Date().toISOString()
        };
        disciplines.push(newDiscipline);
        saveDB('disciplines', disciplines);
        return { success: true, discipline: newDiscipline };
    }

    if (pathname.startsWith('/api/disciplines/') && method === 'PUT') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const id = pathname.split('/')[3];
        let disciplines = loadDB('disciplines');
        const idx = disciplines.findIndex(d => String(d.id) === id);
        if (idx === -1) return { success: false, error: 'Дисциплина не найдена' };
        if (session.role !== 'admin' && disciplines[idx].ownerId !== session.userId) {
            return { success: false, error: 'Нет прав' };
        }
        if (body.name !== undefined) disciplines[idx].name = body.name;
        saveDB('disciplines', disciplines);
        return { success: true, discipline: disciplines[idx] };
    }

    if (pathname.startsWith('/api/disciplines/') && method === 'DELETE') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const id = pathname.split('/')[3];
        let disciplines = loadDB('disciplines');
        const discipline = disciplines.find(d => String(d.id) === id);
        if (!discipline) return { success: false, error: 'Дисциплина не найдена' };
        if (session.role !== 'admin' && discipline.ownerId !== session.userId) {
            return { success: false, error: 'Нет прав' };
        }
        disciplines = disciplines.filter(d => String(d.id) !== id);
        saveDB('disciplines', disciplines);
        // Удаляем связанные данные
        let topics = loadDB('topics').filter(t => String(t.disciplineId) !== id);
        saveDB('topics', topics);
        let tests = loadDB('tests').filter(t => String(t.disciplineId) !== id);
        saveDB('tests', tests);
        let questions = loadDB('questions').filter(q => String(q.disciplineId) !== id);
        saveDB('questions', questions);
        return { success: true };
    }

    // ========== TOPICS ==========
    if (pathname === '/api/topics' && method === 'GET') {
        if (!session) return { success: false, error: 'Не авторизован' };
        let topics = loadDB('topics');
        const tests = loadDB('tests');
        const disciplines = loadDB('disciplines');
        // Админ и учебный отдел видят все темы, преподаватель - только свои
        if (session.role !== 'admin' && session.role !== 'education_dept') {
            const userDisciplines = disciplines.filter(d => String(d.createdBy) === String(session.userId));
            const userDisciplineIds = userDisciplines.map(d => String(d.id));
            topics = topics.filter(t => userDisciplineIds.includes(String(t.disciplineId)));
        }
        const result = topics.map(t => ({
            ...t, testsCount: tests.filter(test => String(test.topicId) === String(t.id)).length
        }));
        return { success: true, topics: result };
    }

    if (pathname === '/api/topics' && method === 'POST') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const { name, disciplineId } = body;
        let topics = loadDB('topics');
        const newTopic = {
            id: generateId(), name, disciplineId, createdBy: session.userId,
            createdAt: new Date().toISOString()
        };
        topics.push(newTopic);
        saveDB('topics', topics);
        return { success: true, topic: newTopic };
    }

    if (pathname.startsWith('/api/topics/') && method === 'PUT') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const id = pathname.split('/')[3];
        let topics = loadDB('topics');
        const idx = topics.findIndex(t => String(t.id) === id);
        if (idx === -1) return { success: false, error: 'Тема не найдена' };
        // Проверка прав: тема принадлежит дисциплине пользователя или админ
        const disciplines = loadDB('disciplines');
        const discipline = disciplines.find(d => String(d.id) === String(topics[idx].disciplineId));
        if (session.role !== 'admin' && discipline && String(discipline.ownerId) !== String(session.userId) && String(discipline.createdBy) !== String(session.userId)) {
            return { success: false, error: 'Нет прав на редактирование этой темы' };
        }
        if (body.name !== undefined) topics[idx].name = body.name;
        if (body.disciplineId !== undefined) topics[idx].disciplineId = body.disciplineId;
        saveDB('topics', topics);
        return { success: true, topic: topics[idx] };
    }

    if (pathname.startsWith('/api/topics/') && method === 'DELETE') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const id = pathname.split('/')[3];
        let topics = loadDB('topics');
        const topic = topics.find(t => String(t.id) === id);
        if (!topic) return { success: false, error: 'Тема не найдена' };
        // Проверка прав: тема принадлежит дисциплине пользователя или админ
        const disciplines = loadDB('disciplines');
        const discipline = disciplines.find(d => String(d.id) === String(topic.disciplineId));
        if (session.role !== 'admin' && discipline && String(discipline.ownerId) !== String(session.userId) && String(discipline.createdBy) !== String(session.userId)) {
            return { success: false, error: 'Нет прав на удаление этой темы' };
        }
        topics = topics.filter(t => String(t.id) !== id);
        saveDB('topics', topics);
        let tests = loadDB('tests').filter(t => String(t.topicId) !== id);
        saveDB('tests', tests);
        return { success: true };
    }

    // ========== TESTS ==========
    if (pathname === '/api/tests' && method === 'GET') {
        if (!session) return { success: false, error: 'Не авторизован' };
        let tests = loadDB('tests');
        const disciplines = loadDB('disciplines');
        const topics = loadDB('topics');
        const questions = loadDB('questions'); // Загружаем вопросы для подсчёта
        if (session.role !== 'admin' && session.role !== 'education_dept') {
            tests = tests.filter(t => String(t.createdBy) === String(session.userId));
        }
        const disciplinesById = new Map(disciplines.map(d => [String(d.id), d]));
        const topicsById = new Map(topics.map(tp => [String(tp.id), tp]));
        // Pre-compute question counts per test
        const questionCountByTestId = {};
        for (const q of questions) {
            const tid = String(q.testId);
            questionCountByTestId[tid] = (questionCountByTestId[tid] || 0) + 1;
        }
        const result = tests.map(t => {
            const discipline = disciplinesById.get(String(t.disciplineId));
            const topic = topicsById.get(String(t.topicId));
            const poolQuestionsCount = questionCountByTestId[String(t.id)] || 0;
            return { ...t, disciplineName: discipline?.name || 'Неизвестно', topicName: topic?.name || 'Неизвестно', poolQuestionsCount };
        });
        return { success: true, tests: result };
    }

    if (pathname === '/api/tests' && method === 'POST') {
        if (!session) return { success: false, error: 'Не авторизован' };
        let tests = loadDB('tests');
        const testLink = crypto.randomBytes(8).toString('hex');
        // Генерируем уникальный короткий код
        const existingCodes = tests.map(t => t.shortCode).filter(Boolean);
        const shortCode = generateTestShortCode(existingCodes);
        const newTest = {
            id: generateId(), name: body.name, disciplineId: body.disciplineId, topicId: body.topicId,
            link: testLink, shortCode, password: body.password || null, questionsCount: body.questionsCount || 40,
            timeLimit: body.timeLimit || 60, penaltyTime: body.penaltyTime ?? 0,
            isTrainingMode: body.isTrainingMode || false, isExamMode: body.isExamMode || false,
            isAdminSrezMode: body.isAdminSrezMode || false,
            skipGroup: body.skipGroup || false,
            adaptiveMode: body.adaptiveMode || false,
            examSettings: body.isExamMode ? { maxAttempts: body.examSettings?.maxAttempts || 2, passingGrade: body.examSettings?.passingGrade || 3 } : null,
            availableFrom: body.availableFrom || null, availableUntil: body.availableUntil || null,
            hideResults: body.hideResults || false, isActive: body.isActive !== false,
            questionTimeLimit: body.questionTimeLimit || 0,
            createdBy: session.userId, createdAt: new Date().toISOString()
        };
        tests.push(newTest);
        saveDB('tests', tests);
        return { success: true, test: newTest };
    }

    if (pathname.startsWith('/api/tests/') && method === 'PUT') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const id = pathname.split('/')[3];
        let tests = loadDB('tests');
        const idx = tests.findIndex(t => String(t.id) === id);
        if (idx === -1) return { success: false, error: 'Тест не найден' };
        if (session.role !== 'admin' && String(tests[idx].createdBy) !== String(session.userId)) {
            return { success: false, error: 'Нет прав' };
        }
        const allowedTestFields = ['name', 'disciplineId', 'topicId', 'password', 'questionsCount',
            'timeLimit', 'penaltyTime', 'isTrainingMode', 'isExamMode', 'isAdminSrezMode',
            'skipGroup', 'adaptiveMode', 'examSettings', 'availableFrom', 'availableUntil', 'hideResults',
            'isActive', 'gradeScale', 'questionTimeLimit'];
        for (const field of allowedTestFields) {
            if (body[field] !== undefined) tests[idx][field] = body[field];
        }
        saveDB('tests', tests);
        return { success: true, test: tests[idx] };
    }

    if (pathname.startsWith('/api/tests/') && method === 'DELETE') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const id = pathname.split('/')[3];
        let tests = loadDB('tests');
        const test = tests.find(t => String(t.id) === id);
        if (!test) return { success: false, error: 'Тест не найден' };
        // Проверка прав: только создатель или админ
        if (session.role !== 'admin' && String(test.createdBy) !== String(session.userId)) {
            return { success: false, error: 'Нет прав на удаление этого теста' };
        }
        // Audit log
        logAudit('DELETE_TEST', session.userId, session.username, {
            testId: id,
            testName: test.name,
            disciplineId: test.disciplineId,
            topicId: test.topicId
        });
        tests = tests.filter(t => String(t.id) !== id);
        saveDB('tests', tests);
        return { success: true };
    }

    // LTI настройки (только admin)
    if (pathname === '/api/lti/settings' && method === 'GET') {
        if (!session || session.role !== 'admin') return { success: false, error: 'Только для администратора' };
        const ltiConfig = getLtiConfig();
        return { success: true, settings: { consumerKey: ltiConfig.consumerKey, enabled: ltiConfig.enabled, consumerSecret: ltiConfig.consumerSecret ? '***' : '' } };
    }
    if (pathname === '/api/lti/settings' && method === 'PUT') {
        if (!session || session.role !== 'admin') return { success: false, error: 'Только для администратора' };
        let settings = loadDB('settings') || [];
        const idx = settings.findIndex(s => s.id === 'lti');
        const ltiData = {
            id: 'lti',
            consumerKey: body.consumerKey || '',
            consumerSecret: body.consumerSecret && body.consumerSecret !== '***' ? body.consumerSecret : (idx >= 0 ? settings[idx].consumerSecret : ''),
            enabled: body.enabled || false,
            updatedAt: new Date().toISOString()
        };
        if (idx >= 0) settings[idx] = ltiData;
        else settings.push(ltiData);
        await saveDBSync('settings', settings);
        console.log('[LTI] Settings updated:', { consumerKey: ltiData.consumerKey, enabled: ltiData.enabled });
        return { success: true };
    }

    // Сброс штрафов для всех тестов (миграция)
    if (pathname === '/api/tests/reset-penalty' && method === 'POST') {
        if (!session || session.role !== 'admin') {
            return { success: false, error: 'Только для администратора' };
        }
        let tests = loadDB('tests');
        let updated = 0;
        for (let test of tests) {
            if (test.penaltyTime === undefined || test.penaltyTime === null) {
                test.penaltyTime = 0;
                updated++;
            }
        }
        if (updated > 0) {
            saveDB('tests', tests);
        }
        return { success: true, message: `Обновлено тестов: ${updated}` };
    }

    // Массовая настройка тестов: скрыть результаты + зачислить студентов из групп дисциплины
    if (pathname === '/api/tests/bulk-setup' && method === 'POST') {
        if (!session || session.role !== 'admin') {
            return { success: false, error: 'Только для администратора' };
        }

        const tests = loadDB('tests');
        const disciplines = loadDB('disciplines');
        const groups = loadDB('groups');
        let participants = loadDB('exam_participants');

        let testsUpdated = 0;
        let participantsCreated = 0;

        for (const test of tests) {
            // 1. Включаем скрытие результатов
            if (!test.hideResults) {
                test.hideResults = true;
                testsUpdated++;
            }

            // 2. Если это срез/зачёт - зачисляем студентов из привязанных групп
            if (test.isExamMode || test.isAdminSrezMode) {
                const discipline = disciplines.find(d => String(d.id) === String(test.disciplineId));
                if (discipline && discipline.assignedGroups && discipline.assignedGroups.length > 0) {
                    const maxAttempts = test.adminSrezSettings?.maxAttempts || test.examSettings?.maxAttempts || 1;

                    for (const groupId of discipline.assignedGroups) {
                        const group = groups.find(g => String(g.id) === String(groupId));
                        if (!group || !group.students || group.students.length === 0) continue;

                        // Варианты для авторасределения
                        const variantNumbers = [];
                        if (test.adminSrezSettings?.variants) {
                            test.adminSrezSettings.variants.forEach((v, i) => variantNumbers.push(i + 1));
                        }

                        for (const student of group.students) {
                            const parts = student.fullName.trim().split(/\s+/);
                            const surname = parts[0] || '';
                            const name = parts[1] || '';
                            const patronymic = parts.slice(2).join(' ') || '';

                            if (!surname || !name) continue;

                            // Проверяем, не добавлен ли уже
                            const exists = participants.some(p =>
                                String(p.testId) === String(test.id) &&
                                p.surname.toLowerCase() === surname.toLowerCase() &&
                                p.name.toLowerCase() === name.toLowerCase() &&
                                (p.group || '').toUpperCase() === (group.name || '').toUpperCase()
                            );

                            if (exists) continue;

                            // Генерируем уникальный пароль
                            const existingPasswords = participants.map(p => p.password);
                            let password;
                            do {
                                password = String(Math.floor(10000 + Math.random() * 90000));
                            } while (existingPasswords.includes(password));

                            // СЛУЧАЙНОЕ распределение вариантов для каждого студента
                            let variant = null;
                            if (variantNumbers.length > 0) {
                                const randomIndex = Math.floor(Math.random() * variantNumbers.length);
                                variant = variantNumbers[randomIndex];
                            }

                            const participant = {
                                id: generateId(),
                                testId: String(test.id),
                                surname: surname.trim(),
                                name: name.trim(),
                                patronymic: patronymic.trim(),
                                group: group.name.trim(),
                                password,
                                variant,
                                attemptsLeft: maxAttempts,
                                maxAttempts: maxAttempts,
                                status: 'not_started',
                                bestGrade: null,
                                createdAt: new Date().toISOString()
                            };

                            participants.push(participant);
                            participantsCreated++;
                        }
                    }
                }
            }
        }

        saveDB('tests', tests);
        saveDB('exam_participants', participants);

        return {
            success: true,
            message: `Обновлено тестов: ${testsUpdated}, зачислено участников: ${participantsCreated}`
        };
    }

    // ========== QUESTIONS ==========
    if (pathname === '/api/questions' && method === 'GET') {
        if (!session) return { success: false, error: 'Не авторизован' };
        let questions = loadDB('questions');
        if (query.testId) {
            questions = questions.filter(q => String(q.testId) === String(query.testId));
        } else if (query.disciplineId) {
            questions = questions.filter(q => String(q.disciplineId) === String(query.disciplineId));
        }
        return { success: true, questions };
    }

    if (pathname === '/api/questions' && method === 'POST') {
        if (!session) return { success: false, error: 'Не авторизован' };
        let questions = loadDB('questions');
        const newQuestion = {
            id: generateId(), disciplineId: body.disciplineId, testId: body.testId || null,
            section: body.section || '', text: body.text, type: body.type || 'single',
            weight: body.weight || 1, answers: body.answers, pairs: body.pairs || null,
            items: body.items || null, correct: body.correct, explanation: body.explanation || '',
            variant: body.variant || null, createdBy: session.userId, createdAt: new Date().toISOString()
        };
        questions.push(newQuestion);
        // Синхронное сохранение для надёжности
        const saved = await saveDBSync('questions', questions);
        if (!saved) {
            return { success: false, error: 'Ошибка сохранения в базу данных' };
        }
        return { success: true, question: newQuestion };
    }

    if (pathname === '/api/questions/import' && method === 'POST') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const { content, disciplineId, testId, section, variant, format } = body;
        // Поддерживаемые форматы: gift (по умолчанию)
        const importFormat = (format || 'gift').toLowerCase();
        if (importFormat !== 'gift') {
            return { success: false, error: `Формат "${format}" не поддерживается. Используйте GIFT формат.` };
        }
        const parsed = parseGIFT(content);
        if (parsed.length === 0) return { success: false, error: 'Не удалось распознать вопросы', total: 0, imported: 0 };

        let questions = loadDB('questions');
        const letters = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К', 'Л', 'М', 'Н', 'О', 'П', 'Р', 'С', 'Т', 'У', 'Ф', 'Х', 'Ц', 'Ч', 'Ш', 'Щ', 'Ъ', 'Ы', 'Ь', 'Э', 'Ю', 'Я'];
        let imported = 0;

        for (const q of parsed) {
            const newQuestion = {
                id: generateId(), disciplineId, testId: testId || null, variant: variant || null,
                section: q.section || section || '', text: q.text, type: q.type || 'single',
                weight: 1, explanation: '', createdBy: session.userId, createdAt: new Date().toISOString()
            };

            if (q.type === 'match') {
                // Соответствие (СО)
                newQuestion.pairs = q.pairs;
                const correct = {};
                q.pairs.forEach((_, i) => { correct[i] = i; });
                newQuestion.correct = correct;
            } else if (q.type === 'sequence') {
                // Последовательность (ПД) - используем items для клиента
                newQuestion.items = q.answers.map(a => a.text);
                // Правильный порядок - индексы 0, 1, 2, ...
                newQuestion.correctOrder = q.answers.map((_, i) => i);
            } else if (q.type === 'short_answer') {
                // Короткий ответ (КО)
                newQuestion.correctAnswers = q.correctAnswers;
                newQuestion.correct = q.correctAnswers[0]; // Основной правильный ответ
            } else {
                // Стандартные типы: single, multiple
                const shuffledAnswers = shuffleArray(q.answers);
                newQuestion.answers = shuffledAnswers.map((a, i) => ({ letter: letters[i], text: a.text }));

                if (q.type === 'multiple') {
                    // Для множественного выбора - массив правильных букв
                    const correctLetters = [];
                    q.answers.filter(a => a.isCorrect).forEach(correctAns => {
                        const idx = shuffledAnswers.findIndex(a => a.text === correctAns.text);
                        if (idx !== -1) correctLetters.push(letters[idx]);
                    });
                    newQuestion.correct = correctLetters;
                } else {
                    // Для одиночного выбора - одна буква
                    const correctText = q.answers.find(a => a.isCorrect)?.text;
                    const newCorrectIndex = shuffledAnswers.findIndex(a => a.text === correctText);
                    newQuestion.correct = letters[newCorrectIndex] || 'А';
                }
            }
            questions.push(newQuestion);
            imported++;
        }
        // ВАЖНО: Синхронное сохранение для надёжности импорта
        const saved = await saveDBSync('questions', questions);
        console.log('[IMPORT] Parsed:', parsed.length, 'Imported:', imported, 'Saved:', saved);
        if (!saved) {
            return { success: false, error: 'Ошибка сохранения в базу данных. Попробуйте ещё раз.' };
        }
        return { success: true, total: parsed.length, imported };
    }

    if (pathname.startsWith('/api/questions/') && method === 'PUT') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const id = pathname.split('/')[3];
        let questions = loadDB('questions');
        const idx = questions.findIndex(q => String(q.id) === id);
        if (idx === -1) return { success: false, error: 'Вопрос не найден' };
        // Проверка прав: только создатель или админ
        if (session.role !== 'admin' && String(questions[idx].createdBy) !== String(session.userId)) {
            return { success: false, error: 'Нет прав на редактирование этого вопроса' };
        }
        const allowedQuestionFields = ['text', 'image', 'type', 'answers', 'correct', 'section',
            'pairs', 'items', 'testId', 'disciplineId', 'variant', 'acceptableAnswers'];
        for (const field of allowedQuestionFields) {
            if (body[field] !== undefined) questions[idx][field] = body[field];
        }
        await saveDBSync('questions', questions);
        return { success: true, question: questions[idx] };
    }

    // Массовое удаление вопросов (bulk-delete)
    if (pathname === '/api/questions/bulk-delete' && method === 'POST') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const { ids } = body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return { success: false, error: 'Не указаны ID вопросов' };
        }
        const questions = loadDB('questions');
        const idsToDelete = new Set(ids.map(String));
        let deleted = 0;
        let errors = 0;

        // Определяем какие ID можем удалить (одна загрузка, одна фильтрация)
        const allowedIds = new Set();
        for (const id of idsToDelete) {
            const question = questions.find(q => String(q.id) === id);
            if (!question) { errors++; continue; }
            if (session.role !== 'admin' && String(question.createdBy) !== String(session.userId)) {
                errors++; continue;
            }
            logAudit('DELETE_QUESTION', session.userId, session.username, {
                questionId: id, testId: question.testId,
                questionText: (question.text || '').substring(0, 100)
            });
            allowedIds.add(id);
            deleted++;
        }

        const filtered = questions.filter(q => !allowedIds.has(String(q.id)));
        await saveDBSync('questions', filtered);

        return { success: true, deleted, errors };
    }

    if (pathname.startsWith('/api/questions/') && method === 'DELETE') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const id = pathname.split('/')[3];
        let questions = loadDB('questions');
        const question = questions.find(q => String(q.id) === id);
        if (!question) {
            console.log(`[DELETE_QUESTION] Вопрос не найден: ${id}`);
            return { success: false, error: 'Вопрос не найден' };
        }
        // Проверка прав: только создатель или админ
        if (session.role !== 'admin' && String(question.createdBy) !== String(session.userId)) {
            console.log(`[DELETE_QUESTION] Нет прав: user=${session.userId}, createdBy=${question.createdBy}`);
            return { success: false, error: 'Нет прав на удаление этого вопроса' };
        }
        // Audit log
        logAudit('DELETE_QUESTION', session.userId, session.username, {
            questionId: id,
            testId: question.testId,
            questionText: (question.text || '').substring(0, 100)
        });
        questions = questions.filter(q => String(q.id) !== id);
        await saveDBSync('questions', questions);
        return { success: true };
    }

    // ========== RESULTS ==========
    if (pathname === '/api/results' && method === 'GET') {
        if (!session) return { success: false, error: 'Не авторизован' };
        let results = loadDB('results');
        const tests = loadDB('tests');
        if (session.role !== 'admin' && session.role !== 'education_dept') {
            const myTestIds = tests.filter(t => String(t.createdBy) === String(session.userId)).map(t => String(t.id));
            results = results.filter(r => myTestIds.includes(String(r.testId)));
        }
        if (query.testId) {
            results = results.filter(r => String(r.testId) === String(query.testId));
        }
        results.sort((a, b) => new Date(b.completedAt || b.submittedAt) - new Date(a.completedAt || a.submittedAt));
        const total = results.length;
        // Пагинация
        const limit = query.limit ? parseInt(query.limit) : 0;
        const offset = query.offset ? parseInt(query.offset) : 0;
        if (limit > 0) {
            results = results.slice(offset, offset + limit);
        } else if (offset > 0) {
            results = results.slice(offset);
        }
        const testsById = new Map(tests.map(t => [String(t.id), t]));
        const lightResults = results.map(r => {
            const test = testsById.get(String(r.testId));
            return {
                id: r.id, testId: r.testId, testName: test?.name || 'Неизвестный тест',
                studentName: r.studentName, studentSurname: r.studentSurname, studentGroup: r.studentGroup,
                correctCount: r.correctCount, totalQuestions: r.totalQuestions, percentage: r.percentage,
                grade: r.grade, completedAt: r.completedAt, submittedAt: r.submittedAt, timeTaken: r.timeTaken,
                violationsCount: r.violationsCount || (r.violations ? r.violations.length : 0),
                // Штрафы преподавателя
                teacherPenaltyCount: r.teacherPenaltyCount || (r.teacherNotes ? r.teacherNotes.length : 0),
                teacherNotes: r.teacherNotes || [],
                // Скорректированные баллы с учётом штрафов
                earnedPoints: r.earnedPoints || r.correctCount || 0,
                adjustedEarnedPoints: r.adjustedEarnedPoints,
                maxPoints: r.maxPoints || r.totalQuestions || 0,
                penaltyCount: r.penaltyCount || 0
            };
        });
        return { success: true, results: lightResults, total };
    }

    // GET /api/results/export-csv — экспорт результатов в CSV
    if (pathname === '/api/results/export-csv' && method === 'GET') {
        if (!session) return { success: false, error: 'Не авторизован' };
        let results = loadDB('results');
        const tests = loadDB('tests');
        const testsById = new Map(tests.map(t => [String(t.id), t]));

        // Фильтрация по testId если указан
        if (query.testId) {
            results = results.filter(r => String(r.testId) === query.testId);
        }
        // Фильтрация по правам
        if (session.role !== 'admin') {
            results = results.filter(r => {
                const test = testsById.get(String(r.testId));
                return test && String(test.createdBy) === String(session.userId);
            });
        }

        const BOM = '\uFEFF';
        const header = 'Фамилия;Имя;Группа;Тест;Баллы;Макс;Процент;Оценка;Штрафы;Нарушения;Дата\n';
        const rows = results.map(r => {
            const test = testsById.get(String(r.testId));
            const date = r.completedAt ? new Date(r.completedAt).toLocaleString('ru-RU') : '';
            return [
                r.studentSurname || '', r.studentName || '', r.studentGroup || '',
                (test?.name || '').replace(/;/g, ','), r.adjustedEarnedPoints ?? r.earnedPoints ?? r.correctCount ?? 0,
                r.maxPoints || r.totalQuestions || 0, r.percentage || 0, r.grade || 0,
                (r.penaltyCount || 0) + (r.teacherPenaltyCount || 0),
                r.violationsCount || 0, date
            ].join(';');
        }).join('\n');

        return { __raw: true, contentType: 'text/csv; charset=utf-8', body: BOM + header + rows,
            headers: { 'Content-Disposition': 'attachment; filename="results.csv"' } };
    }

    // GET /api/results/:id - получение одного результата (только если путь точно /api/results/:id, без дополнительных сегментов)
    if (pathname.match(/^\/api\/results\/[^/]+$/) && method === 'GET') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const id = pathname.split('/')[3];
        const results = loadDB('results');
        const result = results.find(r => String(r.id) === id);
        if (!result) return { success: false, error: 'Результат не найден' };
        // Просмотр результата (с ключом ответов) — только админ/учебный отдел или владелец теста (аудит 2026-06-10).
        if (!canViewTest(session, result.testId)) {
            return { success: false, error: 'Нет прав на просмотр этого результата', statusCode: 403 };
        }
        // Отладка: логируем наличие teacherNotes
        console.log(`[GET /results/${id}] teacherNotes:`, result.teacherNotes ? JSON.stringify(result.teacherNotes) : 'пусто');
        console.log(`[GET /results/${id}] teacherPenaltyCount:`, result.teacherPenaltyCount || 0);
        console.log(`[GET /results/${id}] violations:`, result.violations ? result.violations.length : 0);
        return { success: true, result };
    }

    // DELETE /api/results/:id - удаление одного результата
    if (pathname.match(/^\/api\/results\/[^/]+$/) && method === 'DELETE') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const id = pathname.split('/')[3];
        let results = loadDB('results');
        const result = results.find(r => String(r.id) === id);
        if (!result) return { success: false, error: 'Результат не найден' };
        // Проверка прав: только владелец теста или админ
        if (session.role !== 'admin') {
            const tests = loadDB('tests');
            const test = tests.find(t => String(t.id) === String(result.testId));
            if (!test || String(test.createdBy) !== String(session.userId)) {
                return { success: false, error: 'Нет прав на удаление этого результата' };
            }
        }
        // Audit log
        logAudit('DELETE_RESULT', session.userId, session.username, {
            resultId: id,
            studentName: `${result.studentSurname} ${result.studentName}`,
            studentGroup: result.studentGroup,
            testId: result.testId,
            grade: result.grade,
            percentage: result.percentage
        });
        results = results.filter(r => String(r.id) !== id);
        saveDB('results', results);
        return { success: true };
    }

    // ========== GROUPS ==========
    if (pathname === '/api/groups' && method === 'GET') {
        if (!session) return { success: false, error: 'Не авторизован' };
        let groups = loadDB('groups');
        // Админ и учебный отдел видят все группы, преподаватель — только назначенные
        if (session.role !== 'admin' && session.role !== 'education_dept') {
            groups = groups.filter(g => g.assignedTeachers && g.assignedTeachers.includes(String(session.userId)));
        }
        // full=true возвращает полную информацию включая студентов
        const full = query.full === 'true';
        const result = groups.map(g => {
            const base = {
                id: g.id, name: g.name, studentsCount: g.students?.length || 0,
                assignedTeachers: session.role === 'admin' ? (g.assignedTeachers || []) : undefined,
                createdAt: g.createdAt
            };
            if (full) {
                base.students = g.students || [];
            }
            return base;
        });
        return { success: true, groups: result };
    }

    if (pathname === '/api/groups' && method === 'POST') {
        if (!session || session.role !== 'admin') return { success: false, error: 'Только админ может создавать группы' };
        const { name, students, assignedTeachers } = body;
        if (!name) return { success: false, error: 'Название группы обязательно' };
        let groups = loadDB('groups');
        if (groups.some(g => g.name.toLowerCase() === name.trim().toLowerCase())) {
            return { success: false, error: 'Группа уже существует' };
        }
        const processedStudents = (students || []).map(s => ({
            id: generateId(), fullName: s.fullName?.trim() || s.trim(), photoUrl: s.photoUrl || null,
            createdAt: new Date().toISOString()
        })).filter(s => s.fullName);
        const newGroup = {
            id: generateId(), name: name.trim(), students: processedStudents,
            assignedTeachers: assignedTeachers || [], createdAt: new Date().toISOString()
        };
        groups.push(newGroup);
        saveDB('groups', groups);
        return { success: true, group: newGroup };
    }

    if (pathname.startsWith('/api/groups/') && !pathname.includes('/students') && method === 'GET') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const id = pathname.split('/')[3];
        const groups = loadDB('groups');
        const group = groups.find(g => String(g.id) === id);
        if (!group) return { success: false, error: 'Группа не найдена' };
        // Доступ к составу группы — админ/учебный отдел или назначенный преподаватель (аудит 2026-06-10).
        if (session.role !== 'admin' && session.role !== 'education_dept' &&
            !(group.assignedTeachers || []).includes(String(session.userId))) {
            return { success: false, error: 'Нет прав на просмотр этой группы', statusCode: 403 };
        }
        return { success: true, group };
    }

    if (pathname.startsWith('/api/groups/') && !pathname.includes('/students') && method === 'PUT') {
        if (!session || session.role !== 'admin') return { success: false, error: 'Только админ' };
        const id = pathname.split('/')[3];
        let groups = loadDB('groups');
        const idx = groups.findIndex(g => String(g.id) === id);
        if (idx === -1) return { success: false, error: 'Группа не найдена' };
        if (body.name) groups[idx].name = body.name.trim();
        if (body.students !== undefined) {
            groups[idx].students = body.students.map(s => ({
                id: s.id || generateId(), fullName: typeof s === 'string' ? s.trim() : (s.fullName?.trim() || ''),
                photoUrl: s.photoUrl || null, createdAt: s.createdAt || new Date().toISOString()
            })).filter(s => s.fullName);
        }
        if (body.assignedTeachers !== undefined) groups[idx].assignedTeachers = body.assignedTeachers || [];
        groups[idx].updatedAt = new Date().toISOString();
        saveDB('groups', groups);
        return { success: true, group: groups[idx] };
    }

    if (pathname.startsWith('/api/groups/') && !pathname.includes('/students') && method === 'DELETE') {
        if (!session || session.role !== 'admin') return { success: false, error: 'Только админ' };
        const id = pathname.split('/')[3];
        let groups = loadDB('groups');
        groups = groups.filter(g => String(g.id) !== id);
        saveDB('groups', groups);
        return { success: true };
    }

    // ========== EXAM PARTICIPANTS ==========
    if (pathname === '/api/exam/participants' && method === 'GET') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const testId = query.testId;
        if (!testId) return { success: false, error: 'Не указан testId' };
        // Список участников содержит коды входа — только админ/учебный отдел или владелец теста (аудит 2026-06-10).
        if (!canViewTest(session, testId)) {
            return { success: false, error: 'Нет прав на просмотр участников этого теста', statusCode: 403 };
        }
        const participants = loadDB('exam_participants').filter(p => String(p.testId) === String(testId));
        const results = loadDB('results');
        const enriched = participants.map(p => {
            const participantResults = results.filter(r =>
                String(r.participantId) === String(p.id) ||
                (String(r.testId) === String(testId) && r.studentSurname === p.surname && r.studentName === p.name)
            );
            const lastResult = participantResults[participantResults.length - 1];
            return { ...p, lastResult: lastResult ? { grade: lastResult.grade, percentage: lastResult.percentage, completedAt: lastResult.completedAt } : null };
        });
        return { success: true, participants: enriched };
    }

    // ========== MONITOR: Дашборд мониторинга среза в реальном времени ==========
    if (pathname === '/api/exam/monitor' && method === 'GET') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const testId = query.testId;
        if (!testId) return { success: false, error: 'Не указан testId' };
        // Мониторинг среза — только админ/учебный отдел или владелец теста (аудит 2026-06-10).
        if (!canViewTest(session, testId)) {
            return { success: false, error: 'Нет прав на мониторинг этого теста', statusCode: 403 };
        }

        // Получаем участников
        const participants = loadDB('exam_participants').filter(p => String(p.testId) === String(testId));

        // Получаем активные сессии
        const activeTests = loadDB('active_tests') || [];

        // Получаем результаты
        const results = loadDB('results').filter(r => String(r.testId) === String(testId));

        // Объединяем данные для каждого участника
        const enriched = participants.map(p => {
            // Ищем активную сессию по participantId или по ФИО
            const activeSession = activeTests.find(a =>
                (a.participantId && String(a.participantId) === String(p.id)) ||
                (String(a.testId) === String(testId) &&
                 a.studentSurname === p.surname &&
                 a.studentName === p.name)
            );

            // Результаты этого участника
            const participantResults = results.filter(r =>
                String(r.participantId) === String(p.id) ||
                (r.studentSurname === p.surname && r.studentName === p.name)
            );

            // Лучший результат
            const bestResult = participantResults.reduce((best, r) =>
                (!best || r.percentage > best.percentage) ? r : best, null);

            // Проверяем активна ли сессия (время не истекло)
            const now = Date.now();
            const isSessionActive = activeSession && activeSession.endTime && activeSession.endTime > now;

            return {
                id: p.id,
                surname: p.surname,
                name: p.name,
                patronymic: p.patronymic || '',
                group: p.group,
                variant: p.variant,
                status: p.status,
                attemptsLeft: p.attemptsLeft,
                maxAttempts: p.maxAttempts,

                // Данные активной сессии (если в процессе)
                liveProgress: isSessionActive ? {
                    currentQuestion: activeSession.currentQuestion || 0,
                    totalQuestions: activeSession.questions?.length || 0,
                    answeredCount: Object.keys(activeSession.answers || {}).length,
                    startTime: activeSession.startTime,
                    endTime: activeSession.endTime,
                    violations: activeSession.violations || [],
                    lastUpdate: activeSession.updatedAt || activeSession.startTime
                } : null,

                // Лучший результат
                bestResult: bestResult ? {
                    id: bestResult.id,
                    grade: bestResult.grade,
                    percentage: bestResult.percentage,
                    completedAt: bestResult.completedAt || bestResult.submittedAt,
                    timeTaken: bestResult.timeTaken,
                    violationsCount: bestResult.violationsCount || (bestResult.violations?.length || 0),
                    correctCount: bestResult.correctCount,
                    totalQuestions: bestResult.totalQuestions
                } : null
            };
        });

        return { success: true, participants: enriched, serverTime: Date.now() };
    }

    if (pathname === '/api/exam/participants' && method === 'POST') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const { testId, group, maxAttempts, variant, autoDistribute, participants: newParticipants } = body;
        if (!testId || !group || !newParticipants) return { success: false, error: 'Неверные параметры' };
        // Добавлять участников можно только в свой тест (аудит 2026-06-10).
        if (!canManageTest(session, testId)) {
            return { success: false, error: 'Нет прав на изменение участников этого теста', statusCode: 403 };
        }

        // Автосоздание группы или добавление студентов в существующую
        const groupName = group.trim();
        let groups = loadDB('groups');
        let targetGroup = groups.find(g => g.name.toLowerCase() === groupName.toLowerCase());
        let groupIdx = groups.findIndex(g => g.name.toLowerCase() === groupName.toLowerCase());

        if (!targetGroup) {
            // Создаём группу автоматически
            targetGroup = {
                id: generateId(),
                name: groupName,
                students: [],
                createdAt: new Date().toISOString(),
                createdBy: session.userId,
                autoCreated: true  // Пометка что создана автоматически
            };
            groups.push(targetGroup);
            groupIdx = groups.length - 1;
            console.log(`Автосоздана группа: ${groupName}`);
        }

        // Добавляем студентов в группу (если их там ещё нет)
        if (!targetGroup.students) targetGroup.students = [];
        const existingStudentNames = targetGroup.students.map(s => s.fullName?.toLowerCase());

        for (const p of newParticipants) {
            if (!p.surname) continue;
            const fullName = `${p.surname.trim()} ${(p.name || '').trim()} ${(p.patronymic || '').trim()}`.trim();

            if (!existingStudentNames.includes(fullName.toLowerCase())) {
                targetGroup.students.push({
                    id: generateId(),
                    fullName: fullName,
                    createdAt: new Date().toISOString()
                });
                existingStudentNames.push(fullName.toLowerCase());
            }
        }

        groups[groupIdx] = targetGroup;
        saveDB('groups', groups);

        // Получаем информацию о тесте для автораспределения вариантов
        const tests = loadDB('tests');
        const test = tests.find(t => String(t.id) === String(testId));
        const variants = test?.adminSrezSettings?.variants || [];
        const variantNumbers = variants.map(v => v.number);

        let allParticipants = loadDB('exam_participants');
        const existingPasswords = allParticipants.map(p => p.password);
        const created = [];
        let skipped = 0;

        for (let i = 0; i < newParticipants.length; i++) {
            const p = newParticipants[i];
            if (!p.surname) continue;

            // Проверка на дубликат: тот же тест + фамилия + имя + группа
            const duplicate = allParticipants.find(existing =>
                String(existing.testId) === String(testId) &&
                existing.surname.trim().toLowerCase() === p.surname.trim().toLowerCase() &&
                existing.name.trim().toLowerCase() === (p.name || '').trim().toLowerCase() &&
                existing.group.trim().toLowerCase() === group.trim().toLowerCase()
            );
            if (duplicate) {
                skipped++;
                continue; // Пропускаем дубликат
            }

            const password = generateExamPassword([...existingPasswords, ...created.map(c => c.password)]);

            // Определяем вариант: явно указан > автораспределение > общий вариант > null
            let participantVariant = p.variant || variant || null;
            if (!participantVariant && autoDistribute && variantNumbers.length > 0) {
                // Автораспределение - равномерно по вариантам
                participantVariant = variantNumbers[i % variantNumbers.length];
            }

            const effectiveMaxAttempts = maxAttempts || 2;
            const participant = {
                id: generateId(), testId: String(testId), surname: p.surname.trim(), name: (p.name || '').trim(),
                patronymic: (p.patronymic || '').trim(), group: group.trim(), password,
                variant: participantVariant, attemptsLeft: effectiveMaxAttempts, maxAttempts: effectiveMaxAttempts,
                status: 'not_started', bestGrade: null, createdAt: new Date().toISOString()
            };
            created.push(participant);
        }
        allParticipants = [...allParticipants, ...created];
        saveDB('exam_participants', allParticipants);
        return { success: true, created: created.length, skipped, participants: created };
    }

    if (pathname.startsWith('/api/exam/participants/') && method === 'PUT') {
        if (!session) return { success: false, error: 'Не авторизован' };
        if (session.role !== 'admin' && session.role !== 'teacher') return { success: false, error: 'Нет прав', statusCode: 403 };
        const id = pathname.split('/')[4];
        let participants = loadDB('exam_participants');
        const idx = participants.findIndex(p => String(p.id) === id);
        if (idx === -1) return { success: false, error: 'Участник не найден' };
        if (body.addAttempts) {
            participants[idx].attemptsLeft = (participants[idx].attemptsLeft || 0) + body.addAttempts;
            participants[idx].maxAttempts = (participants[idx].maxAttempts || 0) + body.addAttempts;
            // Сбрасываем статус чтобы участник мог войти заново
            if (participants[idx].status === 'passed' || participants[idx].status === 'failed' || participants[idx].status === 'completed') {
                participants[idx].status = 'not_started';
            }
        }
        if (body.status) participants[idx].status = body.status;
        if (body.variant !== undefined) participants[idx].variant = body.variant;
        saveDB('exam_participants', participants);
        return { success: true, participant: participants[idx] };
    }

    // Сброс всех попыток участников (оставляем коды, сбрасываем статус и результаты)
    if (pathname === '/api/exam/participants/reset' && method === 'POST') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const { testId } = body;
        if (!testId) return { success: false, error: 'testId обязателен' };
        // Сброс участников и удаление результатов — деструктивно, только админ/владелец теста (аудит 2026-06-10).
        if (!canManageTest(session, testId)) {
            return { success: false, error: 'Нет прав на сброс участников этого теста', statusCode: 403 };
        }

        let participants = loadDB('exam_participants');
        let results = loadDB('results');
        let activeTests = loadDB('active_tests');

        // Находим участников этого теста
        const testParticipants = participants.filter(p => String(p.testId) === String(testId));
        if (testParticipants.length === 0) {
            return { success: false, error: 'Участники не найдены' };
        }

        // Сбрасываем статус участников
        let resetCount = 0;
        participants = participants.map(p => {
            if (String(p.testId) === String(testId)) {
                resetCount++;
                return {
                    ...p,
                    status: 'not_started',
                    bestGrade: null,
                    attemptsLeft: p.maxAttempts || 2
                };
            }
            return p;
        });

        // Удаляем результаты по этому тесту
        const resultsBefore = results.length;
        results = results.filter(r => String(r.testId) !== String(testId));
        const deletedResults = resultsBefore - results.length;

        // Удаляем активные сессии по этому тесту
        const activeBefore = activeTests.length;
        activeTests = activeTests.filter(a => String(a.testId) !== String(testId));
        const deletedActive = activeBefore - activeTests.length;

        saveDB('exam_participants', participants);
        saveDB('results', results);
        saveDBDebounced('active_tests', activeTests);

        return {
            success: true,
            resetParticipants: resetCount,
            deletedResults,
            deletedActiveSessions: deletedActive
        };
    }

    // Удаление всех участников по testId
    if (pathname === '/api/exam/participants' && method === 'DELETE' && query.testId) {
        if (!session) return { success: false, error: 'Не авторизован' };
        // Массовое удаление участников — только админ/владелец теста (аудит 2026-06-10).
        if (!canManageTest(session, query.testId)) {
            return { success: false, error: 'Нет прав на удаление участников этого теста', statusCode: 403 };
        }
        let participants = loadDB('exam_participants');
        const before = participants.length;
        participants = participants.filter(p => String(p.testId) !== String(query.testId));
        const deleted = before - participants.length;
        saveDB('exam_participants', participants);
        return { success: true, deleted };
    }

    if (pathname.startsWith('/api/exam/participants/') && method === 'DELETE') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const id = pathname.split('/')[4];
        let participants = loadDB('exam_participants');
        // Удаление участника — только админ/владелец теста, к которому он привязан (аудит 2026-06-10).
        const target = participants.find(p => String(p.id) === id);
        if (target && !canManageTest(session, target.testId)) {
            return { success: false, error: 'Нет прав на удаление этого участника', statusCode: 403 };
        }
        participants = participants.filter(p => String(p.id) !== id);
        saveDB('exam_participants', participants);
        return { success: true };
    }

    // ========== PUBLIC API (для студентов) ==========

    // Универсальная проверка - поддерживает и 5-значные пароли участников и 6+ значные коды тестов
    if (pathname === '/api/public/universal-check' && method === 'POST') {
        // Проверяем готовность кэша (критично для новых воркеров!)
        if (!cacheInitialized) {
            console.log('[WARN] universal-check: Кэш ещё не инициализирован, ожидаем...');
            await initCache();
        }

        const { code } = body;
        if (!code || !/^\d{5,}$/.test(code)) {
            return { success: false, error: 'Введите код (минимум 5 цифр)' };
        }

        // Сначала проверяем как 5-значный пароль участника (для зачётов/срезов)
        if (code.length === 5) {
            const participants = loadDB('exam_participants');
            const participant = participants.find(p => String(p.password) === String(code));

            if (participant) {
                // Нашли участника - определяем тип теста
                const tests = loadDB('tests');
                const test = tests.find(t => String(t.id) === String(participant.testId));

                if (!test) {
                    return { success: false, error: 'Тест не найден' };
                }

                if (!test.isActive) {
                    return { success: false, error: 'Тест временно отключён' };
                }

                // Проверяем статус участника
                if (participant.status === 'completed' || participant.status === 'passed' || participant.status === 'failed') {
                    return { success: false, error: 'Вы уже прошли этот тест' };
                }

                // Определяем куда перенаправить - код передаём отдельно (НЕ в URL для безопасности!)
                if (test.isAdminSrezMode) {
                    return { success: true, redirectUrl: `/srez`, testType: 'srez', testName: test.name, secureCode: code };
                } else {
                    return { success: true, redirectUrl: `/exam`, testType: 'exam', testName: test.name, secureCode: code };
                }
            }
        }

        // Проверяем как 6+ значный код теста
        const tests = loadDB('tests');
        const test = tests.find(t => String(t.shortCode) === String(code));

        if (!test) {
            return { success: false, error: 'Код не найден. Проверьте правильность ввода.' };
        }

        if (!test.isActive) {
            return { success: false, error: 'Тест временно отключён' };
        }

        // Проверка времени доступа
        const now = new Date();
        if (test.availableFrom && now < new Date(test.availableFrom)) {
            return { success: false, error: `Тест будет доступен с ${new Date(test.availableFrom).toLocaleString('ru-RU')}` };
        }
        if (test.availableUntil && now > new Date(test.availableUntil)) {
            return { success: false, error: 'Время прохождения теста истекло' };
        }

        // Для зачётов и срезов с 6-значным кодом - всё равно нужен персональный пароль
        if (test.isExamMode) {
            return { success: true, redirectUrl: '/exam', testType: 'exam', testName: test.name };
        } else if (test.isAdminSrezMode) {
            return { success: true, redirectUrl: '/srez', testType: 'srez', testName: test.name };
        } else {
            // Обычный тест - перенаправляем по прямой ссылке
            return {
                success: true,
                redirectUrl: `/test/${test.link}`,
                testType: test.isTrainingMode ? 'training' : 'test',
                testName: test.name,
                needPassword: test.password && test.password.trim() !== ''
            };
        }
    }

    // Проверка кода теста (6+ цифр) - старый endpoint для совместимости
    if (pathname === '/api/public/check-code' && method === 'POST') {
        // Проверяем готовность кэша
        if (!cacheInitialized) {
            console.log('[WARN] check-code: Кэш ещё не инициализирован, ожидаем...');
            await initCache();
        }

        const { code } = body;
        if (!code || !/^\d{6,}$/.test(code)) {
            return { success: false, error: 'Введите код (минимум 6 цифр)' };
        }

        const tests = loadDB('tests');
        const test = tests.find(t => String(t.shortCode) === String(code));

        if (!test) {
            return { success: false, error: 'Тест с таким кодом не найден' };
        }

        if (!test.isActive) {
            return { success: false, error: 'Тест временно отключён' };
        }

        // Проверка времени доступа
        const now = new Date();
        if (test.availableFrom && now < new Date(test.availableFrom)) {
            return { success: false, error: `Тест будет доступен с ${new Date(test.availableFrom).toLocaleString('ru-RU')}` };
        }
        if (test.availableUntil && now > new Date(test.availableUntil)) {
            return { success: false, error: 'Время прохождения теста истекло' };
        }

        // Определяем тип теста и формируем URL перенаправления
        let redirectUrl;
        let testType;

        if (test.isExamMode) {
            // Зачёт - перенаправляем на exam.html
            redirectUrl = `exam.html?code=${code}`;
            testType = 'exam';
        } else if (test.isAdminSrezMode) {
            // Срез - перенаправляем на srez.html
            redirectUrl = `srez.html?code=${code}`;
            testType = 'srez';
        } else {
            // Обычный тест или тренировка - перенаправляем на test.html
            redirectUrl = `test.html?code=${code}`;
            testType = test.isTrainingMode ? 'training' : 'test';
        }

        return {
            success: true,
            redirectUrl,
            testType,
            testName: test.name,
            needPassword: !test.isExamMode && !test.isAdminSrezMode && test.password && test.password.trim() !== ''
        };
    }

    // Получить link теста по testId (для восстановления сессии)
    if (pathname === '/api/public/test-link' && method === 'POST') {
        // Проверяем готовность кэша
        if (!cacheInitialized) {
            await initCache();
        }

        const { testId } = body;
        if (!testId) {
            return { success: false, error: 'testId обязателен' };
        }
        const tests = loadDB('tests');
        const test = tests.find(t => String(t.id) === String(testId));
        if (!test || !test.link) {
            return { success: false, error: 'Тест не найден' };
        }
        return { success: true, testLink: test.link };
    }

    // Поиск теста по короткому коду (6+ цифр)
    if (pathname === '/api/public/test-by-code' && method === 'POST') {
        // Проверяем готовность кэша
        if (!cacheInitialized) {
            await initCache();
        }

        const { code } = body;
        if (!code || !/^\d{6,}$/.test(code)) {
            return { success: false, error: 'Введите код (минимум 6 цифр)' };
        }

        const tests = loadDB('tests');
        const test = tests.find(t => String(t.shortCode) === String(code));

        if (!test) {
            return { success: false, error: 'Тест с таким кодом не найден' };
        }

        if (!test.isActive) {
            return { success: false, error: 'Тест временно отключён' };
        }

        if (test.isExamMode) {
            return { success: false, error: 'Этот тест доступен только через страницу зачёта', redirectToExam: true };
        }

        // Возвращаем link теста для перенаправления
        return {
            success: true,
            testLink: test.link,
            needPassword: test.password && test.password.trim() !== ''
        };
    }

    // ========== LIVE EXAM MONITOR: Мониторинг активных студентов на тесте ==========
    if (pathname.startsWith('/api/exam/monitor/') && method === 'GET') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const testId = pathname.split('/').pop();
        if (!testId) return { success: false, error: 'Не указан testId' };

        const activeTests = loadDB('active_tests') || [];
        const now = Date.now();

        // Фильтруем только активные сессии для данного теста
        const activeForTest = activeTests.filter(a =>
            String(a.testId) === String(testId) && a.endTime && a.endTime > now
        );

        // Оставляем только самую свежую сессию для каждого студента (по времени старта)
        const latestByStudent = {};
        for (const a of activeForTest) {
            const key = `${(a.studentSurname || '').toLowerCase()}_${(a.studentName || '').toLowerCase()}_${(a.studentGroup || '').toLowerCase()}`;
            const startTs = a.startTime || 0;
            if (!latestByStudent[key] || startTs > (latestByStudent[key].startTime || 0)) {
                latestByStudent[key] = a;
            }
        }
        const uniqueActive = Object.values(latestByStudent);

        const students = uniqueActive.map(a => {
            const totalQuestions = (a.questionIds || []).length || (a.questions ? a.questions.length : 0);
            const currentQuestion = a.progressCurrentQuestion != null ? a.progressCurrentQuestion : (a.currentQuestion || 0) + 1;
            const answeredCount = a.progressAnsweredCount != null ? a.progressAnsweredCount : currentQuestion;
            const startTime = a.startTime;
            const elapsedMinutes = Math.round((now - startTime) / 60000);
            const lastUpdate = a.progressUpdatedAt || a.updatedAt || startTime;
            const idleMinutes = Math.round((now - lastUpdate) / 60000);

            return {
                studentSurname: a.studentSurname || '',
                studentName: a.studentName || '',
                studentGroup: a.studentGroup || '',
                currentQuestion,
                totalQuestions,
                answeredCount,
                startTime,
                elapsedMinutes,
                idleMinutes,
                lastUpdate,
                violations: {
                    tabSwitches: a.tabSwitchCount || 0,
                    fullscreenExits: a.fullscreenExitCount || 0
                }
            };
        });

        return { success: true, students, serverTime: now };
    }

    // ========== UPDATE PROGRESS: Студент периодически отправляет прогресс ==========
    if (pathname === '/api/public/update-progress' && method === 'POST') {
        const { sessionId, currentQuestion, answeredCount, violations } = body;
        if (!sessionId) return { success: false, error: 'sessionId required' };

        const activeTests = loadDB('active_tests');
        const idx = activeTests.findIndex(t => t.sessionId === sessionId);
        if (idx >= 0) {
            activeTests[idx].progressCurrentQuestion = currentQuestion || 0;
            activeTests[idx].progressAnsweredCount = answeredCount || 0;
            activeTests[idx].progressUpdatedAt = Date.now();
            if (violations) {
                activeTests[idx].tabSwitchCount = Math.max(activeTests[idx].tabSwitchCount || 0, violations.tabSwitches || 0);
                activeTests[idx].fullscreenExitCount = Math.max(activeTests[idx].fullscreenExitCount || 0, violations.fullscreenExits || 0);
            }
            saveDBDebounced('active_tests', activeTests);
        }
        return { success: true };
    }

    // Сохранение/удаление активного теста (для восстановления сессии)
    // ОПТИМИЗАЦИЯ: НЕ сохраняем questions в active_tests - это вызывало утечку памяти!
    // Вопросы загружаются заново при восстановлении по testId
    if (pathname === '/api/public/active-test' && method === 'POST') {
        const {
            sessionId, testId, answers, currentQuestion, startTime, endTime,
            studentName, studentSurname, studentGroup, participantId, violations,
            tabSwitchCount, fullscreenExitCount, screenshotAttempts, isExamMode,
            penalties, // штрафы преподавателя/проктора — храним на сервере (аудит 2026-06-10)
            questionIds, variant // Сохраняем только ID вопросов и вариант, не сами вопросы
        } = body;
        if (!sessionId) return { success: false, error: 'sessionId required' };
        const activeTests = loadDB('active_tests');
        const existing = activeTests.findIndex(t => t.sessionId === sessionId);
        const data = {
            sessionId, testId,
            // НЕ сохраняем questions - только их ID для восстановления
            questionIds: questionIds || (body.questions ? body.questions.map(q => q.id) : []),
            variant: variant || null,
            answers, currentQuestion, startTime, endTime,
            studentName, studentSurname, studentGroup,
            participantId: participantId || null,
            violations: violations || [],
            tabSwitchCount: tabSwitchCount || 0,
            fullscreenExitCount: fullscreenExitCount || 0,
            screenshotAttempts: screenshotAttempts || 0,
            // Штрафы проктора фиксируем монотонно: не даём клиенту «обнулить» уже записанные
            // (берём более длинный из старого и нового списка). Аудит 2026-06-10.
            penalties: (() => {
                const incoming = Array.isArray(penalties) ? penalties : [];
                const prev = (existing >= 0 && Array.isArray(activeTests[existing].penalties)) ? activeTests[existing].penalties : [];
                return incoming.length >= prev.length ? incoming : prev;
            })(),
            isExamMode: isExamMode || false,
            updatedAt: Date.now()
        };
        if (existing >= 0) {
            activeTests[existing] = data;
        } else {
            activeTests.push(data);
        }
        saveDBDebounced('active_tests', activeTests);
        return { success: true };
    }

    if (pathname === '/api/public/active-test' && method === 'DELETE') {
        const { sessionId } = body;
        if (!sessionId) return { success: false, error: 'sessionId required' };
        let activeTests = loadDB('active_tests');
        activeTests = activeTests.filter(t => t.sessionId !== sessionId);
        saveDBDebounced('active_tests', activeTests);
        return { success: true };
    }

    // === ADAPTIVE TESTING: next question endpoint ===
    if (pathname === '/api/public/next-question' && method === 'POST') {
        const { sessionId: adaptiveSessionId, lastQuestionId, wasCorrect, answer } = body;
        if (!adaptiveSessionId) return { success: false, error: 'sessionId required' };

        let adaptiveSessions = loadDB('adaptive_sessions');
        const session = adaptiveSessions.find(s => s.id === adaptiveSessionId);
        if (!session) return { success: false, error: 'Adaptive session not found' };

        const tests = loadDB('tests');
        const test = tests.find(t => String(t.id) === String(session.testId));
        if (!test) return { success: false, error: 'Test not found' };

        const allQuestions = loadDB('questions');

        // Grade the last answered question
        let lastAnswerCorrect = false;
        if (lastQuestionId && answer !== undefined) {
            const lastQuestion = allQuestions.find(q => String(q.id) === String(lastQuestionId));
            if (lastQuestion) {
                lastAnswerCorrect = gradeAnswer(lastQuestion, answer);
                if (lastAnswerCorrect) session.correctCount++;
            }
        }

        // Update difficulty based on performance
        if (wasCorrect || lastAnswerCorrect) {
            session.currentDifficulty = Math.min(3, session.currentDifficulty + 1);
        } else {
            session.currentDifficulty = Math.max(1, session.currentDifficulty - 1);
        }

        // Check if we've reached the limit
        if (session.questionsServed >= session.questionsLimit) {
            saveDBDebounced('adaptive_sessions', adaptiveSessions);
            return { success: true, finished: true, wasCorrect: lastAnswerCorrect };
        }

        // Find available questions (not yet answered)
        const availableQuestions = allQuestions.filter(q =>
            session.questionPool.includes(q.id) && !session.answeredQuestions.includes(q.id)
        );

        if (availableQuestions.length === 0) {
            saveDBDebounced('adaptive_sessions', adaptiveSessions);
            return { success: true, finished: true, wasCorrect: lastAnswerCorrect };
        }

        // Select next question based on target difficulty
        const targetDifficulty = session.currentDifficulty;
        let candidates = availableQuestions.filter(q => (q.difficulty || 2) === targetDifficulty);

        // If no questions at target difficulty, try adjacent difficulties
        if (candidates.length === 0) {
            // Try one level adjacent first
            const adj1 = targetDifficulty === 3 ? 2 : (targetDifficulty === 1 ? 2 : (lastAnswerCorrect ? 2 : 2));
            candidates = availableQuestions.filter(q => (q.difficulty || 2) === adj1);
        }
        if (candidates.length === 0) {
            // Try any remaining difficulty
            candidates = availableQuestions;
        }

        // Pick a random question from candidates
        const nextQ = candidates[Math.floor(Math.random() * candidates.length)];

        // Update session
        session.answeredQuestions.push(nextQ.id);
        session.questionsServed++;
        saveDBDebounced('adaptive_sessions', adaptiveSessions);

        const preparedQuestion = prepareQuestionForClient(nextQ, test.isTrainingMode);

        return {
            success: true,
            finished: false,
            wasCorrect: lastAnswerCorrect,
            question: preparedQuestion,
            questionNumber: session.questionsServed,
            totalQuestions: session.questionsLimit
        };
    }

    if (pathname === '/api/public/start' && method === 'POST') {
        // Проверяем готовность кэша
        if (!cacheInitialized) {
            console.log('[WARN] Кэш ещё не инициализирован, ожидаем...');
            await initCache();
        }

        const { password, testLink } = body;
        const tests = loadDB('tests');
        let test = null;
        if (testLink) test = tests.find(t => t.link === testLink);
        else if (password) test = tests.find(t => t.password === password);
        if (!test) return { success: false, error: 'Тест не найден' };
        if (!test.isActive) return { success: false, error: 'Тест временно отключён' };
        if (test.isExamMode) return { success: false, error: 'Этот тест доступен только через страницу зачёта', redirectToExam: true };

        const now = new Date();
        if (test.availableFrom && now < new Date(test.availableFrom)) {
            return { success: false, error: `Тест будет доступен с ${new Date(test.availableFrom).toLocaleString('ru-RU')}` };
        }
        if (test.availableUntil && now > new Date(test.availableUntil)) {
            return { success: false, error: 'Время прохождения теста истекло' };
        }
        if (test.password && test.password.trim() !== '' && password !== test.password) {
            return { success: false, error: 'Неверный пароль', needPassword: true };
        }

        const allQuestions = loadDB('questions');
        console.log(`[DEBUG] Загружено вопросов из кэша: ${allQuestions.length}`);

        // Загружаем вопросы ТОЛЬКО по testId (убран fallback по disciplineId)
        let testQuestions = allQuestions.filter(q => String(q.testId) === String(test.id));
        console.log(`[DEBUG] Вопросов для теста ${test.id}: ${testQuestions.length}`);

        if (testQuestions.length === 0) {
            // Повторная попытка загрузки из БД напрямую
            console.log('[WARN] Вопросы не найдены в кэше, пробуем загрузить из БД напрямую...');
            try {
                const dbResult = await pool.query("SELECT data FROM app_data WHERE store_name = 'questions'");
                if (dbResult.rows.length > 0) {
                    const freshQuestions = JSON.parse(dbResult.rows[0].data || '[]');
                    dataCache['questions'] = freshQuestions;
                    testQuestions = freshQuestions.filter(q => String(q.testId) === String(test.id));
                    console.log(`[DEBUG] После перезагрузки вопросов для теста: ${testQuestions.length}`);
                }
            } catch (dbErr) {
                console.error('[ERROR] Ошибка загрузки вопросов из БД:', dbErr.message);
            }
        }

        if (testQuestions.length === 0) {
            return { success: false, error: 'В тесте нет вопросов. Обратитесь к преподавателю.' };
        }

        // === ADAPTIVE MODE ===
        if (test.adaptiveMode) {
            const adaptiveLimit = Math.min(test.questionsCount || 20, testQuestions.length);
            // Pick the first question: prefer medium difficulty (2), fallback to any
            const mediumQs = testQuestions.filter(q => (q.difficulty || 2) === 2);
            const firstQ = mediumQs.length > 0 ? mediumQs[Math.floor(Math.random() * mediumQs.length)]
                : testQuestions[Math.floor(Math.random() * testQuestions.length)];

            const adaptiveSessionId = 'adaptive_' + generateId();
            // Store adaptive session
            let adaptiveSessions = loadDB('adaptive_sessions');
            adaptiveSessions.push({
                id: adaptiveSessionId,
                testId: test.id,
                questionPool: testQuestions.map(q => q.id),
                answeredQuestions: [firstQ.id],
                currentDifficulty: 2,
                questionsLimit: adaptiveLimit,
                questionsServed: 1,
                correctCount: 0,
                createdAt: new Date().toISOString()
            });
            saveDBDebounced('adaptive_sessions', adaptiveSessions);

            const preparedFirst = prepareQuestionForClient(firstQ, test.isTrainingMode);

            const disciplines = loadDB('disciplines');
            const discipline = disciplines.find(d => String(d.id) === String(test.disciplineId));

            return {
                success: true,
                test: {
                    id: test.id, name: test.name, disciplineName: discipline?.name || '',
                    timeLimit: test.timeLimit, penaltyTime: test.penaltyTime,
                    questionsCount: adaptiveLimit,
                    isTrainingMode: test.isTrainingMode || false,
                    hideResults: test.hideResults || false,
                    skipGroup: test.skipGroup || false,
                    gradeScale: test.gradeScale || null,
                    questionTimeLimit: test.questionTimeLimit || 0,
                    adaptiveMode: true
                },
                adaptiveSessionId: adaptiveSessionId,
                questions: [preparedFirst]
            };
        }

        const count = Math.min(test.questionsCount || 20, testQuestions.length);
        testQuestions = shuffleArray(testQuestions).slice(0, count);

        const letters = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К', 'Л', 'М', 'Н', 'О', 'П', 'Р', 'С', 'Т', 'У', 'Ф', 'Х', 'Ц', 'Ч', 'Ш', 'Щ', 'Ъ', 'Ы', 'Ь', 'Э', 'Ю', 'Я'];
        const preparedQuestions = testQuestions.map(q => {
            const questionType = q.type || 'single';
            if (questionType === 'match') {
                return { id: q.id, text: q.text, image: q.image || null, section: q.section, type: 'match', pairs: q.pairs || [] };
            }
            if (questionType === 'short_answer') {
                return { id: q.id, text: q.text, image: q.image || null, section: q.section, type: 'short_answer' };
            }
            if (questionType === 'sequence') {
                const items = q.items || [];
                return {
                    id: q.id, text: q.text, image: q.image || null, section: q.section, type: 'sequence',
                    items: [...items]
                };
            }
            if (!q.answers || !Array.isArray(q.answers)) {
                return { id: q.id, text: q.text, image: q.image || null, section: q.section, type: questionType, answers: [] };
            }
            const shuffledAnswers = shuffleArray(q.answers.map(a => ({ text: a.text, image: a.image || null, _origLetter: a.letter })));
            const base = {
                id: q.id, text: q.text, image: q.image || null, section: q.section, type: questionType,
                answers: shuffledAnswers.map((a, i) => ({ letter: letters[i], originalLetter: a._origLetter, text: a.text, image: a.image || null }))
            };
            if (test.isTrainingMode) base.correct = q.correct;
            return base;
        });

        const disciplines = loadDB('disciplines');
        const discipline = disciplines.find(d => String(d.id) === String(test.disciplineId));

        return {
            success: true,
            test: {
                id: test.id, name: test.name, disciplineName: discipline?.name || '',
                timeLimit: test.timeLimit, penaltyTime: test.penaltyTime,
                questionsCount: preparedQuestions.length, isTrainingMode: test.isTrainingMode || false,
                hideResults: test.hideResults || false,
                skipGroup: test.skipGroup || false,
                gradeScale: test.gradeScale || null,
                questionTimeLimit: test.questionTimeLimit || 0
            },
            questions: preparedQuestions
        };
    }

    if (pathname === '/api/public/exam-start' && method === 'POST') {
        // Проверяем готовность кэша (критично для новых воркеров!)
        if (!cacheInitialized) {
            console.log('[WARN] exam-start: Кэш ещё не инициализирован, ожидаем...');
            await initCache();
        }

        // Rate limiting — защита от перебора кодов экзамена
        const rateLimitCheck = checkRateLimit('examCode', clientIp);
        if (!rateLimitCheck.allowed) {
            return { success: false, error: rateLimitCheck.error, statusCode: 429 };
        }

        const { password } = body;
        if (!password || password.length !== 5) return { success: false, error: 'Введите 5-значный код' };

        const participants = loadDB('exam_participants');
        let participant = participants.find(p => String(p.password) === String(password));
        if (!participant) {
            recordFailedAttempt('examCode', clientIp);
            return { success: false, error: 'Неверный код' };
        }

        // Успешный вход — сбрасываем rate limit
        resetRateLimit('examCode', clientIp);

        // КРИТИЧЕСКАЯ ЗАЩИТА: проверяем статус участника (защита от повторного прохождения через кнопку Назад)
        // НО: если преподаватель добавил попытки (attemptsLeft > 0), разрешаем повторный вход
        if ((participant.status === 'passed' || participant.status === 'failed' || participant.status === 'completed') && participant.attemptsLeft <= 0) {
            return { success: false, error: 'Вы уже прошли этот тест. Повторное прохождение невозможно.' };
        }

        // Разрешаем вход если тест в процессе (восстановление сессии), даже если попытки = 0
        if (participant.attemptsLeft <= 0 && participant.status !== 'in_progress') {
            return { success: false, error: 'Попытки исчерпаны' };
        }

        const tests = loadDB('tests');
        const test = tests.find(t => String(t.id) === String(participant.testId));
        if (!test) return { success: false, error: 'Тест не найден' };
        if (!test.isActive) return { success: false, error: 'Тест временно отключён' };

        // Проверка времени доступности теста
        const now = new Date();
        if (test.availableFrom && new Date(test.availableFrom) > now) {
            return { success: false, error: 'Тест ещё не доступен. Начало: ' + new Date(test.availableFrom).toLocaleString('ru-RU') };
        }
        if (test.availableUntil && new Date(test.availableUntil) < now) {
            return { success: false, error: 'Время тестирования истекло' };
        }

        // Атомарное уменьшение попыток (защита от гонки данных при одновременных запросах)
        try {
            const updated = await updateInTable('exam_participants', participant.id, (p) => {
                if (p.status !== 'in_progress') {
                    if (p.attemptsLeft <= 0) {
                        throw new Error('ATTEMPTS_EXHAUSTED');
                    }
                    p.attemptsLeft = Math.max(0, p.attemptsLeft - 1);
                    p.startedAt = new Date().toISOString();
                }
                p.status = 'in_progress';
                return p;
            });
            if (!updated) {
                return { success: false, error: 'Участник не найден' };
            }
            participant = updated;
        } catch (lockErr) {
            if (lockErr.message === 'ATTEMPTS_EXHAUSTED') {
                return { success: false, error: 'Попытки исчерпаны' };
            }
            console.error('[exam-start] Lock error:', lockErr.message);
            return { success: false, error: 'Сервер занят, попробуйте снова' };
        }

        let allQuestions = loadDB('questions');
        console.log(`[DEBUG exam-start] Загружено вопросов из кэша: ${allQuestions.length}`);

        // Загружаем вопросы ТОЛЬКО по testId (убран fallback по disciplineId)
        let testQuestions = allQuestions.filter(q => String(q.testId) === String(test.id));
        // Фильтрация по варианту (если есть)
        if (participant.variant) {
            testQuestions = testQuestions.filter(q => String(q.variant) === String(participant.variant));
        }

        console.log(`[DEBUG exam-start] Вопросов для теста ${test.id}, вариант ${participant.variant || 'нет'}: ${testQuestions.length}`);

        if (testQuestions.length === 0) {
            // Повторная попытка загрузки из БД напрямую
            console.log('[WARN exam-start] Вопросы не найдены в кэше, пробуем загрузить из БД...');
            try {
                const dbResult = await pool.query("SELECT data FROM app_data WHERE store_name = 'questions'");
                if (dbResult.rows.length > 0) {
                    allQuestions = JSON.parse(dbResult.rows[0].data || '[]');
                    dataCache['questions'] = allQuestions;
                    testQuestions = allQuestions.filter(q => String(q.testId) === String(test.id));
                    if (participant.variant) {
                        testQuestions = testQuestions.filter(q => String(q.variant) === String(participant.variant));
                    }
                    console.log(`[DEBUG exam-start] После перезагрузки вопросов: ${testQuestions.length}`);
                }
            } catch (dbErr) {
                console.error('[ERROR exam-start] Ошибка загрузки вопросов из БД:', dbErr.message);
            }
        }

        if (testQuestions.length === 0) {
            return { success: false, error: 'В тесте нет вопросов для вашего варианта. Обратитесь к преподавателю.' };
        }

        // === ADAPTIVE MODE for exam ===
        if (test.adaptiveMode) {
            const adaptiveLimit = Math.min(test.questionsCount || 20, testQuestions.length);
            const mediumQs = testQuestions.filter(q => (q.difficulty || 2) === 2);
            const firstQ = mediumQs.length > 0 ? mediumQs[Math.floor(Math.random() * mediumQs.length)]
                : testQuestions[Math.floor(Math.random() * testQuestions.length)];

            const adaptiveSessionId = 'adaptive_' + generateId();
            let adaptiveSessions = loadDB('adaptive_sessions');
            adaptiveSessions.push({
                id: adaptiveSessionId,
                testId: test.id,
                questionPool: testQuestions.map(q => q.id),
                answeredQuestions: [firstQ.id],
                currentDifficulty: 2,
                questionsLimit: adaptiveLimit,
                questionsServed: 1,
                correctCount: 0,
                createdAt: new Date().toISOString()
            });
            saveDBDebounced('adaptive_sessions', adaptiveSessions);

            const preparedFirst = prepareQuestionForClient(firstQ, false);

            const disciplines = loadDB('disciplines');
            const discipline = disciplines.find(d => String(d.id) === String(test.disciplineId));

            return {
                success: true, isExamMode: true,
                examSessionToken: signExamSession(participant.id, test.id),
                adaptiveSessionId: adaptiveSessionId,
                participant: {
                    id: participant.id, surname: participant.surname, name: participant.name,
                    patronymic: participant.patronymic, group: participant.group,
                    variant: participant.variant || null, attemptsLeft: participant.attemptsLeft
                },
                test: {
                    id: test.id, name: test.name, link: test.link, disciplineName: discipline?.name || '',
                    timeLimit: test.timeLimit, penaltyTime: test.penaltyTime,
                    questionsCount: adaptiveLimit,
                    isTrainingMode: false, isExamMode: true,
                    isAdminSrezMode: test.isAdminSrezMode || false, hideResults: test.hideResults || false,
                    gradeScale: test.gradeScale || null,
                    questionTimeLimit: test.questionTimeLimit || 0,
                    adaptiveMode: true
                },
                questions: [preparedFirst]
            };
        }

        const count = Math.min(test.questionsCount || 20, testQuestions.length);
        testQuestions = shuffleArray(testQuestions).slice(0, count);

        const letters = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К', 'Л', 'М', 'Н', 'О', 'П', 'Р', 'С', 'Т', 'У', 'Ф', 'Х', 'Ц', 'Ч', 'Ш', 'Щ', 'Ъ', 'Ы', 'Ь', 'Э', 'Ю', 'Я'];
        const preparedQuestions = testQuestions.map(q => {
            const questionType = q.type || 'single';
            if (questionType === 'match') return { id: q.id, text: q.text, image: q.image || null, section: q.section, type: 'match', pairs: q.pairs || [] };
            if (questionType === 'short_answer') return { id: q.id, text: q.text, image: q.image || null, section: q.section, type: 'short_answer' };
            if (questionType === 'sequence') {
                const items = q.items || [];
                return { id: q.id, text: q.text, image: q.image || null, section: q.section, type: 'sequence', items: [...items] };
            }
            if (!q.answers) return { id: q.id, text: q.text, image: q.image || null, section: q.section, type: questionType, answers: [] };
            const shuffledAnswers = shuffleArray(q.answers.map(a => ({ text: a.text, image: a.image || null, _origLetter: a.letter })));
            return {
                id: q.id, text: q.text, image: q.image || null, section: q.section, type: questionType,
                answers: shuffledAnswers.map((a, i) => ({ letter: letters[i], originalLetter: a._origLetter, text: a.text, image: a.image || null }))
            };
        });

        const disciplines = loadDB('disciplines');
        const discipline = disciplines.find(d => String(d.id) === String(test.disciplineId));

        return {
            success: true, isExamMode: true,
            examSessionToken: signExamSession(participant.id, test.id),
            participant: {
                id: participant.id, surname: participant.surname, name: participant.name,
                patronymic: participant.patronymic, group: participant.group,
                variant: participant.variant || null, attemptsLeft: participant.attemptsLeft
            },
            test: {
                id: test.id, name: test.name, link: test.link, disciplineName: discipline?.name || '',
                timeLimit: test.timeLimit, penaltyTime: test.penaltyTime,
                questionsCount: preparedQuestions.length, isTrainingMode: false, isExamMode: true,
                isAdminSrezMode: test.isAdminSrezMode || false, hideResults: test.hideResults || false,
                gradeScale: test.gradeScale || null,
                questionTimeLimit: test.questionTimeLimit || 0
            },
            questions: preparedQuestions
        };
    }

    // ========== LEADERBOARD (Training Mode) ==========
    if (pathname.match(/^\/api\/public\/leaderboard\/[^/]+$/) && method === 'GET') {
        const testId = pathname.split('/')[4];
        const tests = loadDB('tests');
        const test = tests.find(t => String(t.id) === String(testId));
        if (!test) return { success: false, error: 'Тест не найден' };
        if (!test.isTrainingMode) return { success: false, error: 'Лидерборд доступен только для тренировочных тестов' };

        const results = loadDB('results');
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        // Filter results: matching testId, training mode, last 24 hours
        const recentResults = results
            .filter(r => String(r.testId) === String(testId) &&
                         r.isTrainingMode &&
                         (now - new Date(r.submittedAt).getTime()) < twentyFourHours)
            .sort((a, b) => b.percentage - a.percentage || (a.timeTaken || 0) - (b.timeTaken || 0))
            .slice(0, 20);

        const leaderboard = recentResults.map((r, idx) => {
            // Abbreviate first name to initial for privacy
            const firstInitial = r.studentName ? r.studentName.charAt(0) + '.' : '';
            const name = r.studentSurname ? `${r.studentSurname} ${firstInitial}` : firstInitial;

            // Format time taken (seconds) to mm:ss
            const totalSeconds = r.timeTaken || 0;
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            const time = `${minutes}:${String(seconds).padStart(2, '0')}`;

            return {
                rank: idx + 1,
                name,
                group: r.studentGroup || '',
                percentage: r.percentage || 0,
                grade: r.grade,
                time,
                // Include identifiers for highlighting current student
                studentSurname: r.studentSurname,
                studentNameInitial: firstInitial
            };
        });

        return { success: true, leaderboard };
    }

    if (pathname === '/api/public/submit' && method === 'POST') {
        // Не логируем ПДн (ФИО) в обычные логи — только техн. идентификатор теста (152-ФЗ/приватность)
        console.log('[SUBMIT] Получен запрос на отправку результатов, testId:', body.testId);

        let {
            testId, studentName, studentSurname, studentPatronymic, studentGroup, answers, questionTimes, timeTaken,
            tabSwitchCount, fullscreenExitCount, screenshotAttempts, violations, penalties,
            deviceType, participantId, isExamMode, variant: bodyVariant, submissionId, examSessionToken,
            ltiSessionId
        } = body;

        // Проверка подписи экзаменной сессии (защита от подмены participantId).
        // ВАЖНО (аудит 2026-06-10): проверяем при ЛЮБОМ participantId в режиме экзамена.
        // Раньше при отсутствии examSessionToken проверка пропускалась целиком, и можно было
        // зачесть результат на чужой participantId без подписи. Теперь отсутствие токена = провал
        // проверки → понижаем до обычного результата (как и при невалидной подписи).
        if (isExamMode && participantId) {
            let sigOk = false;
            if (examSessionToken) {
                try {
                    sigOk = verifyExamSession(participantId, testId, examSessionToken);
                } catch (e) {
                    console.warn('[SECURITY] Ошибка проверки подписи:', e.message);
                    sigOk = false;
                }
            }
            if (!sigOk) {
                console.warn('[SECURITY] Отсутствует/невалидна подпись экзаменной сессии:', participantId, testId);
                // Не блокируем полностью — сбрасываем participantId чтобы результат сохранился как обычный
                participantId = null;
                isExamMode = false;
            }
        }

        // Серверная валидация анти-чит данных: берём violations с сервера (нельзя подделать на клиенте)
        const activeTests = loadDB('active_tests');
        const activeSession = activeTests.find(a =>
            String(a.testId) === String(testId) &&
            a.studentSurname === studentSurname &&
            a.studentName === studentName
        );
        if (activeSession) {
            // Используем серверные данные о нарушениях (клиент мог их очистить)
            const serverViolations = activeSession.violations || [];
            const serverTabSwitches = activeSession.tabSwitchCount || 0;
            const serverFullscreenExits = activeSession.fullscreenExitCount || 0;
            const serverScreenshots = activeSession.screenshotAttempts || 0;
            const serverPenalties = activeSession.penalties || [];
            // Берём максимум между клиентскими и серверными данными
            violations = serverViolations.length > (violations || []).length ? serverViolations : (violations || []);
            tabSwitchCount = Math.max(tabSwitchCount || 0, serverTabSwitches);
            fullscreenExitCount = Math.max(fullscreenExitCount || 0, serverFullscreenExits);
            screenshotAttempts = Math.max(screenshotAttempts || 0, serverScreenshots);
            // Штрафы проктора: берём более длинный список (аудит 2026-06-10) — студент не может
            // снять записанные сервером штрафы, прислав penalties:[] в теле сдачи.
            penalties = serverPenalties.length > (penalties || []).length ? serverPenalties : (penalties || []);
        }

        if (!testId) {
            console.log('[SUBMIT] Ошибка: testId не указан');
            return { success: false, error: 'testId не указан' };
        }

        // Защита от двойной отправки: проверяем submissionId или недавний результат
        {
            const results = loadDB('results');
            const duplicate = results.find(r =>
                (submissionId && r.submissionId === submissionId) ||
                (String(r.testId) === String(testId) &&
                 r.studentSurname === studentSurname &&
                 r.studentName === studentName &&
                 r.studentGroup === studentGroup &&
                 (answers ? r.answersCount === answers.length : true) &&
                 (participantId ? r.participantId === participantId : true) &&
                 Date.now() - new Date(r.submittedAt).getTime() < 300000) // в течение 5 мин
            );
            if (duplicate) {
                console.log('[SUBMIT] Дубликат обнаружен, возвращаем существующий результат');
                return { success: true, result: duplicate, duplicate: true };
            }
        }

        const tests = loadDB('tests');
        const test = tests.find(t => String(t.id) === String(testId));
        if (!test) {
            console.log('[SUBMIT] Ошибка: Тест не найден, testId:', testId);
            return { success: false, error: 'Тест не найден' };
        }
        console.log('[SUBMIT] Тест найден:', test.name);

        const allQuestions = loadDB('questions');
        // Валидация входа: без answers/questionIds — мягкая ошибка, а не 500 (аудит 2026-06-10).
        // Раньше Object.keys(null) бросал исключение → HTTP 500, который клиент мог ретраить (риск дублей).
        if ((!answers || typeof answers !== 'object') && !Array.isArray(body.questionIds)) {
            return { success: false, error: 'Не переданы ответы (answers)' };
        }
        const questionIds = body.questionIds || Object.keys(answers || {});

        let earnedPoints = 0, maxPoints = 0, correctCount = 0;
        const details = [];

        for (const questionId of questionIds) {
            const question = allQuestions.find(q => String(q.id) === String(questionId));
            if (question) {
                const userAnswer = answers[questionId];
                const questionType = question.type || 'single';
                const questionWeight = question.weight || 1;
                maxPoints += questionWeight;

                let isCorrect = false;
                let userAnswerText = '-', correctAnswerText = '';

                if (questionType === 'match') {
                    const correctPairs = question.correct;
                    if (userAnswer && typeof userAnswer === 'object' && correctPairs && typeof correctPairs === 'object') {
                        isCorrect = Object.keys(correctPairs).every(key => String(userAnswer[key]) === String(correctPairs[key]));
                        // Формируем текст ответа для match
                        if (question.pairs) {
                            const userPairsText = Object.entries(userAnswer || {}).map(([k, v]) => {
                                const left = question.pairs.find(p => String(p.id) === String(k))?.left || k;
                                const right = question.pairs.find(p => String(p.id) === String(v))?.right || v;
                                return `${left}→${right}`;
                            }).join('; ');
                            userAnswerText = userPairsText || '-';
                            correctAnswerText = Object.entries(correctPairs).map(([k, v]) => {
                                const left = question.pairs.find(p => String(p.id) === String(k))?.left || k;
                                const right = question.pairs.find(p => String(p.id) === String(v))?.right || v;
                                return `${left}→${right}`;
                            }).join('; ');
                        }
                    }
                } else if (questionType === 'short_answer') {
                    if (userAnswer) {
                        // correctAnswers (массив допустимых ответов) имеет приоритет над correct
                        const correctAnswers = question.correctAnswers
                            || (Array.isArray(question.correct) ? question.correct : [question.correct]);
                        isCorrect = correctAnswers.some(ans => ans != null && String(ans).toLowerCase() === String(userAnswer).trim().toLowerCase());
                        userAnswerText = userAnswer;
                        correctAnswerText = correctAnswers[0] || '';
                    }
                } else if (questionType === 'multiple') {
                    const correctArr = Array.isArray(question.correct) ? question.correct : [question.correct];
                    const userArr = Array.isArray(userAnswer) ? userAnswer : (userAnswer ? [userAnswer] : []);
                    const sortedUser = [...userArr].sort();
                    const sortedCorrect = [...correctArr].sort();
                    isCorrect = sortedUser.length === sortedCorrect.length && sortedUser.every((v, i) => v === sortedCorrect[i]);
                    // Формируем текст ответа для multiple
                    if (question.answers) {
                        userAnswerText = userArr.map(letter => {
                            const ans = question.answers.find(a => a.letter === letter);
                            return ans ? ans.text : letter;
                        }).join(', ') || '-';
                        correctAnswerText = correctArr.map(letter => {
                            const ans = question.answers.find(a => a.letter === letter);
                            return ans ? ans.text : letter;
                        }).join(', ');
                    }
                } else if (questionType === 'sequence') {
                    // Для sequence - правильный порядок из correctOrder, если нет — [0, 1, 2, ...]
                    if (Array.isArray(userAnswer)) {
                        const correctOrder = question.correctOrder || (question.items ? question.items.map((_, i) => i) : null);
                        if (correctOrder) {
                            isCorrect = userAnswer.length === correctOrder.length &&
                                       userAnswer.every((val, idx) => val === correctOrder[idx]);
                        }
                        // Формируем текст ответа для sequence
                        if (question.items && correctOrder) {
                            userAnswerText = userAnswer.map(idx => question.items[idx] || `[${idx}]`).join(' → ');
                            correctAnswerText = correctOrder.map(idx => question.items[idx] || `[${idx}]`).join(' → ');
                        }
                    }
                } else {
                    // single: correct может быть строкой-буквой или массивом из одной буквы
                    const correctVal = Array.isArray(question.correct) ? question.correct[0] : question.correct;
                    isCorrect = userAnswer != null && correctVal != null && String(correctVal) === String(userAnswer);
                    const userAnswerObj = question.answers?.find(a => a.letter === userAnswer);
                    const correctAnswerObj = question.answers?.find(a => a.letter === correctVal);
                    userAnswerText = userAnswerObj?.text || '-';
                    correctAnswerText = correctAnswerObj?.text || '';
                }

                if (isCorrect) { correctCount++; earnedPoints += questionWeight; }

                details.push({
                    questionId, questionText: question.text, questionType, weight: questionWeight,
                    timeSpent: questionTimes?.[questionId] || 0, userAnswer: userAnswer || '-',
                    userAnswerText, correctAnswer: question.correct, correctAnswerText, isCorrect,
                    pointsEarned: isCorrect ? questionWeight : 0,
                    // Картинки для отчёта
                    questionImage: question.image || null,
                    answers: question.answers || [],
                    pairs: question.pairs || [],
                    items: question.items || []
                });
            }
        }

        const penaltyCount = penalties?.length || 0;
        const adjustedEarnedPoints = Math.max(0, earnedPoints - penaltyCount);
        // correctCount НЕ уменьшается штрафами - это количество правильных ответов
        // Штрафы влияют только на баллы (earnedPoints), не на статистику правильных ответов
        const adjustedCorrectCount = correctCount;
        const percentage = maxPoints > 0 ? Math.round((adjustedEarnedPoints / maxPoints) * 100) : 0;
        const grade = calculateGrade(percentage, test.gradeScale);

        // Определяем вариант: из body или из участника
        let variant = bodyVariant || null;
        if (!variant && participantId) {
            const participants = loadDB('exam_participants');
            const participant = participants.find(p => p.id === participantId);
            if (participant && participant.variant) {
                variant = participant.variant;
            }
        }

        {
            const newResult = {
                id: generateId(), testId, studentName, studentSurname, studentPatronymic: studentPatronymic || '', studentGroup,
                correctCount, earnedPoints, maxPoints, adjustedEarnedPoints, adjustedCorrectCount,
                penaltyCount, penalties: penalties || [], totalQuestions: questionIds.length,
                percentage, grade, timeTaken, questionTimes: questionTimes || {},
                tabSwitchCount: tabSwitchCount || 0, fullscreenExitCount: fullscreenExitCount || 0,
                screenshotAttempts: screenshotAttempts || 0, violations: violations || [],
                violationsCount: violations?.length || 0, deviceType: deviceType || 'unknown',
                completedAt: new Date().toISOString(), submittedAt: new Date().toISOString(),
                details, isExamMode: isExamMode || false, isTrainingMode: test.isTrainingMode || false,
                participantId: participantId || null,
                variant: variant, submissionId: submissionId || null
            };

            // Атомарное добавление результата (защита от гонки данных при массовой сдаче).
            // Если БД недоступна дольше, чем все повторы — результат уже лежит в кэше (addToTable
            // обновляет dataCache до записи) и будет сохранён при следующей успешной записи/флэше.
            // Поэтому НЕ роняем сдачу студента в 500 — фиксируем критическую ошибку и продолжаем.
            // Построчная вставка результата (быстро, без переписывания блоба) с устойчивым ретраем.
            // Если БД недоступна дольше всех повторов — результат уже в кэше (appendResult кладёт его
            // в кэш до записи), поэтому НЕ роняем сдачу студента в 500; он сохранится при ресинке/следующей записи.
            try {
                await appendResult(newResult);
            } catch (saveErr) {
                console.error(`[КРИТИЧНО] Результат ${newResult.id} не записан в БД (БД недоступна), но сохранён в кэше: ${saveErr.message}`);
                if (!Array.isArray(dataCache['results'])) dataCache['results'] = [];
                if (!dataCache['results'].some(r => r.id === newResult.id)) dataCache['results'].push(newResult);
            }

            // Telegram и обновление участников — только для НЕ-тренировочных тестов
            if (!test.isTrainingMode) {
                // Telegram-уведомление преподавателю — НЕ блокируем ответ студенту (fire-and-forget).
                // Отправка может занимать секунды (внешний HTTPS), и студент не должен этого ждать —
                // иначе под нагрузкой каждая сдача висит до таймаута уведомления.
                notifyTestResult(testId, newResult).catch(telegramErr =>
                    console.error('[TELEGRAM] Ошибка отправки уведомления:', telegramErr.message));

                // Обновляем статус участника
                if (participantId && isExamMode) {
                    await updateInTable('exam_participants', participantId, (p) => {
                        const passingGrade = test.examSettings?.passingGrade || 3;
                        p.lastResultId = newResult.id;
                        p.status = grade >= passingGrade ? 'passed' : 'failed';
                        if (!p.bestGrade || grade > p.bestGrade) {
                            p.bestGrade = grade;
                        }
                        return p;
                    });
                }
            }
        }

        // LTI: отправляем оценку в Moodle если есть сессия
            if (ltiSessionId) {
                const ltiSessions = dataCache['lti_sessions'] || [];
                const ltiSession = ltiSessions.find(s => s.id === ltiSessionId);
                if (ltiSession && ltiSession.outcomeUrl && ltiSession.sourcedId) {
                    const ltiConfig = getLtiConfig();
                    const moodleScore = percentage / 100; // Moodle принимает 0.0 - 1.0
                    postGradeToMoodle(
                        ltiSession.outcomeUrl, ltiSession.sourcedId,
                        moodleScore, ltiConfig.consumerKey, ltiConfig.consumerSecret
                    ).then(success => {
                        console.log(`[LTI] Grade ${success ? 'posted' : 'FAILED'} to Moodle for ${studentSurname} ${studentName}: ${percentage}%`);
                    }).catch(err => {
                        console.error('[LTI] Grade posting error:', err.message);
                    });
                }
            }

        console.log('[SUBMIT] Успешно! Оценка:', grade, 'Процент:', percentage);
        return {
            success: true,
            result: {
                correctCount: adjustedCorrectCount, originalCorrectCount: correctCount,
                earnedPoints, adjustedEarnedPoints, maxPoints, penaltyCount,
                totalQuestions: questionIds.length, percentage, grade, details
            }
        };
    }

    // ========== USERS UPDATE ==========
    if (pathname.startsWith('/api/users/') && method === 'PUT') {
        if (!session || session.role !== 'admin') return { success: false, error: 'Нет доступа' };
        const userId = pathname.split('/')[3];
        let users = loadDB('users');
        const idx = users.findIndex(u => String(u.id) === userId);
        if (idx === -1) return { success: false, error: 'Пользователь не найден' };
        // Проверка уникальности логина при изменении
        if (body.username && body.username !== users[idx].username) {
            const duplicate = users.find(u => u.username === body.username && String(u.id) !== userId);
            if (duplicate) return { success: false, error: 'Пользователь с таким логином уже существует' };
            users[idx].username = body.username;
        }
        if (body.name) users[idx].name = body.name;
        if (body.email !== undefined) users[idx].email = body.email;
        if (body.role) users[idx].role = body.role;
        if (body.password) users[idx].password = hashPassword(body.password);
        if (body.avatarUrl !== undefined) users[idx].avatarUrl = body.avatarUrl;
        saveDB('users', users);
        return { success: true, user: { id: users[idx].id, username: users[idx].username, role: users[idx].role, name: users[idx].name, avatarUrl: users[idx].avatarUrl } };
    }

    // ========== AUTH PROFILE ==========
    if (pathname === '/api/auth/profile' && method === 'PUT') {
        if (!session) return { success: false, error: 'Не авторизован' };
        let users = loadDB('users');
        const idx = users.findIndex(u => String(u.id) === String(session.userId));
        if (idx === -1) return { success: false, error: 'Пользователь не найден' };
        if (body.name) users[idx].name = body.name;
        if (body.email !== undefined) users[idx].email = body.email;
        if (body.avatarUrl !== undefined) users[idx].avatarUrl = body.avatarUrl;
        // Telegram настройки (не перезаписываем маской)
        if (body.telegramToken !== undefined && body.telegramToken !== '***настроен***') users[idx].telegramToken = body.telegramToken;
        if (body.telegramChatId !== undefined) users[idx].telegramChatId = body.telegramChatId;
        if (body.telegramEnabled !== undefined) users[idx].telegramEnabled = body.telegramEnabled;
        saveDB('users', users);
        return {
            success: true,
            user: {
                id: users[idx].id,
                username: users[idx].username,
                role: users[idx].role,
                name: users[idx].name,
                email: users[idx].email,
                avatarUrl: users[idx].avatarUrl,
                telegramToken: users[idx].telegramToken ? '***настроен***' : '',
                telegramChatId: users[idx].telegramChatId || '',
                telegramEnabled: users[idx].telegramEnabled
            }
        };
    }

    if (pathname === '/api/auth/change-password' && method === 'POST') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const { currentPassword, newPassword } = body;
        if (!currentPassword || !newPassword) return { success: false, error: 'Введите текущий и новый пароль' };
        const pwdError = validatePassword(newPassword);
        if (pwdError) return { success: false, error: pwdError };
        let users = loadDB('users');
        const idx = users.findIndex(u => String(u.id) === String(session.userId));
        if (idx === -1) return { success: false, error: 'Пользователь не найден' };
        if (!verifyPassword(currentPassword, users[idx].password)) {
            return { success: false, error: 'Неверный текущий пароль' };
        }
        users[idx].password = hashPassword(newPassword);
        saveDB('users', users);
        return { success: true, message: 'Пароль успешно изменён' };
    }

    // ========== ANALYTICS ==========
    if (pathname === '/api/analytics' && method === 'GET') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const { testId, disciplineId, mode, group } = query;

        let results = loadDB('results');
        const tests = loadDB('tests');
        const allQuestions = loadDB('questions');

        // Фильтрация по правам
        if (session.role !== 'admin' && session.role !== 'education_dept') {
            const myTestIds = tests.filter(t => String(t.createdBy) === String(session.userId)).map(t => String(t.id));
            results = results.filter(r => myTestIds.includes(String(r.testId)));
        }

        // Фильтрация по параметрам
        if (testId) results = results.filter(r => String(r.testId) === String(testId));
        if (disciplineId) {
            const discTests = tests.filter(t => String(t.disciplineId) === String(disciplineId)).map(t => String(t.id));
            results = results.filter(r => discTests.includes(String(r.testId)));
        }
        if (group) results = results.filter(r => (r.studentGroup || '').toUpperCase().trim() === group.toUpperCase().trim());
        const testsById = new Map(tests.map(t => [String(t.id), t]));
        if (mode) {
            results = results.filter(r => {
                const test = testsById.get(String(r.testId));
                if (!test) return false;
                if (mode === 'exam') return test.isExamMode;
                if (mode === 'srez') return test.isAdminSrezMode;
                if (mode === 'training') return test.isTrainingMode;
                if (mode === 'normal') return !test.isExamMode && !test.isAdminSrezMode && !test.isTrainingMode;
                return true;
            });
        }

        // Собираем уникальные группы
        const groups = [...new Set(results.map(r => (r.studentGroup || '').toUpperCase().trim()).filter(g => g))].sort();

        // Статистика оценок
        const gradeStats = { 5: 0, 4: 0, 3: 0, 2: 0 };
        results.forEach(r => { if (r.grade >= 2 && r.grade <= 5) gradeStats[r.grade]++; });

        // Анализ по вопросам - собираем статистику из details результатов
        const questionStats = {};

        results.forEach(result => {
            if (!result.details || !Array.isArray(result.details)) return;

            result.details.forEach(detail => {
                const qId = detail.questionId;
                if (!qId) return;

                if (!questionStats[qId]) {
                    questionStats[qId] = {
                        questionId: qId,
                        questionText: detail.questionText || 'Без текста',
                        totalAttempts: 0,
                        correctCount: 0,
                        incorrectCount: 0,
                        wrongAnswers: {},
                        totalTime: 0,
                        timeCount: 0
                    };
                }

                questionStats[qId].totalAttempts++;

                // Статистика времени ответа
                const timeSpent = detail.timeSpent || 0;
                if (timeSpent > 0) {
                    questionStats[qId].totalTime += timeSpent;
                    questionStats[qId].timeCount++;
                }

                if (detail.isCorrect) {
                    questionStats[qId].correctCount++;
                } else {
                    questionStats[qId].incorrectCount++;
                    const wrongAnswer = String(detail.userAnswerText || detail.userAnswer || '-');
                    if (wrongAnswer && wrongAnswer !== '-') {
                        questionStats[qId].wrongAnswers[wrongAnswer] = (questionStats[qId].wrongAnswers[wrongAnswer] || 0) + 1;
                    }
                }
            });
        });

        // Преобразуем в массив и считаем проценты
        const questions = Object.values(questionStats).map(q => {
            const successRate = q.totalAttempts > 0 ? Math.round((q.correctCount / q.totalAttempts) * 100) : 0;
            let difficulty = 'easy';
            if (successRate <= 30) difficulty = 'hard';
            else if (successRate <= 60) difficulty = 'medium';

            const topWrongAnswers = Object.entries(q.wrongAnswers)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([answer, count]) => ({ answer, count }));

            const avgTimeSeconds = q.timeCount > 0 ? Math.round(q.totalTime / q.timeCount) : 0;

            return {
                questionId: q.questionId,
                questionText: q.questionText,
                totalAttempts: q.totalAttempts,
                correctCount: q.correctCount,
                incorrectCount: q.incorrectCount,
                successRate,
                difficulty,
                topWrongAnswers,
                avgTimeSeconds
            };
        });

        // Сортируем по успешности (сложные первыми)
        questions.sort((a, b) => a.successRate - b.successRate);

        // Сводка
        const totalQuestions = questions.length;
        const totalAttempts = results.length;
        const avgSuccessRate = totalQuestions > 0
            ? Math.round(questions.reduce((sum, q) => sum + q.successRate, 0) / totalQuestions)
            : 0;
        const hardQuestions = questions.filter(q => q.difficulty === 'hard').length;
        const mediumQuestions = questions.filter(q => q.difficulty === 'medium').length;
        const easyQuestions = questions.filter(q => q.difficulty === 'easy').length;

        // Сравнительная аналитика по группам
        const groupComparison = {};
        results.forEach(r => {
            const g = (r.studentGroup || '').toUpperCase().trim();
            if (!g) return;
            if (!groupComparison[g]) {
                groupComparison[g] = { group: g, count: 0, totalPercentage: 0, gradeStats: { 5: 0, 4: 0, 3: 0, 2: 0 }, totalTimeTaken: 0, timeCount: 0 };
            }
            groupComparison[g].count++;
            groupComparison[g].totalPercentage += (r.percentage || 0);
            if (r.grade >= 2 && r.grade <= 5) groupComparison[g].gradeStats[r.grade]++;
            if (r.timeTaken > 0) {
                groupComparison[g].totalTimeTaken += r.timeTaken;
                groupComparison[g].timeCount++;
            }
        });

        const groupStats = Object.values(groupComparison).map(g => ({
            group: g.group,
            studentsCount: g.count,
            avgPercentage: g.count > 0 ? Math.round(g.totalPercentage / g.count) : 0,
            avgTimeTaken: g.timeCount > 0 ? Math.round(g.totalTimeTaken / g.timeCount) : 0,
            gradeStats: g.gradeStats,
            qualityRate: g.count > 0 ? Math.round(((g.gradeStats[5] + g.gradeStats[4]) / g.count) * 100) : 0
        })).sort((a, b) => b.avgPercentage - a.avgPercentage);

        return {
            success: true,
            summary: {
                totalQuestions,
                totalAttempts,
                avgSuccessRate,
                hardQuestions,
                mediumQuestions,
                easyQuestions
            },
            questions,
            gradeStats,
            groups,
            groupStats
        };
    }

    // ========== FOLDERS ==========
    if (pathname === '/api/folders' && method === 'GET') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const type = query.type; // disciplines или groups

        let folders = loadDB('folders');
        if (session.role !== 'admin') {
            folders = folders.filter(f => String(f.createdBy) === String(session.userId));
        }
        // Фильтруем по типу если указан
        if (type) {
            folders = folders.filter(f => f.type === type);
        }

        // Собираем folderItems из дисциплин и групп
        let folderItems = [];
        if (!type || type === 'disciplines') {
            const disciplines = loadDB('disciplines');
            disciplines.forEach(d => {
                if (d.folderId) {
                    folderItems.push({ itemId: d.id, folderId: d.folderId, type: 'disciplines' });
                }
            });
        }
        if (!type || type === 'groups') {
            const groups = loadDB('groups');
            groups.forEach(g => {
                if (g.folderId) {
                    folderItems.push({ itemId: g.id, folderId: g.folderId, type: 'groups' });
                }
            });
        }

        return { success: true, folders, folderItems };
    }

    if (pathname === '/api/folders' && method === 'POST') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const { name, parentId, color, type } = body;
        if (!name) return { success: false, error: 'Название обязательно' };
        let folders = loadDB('folders');
        const newFolder = {
            id: generateId(), name: name.trim(), parentId: parentId || null,
            color: color || null, type: type || 'disciplines',
            createdBy: session.userId, createdAt: new Date().toISOString()
        };
        folders.push(newFolder);
        saveDB('folders', folders);
        return { success: true, folder: newFolder };
    }

    if (pathname.startsWith('/api/folders/') && !pathname.includes('/items') && method === 'PUT') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const id = pathname.split('/')[3];
        let folders = loadDB('folders');
        const idx = folders.findIndex(f => String(f.id) === id);
        if (idx === -1) return { success: false, error: 'Папка не найдена' };
        // Проверка прав: только создатель или админ
        if (session.role !== 'admin' && String(folders[idx].createdBy) !== String(session.userId)) {
            return { success: false, error: 'Нет прав на редактирование этой папки' };
        }
        if (body.name) folders[idx].name = body.name.trim();
        if (body.parentId !== undefined) folders[idx].parentId = body.parentId;
        if (body.color !== undefined) folders[idx].color = body.color;
        if (body.type !== undefined) folders[idx].type = body.type;
        saveDB('folders', folders);
        return { success: true, folder: folders[idx] };
    }

    if (pathname.startsWith('/api/folders/') && !pathname.includes('/items') && method === 'DELETE') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const id = pathname.split('/')[3];
        let folders = loadDB('folders');
        const folder = folders.find(f => String(f.id) === id);
        if (!folder) return { success: false, error: 'Папка не найдена' };
        // Проверка прав: только создатель или админ
        if (session.role !== 'admin' && String(folder.createdBy) !== String(session.userId)) {
            return { success: false, error: 'Нет прав на удаление этой папки' };
        }
        folders = folders.filter(f => String(f.id) !== id);
        saveDB('folders', folders);
        // Удаляем привязки только для своих дисциплин
        let disciplines = loadDB('disciplines');
        disciplines.forEach(d => { if (String(d.folderId) === id) d.folderId = null; });
        saveDB('disciplines', disciplines);
        return { success: true };
    }

    if (pathname === '/api/folders/items' && method === 'POST') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const { itemId, folderId } = body;
        // Поддерживаем оба варианта: itemType и type
        const itemType = body.itemType || body.type;

        // Проверяем права на папку (если указана)
        if (folderId) {
            const folders = loadDB('folders');
            const folder = folders.find(f => String(f.id) === String(folderId));
            if (!folder) return { success: false, error: 'Папка не найдена' };
            if (session.role !== 'admin' && String(folder.createdBy) !== String(session.userId)) {
                return { success: false, error: 'Нет прав на эту папку' };
            }
        }

        if (itemType === 'discipline' || itemType === 'disciplines') {
            let disciplines = loadDB('disciplines');
            const idx = disciplines.findIndex(d => String(d.id) === String(itemId));
            if (idx === -1) return { success: false, error: 'Дисциплина не найдена' };
            // Проверка прав на дисциплину
            if (session.role !== 'admin' && String(disciplines[idx].ownerId) !== String(session.userId) && String(disciplines[idx].createdBy) !== String(session.userId)) {
                return { success: false, error: 'Нет прав на эту дисциплину' };
            }
            disciplines[idx].folderId = folderId || null;
            saveDB('disciplines', disciplines);
            return { success: true };
        }

        if (itemType === 'group' || itemType === 'groups') {
            let groups = loadDB('groups');
            const idx = groups.findIndex(g => String(g.id) === String(itemId));
            if (idx === -1) return { success: false, error: 'Группа не найдена' };
            groups[idx].folderId = folderId || null;
            saveDB('groups', groups);
            return { success: true };
        }

        return { success: false, error: 'Неизвестный тип элемента' };
    }

    // ========== GROUPS STUDENTS ==========
    // Проверка прав: админ или преподаватель, назначенный на группу
    function canManageGroupStudents(session, group) {
        if (session.role === 'admin') return true;
        if (session.role === 'teacher' && group.assignedTeachers?.includes(String(session.userId))) return true;
        return false;
    }

    if (pathname.match(/^\/api\/groups\/[^/]+\/students$/) && method === 'POST') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const groupId = pathname.split('/')[3];
        let groups = loadDB('groups');
        const idx = groups.findIndex(g => String(g.id) === groupId);
        if (idx === -1) return { success: false, error: 'Группа не найдена' };
        // Проверка прав
        if (!canManageGroupStudents(session, groups[idx])) {
            return { success: false, error: 'Нет прав на редактирование этой группы' };
        }
        const { fullName, photoUrl } = body;
        if (!fullName) return { success: false, error: 'ФИО обязательно' };
        const newStudent = {
            id: generateId(), fullName: fullName.trim(), photoUrl: photoUrl || null,
            createdAt: new Date().toISOString()
        };
        if (!groups[idx].students) groups[idx].students = [];
        groups[idx].students.push(newStudent);
        saveDB('groups', groups);
        return { success: true, student: newStudent };
    }

    if (pathname.match(/^\/api\/groups\/[^/]+\/students\/[^/]+$/) && method === 'PUT') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const parts = pathname.split('/');
        const groupId = parts[3];
        const studentId = parts[5];
        let groups = loadDB('groups');
        const gIdx = groups.findIndex(g => String(g.id) === groupId);
        if (gIdx === -1) return { success: false, error: 'Группа не найдена' };
        // Проверка прав
        if (!canManageGroupStudents(session, groups[gIdx])) {
            return { success: false, error: 'Нет прав на редактирование этой группы' };
        }
        const sIdx = (groups[gIdx].students || []).findIndex(s => String(s.id) === studentId);
        if (sIdx === -1) return { success: false, error: 'Студент не найден' };
        if (body.fullName) groups[gIdx].students[sIdx].fullName = body.fullName.trim();
        if (body.photoUrl !== undefined) groups[gIdx].students[sIdx].photoUrl = body.photoUrl;
        saveDB('groups', groups);
        return { success: true, student: groups[gIdx].students[sIdx] };
    }

    if (pathname.match(/^\/api\/groups\/[^/]+\/students\/[^/]+$/) && method === 'DELETE') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const parts = pathname.split('/');
        const groupId = parts[3];
        const studentId = parts[5];
        let groups = loadDB('groups');
        const gIdx = groups.findIndex(g => String(g.id) === groupId);
        if (gIdx === -1) return { success: false, error: 'Группа не найдена' };
        // Проверка прав
        if (!canManageGroupStudents(session, groups[gIdx])) {
            return { success: false, error: 'Нет прав на редактирование этой группы' };
        }

        // Находим студента для получения его ФИО
        const student = (groups[gIdx].students || []).find(s => String(s.id) === studentId);
        const groupName = groups[gIdx].name;

        // Удаляем студента из группы
        groups[gIdx].students = (groups[gIdx].students || []).filter(s => String(s.id) !== studentId);
        saveDB('groups', groups);

        // Удаляем участника из exam_participants по ФИО и группе
        if (student && student.fullName) {
            let examParticipants = loadDB('exam_participants');
            const nameParts = student.fullName.trim().split(/\s+/);
            const surname = nameParts[0] || '';
            const name = nameParts[1] || '';
            const patronymic = nameParts.slice(2).join(' ') || '';

            const before = examParticipants.length;
            examParticipants = examParticipants.filter(p => {
                // Сравниваем по группе и ФИО
                const sameGroup = (p.group || '').toLowerCase() === (groupName || '').toLowerCase();
                const sameName = (p.surname || '').toLowerCase() === surname.toLowerCase() && (p.name || '').toLowerCase() === name.toLowerCase() && (p.patronymic || '').toLowerCase() === patronymic.toLowerCase();
                return !(sameGroup && sameName);
            });

            if (examParticipants.length < before) {
                saveDB('exam_participants', examParticipants);
                console.log(`Удалён участник ${student.fullName} из exam_participants (${before - examParticipants.length} записей)`);
            }
        }

        return { success: true };
    }

    // ========== ПОИСК И ПОЛНОЕ УДАЛЕНИЕ СТУДЕНТА ==========
    // Поиск студента по имени во всех местах системы
    if (pathname === '/api/students/search' && method === 'GET') {
        if (!session) return { success: false, error: 'Не авторизован' };
        if (session.role !== 'admin') return { success: false, error: 'Только админ' };

        const searchQuery = (query.q || '').toLowerCase().trim();
        if (!searchQuery || searchQuery.length < 2) {
            return { success: false, error: 'Введите минимум 2 символа для поиска' };
        }

        const groups = loadDB('groups');
        const examParticipants = loadDB('exam_participants');
        const results = loadDB('results');

        const found = [];

        // Поиск в группах
        for (const group of groups) {
            for (const student of (group.students || [])) {
                if ((student.fullName || '').toLowerCase().includes(searchQuery)) {
                    found.push({
                        type: 'group_student',
                        fullName: student.fullName,
                        groupName: group.name,
                        groupId: group.id,
                        studentId: student.id
                    });
                }
            }
        }

        // Поиск в участниках экзаменов
        for (const p of examParticipants) {
            const fullName = `${p.surname || ''} ${p.name || ''} ${p.patronymic || ''}`.trim();
            if (fullName.toLowerCase().includes(searchQuery)) {
                found.push({
                    type: 'exam_participant',
                    fullName: fullName,
                    groupName: p.group,
                    status: p.status,
                    testId: p.testId,
                    participantId: p.id
                });
            }
        }

        // Поиск в результатах
        for (const r of results) {
            const fullName = `${r.studentSurname || ''} ${r.studentName || ''}`.trim();
            if (fullName.toLowerCase().includes(searchQuery)) {
                found.push({
                    type: 'result',
                    fullName: fullName,
                    groupName: r.studentGroup,
                    testId: r.testId,
                    percentage: r.percentage,
                    grade: r.grade,
                    resultId: r.id,
                    completedAt: r.completedAt
                });
            }
        }

        return { success: true, found, query: searchQuery };
    }

    // Полное удаление студента из всех мест системы
    if (pathname === '/api/students/delete-full' && method === 'POST') {
        if (!session) return { success: false, error: 'Не авторизован' };
        if (session.role !== 'admin') return { success: false, error: 'Только админ' };

        const { fullName, groupName, deleteFromGroups, deleteFromExams, deleteFromSrez, deleteResults } = body;

        if (!fullName || fullName.trim().length < 2) {
            return { success: false, error: 'Не указано ФИО студента' };
        }

        const searchName = fullName.toLowerCase().trim();
        const searchGroup = groupName ? groupName.toLowerCase().trim() : null;

        // Парсим ФИО для участников
        const nameParts = fullName.trim().split(/\s+/);
        const surname = nameParts[0] || '';
        const name = nameParts[1] || '';
        const patronymic = nameParts.slice(2).join(' ') || '';

        const deleted = {
            fromGroups: 0,
            fromExamParticipants: 0,
            fromResults: 0
        };

        // Удаление из групп
        if (deleteFromGroups !== false) {
            let groups = loadDB('groups');
            for (const group of groups) {
                if (searchGroup && group.name.toLowerCase() !== searchGroup) continue;

                const before = (group.students || []).length;
                group.students = (group.students || []).filter(s =>
                    (s.fullName || '').toLowerCase().trim() !== searchName.trim()
                );
                deleted.fromGroups += before - group.students.length;
            }
            if (deleted.fromGroups > 0) saveDB('groups', groups);
        }

        // Удаление из участников экзаменов
        if (deleteFromExams !== false) {
            let examParticipants = loadDB('exam_participants');
            const before = examParticipants.length;
            examParticipants = examParticipants.filter(p => {
                if (searchGroup && p.group?.toLowerCase() !== searchGroup) return true;
                const pSurname = (p.surname || '').toLowerCase();
                const pName = (p.name || '').toLowerCase();
                const pPatronymic = (p.patronymic || '').toLowerCase();
                const pFullName = `${pSurname} ${pName} ${pPatronymic}`.trim();
                return pFullName.trim() !== searchName.trim();
            });
            deleted.fromExamParticipants = before - examParticipants.length;
            if (deleted.fromExamParticipants > 0) saveDB('exam_participants', examParticipants);
        }

        // Удаление результатов
        if (deleteResults === true) {
            let results = loadDB('results');
            const before = results.length;
            results = results.filter(r => {
                if (searchGroup && r.studentGroup?.toLowerCase() !== searchGroup) return true;
                const rSurname = (r.studentSurname || '').toLowerCase();
                const rName = (r.studentName || '').toLowerCase();
                const rFullName = `${rSurname} ${rName}`.trim();
                return rFullName !== searchName;
            });
            deleted.fromResults = before - results.length;
            if (deleted.fromResults > 0) saveDB('results', results);
        }

        // Audit log
        logAudit('DELETE_STUDENT_FULL', session.userId, session.username, {
            fullName,
            groupName: groupName || 'все группы',
            deleted
        });

        const totalDeleted = deleted.fromGroups + deleted.fromExamParticipants + deleted.fromResults;

        return { success: true, deleted, totalDeleted };
    }

    // ========== GROUPS IMPORT ==========
    if (pathname === '/api/groups/import' && method === 'POST') {
        if (!session || session.role !== 'admin') return { success: false, error: 'Только админ' };
        const { groupName, students, groupId, text } = body;

        let groups = loadDB('groups');
        let group;
        let gIdx;

        // Вариант 1: Импорт в существующую группу по groupId + text (из UI)
        if (groupId && text) {
            gIdx = groups.findIndex(g => String(g.id) === String(groupId));
            if (gIdx === -1) return { success: false, error: 'Группа не найдена' };
            group = groups[gIdx];

            // Парсим текст - каждая строка = студент
            const lines = text.split('\n').map(l => l.trim()).filter(l => l);
            const existingNames = (group.students || []).map(s => s.fullName?.toLowerCase());
            let imported = 0;
            let skipped = 0;

            for (const line of lines) {
                if (existingNames.includes(line.toLowerCase())) {
                    skipped++;
                    continue;
                }
                if (!group.students) group.students = [];
                group.students.push({
                    id: generateId(),
                    fullName: line,
                    photoUrl: null,
                    createdAt: new Date().toISOString()
                });
                existingNames.push(line.toLowerCase());
                imported++;
            }

            saveDB('groups', groups);
            return { success: true, group, imported, skipped };
        }

        // Вариант 2: Создание/импорт группы по groupName + students (API)
        if (!groupName) return { success: false, error: 'Название группы обязательно' };
        group = groups.find(g => g.name.toLowerCase() === groupName.trim().toLowerCase());
        if (!group) {
            group = {
                id: generateId(), name: groupName.trim(), students: [],
                assignedTeachers: [], createdAt: new Date().toISOString()
            };
            groups.push(group);
        }
        gIdx = groups.findIndex(g => g.id === group.id);
        const newStudents = (students || []).map(s => ({
            id: generateId(), fullName: (typeof s === 'string' ? s : s.fullName)?.trim() || '',
            photoUrl: s.photoUrl || null, createdAt: new Date().toISOString()
        })).filter(s => s.fullName);
        groups[gIdx].students = [...(groups[gIdx].students || []), ...newStudents];
        saveDB('groups', groups);
        return { success: true, group: groups[gIdx], imported: newStudents.length };
    }

    // ========== PHOTOS ==========
    if (pathname === '/api/photos' && method === 'POST') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const { groupId, studentId, photoUrl, imageData } = body;
        // Поддерживаем оба варианта: photoUrl (старый) и imageData (новый)
        const photo = imageData || photoUrl;
        if (!groupId || !studentId || !photo) return { success: false, error: 'Неверные параметры' };
        let groups = loadDB('groups');
        const gIdx = groups.findIndex(g => String(g.id) === String(groupId));
        if (gIdx === -1) return { success: false, error: 'Группа не найдена' };
        const sIdx = (groups[gIdx].students || []).findIndex(s => String(s.id) === String(studentId));
        if (sIdx === -1) return { success: false, error: 'Студент не найден' };
        groups[gIdx].students[sIdx].photoUrl = photo;
        saveDB('groups', groups);
        return { success: true };
    }

    if (pathname.match(/^\/api\/photos\/[^/]+\/[^/]+$/) && method === 'DELETE') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const parts = pathname.split('/');
        const groupId = parts[3];
        const studentId = parts[4];
        let groups = loadDB('groups');
        const gIdx = groups.findIndex(g => String(g.id) === groupId);
        if (gIdx === -1) return { success: false, error: 'Группа не найдена' };
        const sIdx = (groups[gIdx].students || []).findIndex(s => String(s.id) === studentId);
        if (sIdx === -1) return { success: false, error: 'Студент не найден' };
        groups[gIdx].students[sIdx].photoUrl = null;
        saveDB('groups', groups);
        return { success: true };
    }

    // ========== RESULTS BULK DELETE ==========
    if (pathname === '/api/results/bulk-delete' && method === 'POST') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const { ids } = body;
        if (!ids || !Array.isArray(ids)) return { success: false, error: 'Неверные параметры' };

        let results = loadDB('results');
        const tests = loadDB('tests');
        const before = results.length;
        let noAccess = 0;

        // Проверка прав: админ может удалять всё, преподаватель - только результаты своих тестов
        if (session.role !== 'admin') {
            // Получаем ID тестов, которые создал этот преподаватель
            const myTestIds = tests
                .filter(t => String(t.createdBy) === String(session.userId))
                .map(t => String(t.id));

            // Удаляем только те результаты, которые входят в ids И относятся к тестам преподавателя
            results = results.filter(r => {
                if (!ids.includes(String(r.id))) return true; // Не в списке на удаление - оставляем
                // В списке на удаление - проверяем права
                if (!myTestIds.includes(String(r.testId))) {
                    noAccess++; // Считаем сколько не смогли удалить
                    return true; // Оставляем если НЕ мой тест (не можем удалить чужое)
                }
                return false; // Удаляем - это мой тест
            });
        } else {
            // Админ удаляет всё из списка
            results = results.filter(r => !ids.includes(String(r.id)));
        }

        saveDB('results', results);
        return { success: true, deleted: before - results.length, noAccess };
    }

    // ========== RESULTS TEACHER NOTES ==========
    if (pathname.match(/^\/api\/results\/[^/]+\/teacher-notes$/) && method === 'PUT') {
        if (!session) return { success: false, error: 'Не авторизован' };
        const resultId = pathname.split('/')[3];
        console.log(`[PUT teacher-notes] resultId: ${resultId}`);
        console.log(`[PUT teacher-notes] body.teacherNotes:`, JSON.stringify(body.teacherNotes));
        let results = loadDB('results');
        const idx = results.findIndex(r => String(r.id) === resultId);
        if (idx === -1) {
            console.log(`[PUT teacher-notes] Результат не найден!`);
            return { success: false, error: 'Результат не найден' };
        }
        // Правка оценки/штрафов — только админ или владелец теста (аудит 2026-06-10).
        if (!canManageTest(session, results[idx].testId)) {
            return { success: false, error: 'Нет прав на изменение этого результата', statusCode: 403 };
        }
        // Сохраняем как массив объектов (не строку!)
        const notes = Array.isArray(body.teacherNotes) ? body.teacherNotes : [];
        // Добавляем ID каждой заметке если его нет
        notes.forEach(note => {
            if (!note.id) note.id = generateId();
            if (!note.addedBy) note.addedBy = session.name || session.username;
        });
        results[idx].teacherNotes = notes;

        // === ПЕРЕСЧЁТ БАЛЛОВ С УЧЁТОМ ШТРАФОВ ОТ ПРЕПОДАВАТЕЛЯ ===
        // Логика:
        // - earnedPoints - исходные набранные баллы (до любых штрафов)
        // - penaltyCount - штрафы во время теста (из penalties при submit)
        // - teacherPenaltyCount - штрафы от преподавателя после теста (teacherNotes)
        // - adjustedEarnedPoints = earnedPoints - penaltyCount - teacherPenaltyCount

        const teacherPenaltyCount = notes.length;
        // Исходные баллы (до штрафов) - берём earnedPoints, который сохраняется без штрафов
        const originalEarnedPoints = results[idx].earnedPoints || results[idx].correctCount || 0;
        const maxPoints = results[idx].maxPoints || results[idx].totalQuestions || 1;
        // Штрафы во время теста (penalties при submit)
        const testPenaltyCount = results[idx].penaltyCount || 0;

        // Общие штрафы = штрафы во время теста + штрафы от преподавателя после теста
        const totalPenaltyCount = testPenaltyCount + teacherPenaltyCount;

        // Вычисляем скорректированные баллы (вычитаем ВСЕ штрафы из исходных баллов)
        const adjustedEarnedPoints = Math.max(0, originalEarnedPoints - totalPenaltyCount);
        const percentage = maxPoints > 0 ? Math.round((adjustedEarnedPoints / maxPoints) * 100) : 0;
        const testForGrade = loadDB('tests').find(t => String(t.id) === String(results[idx].testId));
        const grade = calculateGrade(percentage, testForGrade?.gradeScale);

        // Обновляем результат
        results[idx].teacherPenaltyCount = teacherPenaltyCount;
        results[idx].totalPenaltyCount = totalPenaltyCount;
        results[idx].adjustedEarnedPoints = adjustedEarnedPoints;
        results[idx].percentage = percentage;
        results[idx].grade = grade;

        // Используем синхронное сохранение для гарантии записи в БД
        const saved = await saveDBSync('results', results);
        if (!saved) {
            console.error(`[PUT /results/${resultId}/teacher-notes] ОШИБКА: Не удалось сохранить в БД!`);
            return { success: false, error: 'Ошибка сохранения в базу данных' };
        }
        console.log(`[PUT /results/${resultId}/teacher-notes] Сохранено ${notes.length} отметок, новый процент: ${percentage}%, оценка: ${grade}`);

        // Обновляем статус exam_participant если оценка изменилась
        const participantIdFromResult = results[idx].participantId;
        if (participantIdFromResult) {
            const testForResult = loadDB('tests').find(t => String(t.id) === String(results[idx].testId));
            if (testForResult && (testForResult.isExamMode || testForResult.isAdminSrezMode)) {
                const passingGrade = testForResult.examSettings?.passingGrade || 3;
                await updateInTable('exam_participants', participantIdFromResult, (p) => {
                    p.bestGrade = grade;
                    p.status = grade >= passingGrade ? 'passed' : 'failed';
                    return p;
                });
                console.log(`[PUT /results/${resultId}/teacher-notes] Обновлён участник ${participantIdFromResult}: grade=${grade}, status=${grade >= passingGrade ? 'passed' : 'failed'}`);
            }
        }

        return { success: true, result: results[idx] };
    }

    // ========== MAINTENANCE MODE (ТЕХРАБОТЫ) ==========
    // Получить статус техработ (публичный)
    if (pathname === '/api/maintenance' && method === 'GET') {
        let settings = loadDB('settings');
        const maintenance = settings.find(s => s.key === 'maintenance');
        return {
            success: true,
            enabled: maintenance?.enabled || false,
            message: maintenance?.message || 'Ведутся технические работы'
        };
    }

    // Включить/выключить режим техработ (только админ)
    if (pathname === '/api/maintenance' && method === 'POST') {
        if (!session) return { success: false, error: 'Не авторизован' };
        if (session.role !== 'admin') return { success: false, error: 'Нет прав' };

        let settings = loadDB('settings');
        const idx = settings.findIndex(s => s.key === 'maintenance');
        const maintenanceData = {
            key: 'maintenance',
            enabled: body.enabled || false,
            message: body.message || 'Ведутся технические работы',
            updatedAt: new Date().toISOString(),
            updatedBy: session.userId
        };

        if (idx >= 0) {
            settings[idx] = maintenanceData;
        } else {
            settings.push(maintenanceData);
        }
        saveDB('settings', settings);
        return { success: true, maintenance: maintenanceData };
    }

    return { success: false, error: 'API не найден' };
}

// ============================================
// HTTP СЕРВЕР
// ============================================

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
};

const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = parsedUrl.pathname;
    const query = Object.fromEntries(parsedUrl.searchParams.entries());

    // CORS (безопасная настройка)
    const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://kst-test.ru';
    const origin = req.headers.origin;

    if (origin && (origin === allowedOrigin || process.env.NODE_ENV !== 'production')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Security Headers (защита от XSS, clickjacking и других атак)
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Разрешаем iframe для LTI (Moodle) и sdo-kst.ru
    if (pathname === '/lti/launch' || req.headers.referer?.includes('sdo-kst.ru')) {
        res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://sdo-kst.ru");
    } else {
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    }
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    // CSP disabled for compatibility

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // LTI Launch endpoint (Moodle отправляет form-urlencoded POST)
    if (pathname === '/lti/launch' && req.method === 'POST') {
        try {
            const LTI_MAX_BODY_SIZE = 1 * 1024 * 1024; // 1MB max for LTI launch
            const chunks = [];
            let ltiBodySize = 0;
            for await (const chunk of req) {
                ltiBodySize += chunk.length;
                if (ltiBodySize > LTI_MAX_BODY_SIZE) {
                    res.writeHead(413, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Request body too large' }));
                    return;
                }
                chunks.push(chunk);
            }
            const rawBody = Buffer.concat(chunks).toString();
            const params = Object.fromEntries(new URLSearchParams(rawBody));

            const ltiConfig = getLtiConfig();
            if (!ltiConfig.enabled || !ltiConfig.consumerKey) {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h1>LTI интеграция не настроена</h1><p>Обратитесь к администратору системы тестирования.</p>');
                return;
            }

            // Проверяем consumer key
            if (params.oauth_consumer_key !== ltiConfig.consumerKey) {
                res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h1>Неверный ключ LTI</h1>');
                return;
            }

            // Проверяем OAuth подпись
            const launchUrl = `https://${req.headers.host}${pathname}`;
            if (!verifyLtiSignature('POST', launchUrl, params, ltiConfig.consumerSecret)) {
                // Пробуем с http
                const launchUrlHttp = `http://${req.headers.host}${pathname}`;
                if (!verifyLtiSignature('POST', launchUrlHttp, params, ltiConfig.consumerSecret)) {
                    console.error('[LTI] Signature verification failed');
                    res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end('<h1>Ошибка проверки подписи LTI</h1>');
                    return;
                }
            }

            // Извлекаем данные пользователя
            const ltiUserId = params.user_id || '';
            const fullName = (params.lis_person_name_full || '').trim();
            const firstName = params.lis_person_name_given || '';
            const lastName = params.lis_person_name_family || '';
            const email = params.lis_person_contact_email_primary || '';
            const roles = params.roles || '';
            const courseTitle = params.context_title || '';
            const courseName = params.context_label || '';
            const resourceTitle = params.resource_link_title || '';
            const resourceId = params.resource_link_id || '';
            const outcomeUrl = params.lis_outcome_service_url || '';
            const sourcedId = params.lis_result_sourcedid || '';
            const customTestId = params.custom_test_id || '';
            const customTestLink = params.custom_test_link || '';

            console.log(`[LTI] Launch: user=${fullName || lastName + ' ' + firstName}, course=${courseTitle}, resource=${resourceTitle}, testId=${customTestId}`);

            // Создаём LTI сессию
            const ltiSessionId = crypto.randomUUID();
            const ltiSession = {
                id: ltiSessionId,
                ltiUserId, fullName, firstName, lastName, email,
                roles, courseTitle, courseName,
                resourceId, resourceTitle,
                outcomeUrl, sourcedId,
                customTestId, customTestLink,
                consumerKey: ltiConfig.consumerKey,
                createdAt: new Date().toISOString()
            };

            // Сохраняем LTI сессию в кеш
            if (!dataCache['lti_sessions']) dataCache['lti_sessions'] = [];
            // Очищаем старые сессии (> 4 часов)
            dataCache['lti_sessions'] = dataCache['lti_sessions'].filter(s =>
                Date.now() - new Date(s.createdAt).getTime() < 4 * 60 * 60 * 1000
            );
            dataCache['lti_sessions'].push(ltiSession);
            saveDBDebounced('lti_sessions');

            // Определяем куда перенаправить
            let redirectUrl;
            if (customTestLink) {
                redirectUrl = `/test/${customTestLink}?lti=${ltiSessionId}`;
            } else if (customTestId) {
                const tests = loadDB('tests');
                const test = tests.find(t => String(t.id) === customTestId);
                if (test) {
                    redirectUrl = `/test/${test.link}?lti=${ltiSessionId}`;
                } else {
                    redirectUrl = `/start?lti=${ltiSessionId}`;
                }
            } else {
                redirectUrl = `/start?lti=${ltiSessionId}`;
            }

            // Перенаправляем студента
            res.writeHead(302, { 'Location': redirectUrl });
            res.end();
            return;
        } catch (err) {
            console.error('[LTI] Launch error:', err);
            res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>Ошибка LTI</h1><p>' + escapeHtml(err.message) + '</p>');
            return;
        }
    }

    // LTI: получить данные сессии (для test.html)
    if (pathname === '/api/lti/session' && req.method === 'GET') {
        const ltiId = query.id;
        if (!ltiId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'LTI session ID required' }));
            return;
        }
        const sessions = dataCache['lti_sessions'] || [];
        const session = sessions.find(s => s.id === ltiId);
        if (!session) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'LTI session not found' }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
            success: true,
            firstName: session.firstName,
            lastName: session.lastName,
            fullName: session.fullName,
            courseName: session.courseTitle || session.courseName,
            resourceTitle: session.resourceTitle
        }));
        return;
    }

    // API
    if (pathname.startsWith('/api/')) {
        if (pathname.includes('submit')) {
            console.log(`[HTTP] ${req.method} ${pathname} от ${req.headers['x-real-ip'] || req.socket?.remoteAddress}`);
        }
        let body = {};
        const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB макс
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
            try {
                const chunks = [];
                let totalSize = 0;
                for await (const chunk of req) {
                    totalSize += chunk.length;
                    if (totalSize > MAX_BODY_SIZE) {
                        res.writeHead(413, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Слишком большой запрос' }));
                        return;
                    }
                    chunks.push(chunk);
                }
                const data = Buffer.concat(chunks).toString();
                if (data) body = JSON.parse(data);
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Неверный JSON' }));
                return;
            }
        }

        const token = req.headers.authorization?.replace('Bearer ', '');
        // Получаем IP клиента. Заголовкам X-Real-IP / X-Forwarded-For доверяем ТОЛЬКО когда
        // соединение пришло от локального обратного прокси (nginx на 127.0.0.1) — иначе клиент,
        // подключившийся к порту напрямую, мог бы подделать их и обойти rate-limit (аудит 2026-06-10).
        const peerIp = req.socket?.remoteAddress || '';
        const fromLocalProxy = peerIp === '127.0.0.1' || peerIp === '::1' || peerIp === '::ffff:127.0.0.1';
        let clientIp;
        if (fromLocalProxy) {
            // nginx перезаписывает X-Real-IP = $remote_addr (подделать нельзя). XFF — берём ПОСЛЕДНИЙ
            // элемент (его дописал nginx через $proxy_add_x_forwarded_for), а не первый клиентский.
            const xff = req.headers['x-forwarded-for'];
            clientIp = (req.headers['x-real-ip'] && String(req.headers['x-real-ip']).trim()) ||
                       (xff ? String(xff).split(',').pop().trim() : '') ||
                       peerIp || 'unknown';
        } else {
            clientIp = peerIp || 'unknown';
        }
        try {
            const result = await handleAPI(req.method, pathname, body, token, query, clientIp);
            // HTTP статус код в зависимости от результата
            let statusCode = 200;
            if (result.statusCode) {
                statusCode = result.statusCode;
                delete result.statusCode; // Не отправляем в ответе
            } else if (!result.success && result.error) {
                // Определяем код по типу ошибки
                if (result.error.includes('авторизован') || result.error.includes('Неверный логин')) {
                    statusCode = 401;
                } else if (result.error.includes('запрещ') || result.error.includes('нет прав')) {
                    statusCode = 403;
                } else if (result.error.includes('не найден') || result.error.includes('Не найден')) {
                    statusCode = 404;
                } else if (result.error.includes('Слишком много')) {
                    statusCode = 429; // Too Many Requests
                }
            }
            // Поддержка raw-ответов (CSV и т.п.)
            if (result && result.__raw) {
                const rawHeaders = { 'Content-Type': result.contentType || 'text/plain', ...result.headers };
                res.writeHead(200, rawHeaders);
                res.end(result.body);
                return;
            }
            res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(result));
        } catch (e) {
            console.error('API Error:', e);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера' }));
        }
        return;
    }

    // SPA роутинг
    if (pathname === '/test' || pathname.startsWith('/test/')) pathname = '/test.html';
    if (pathname === '/exam' || pathname.startsWith('/exam/')) pathname = '/exam.html';
    if (pathname === '/srez' || pathname.startsWith('/srez/')) pathname = '/srez.html';
    if (pathname === '/start' || pathname.startsWith('/start/')) pathname = '/start.html';

    // Статика
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(__dirname, filePath);

    // Защита от Path Traversal — файл должен быть внутри директории проекта
    if (!filePath.startsWith(__dirname + path.sep) && filePath !== __dirname) {
        res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>403 - Доступ запрещён</h1>');
        return;
    }

    // Блокируем доступ к .env, исходникам сервера, бэкапам и другим чувствительным файлам.
    // ВАЖНО: клиентский JS живёт только в /js/ и sw.js — всё остальное серверное/чувствительное закрываем.
    const basename = path.basename(filePath);
    const lowerName = basename.toLowerCase();
    const blockedNames = new Set([
        '.env', '.gitignore', 'ecosystem.config.js', 'package.json', 'package-lock.json',
        'node_modules', 'server-postgres.js', 'proxy3000.js', 'init-db.sql'
    ]);
    const blockedExts = new Set(['.sql', '.sh', '.bat', '.md', '.dump', '.tgz', '.gz', '.zip', '.log', '.bak', '.env']);
    const isBlocked =
        basename.startsWith('.') ||                 // dot-файлы (.env, .gitignore, ...)
        blockedNames.has(basename) ||
        blockedExts.has(path.extname(lowerName)) ||  // исходники БД, скрипты, дампы, логи
        lowerName.includes('.backup') ||             // *.backup, *.html.backup.pre-pwa и т.п.
        lowerName.endsWith('~');
    if (isBlocked) {
        res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>403 - Доступ запрещён</h1>');
        return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // HTML файлы не кэшируем (чтобы обновления сразу были видны)
    // CSS/JS кэшируем на 1 час, изображения на 1 день
    let cacheControl = 'public, max-age=3600'; // По умолчанию 1 час
    if (ext === '.html') {
        cacheControl = 'no-cache, no-store, must-revalidate'; // HTML всегда свежий
    } else if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.ico', '.svg'].includes(ext)) {
        cacheControl = 'public, max-age=86400'; // Изображения 1 день
    }

    try {
        const content = await fs.promises.readFile(filePath);

        // ETag для кэширования статики
        const etag = '"' + crypto.createHash('md5').update(content).digest('hex') + '"';
        if (req.headers['if-none-match'] === etag) {
            res.writeHead(304);
            res.end();
            return;
        }

        // Сжатие gzip для текстовых файлов (HTML, CSS, JS) - ускоряет загрузку в 3-5 раз
        const compressible = ['.html', '.css', '.js', '.json', '.svg', '.txt'];
        const acceptGzip = req.headers['accept-encoding']?.includes('gzip');

        const headers = {
            'Content-Type': contentType,
            'Cache-Control': cacheControl,
            'ETag': etag
        };

        if (compressible.includes(ext) && acceptGzip && content.length > 1024) {
            zlib.gzip(content, (err, compressed) => {
                if (err) {
                    res.writeHead(200, headers);
                    res.end(content);
                } else {
                    headers['Content-Encoding'] = 'gzip';
                    res.writeHead(200, headers);
                    res.end(compressed);
                }
            });
        } else {
            res.writeHead(200, headers);
            res.end(content);
        }
    } catch (e) {
        if (e.code === 'ENOENT') {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>404 - Файл не найден</h1>');
        } else {
            res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>500 - Ошибка сервера</h1>');
        }
    }
});

// ============================================
// ИНИЦИАЛИЗАЦИЯ (PostgreSQL)
// ============================================

async function startServer() {
    try {
        console.log('Подключение к PostgreSQL TimewEB...');

        // Проверяем подключение
        await pool.query('SELECT 1');
        console.log('PostgreSQL подключён успешно!');

        // Загружаем данные в кэш
        await initCache();

        // Построчное хранилище результатов (нагрузка): таблица + однократная миграция + загрузка кэша из строк
        try {
            await ensureResultsTable();
            await migrateResultsToRows();
            dataCache['results'] = await loadResultsFromRows();
            resultsRowMode = true;
            console.log(`[RESULTS] Построчный режим включён, в кэше ${dataCache['results'].length} результатов`);
        } catch (e) {
            // Безопасный фолбэк: если что-то не так — остаёмся на старом блобе (results из initCache)
            resultsRowMode = false;
            console.error('[RESULTS] Не удалось включить построчный режим, остаёмся на старом блобе:', e.message);
        }

        // Миграция: добавляем shortCode ко всем тестам без него
        const tests = loadDB('tests');
        const existingCodes = tests.map(t => t.shortCode).filter(Boolean);
        let migrated = 0;

        for (const test of tests) {
            if (!test.shortCode) {
                const newCode = generateTestShortCode(existingCodes);
                test.shortCode = newCode;
                existingCodes.push(newCode);
                migrated++;
            }
        }

        if (migrated > 0) {
            saveDB('tests', tests);
            console.log(`Миграция shortCode: добавлено ${migrated} кодов`);
        }

        // Запускаем периодическую синхронизацию кэша между воркерами PM2
        startCacheSync();

        // Запускаем сервер
        server.listen(PORT, HOST, () => {
            console.log('');
            console.log('╔══════════════════════════════════════════════════════════╗');
            console.log('║      СЕРВЕР ТЕСТИРОВАНИЯ ЗАПУЩЕН (PostgreSQL)           ║');
            console.log('╠══════════════════════════════════════════════════════════╣');
            console.log(`║  Адрес: http://0.0.0.0:${PORT}                              ║`);
            console.log('║  База данных: TimewEB PostgreSQL                        ║');
            console.log(`║  Пул соединений: ${pool.options.max} на воркер                            ║`);
            console.log('║                                                          ║');
            console.log('║  ⚠️  БЕЗОПАСНОСТЬ: Credentials в .env файле              ║');
            console.log('║  ⚠️  ВАЖНО: Смените пароль админа после первого входа!  ║');
            console.log('╚══════════════════════════════════════════════════════════╝');
            console.log('');
        });

        // ========== ФУНКЦИЯ ОЧИСТКИ ПАМЯТИ (ОПТИМИЗИРОВАНО) ==========
        function cleanupMemory(aggressive = false) {
            const memBefore = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
            let cleaned = [];
            const now = Date.now();

            // 1. Очистка истёкших active_tests (старше 4 часов, было 24)
            const activeTests = dataCache['active_tests'] || [];
            const hoursAgo = now - (aggressive ? 2 : 4) * 60 * 60 * 1000;
            const validActiveTests = activeTests.filter(t => {
                const savedAt = new Date(t.updatedAt || t.savedAt || t.startTime || 0).getTime();
                return savedAt > hoursAgo;
            });
            if (validActiveTests.length < activeTests.length) {
                const removed = activeTests.length - validActiveTests.length;
                dataCache['active_tests'] = validActiveTests;
                cleaned.push(`active_tests: -${removed}`);
            }

            // 2. Ограничение active_tests по количеству (макс 500)
            if (dataCache['active_tests'] && dataCache['active_tests'].length > 500) {
                dataCache['active_tests'] = [...dataCache['active_tests']].sort((a, b) =>
                    new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
                );
                const removed = dataCache['active_tests'].length - 500;
                dataCache['active_tests'] = dataCache['active_tests'].slice(0, 500);
                cleaned.push(`active_tests_limit: -${removed}`);
            }

            // 3. Ограничение admin_logs в памяти (последние 200, было 500)
            const logs = dataCache['admin_logs'] || [];
            const logLimit = aggressive ? 100 : 200;
            if (logs.length > logLimit) {
                dataCache['admin_logs'] = [...logs].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)).slice(0, logLimit);
                cleaned.push(`admin_logs: -${logs.length - logLimit}`);
            }

            // 4. Очистка старых сессий (старше 1 дня, было 7)
            const sessions = dataCache['sessions'] || [];
            const dayAgo = now - (aggressive ? 12 : 24) * 60 * 60 * 1000;
            const validSessions = sessions.filter(s => {
                const lastAccess = new Date(s.lastAccess || s.createdAt || 0).getTime();
                return lastAccess > dayAgo;
            });
            if (validSessions.length < sessions.length) {
                const removed = sessions.length - validSessions.length;
                dataCache['sessions'] = validSessions;
                cleaned.push(`sessions: -${removed}`);
            }

            // 5. НЕ удаляем exam_participants из кэша — они нужны для входа студентов!
            // Участники синхронизируются из БД через syncCacheFromDB().

            // 6. Сохраняем очищенные данные в БД (чтобы мусор не возвращался после рестарта)
            if (cleaned.length > 0) {
                if (dataCache['active_tests']) saveDB('active_tests', dataCache['active_tests']);
                if (dataCache['admin_logs']) saveDB('admin_logs', dataCache['admin_logs']);
                if (dataCache['sessions']) saveDB('sessions', dataCache['sessions']);
            }

            // 7. Принудительная сборка мусора (если доступна)
            if (global.gc) {
                global.gc();
                cleaned.push('GC');
            }

            const memAfter = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

            if (cleaned.length > 0) {
                console.log(`[ОЧИСТКА ПАМЯТИ${aggressive ? ' АГРЕССИВНАЯ' : ''}] ${cleaned.join(', ')} | ${memBefore}MB -> ${memAfter}MB`);
            }

            return memAfter;
        }

        // Мониторинг нагрузки каждые 2 минуты
        setInterval(() => {
            const poolStats = {
                total: pool.totalCount,
                idle: pool.idleCount,
                waiting: pool.waitingCount
            };
            const memUsage = process.memoryUsage();
            const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);

            // Считаем активные сессии и active_tests
            const sessionsData = loadDB('sessions');
            const activeTestsData = loadDB('active_tests');
            const activeSessions = sessionsData.length;
            const activeTestsCount = activeTestsData.length;

            console.log(`[МОНИТОРИНГ] Сессий: ${activeSessions} | ActiveTests: ${activeTestsCount} | Память: ${memMB}MB | БД: ${poolStats.total} соед. (${poolStats.idle} свободно, ${poolStats.waiting} ждут)`);

            // Предупреждение при высокой нагрузке
            if (poolStats.waiting > 10) {
                console.log('⚠️  ВНИМАНИЕ: Много запросов ждут соединения с БД!');
            }

            // Автоматическая очистка при превышении памяти
            if (memMB > 300) {
                console.log('⚠️  Память > 300MB, запускаю очистку...');
                const memAfter = cleanupMemory(false);

                // Агрессивная очистка если память всё ещё высокая
                if (memAfter > 500) {
                    console.log('⚠️  Память > 500MB, агрессивная очистка...');
                    cleanupMemory(true);
                }
            }
        }, 120000);

        // Плановая очистка каждые 2 минуты (было 5)
        setInterval(() => {
            cleanupMemory(false);
        }, 2 * 60 * 1000);

        // ========== ОЧИСТКА ЗАВИСШИХ IN_PROGRESS (каждые 30 минут) ==========
        async function cleanupStuckInProgress() {
            try {
                await acquireTableLock('exam_participants');
                try {
                    const participants = loadDB('exam_participants');
                    const now = Date.now();
                    const TWO_HOURS = 2 * 60 * 60 * 1000; // 2 часа в миллисекундах

                    let cleaned = 0;
                    const updated = participants.map(p => {
                        if (p.status === 'in_progress') {
                            // Проверяем когда участник начал тест
                            const startTime = p.startedAt ? new Date(p.startedAt).getTime() : 0;
                            const elapsed = now - startTime;

                            // Если прошло больше 2 часов - завершаем принудительно
                            if (elapsed > TWO_HOURS || !p.startedAt) {
                                p.status = 'failed';
                                p.finishedAt = new Date().toISOString();
                                p.finishReason = 'auto_cleanup_stuck';
                                cleaned++;
                                console.log(`[CLEANUP] Завершён зависший: ${p.surname} ${p.name} (${p.group})`);
                            }
                        }
                        return p;
                    });

                    if (cleaned > 0) {
                        await saveToDB('exam_participants', updated);
                        dataCache['exam_participants'] = updated;
                        console.log(`[CLEANUP] Очищено зависших in_progress: ${cleaned}`);
                    }
                } finally {
                    releaseTableLock('exam_participants');
                }
            } catch (err) {
                console.error('[CLEANUP ERROR]', err.message);
            }
        }

        // Запуск очистки зависших каждые 30 минут
        setInterval(cleanupStuckInProgress, 30 * 60 * 1000);

        // Первый запуск через 5 минут после старта сервера
        setTimeout(cleanupStuckInProgress, 5 * 60 * 1000);

    } catch (err) {
        console.error('ОШИБКА ЗАПУСКА:', err.message);
        process.exit(1);
    }
}

// Graceful shutdown — закрываем HTTP сервер, потом пул БД
let isShuttingDown = false;
function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n[SHUTDOWN] Получен ${signal}, завершаем gracefully...`);

    // Перестаём принимать новые соединения
    server.close(async () => {
        console.log('[SHUTDOWN] HTTP сервер закрыт');
        try {
            // Сохраняем audit log перед выходом
            if (dataCache['audit_log']) {
                await saveToDB('audit_log', dataCache['audit_log']);
            }
            await pool.end();
            console.log('[SHUTDOWN] Пул PostgreSQL закрыт');
        } catch (err) {
            console.error('[SHUTDOWN] Ошибка при закрытии:', err.message);
        }
        process.exit(0);
    });

    // Если через 10 секунд не закрылся — принудительно
    setTimeout(() => {
        console.error('[SHUTDOWN] Принудительное завершение (таймаут 10с)');
        process.exit(1);
    }, 10000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Запуск
startServer();
