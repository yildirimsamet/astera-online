#!/usr/bin/env python3
"""Astera-only backup retention. Dry-run by default; run hourly with --apply.

The snapshot's encoded UTC time is authoritative: copying/touching a private
dump must not restart its retention. Thirty days less one hourly scheduling
interval leaves room for the next sweep. No links are followed. Release folders
are immutable; never put a new snapshot into an old release folder.
"""
import argparse
from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import re
import stat
import sys

DAILY = re.compile(r"astera-(\d{8}-\d{6})\.sql\.gz$")
ARCHIVE = re.compile(r"astera-(?:pve-[a-f0-9]+-)?(\d{8}-\d{6})\.(?:sql\.gz|media\.tar\.gz)(?:\.(?:partial|sha256))?$")
RELEASE = re.compile(r"astera-[a-z0-9-]+-(\d{8}T\d{6}Z)$")
ENV_COPY = re.compile(r"astera-mail-env-(\d{8}T\d{6}Z)-[a-f0-9]+\.env$")


def snapshot_time(value):
    return datetime.strptime(value, "%Y%m%dT%H%M%SZ" if "T" in value else "%Y%m%d-%H%M%S").replace(tzinfo=timezone.utc)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", required=True, type=Path)
    parser.add_argument("--keep", default=14, type=int, choices=range(1, 15), metavar="1..14")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    root = args.directory.absolute()
    if root != root.resolve() or root in (Path("/"), Path("/tmp"), Path("/home"), Path.home()) or not root.is_dir():
        parser.error("Use an existing dedicated backup directory without symlink components")
    cutoff = datetime.now(timezone.utc) - timedelta(days=30) + timedelta(hours=1)
    entries = sorted(root.iterdir())
    candidates = set()
    daily = sorted((p for p in entries if p.is_file() and not p.is_symlink() and DAILY.fullmatch(p.name)), reverse=True)
    for old in daily[args.keep:]:
        prefix = old.name.removesuffix(".sql.gz")
        candidates.update(p for p in entries if p.name in {prefix + suffix for suffix in (".sql.gz", ".sql.gz.sha256", ".media.tar.gz", ".media.tar.gz.sha256")})
    for entry in entries:
        if entry.is_symlink():
            continue
        match = RELEASE.fullmatch(entry.name) if entry.is_dir() else ARCHIVE.fullmatch(entry.name) or ENV_COPY.fullmatch(entry.name)
        if not match:
            continue
        try:
            expired = snapshot_time(match[1]) <= cutoff
        except ValueError:
            continue
        if not expired:
            continue
        if entry.is_dir():
            for current, directories, files in os.walk(entry, followlinks=False):
                directories[:] = [name for name in directories if not (Path(current) / name).is_symlink()]
                for name in files:
                    path = Path(current) / name
                    # Existing Compose invocations reference this nonpersonal image pin.
                    if path != entry / "pinned-compose.yml":
                        candidates.add(path)
        else:
            candidates.add(entry)
    removed = 0
    for path in sorted(candidates):
        try:
            before = path.lstat()
            if not stat.S_ISREG(before.st_mode) or path.resolve() != path:
                continue
            print(("pruned " if args.apply else "would prune ") + str(path.relative_to(root)))
            if args.apply:
                # Do not act on a replaced path from the inventory.
                current = path.lstat()
                if (before.st_dev, before.st_ino) != (current.st_dev, current.st_ino):
                    raise RuntimeError("Backup changed during retention; retry")
                path.unlink()
            removed += 1
        except FileNotFoundError:
            pass  # Another retention run already removed it.
    print(f"{'Applied' if args.apply else 'Dry run'}: {removed} files; daily keep={args.keep}; maximum=30 days (hourly safety margin=1h)")


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError) as error:
        print(f"Retention failed: {error}", file=sys.stderr)
        sys.exit(1)
