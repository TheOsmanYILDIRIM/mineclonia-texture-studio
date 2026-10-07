#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(".")
FAMILIES=("blocks","mobs","armor","items")

def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))

def canonicalize(family, entry, batch_rows):
    src=ROOT/entry["file"]
    row=None
    if src.suffix.lower()==".txt":
        text=src.read_text(encoding="utf-8").strip()
        stages={"reference":text}
    else:
        if src.name.startswith("batch_"):
            row=batch_rows.get(entry["id"])
            if row is None:
                raise RuntimeError(f"{family}: missing batch row {entry['id']}")
        else:
            row=read_json(src)
        if row.get("schema_version")==2 and isinstance(row.get("stages"),dict):
            stages=row["stages"]
        elif family=="items":
            stages={
                "creative":row.get("creative_prompt","").strip(),
                "correction":row.get("correction_prompt","").strip(),
            }
        else:
            stages={"reference":row.get("reference_prompt","").strip()}
    if not all(isinstance(v,str) and v.strip() for v in stages.values()):
        raise RuntimeError(f"{family}: empty stage in {entry['id']}")
    return {
        "schema_version":2,
        "family":family,
        "id":entry["id"],
        "path":entry.get("texture_path") or (row or {}).get("path") or (row or {}).get("texture_path"),
        "name":entry.get("name") or (row or {}).get("name"),
        "stages":stages,
    }

for family in FAMILIES:
    base=ROOT/"prompts"/family
    manifest_path=base/"manifest.json"
    manifest=read_json(manifest_path)
    entries=[e for e in manifest.get("entries",[]) if e.get("status")=="done" and e.get("file")]

    batch_paths=set()
    for b in manifest.get("batches",[]) or []:
        if b.get("file"): batch_paths.add(b["file"])
    for e in entries:
        if Path(e["file"]).name.startswith("batch_"): batch_paths.add(e["file"])

    batch_rows={}
    for p in sorted(batch_paths):
        bp=ROOT/p
        if not bp.exists(): continue
        data=read_json(bp)
        for rid,row in (data.get("prompts") or {}).items():
            batch_rows[rid]=row

    canonical=[]
    for entry in entries:
        obj=canonicalize(family,entry,batch_rows)
        if not obj["path"] or not obj["name"]:
            raise RuntimeError(f"{family}: missing path/name for {obj['id']}")
        out=base/f"{obj['id']}.json"
        out.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        canonical.append((entry,obj,out))

    # Remove legacy prompt payloads after canonical files are safely written.
    keep={str((base/"manifest.json").as_posix())}
    keep.update(str(out.as_posix()) for _,_,out in canonical)
    for p in list(base.iterdir()):
        rel=p.as_posix()
        if p.is_file() and rel not in keep and (p.suffix.lower()==".txt" or p.name.startswith("batch_")):
            p.unlink()

    new_entries=[]
    for order,(entry,obj,out) in enumerate(canonical,1):
        e=dict(entry)
        e["order"]=order
        e["id"]=obj["id"]
        e["name"]=obj["name"]
        e["texture_path"]=obj["path"]
        e["status"]="done"
        e["file"]=out.as_posix()
        new_entries.append(e)

    manifest["schema_version"]=2
    manifest["kind"]="canonical_prompt_manifest"
    manifest["family"]=family
    manifest["total"]=len(new_entries)
    manifest["done"]=len(new_entries)
    manifest["pending"]=0
    manifest["entries"]=new_entries
    manifest["batches"]=[]
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

print("normalized", {f: len(read_json(ROOT/"prompts"/f/"manifest.json")["entries"]) for f in FAMILIES})
