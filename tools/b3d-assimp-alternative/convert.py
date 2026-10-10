#!/usr/bin/env python3
"""Independent Assimp B3D import experiment; never substitutes fake geometry."""
import json
import pathlib
import subprocess
import sys

root, output, report = map(pathlib.Path, sys.argv[1:4])
results = []
for source in sorted(root.rglob("*.b3d")):
    relative = source.relative_to(root)
    target = output / relative.with_suffix(".gltf")
    target.parent.mkdir(parents=True, exist_ok=True)
    command = ["assimp", "export", str(source), str(target), "-fgltf2"]
    try:
        proc = subprocess.run(command, capture_output=True, text=True, timeout=90)
        error = (proc.stdout + "\n" + proc.stderr)[-2500:]
        ok = proc.returncode == 0 and target.is_file() and target.stat().st_size > 0
        meshes = skins = animations = 0
        if ok:
            try:
                data = json.loads(target.read_text())
                meshes = len(data.get("meshes", []))
                skins = len(data.get("skins", []))
                animations = len(data.get("animations", []))
                ok = data.get("asset", {}).get("version", "").startswith("2") and meshes > 0
                if not ok:
                    error = "No valid glTF 2 mesh produced"
            except Exception as exc:
                ok = False
                error = f"glTF JSON validation failed: {exc}"
        if not ok:
            for item in target.parent.glob(target.stem + ".*"):
                if item.is_file():
                    item.unlink()
        results.append({"source": str(relative), "ok": ok, "meshes": meshes,
                        "skins": skins, "animations": animations, "detail": error if not ok else ""})
    except Exception as exc:
        results.append({"source": str(relative), "ok": False, "detail": str(exc)})
report.parent.mkdir(parents=True, exist_ok=True)
report.write_text(json.dumps(results, indent=2))
print(f"Total {len(results)}; mesh conversions {sum(x['ok'] for x in results)}; "
      f"failures {sum(not x['ok'] for x in results)}")
if not results:
    sys.exit("No B3D sources found")
