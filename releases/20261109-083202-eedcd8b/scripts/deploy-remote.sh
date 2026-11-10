#!/usr/bin/env bash
# Parte remota do deploy (corre na VPS, chamada por scripts/deploy.ts). Não precisa de sudo.
#
# Estrutura em $BASE (por omissão /var/www/anayeshua):
#   shared/.env, shared/videos/, shared/data/   — persistem entre versões
#   shared/backups/*.dump                        — cópias da base antes de migrar (últimas 10)
#   shared/ecosystem.config.cjs                  — processo pm2 "anayeshua"
#   releases/<data>-<commit>/                    — uma pasta por versão (ficam as últimas 5)
#   current -> releases/...                      — versão activa (nginx serve current/dist)
#
# Uso:
#   deploy-remote.sh deploy <pasta-da-versão>   instala, compila, migra, activa e verifica
#   deploy-remote.sh rollback                    volta à versão anterior
#   deploy-remote.sh status                      mostra a versão activa e as disponíveis
set -euo pipefail

BASE="${DEPLOY_PATH:-/var/www/anayeshua}"
NODE_DIR="${DEPLOY_NODE_DIR:-/opt/node-22}"
APP_NAME=anayeshua
PORT=8787
KEEP_RELEASES=5
KEEP_BACKUPS=10

SHARED="$BASE/shared"
RELEASES="$BASE/releases"
CURRENT="$BASE/current"
export PATH="$NODE_DIR/bin:$PATH"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

# Primeira vez: converte a instalação antiga ($BASE/app) para shared/ + releases/.
migrate_layout() {
  [ -d "$SHARED" ] && return
  log "Primeira execução: a criar $SHARED"
  mkdir -p "$SHARED/backups" "$RELEASES"
  if [ -d "$BASE/app" ]; then
    [ -f "$BASE/app/.env" ] && mv "$BASE/app/.env" "$SHARED/.env"
    [ -d "$BASE/app/videos" ] && mv "$BASE/app/videos" "$SHARED/videos"
    [ -d "$BASE/app/data" ] && mv "$BASE/app/data" "$SHARED/data"
    rm -f "$BASE/app/ecosystem.config.cjs"
    local legacy="$RELEASES/00000000-000000-legacy"
    mv "$BASE/app" "$legacy"
    link_shared "$legacy"
    ln -sfn "$legacy" "$CURRENT"
  fi
  mkdir -p "$SHARED/videos" "$SHARED/data/uploads"
  [ -f "$SHARED/.env" ] || fail "Falta $SHARED/.env (copie o .env de produção para lá)."
}

link_shared() {
  local release="$1"
  rm -rf "$release/.env" "$release/videos" "$release/data"
  ln -s "$SHARED/.env" "$release/.env"
  ln -s "$SHARED/videos" "$release/videos"
  ln -s "$SHARED/data" "$release/data"
}

write_ecosystem() {
  cat > "$SHARED/ecosystem.config.cjs" <<EOF
// Gerado por scripts/deploy-remote.sh — o pm2 corre sempre a versão em current/.
module.exports = {
  apps: [{
    name: '$APP_NAME',
    cwd: '$CURRENT',
    script: 'server/index.ts',
    interpreter: '$NODE_DIR/bin/node',
    env: { NODE_ENV: 'production', PORT: '$PORT', PATH: '$NODE_DIR/bin:/usr/local/bin:/usr/bin:/bin' },
    max_memory_restart: '1G',
  }],
}
EOF
}

# Pára e volta a criar só o processo desta app (os outros processos pm2 não são tocados).
restart_app() {
  write_ecosystem
  pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
  pm2 start "$SHARED/ecosystem.config.cjs" >/dev/null
  pm2 save >/dev/null
}

healthy() {
  for _ in $(seq 1 30); do
    curl -fs -o /dev/null "http://127.0.0.1:$PORT/api/settings" && return 0
    sleep 1
  done
  return 1
}

activate() {
  local release="$1"
  ln -sfn "$release" "$CURRENT.tmp"
  mv -Tf "$CURRENT.tmp" "$CURRENT"
}

# Versão imediatamente anterior à activa (as pastas ordenam-se pela data no nome).
previous_release() {
  local active
  active="$(readlink -f "$CURRENT" 2>/dev/null || true)"
  ls -1d "$RELEASES"/*/ 2>/dev/null | sed 's#/$##' | sort | awk -v a="$active" '$0 < a' | tail -1
}

backup_database() {
  local url
  url="$(grep -E '^DATABASE_URL=' "$SHARED/.env" | tail -1 | cut -d= -f2-)"
  [ -n "$url" ] || fail "DATABASE_URL não definido em $SHARED/.env"
  local file="$SHARED/backups/$(date +%Y%m%d-%H%M%S).dump"
  log "Cópia de segurança da base → $file"
  pg_dump --format=custom --file="$file" "$url"
  chmod 600 "$file"
  ls -1t "$SHARED"/backups/*.dump 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f
}

prune_releases() {
  local active
  active="$(readlink -f "$CURRENT")"
  # awk (e não grep) para uma lista vazia não contar como erro com pipefail.
  ls -1d "$RELEASES"/*/ | sed 's#/$##' | sort | head -n -$KEEP_RELEASES | awk -v a="$active" '$0 != a' | xargs -r rm -rf
}

cmd_deploy() {
  local release="$1"
  [ -d "$release" ] || fail "Versão $release não existe."
  migrate_layout
  local previous
  previous="$(readlink -f "$CURRENT" 2>/dev/null || true)"

  link_shared "$release"
  cd "$release"
  log "Node $(node -v): a instalar dependências"
  npm ci --no-audit --no-fund --loglevel=error
  log "A compilar (typecheck + frontend)"
  npm run build --silent
  backup_database
  log "Migrações"
  npm run db:migrate --silent

  log "A activar $(basename "$release")"
  activate "$release"
  restart_app
  if ! healthy; then
    pm2 logs "$APP_NAME" --lines 30 --nostream || true
    if [ -n "$previous" ] && [ -d "$previous" ]; then
      log "A API não respondeu — a voltar a $(basename "$previous")"
      activate "$previous"
      restart_app
      healthy && echo "Versão anterior reposta." || echo "Atenção: a versão anterior também não responde."
    fi
    fail "Deploy falhou: a API não respondeu em http://127.0.0.1:$PORT/api/settings"
  fi
  prune_releases
  log "Pronto: $(basename "$release") activa"
}

cmd_rollback() {
  local target
  target="$(previous_release)"
  [ -n "$target" ] || fail "Não há versão anterior."
  log "A voltar a $(basename "$target")"
  # As migrações não são desfeitas; a base fica como está (há cópias em shared/backups).
  activate "$target"
  restart_app
  healthy || fail "A versão $(basename "$target") não respondeu."
  log "Pronto: $(basename "$target") activa"
}

cmd_status() {
  echo "Activa:   $(basename "$(readlink -f "$CURRENT" 2>/dev/null || echo '(nenhuma)')")"
  echo "Versões:"; ls -1 "$RELEASES" 2>/dev/null | sed 's/^/  /'
  echo "Cópias:";  ls -1t "$SHARED/backups" 2>/dev/null | head -3 | sed 's/^/  /'
  pm2 describe "$APP_NAME" 2>/dev/null | grep -E 'status|uptime|restarts' | head -3 || true
  curl -fsS -o /dev/null -w "API: %{http_code}\n" "http://127.0.0.1:$PORT/api/settings" || echo "API: sem resposta"
}

case "${1:-}" in
  deploy) cmd_deploy "${2:?pasta da versão}" ;;
  rollback) cmd_rollback ;;
  status) cmd_status ;;
  *) fail "Uso: deploy-remote.sh deploy <pasta> | rollback | status" ;;
esac
