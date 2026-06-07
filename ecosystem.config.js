module.exports = {
  apps: [{
    name: 'test-system',
    script: 'server-postgres.js',

    // CLUSTER MODE: 4 воркера (оптимизировано для стабильности и безопасности БД)
    // 4 воркера × 10 соединений к БД = 40 макс соединений (безопасно для PostgreSQL)
    instances: 4,
    exec_mode: 'cluster',

    // Автоперезапуск при превышении памяти (1GB на воркер, всего до 4GB)
    max_memory_restart: '1024M',

    // Node.js флаги для управления памятью (1GB heap на воркер)
    node_args: '--max-old-space-size=1024 --expose-gc',

    // Переменные окружения (основные credentials в .env файле!)
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },

    // Логирование
    error_file: '/root/.pm2/logs/test-system-error.log',
    out_file: '/root/.pm2/logs/test-system-out.log',
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
