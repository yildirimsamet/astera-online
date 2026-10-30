#!/usr/bin/env bash
# The maintenance flag nginx answers the API with (scaling plan F0.9).
#
#   deploy/maintenance.sh on <reopening instant>   e.g. on 2026-11-02T01:15:00Z
#   deploy/maintenance.sh off
#   deploy/maintenance.sh status
#
# While the flag exists every /api door answers 503 with this JSON and the client
# shows the maintenance screen, counting down to the reopening. Planning the window
# (the 24-hour notice, refused hostile arrivals) is `pnpm maintenance schedule`, a
# separate step; raise the flag only inside a planned window.
set -euo pipefail

DIR="${ASTERA_MAINTENANCE_DIR:-/var/www/astera-maintenance}"
SUDO="${ASTERA_SUDO-sudo}"
FLAG="$DIR/maintenance.json"

case "${1:-}" in
  on)
    [ -n "${2:-}" ] || { echo "usage: $0 on <reopening instant>" >&2; exit 2; }
    ends="$(date -u -d "$2" +%Y-%m-%dT%H:%M:%S.000Z)" || { echo "cannot read the reopening: $2" >&2; exit 2; }
    $SUDO mkdir -p "$DIR"
    # Written beside the flag and moved over it, so nginx never serves half a file.
    printf '{"error":"MAINTENANCE","message":"Astera is under maintenance","params":{"endsAt":"%s"}}' "$ends" \
      | $SUDO tee "$FLAG.tmp" >/dev/null
    $SUDO chmod 0644 "$FLAG.tmp"
    $SUDO mv "$FLAG.tmp" "$FLAG"
    echo "maintenance on until $ends"
    ;;
  off)
    $SUDO rm -f "$FLAG"
    echo "maintenance off"
    ;;
  status)
    if [ -f "$FLAG" ]; then
      echo "maintenance on until $(sed -E 's/.*"endsAt":"([^"]+)".*/\1/' "$FLAG")"
    else
      echo "maintenance off"
    fi
    ;;
  *)
    echo "usage: $0 on <reopening instant> | off | status" >&2
    exit 2
    ;;
esac
