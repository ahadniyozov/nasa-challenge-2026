#!/bin/sh
# Deploy or update the game with one command (run on the server, from anywhere in the repo):
#
#   ./deploy/deploy.sh mission.example.com   first time: saves the domain to deploy/.env, builds, starts
#   ./deploy/deploy.sh                        update: git pull, rebuild, restart (domain from deploy/.env)
#
# Local test without a certificate:  ./deploy/deploy.sh :80   → http://localhost
set -eu

cd "$(dirname "$0")"

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker with the compose plugin is required: curl -fsSL https://get.docker.com | sh" >&2
  exit 1
fi

if [ $# -ge 1 ]; then
  printf 'DOMAIN=%s\n' "$1" > .env
  echo "Saved DOMAIN=$1 to deploy/.env"
fi
if [ ! -f .env ]; then
  echo "Usage: ./deploy/deploy.sh mission.example.com   (no deploy/.env yet)" >&2
  exit 1
fi
DOMAIN=$(sed -n 's/^DOMAIN=//p' .env | tail -n 1)
if [ -z "$DOMAIN" ]; then
  echo "deploy/.env has no DOMAIN=... line" >&2
  exit 1
fi

# latest code (skipped with a warning if this is not a clean git checkout)
if git -C .. rev-parse --git-dir >/dev/null 2>&1; then
  git -C .. pull --ff-only || echo "WARNING: git pull failed - deploying the code that is here now" >&2
fi

case "$DOMAIN" in
  :*|localhost|127.*) ;;
  *)
    ip=$(getent hosts "$DOMAIN" 2>/dev/null | awk '{print $1; exit}' || true)
    if [ -z "$ip" ]; then
      echo "WARNING: $DOMAIN does not resolve yet. Add a DNS A record pointing to this server," >&2
      echo "         otherwise Caddy cannot get an HTTPS certificate." >&2
    else
      echo "$DOMAIN → $ip (must be this server's public IP)"
    fi
    ;;
esac

docker compose up -d --build
docker image prune -f >/dev/null # drop old build layers

# wait until the game answers
insecure="" # localhost uses Caddy's own certificate, which curl does not trust
case "$DOMAIN" in
  :*) url="http://localhost" ;;
  localhost) url="https://localhost"; insecure="-k" ;;
  *) url="https://$DOMAIN" ;;
esac
printf 'Waiting for %s ' "$url"
i=0
while [ $i -lt 30 ]; do
  # shellcheck disable=SC2086 # $insecure is empty or one flag
  if curl -fsS -o /dev/null --max-time 5 $insecure "$url" 2>/dev/null; then
    echo "OK"
    echo "The game is live: $url"
    exit 0
  fi
  printf '.'
  i=$((i + 1))
  sleep 3
done
echo
echo "No answer from $url after 90 s. Logs: cd deploy && docker compose logs --tail=50 web" >&2
exit 1
