// ============================================
// Модуль IndexedDB для офлайн-режима тестирования
// ============================================

const OfflineDB = {
    DB_NAME: 'KSTTestOffline',
    DB_VERSION: 1,
    db: null,

    // Инициализация базы данных
    async init() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = () => {
                console.error('[OfflineDB] Error opening database:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('[OfflineDB] Database opened successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log('[OfflineDB] Upgrading database...');

                // Хранилище для данных теста (вопросы, настройки)
                if (!db.objectStoreNames.contains('testData')) {
                    const testStore = db.createObjectStore('testData', { keyPath: 'testId' });
                    testStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // Хранилище для ответов пользователя
                if (!db.objectStoreNames.contains('answers')) {
                    const answersStore = db.createObjectStore('answers', { keyPath: 'id', autoIncrement: true });
                    answersStore.createIndex('testId', 'testId', { unique: false });
                    answersStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // Хранилище для отложенных результатов (не отправленных на сервер)
                if (!db.objectStoreNames.contains('pendingResults')) {
                    const resultsStore = db.createObjectStore('pendingResults', { keyPath: 'id', autoIncrement: true });
                    resultsStore.createIndex('testId', 'testId', { unique: false });
                    resultsStore.createIndex('timestamp', 'timestamp', { unique: false });
                    resultsStore.createIndex('synced', 'synced', { unique: false });
                }

                // Хранилище для состояния теста (для восстановления)
                if (!db.objectStoreNames.contains('testState')) {
                    db.createObjectStore('testState', { keyPath: 'sessionId' });
                }
            };
        });
    },

    // === Работа с данными теста ===

    // Сохранить данные теста для офлайн-режима
    async saveTestData(testId, data) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['testData'], 'readwrite');
            const store = transaction.objectStore('testData');

            const record = {
                testId: String(testId),
                data: data,
                timestamp: Date.now()
            };

            const request = store.put(record);
            request.onsuccess = () => {
                console.log('[OfflineDB] Test data saved:', testId);
                resolve(record);
            };
            request.onerror = () => reject(request.error);
        });
    },

    // Получить данные теста
    async getTestData(testId) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['testData'], 'readonly');
            const store = transaction.objectStore('testData');
            const request = store.get(String(testId));

            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    console.log('[OfflineDB] Test data loaded:', testId);
                    resolve(result.data);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    },

    // === Работа с ответами ===

    // Сохранить ответ на вопрос
    async saveAnswer(testId, questionId, answer) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['answers'], 'readwrite');
            const store = transaction.objectStore('answers');

            const record = {
                testId: String(testId),
                questionId: String(questionId),
                answer: answer,
                timestamp: Date.now()
            };

            const request = store.add(record);
            request.onsuccess = () => resolve(record);
            request.onerror = () => reject(request.error);
        });
    },

    // Получить все ответы по тесту
    async getAnswers(testId) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['answers'], 'readonly');
            const store = transaction.objectStore('answers');
            const index = store.index('testId');
            const request = index.getAll(String(testId));

            request.onsuccess = () => {
                const answers = {};
                request.result.forEach(record => {
                    answers[record.questionId] = record.answer;
                });
                resolve(answers);
            };
            request.onerror = () => reject(request.error);
        });
    },

    // === Работа с отложенными результатами ===

    // Сохранить результат для отложенной отправки
    async savePendingResult(resultData) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pendingResults'], 'readwrite');
            const store = transaction.objectStore('pendingResults');

            const record = {
                ...resultData,
                timestamp: Date.now(),
                synced: false,
                retryCount: 0
            };

            const request = store.add(record);
            request.onsuccess = () => {
                console.log('[OfflineDB] Pending result saved');
                resolve({ ...record, id: request.result });
            };
            request.onerror = () => reject(request.error);
        });
    },

    // Получить все неотправленные результаты
    async getPendingResults() {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pendingResults'], 'readonly');
            const store = transaction.objectStore('pendingResults');
            const index = store.index('synced');
            const request = index.getAll(false);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Пометить результат как отправленный
    async markResultSynced(id) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pendingResults'], 'readwrite');
            const store = transaction.objectStore('pendingResults');
            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const record = getRequest.result;
                if (record) {
                    record.synced = true;
                    record.syncedAt = Date.now();
                    const putRequest = store.put(record);
                    putRequest.onsuccess = () => resolve(record);
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    resolve(null);
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    },

    // Удалить отправленные результаты
    async clearSyncedResults() {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pendingResults'], 'readwrite');
            const store = transaction.objectStore('pendingResults');
            const index = store.index('synced');
            const request = index.openCursor(IDBKeyRange.only(true));

            let deletedCount = 0;
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    deletedCount++;
                    cursor.continue();
                } else {
                    console.log('[OfflineDB] Cleared synced results:', deletedCount);
                    resolve(deletedCount);
                }
            };
            request.onerror = () => reject(request.error);
        });
    },

    // === Работа с состоянием теста ===

    // Сохранить состояние теста (для восстановления после перезагрузки)
    async saveTestState(sessionId, state) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['testState'], 'readwrite');
            const store = transaction.objectStore('testState');

            const record = {
                sessionId: String(sessionId),
                state: state,
                timestamp: Date.now()
            };

            const request = store.put(record);
            request.onsuccess = () => {
                console.log('[OfflineDB] Test state saved');
                resolve(record);
            };
            request.onerror = () => reject(request.error);
        });
    },

    // Получить состояние теста
    async getTestState(sessionId) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['testState'], 'readonly');
            const store = transaction.objectStore('testState');
            const request = store.get(String(sessionId));

            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? result.state : null);
            };
            request.onerror = () => reject(request.error);
        });
    },

    // Удалить состояние теста
    async clearTestState(sessionId) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['testState'], 'readwrite');
            const store = transaction.objectStore('testState');
            const request = store.delete(String(sessionId));

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },

    // === Утилиты ===

    // Проверить онлайн статус
    isOnline() {
        return navigator.onLine;
    },

    // Очистить все данные (при необходимости)
    async clearAll() {
        await this.init();
        const stores = ['testData', 'answers', 'pendingResults', 'testState'];

        for (const storeName of stores) {
            await new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }

        console.log('[OfflineDB] All data cleared');
    }
};

// Экспортируем для использования
if (typeof window !== 'undefined') {
    window.OfflineDB = OfflineDB;
}
