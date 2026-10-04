#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

usage() {
    cat <<'EOF'
Usage: ./deploy/manage.sh COMMAND

  start     Build and start the service.
  stop      Stop the service. Keep certificate storage.
  restart   Build and replace the containers. Keep certificate storage.
  status    Show container status.
  logs      Show the last 200 log lines and wait for new lines.
  cert      Export the public certificate to deploy/vmodel-local-ca.crt.
  help      Show these instructions.
EOF
}

if [[ $# -ne 1 ]]; then
    usage >&2
    exit 2
fi
case "$1" in
    help|-h|--help) usage; exit 0 ;;
    start|stop|restart|status|logs|cert) ;;
    *) usage >&2; exit 2 ;;
esac

cd -- "$DEPLOY_DIR"
command -v docker >/dev/null 2>&1 || { echo 'Install Docker and Docker Compose v2.' >&2; exit 1; }
DOCKER=(docker)
if ! docker info >/dev/null 2>&1; then
    command -v sudo >/dev/null 2>&1 || { echo 'Docker access failed. Check Docker and your permissions.' >&2; exit 1; }
    DOCKER=(sudo '--preserve-env=VMODEL_DOMAIN,VMODEL_HTTPS_PORT,COMPOSE_PROJECT_NAME' docker)
fi
"${DOCKER[@]}" compose version >/dev/null

compose() {
    "${DOCKER[@]}" compose --project-directory "$DEPLOY_DIR" -f "$DEPLOY_DIR/compose.yaml" "$@"
}

export_certificate() {
    local attempt certificate
    for ((attempt=1; attempt<=30; attempt++)); do
        if certificate="$(compose exec -T https cat /data/caddy/pki/authorities/local/root.crt 2>/dev/null)"; then
            printf '%s\n' "$certificate" > "$DEPLOY_DIR/vmodel-local-ca.crt"
            printf 'Public certificate: %s/vmodel-local-ca.crt\n' "$DEPLOY_DIR"
            echo 'Install this certificate as a trusted root certificate on each client.'
            return 0
        fi
        sleep 1
    done
    echo 'Certificate export failed. Check ./deploy/manage.sh logs.' >&2
    return 1
}

case "$1" in
    start|restart)
        options=(up -d --build --wait --wait-timeout 120)
        if [[ "$1" == restart ]]; then options+=(--force-recreate); fi
        compose "${options[@]}"
        export_certificate
        origin="$(compose exec -T vmodel printenv VMODEL_ORIGIN)"
        printf 'Open %s after the client trusts the certificate.\n' "$origin"
        ;;
    stop) compose down ;;
    status) compose ps ;;
    logs) compose logs --follow --tail 200 ;;
    cert) export_certificate ;;
esac
