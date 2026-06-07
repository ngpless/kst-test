module.exports = {
  apps: [{
    name: 'test-system',
    script: 'server-postgres.js',

    // ВНИМАНИЕ: режим ОДНОГО процесса (fork) — НЕ cluster!
    // Модель данных хранит каждую таблицу единым JSON-блобом во ВНУТРИпроцессном кэше,
    // а блокировки записи (tableLocks) тоже внутрипроцессные. В cluster mode у каждого
    // воркера свой кэш и свои локи => одновременные сдачи МОЛЧА затирают результаты друг друга.
    // Не переводить в cluster, пока results не переведён на построчное хранение.
    instances: 1,
    exec_mode: 'fork',

    // Автоперезапуск при превышении памяти
    max_memory_restart: '1536M',

    // Node.js флаги для управления памятью
    node_args: '--max-old-space-size=1536 --expose-gc',

    // Переменные окружения (основные credentials в .env файле!)
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },

    // Логирование (процесс работает под пользователем open)
    error_file: '/home/open/.pm2/logs/test-system-error.log',
    out_file: '/home/open/.pm2/logs/test-system-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,

    // Перезапуск
    autorestart: true,
    watch: false,
    max_restarts: 15,
    min_uptime: '10s',
    restart_delay: 1000,

    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,

    // Балансировка нагрузки
    increment_var: 'PORT',
    instance_var: 'INSTANCE_ID'
  }]
};
