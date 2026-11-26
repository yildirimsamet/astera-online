#!/usr/bin/env python3
"""Check the live app update the way a phone downloads it, after every publish.

    python3 deploy/verify-ota.py [ORIGIN]     ORIGIN defaults to https://asteraonline.space

The phone checks every file it downloads against the hash in the manifest and refuses
the whole release when one differs. On 2026-11-26 Cloudflare Web Analytics appended its
beacon to the release's index.html, but only for a client that sends no Accept header,
as the updater does; curl sends `Accept: */*` and saw the file intact. So this asks
like the phone: no Accept, gzip accepted, the updater's User-Agent. Proxies rewrite
HTML, so every HTML file the manifest names is downloaded and hashed.

It also fails when the web and the app update name different releases: a web publish
without its OTA leaves app players on older code than the browser (2026-11-26).
Exit 0 when both hold, 1 otherwise. Standard library only: the VPS has no Node.
"""
import gzip
import hashlib
import http.client
import json
import sys
import urllib.parse

USER_AGENT = 'CapacitorUpdater/verify (space.asteraonline.app) android/verify'


def get(url: str) -> bytes:
    parts = urllib.parse.urlsplit(url)
    connection_type = http.client.HTTPSConnection if parts.scheme == 'https' else http.client.HTTPConnection
    connection = connection_type(parts.netloc, timeout=30)
    try:
        # No Accept header, like OkHttp. Passing Accept-Encoding stops http.client adding its own.
        connection.request('GET', parts.path + (f'?{parts.query}' if parts.query else ''),
                           headers={'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip'})
        response = connection.getresponse()
        body = response.read()
        if response.status != 200:
            raise RuntimeError(f'{url}: HTTP {response.status}')
        if (response.getheader('Content-Encoding') or '').lower() == 'gzip':
            body = gzip.decompress(body)
        return body
    finally:
        connection.close()


def main() -> int:
    origin = (sys.argv[1] if len(sys.argv) > 1 else 'https://asteraonline.space').rstrip('/')
    failures = []
    try:
        latest = json.loads(get(f'{origin}/ota/latest.json'))
        version = latest['version']
        manifest = json.loads(get(origin + latest['manifest']))
        if manifest.get('version') != version:
            failures.append(f'the manifest names {manifest.get("version")}, latest.json {version}')
        pages = [entry for entry in manifest['files'] if entry['file_name'].lower().endswith(('.html', '.htm'))]
        if not pages:
            failures.append('the manifest names no HTML file')
        for entry in pages:
            if not entry['download_url'].startswith(f'{origin}/ota/files/'):
                failures.append(f'{entry["file_name"]}: served from {entry["download_url"]}, outside {origin}/ota/files/')
                continue
            served = hashlib.sha256(get(entry['download_url'])).hexdigest()
            if served != entry['file_hash']:
                failures.append(f'{entry["file_name"]}: arrives as {served[:12]}…, the manifest says {entry["file_hash"][:12]}… '
                                '(a proxy rewrote it; every phone refuses this release)')
        web = get(f'{origin}/release.txt').decode().strip()
        if web != version:
            failures.append(f'web {web[:12]} and OTA {version[:12]} name different releases '
                            '(a web publish without its OTA, or the reverse)')
    except (OSError, RuntimeError, KeyError, ValueError) as error:
        failures.append(f'could not read the live update: {error}')
        version = '?'
    if failures:
        for failure in failures:
            print(f'  ✗ {failure}', file=sys.stderr)
        return 1
    print(f'  OTA {version}: {len(pages)} HTML file(s) arrive byte-exact; the web serves the same release')
    return 0


if __name__ == '__main__':
    sys.exit(main())
