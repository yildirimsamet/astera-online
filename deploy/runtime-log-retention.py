#!/usr/bin/env python3
"""Expire Astera daily runtime files, with a one-hour scheduling safety margin.

The receiver's UTC date in the filename is authoritative, not a copied file's
mtime. A file starts at midnight; remove it before its oldest event is 30 days
old. Run hourly. Preview is the default; never follow links or recurse.
"""
import argparse
from datetime import datetime, timedelta, timezone
from pathlib import Path
import re
import stat
import sys

NAME = re.compile(r"runtime-(\d{4}-\d{2}-\d{2})\.log$")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", required=True, type=Path)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    root = args.directory.absolute()
    broad = {Path("/"), Path("/tmp"), Path("/home"), Path("/var"), Path("/var/log"), Path("/etc"), Path("/run"), Path.home()}
    if root != root.resolve() or root in broad or not root.is_dir():
        parser.error("Use a dedicated existing directory without symlink components")
    cutoff = datetime.now(timezone.utc) - timedelta(days=30) + timedelta(hours=1)
    removed = 0
    for path in sorted(root.iterdir()):
        match = NAME.fullmatch(path.name)
        if not match:
            continue
        try:
            day = datetime.strptime(match[1], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        if day > cutoff:
            continue
        try:
            before = path.lstat()
            if not stat.S_ISREG(before.st_mode) or path.resolve() != path:
                continue
            print(("pruned " if args.apply else "would prune ") + path.name)
            if args.apply:
                current = path.lstat()
                if (before.st_dev, before.st_ino) != (current.st_dev, current.st_ino):
                    raise RuntimeError("Runtime log changed during retention; retry")
                path.unlink()
            removed += 1
        except FileNotFoundError:
            pass
    print(f"{'Applied' if args.apply else 'Dry run'}: {removed} files; maximum=30 days (hourly safety margin=1h)")


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError) as error:
        print(f"Retention failed: {error}", file=sys.stderr)
        sys.exit(1)
