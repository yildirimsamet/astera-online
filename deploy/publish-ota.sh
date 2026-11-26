#!/usr/bin/env bash
# Publish a packed OTA release (apps/web/otaPack.ts) for the app's live update.
#
#   publish-ota.sh STAGE OTA_ROOT              files, then the manifest, then latest.json
#   publish-ota.sh --restore-previous OTA_ROOT the release before the last publish (EN-07)
#
# A phone reads latest.json first and then downloads what its manifest names, so
# latest.json changes last, atomically, and only once every file it leads to is in
# place. Afterwards only old releases go (OTA F4): the last KEEP publishes, the live
# release and the one a rollback puts back stay whole, with every file they name.
set -euo pipefail

KEEP=5

release_of() {  # LATEST_JSON → the 40-hex release it names, on a line of its own
  # otaPack writes no final newline, and sed then prints none: two names would run together.
  printf '%s\n' "$(sed -n 's/.*"version":"\([a-f0-9]\{40\}\)".*/\1/p' "$1")"
}

prune() {  # ROOT
  local root=$1 keep name
  keep=$(mktemp)
  tail -n "$KEEP" "$root/releases" > "$keep"
  for pointer in latest.json latest.previous.json; do
    if [[ -f "$root/$pointer" ]]; then release_of "$root/$pointer" >> "$keep"; fi
  done
  for dir in "$root"/*/; do
    name=$(basename "$dir")
    if [[ "$name" =~ ^[a-f0-9]{40}$ ]] && ! grep -qx "$name" "$keep"; then rm -rf "$dir"; fi
  done
  # Files the kept manifests name, by content hash; anything else, and its .gz, goes.
  local named
  named=$(mktemp)
  while read -r release; do
    if [[ -f "$root/$release/manifest.json" ]]; then
      grep -o '/ota/files/[^"]*' "$root/$release/manifest.json" | sed 's|^/ota/files/||'
    fi
  done < <(sort -u "$keep") | sort -u > "$named"
  for file in "$root"/files/*; do
    [[ -e "$file" ]] || continue
    name=$(basename "$file")
    if ! grep -qx "${name%.gz}" "$named"; then rm -f "$file"; fi
  done
  rm -f "$keep" "$named"
}

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
version=$(release_of "$stage/latest.json")
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
# The publish order, newest last; a release published again moves to the end.
{ grep -vx "$version" "$root/releases" 2>/dev/null || true; echo "$version"; } > "$root/releases.next"
mv -f "$root/releases.next" "$root/releases"
prune "$root"
echo "OTA latest -> $version"
