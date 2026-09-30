module.exports = {
  apps: [
    {
      name: 'smart-tutor',
      script: 'dist/server.js',
      cwd: '/srv/smart-tutor',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
}
