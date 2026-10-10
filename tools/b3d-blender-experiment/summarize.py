"""Emit bounded, non-sensitive conversion diagnostics without exposing raw Blender logs."""
import json, sys, re
from collections import Counter
from pathlib import Path

path=Path(sys.argv[1])
exit_code=int(sys.argv[2])
try:
    data=json.loads(path.read_text())
    if not isinstance(data,list): raise ValueError("report is not a list")
except (OSError,ValueError,TypeError):
    data=[]
def clean_error(item):
    message=str(item.get("error") or item.get("export_error") or "")
    if not message: return "unknown"
    # Never expose untrusted paths, exception messages or raw stack traces.
    patterns=("fcurve","attribute","typeerror","keyerror","indexerror","runtimeerror","valueerror","export","import")
    return next((p for p in patterns if p in message.lower()),"other")
failed=[x for x in data if isinstance(x,dict) and not x.get("ok")]
targets={}
for name in ("creeper","enderman","horse"):
    matches=[x for x in data if isinstance(x,dict) and name in str(x.get("source","")).lower()]
    targets[name]={"count":len(matches),"converted":sum(bool(x.get("ok")) for x in matches),
                   "meshes":sum(int(x.get("meshes",0)) for x in matches),
                   "skins":sum(int(x.get("skins",0)) for x in matches),
                   "animations":sum(int(x.get("animations",0)) for x in matches)}
def safe_signature(item):
    msg=str(item.get("error") or item.get("export_error") or "")
    # Only expose known Blender API identifiers from AttributeError, never arbitrary text.
    match=re.search(r"has no attribute ['\\\"]([A-Za-z_][A-Za-z_0-9]{0,63})['\\\"]",msg)
    return match.group(1) if match else "unspecified"
signatures=Counter(safe_signature(x) for x in failed)

def safe_object_type(item):
    message=str(item.get("error") or item.get("export_error") or "")
    match=re.search(r"['\"]([A-Za-z_][A-Za-z_0-9]{0,63})['\"] object has no attribute ['\"]([A-Za-z_][A-Za-z_0-9]{0,63})['\"]",message)
    return match.group(1) if match else "unspecified"
object_types=Counter(safe_object_type(x) for x in failed)
print(json.dumps({"api_attribute_signatures":dict(signatures),"api_object_types":dict(object_types),"schema":3,"exit_code":exit_code,"report_present":path.exists(),
 "total":len(data),"converted":sum(bool(x.get("ok")) for x in data if isinstance(x,dict)),
 "failed":len(failed),"error_categories":dict(Counter(clean_error(x) for x in failed)),
 "models_with_skins":sum(int(x.get("skins",0))>0 for x in data if isinstance(x,dict)),
 "models_with_animations":sum(int(x.get("animations",0))>0 for x in data if isinstance(x,dict)),
 "targets":targets},sort_keys=True))
