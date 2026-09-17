#!/usr/bin/env bash
# Publish a Vite build without invalidating lazy imports in already-open tabs.
# Run as the user that owns the webroot (or through sudo on production).
set -euo pipefail

stage=${1:?Usage: publish-web.sh STAGE WEBROOT}
webroot=${2:?Usage: publish-web.sh STAGE WEBROOT}
[[ -f "$stage/index.html" ]] || { echo "Missing staged index.html" >&2; exit 1; }
[[ -d "$stage/assets" ]] || { echo "Missing staged assets directory" >&2; exit 1; }
mkdir -p "$webroot"

# Immutable Vite filenames can still be requested by an open tab whose main
# bundle predates this deploy. Preserve only old /assets/ files; removed public
# pages must disappear. New assets must land before the new HTML does.
rsync -a --delete --chmod=D755,F644 --filter='P /assets/***' \
  --exclude=/index.html --exclude=/index.html.gz \
  "$stage"/ "$webroot"/

next_index=$(mktemp -p "$webroot" .index.html.XXXXXX)
trap 'rm -f "$next_index"' EXIT
rsync -a --chmod=F644 "$stage/index.html" "$next_index"

# A previous precompressed index would otherwise override the new plain HTML
# for clients sending Accept-Encoding: gzip. Nginx compresses this small file.
rm -f "$webroot/index.html.gz"
mv -f "$next_index" "$webroot/index.html"
