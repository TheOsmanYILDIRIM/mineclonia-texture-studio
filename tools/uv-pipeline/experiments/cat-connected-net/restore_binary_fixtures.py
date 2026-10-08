#!/usr/bin/env python3
"""Restore only verified original PNG/B3D research fixtures from the chat closeout ZIP.

Usage:
    python restore_binary_fixtures.py /path/to/MTS_ConnectedNet_UV_Closeout_2026-10-08.zip

The archive's entry paths and SHA-256 hashes are checked against FILE_MANIFEST.json
before ANY file is written. Existing matching files are left untouched; a
mismatched existing file fails closed. This script never commits or deploys.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile


def restore(archive: Path, root: Path) -> dict[str, int]:
    manifest = json.loads((root / "FILE_MANIFEST.json").read_text(encoding="utf-8"))
    binary = {name: meta for name, meta in manifest.items()
              if name.endswith((".png", ".b3d"))}
    staged: list[tuple[Path, bytes]] = []
    present = 0

    with ZipFile(archive) as z:
        if z.testzip() is not None:
            raise ValueError("ZIP CRC integrity check failed")
        for name, meta in binary.items():
            rel = Path(name)
            if rel.is_absolute() or ".." in rel.parts:
                raise ValueError(f"Unsafe archive entry path: {name}")
            data = z.read(name)
            sha = hashlib.sha256(data).hexdigest()
            if len(data) != meta["size_bytes"] or sha != meta["sha256"]:
                raise ValueError(f"Fixture checksum mismatch: {name}")
            destination = root / rel
            if destination.exists():
                current = destination.read_bytes()
                if current != data:
                    raise FileExistsError(f"Existing fixture differs: {destination}")
                present += 1
            else:
                staged.append((destination, data))

    for destination, data in staged:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
    return {"verified_binary_files": len(binary), "already_present": present,
            "restored": len(staged)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help="Original 25-file chat ZIP")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent)
    args = parser.parse_args()
    print(json.dumps(restore(args.archive, args.root), indent=2))
