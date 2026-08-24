#!/usr/bin/env bash
# One-time, reversible Nginx host tuning required by D99.

set -euo pipefail

nginx_config=${NGINX_CONFIG:-/etc/nginx/nginx.conf}
required_connections=8192
permanent_backup="${nginx_config}.pre-astera-d99"
rollback=$(mktemp -p /tmp astera-nginx.XXXXXX)
trap 'sudo -n rm -f "$rollback" "$rollback.rendered"' EXIT

matches=$(sudo -n awk '/^[[:space:]]*worker_connections[[:space:]]+[0-9]+;/ { count += 1 } END { print count + 0 }' "$nginx_config")
[[ "$matches" == 1 ]] || {
  echo "Refusing to edit $nginx_config: expected one worker_connections directive, found $matches."
  exit 1
}

current=$(sudo -n awk '/^[[:space:]]*worker_connections[[:space:]]+[0-9]+;/ {
  value=$2; sub(/;/, "", value); print value; exit
}' "$nginx_config")
[[ "$current" =~ ^[0-9]+$ ]] || { echo 'Could not read worker_connections.'; exit 1; }
if (( current >= required_connections )); then
  echo "nginx worker_connections is already $current; no change needed."
  exit 0
fi

sudo -n cp -a "$nginx_config" "$rollback"
if ! sudo -n test -e "$permanent_backup"; then
  sudo -n cp -a "$nginx_config" "$permanent_backup"
fi

sudo -n awk -v wanted="$required_connections" '
  /^[[:space:]]*worker_connections[[:space:]]+[0-9]+;/ {
    indent=$0; sub(/[^[:space:]].*$/, "", indent)
    print indent "worker_connections " wanted ";"
    next
  }
  { print }
' "$nginx_config" >"$rollback.rendered"
sudo -n install -o root -g root -m 0644 "$rollback.rendered" "$nginx_config"

if ! sudo -n nginx -t; then
  echo 'nginx validation failed; restoring the exact pre-run file.' >&2
  sudo -n cp -a "$rollback" "$nginx_config"
  sudo -n nginx -t
  exit 1
fi

sudo -n systemctl reload nginx
active=$(sudo -n nginx -T 2>&1 | awk '/^[[:space:]]*worker_connections[[:space:]]+[0-9]+;/ {
  value=$2; sub(/;/, "", value); print value; exit
}')
[[ "$active" == "$required_connections" ]] || {
  echo "nginx reloaded but active worker_connections is $active, not $required_connections." >&2
  exit 1
}

echo "nginx worker_connections: $current -> $active"
echo "one-time rollback copy: $permanent_backup"
