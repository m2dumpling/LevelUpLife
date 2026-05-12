// pm2 配置 — 比 Docker 快 5x
module.exports = {
  apps: [
    {
      name: "levelup-life",
      script: ".next/standalone/server.js",
      cwd: "/opt/levelup-life",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "0.0.0.0",
        DATABASE_PATH: "/opt/levelup-life/data/levelup.db",
      },
      max_memory_restart: "300M",
      restart_delay: 3000,
      max_restarts: 10,
      exp_backoff_restart_delay: 100,
    },
  ],
};
