#!/usr/bin/env bash
# Publish a packed OTA release (apps/web/otaPack.ts) for the app's live update.
#
#   publish-ota.sh STAGE OTA_ROOT              files, then the manifest, then latest.json
#   publish-ota.sh --restore-previous OTA_ROOT the release before the last publish (EN-07)
#
# A phone reads latest.json first and then downloads what its manifest names, so
# latest.json changes last, atomically, and only once every file it leads to is in
# place. Nothing is ever deleted: a phone midway through an older release still
# finds its files, and the previous release stays one step away.
set -euo pipefail

swap_latest() {  # SOURCE ROOT
  local next
  next=$(mktemp -p "$2" .latest.json.XXXXXX)
  cp "$1" "$next"
  chmod 644 "$next"
  mv -f "$next" "$2/latest.json"
}

if [[ "${1:-}" == "--restore-previous" ]]; then
  root=${2:?Usage: publish-ota.sh --restore-previous OTA_ROOT}
  [[ -f "$root/latest.previous.json" ]] || { echo "No previous OTA release to restore" >&2; exit 1; }
  swap_latest "$root/latest.previous.json" "$root"
  echo "OTA latest restored to the previous release"
  exit 0
fi

stage=${1:?Usage: publish-ota.sh STAGE OTA_ROOT}
root=${2:?Usage: publish-ota.sh STAGE OTA_ROOT}
[[ -f "$stage/latest.json" ]] || { echo "Missing staged latest.json" >&2; exit 1; }
version=$(sed -n 's/.*"version":"\([a-f0-9]\{40\}\)".*/\1/p' "$stage/latest.json")
[[ -n "$version" ]] || { echo "Staged latest.json names no release" >&2; exit 1; }
manifest="$stage/$version/manifest.json"
[[ -f "$manifest" ]] || { echo "Missing staged manifest for $version" >&2; exit 1; }
# Every file the manifest names must be staged, or phones would download a hole.
while read -r name; do
  [[ -f "$stage/files/$name" ]] || { echo "Manifest names a missing file: $name" >&2; exit 1; }
done < <(grep -o '/ota/files/[^"]*' "$manifest" | sed 's|^/ota/files/||')

mkdir -p "$root/files" "$root/$version"
rsync -a --ignore-existing --chmod=D755,F644 "$stage/files"/ "$root/files"/
rsync -a --chmod=D755,F644 "$stage/$version"/ "$root/$version"/
# A re-run of the same deploy must not overwrite the real previous release with itself.
if [[ -f "$root/latest.json" ]] && ! cmp -s "$root/latest.json" "$stage/latest.json"; then
  cp -p "$root/latest.json" "$root/latest.previous.json"
fi
swap_latest "$stage/latest.json" "$root"
echo "OTA latest -> $version"
