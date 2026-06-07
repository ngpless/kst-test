-- ============================================
-- ИНИЦИАЛИЗАЦИЯ БД ДЛЯ СИСТЕМЫ ТЕСТИРОВАНИЯ
-- ============================================

-- Создание таблицы для хранения данных приложения
CREATE TABLE IF NOT EXISTS app_data (
    store_name VARCHAR(100) NOT NULL,
    data_key VARCHAR(100) NOT NULL DEFAULT 'data',
    data TEXT NOT NULL DEFAULT '[]',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (store_name, data_key)
);

-- Создание индекса для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_app_data_store ON app_data(store_name);

-- Вставка данных по умолчанию (admin пользователь будет создан автоматически при первом запуске)
INSERT INTO app_data (store_name, data_key, data, updated_at)
VALUES
    ('users', 'data', '[]', NOW()),
    ('questions', 'data', '[]', NOW()),
    ('disciplines', 'data', '[]', NOW()),
    ('groups', 'data', '[]', NOW()),
    ('results', 'data', '[]', NOW()),
    ('active_tests', 'data', '[]', NOW()),
    ('exam_participants', 'data', '[]', NOW())
ON CONFLICT (store_name, data_key) DO NOTHING;

-- Готово!
SELECT 'Database initialized successfully!' as status;
