"""Build the publishable copy of the Gözlemevi spec for the claude.ai artifact.

The repo copy (`gozlemevi.html`) points its images at the game's own assets so it
renders when opened from the repo. An artifact cannot reach outside its own files,
so this writes a copy whose images live under `a/` and copies those images beside it.

    python3 docs/ui-v2/publish.py <out-dir>

Then publish `<out-dir>/index.html` with root `<out-dir>` and the `a/*` files, to the
same artifact URL (https://claude.ai/artifact/E3me7XbaVBVuf98Bxfg8pU).
"""
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PREFIX = '../../apps/web/public/assets/images/'


def main() -> None:
    out = sys.argv[1]
    os.makedirs(os.path.join(out, 'a'), exist_ok=True)
    html = open(os.path.join(HERE, 'gozlemevi.html'), encoding='utf-8').read()
    seen: dict[str, str] = {}

    def rewrite(match: re.Match[str]) -> str:
        rel = match.group(1)
        name = rel.replace('/', '_')
        seen[name] = rel
        return f'"a/{name}"'

    html = re.sub(r'"' + re.escape(PREFIX) + r'([a-z0-9_/]+\.(?:png|webp))"', rewrite, html)
    for name, rel in seen.items():
        shutil.copyfile(os.path.join(HERE, PREFIX, rel), os.path.join(out, 'a', name))
    open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(html)
    print(f'{len(seen)} images, {len(html.encode())} bytes -> {out}')


if __name__ == '__main__':
    main()
