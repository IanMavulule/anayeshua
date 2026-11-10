// Gerado por scripts/deploy-remote.sh — o pm2 corre sempre a versão em current/.
module.exports = {
  apps: [{
    name: 'anayeshua',
    cwd: '/var/www/anayeshua/current',
    script: 'server/index.ts',
    interpreter: '/opt/node-22/bin/node',
    env: { NODE_ENV: 'production', PORT: '8787', PATH: '/opt/node-22/bin:/usr/local/bin:/usr/bin:/bin' },
    max_memory_restart: '1G',
  }],
}
