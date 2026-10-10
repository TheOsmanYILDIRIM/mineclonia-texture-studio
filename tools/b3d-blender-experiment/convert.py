"""Run inside Blender: B3D import add-on -> GLB, with independent per-model reports."""
import bpy, sys, os, json, pathlib, traceback, struct
from collections import Counter

args=sys.argv[sys.argv.index("--")+1:]
root=pathlib.Path(args[0]); output=pathlib.Path(args[1]); report=pathlib.Path(args[2])
sys.path.insert(0,"/tmp")
import io_scene_b3d
io_scene_b3d.register()
results=[]
for source in sorted(root.rglob("*.b3d")):
    rel=source.relative_to(root)
    dest=output/rel.with_suffix(".glb")
    dest.parent.mkdir(parents=True,exist_ok=True)
    entry={"source":str(rel),"ok":False}
    try:
        io_scene_b3d.import_b3d.imported_armature_objects.clear()
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)
        for block in list(bpy.data.meshes):
            if block.users == 0: bpy.data.meshes.remove(block)
        for block in list(bpy.data.armatures):
            if block.users == 0: bpy.data.armatures.remove(block)
        result=bpy.ops.import_scene.b3d(filepath=str(source),constrain_size=0.0,use_image_search=False)
        meshes=[o for o in bpy.data.objects if o.type=="MESH"]
        arms=[o for o in bpy.data.objects if o.type=="ARMATURE"]
        entry.update(import_result=list(result),import_meshes=len(meshes),import_armatures=len(arms),
                     imported_actions=len(bpy.data.actions),
                     import_vertices=sum(len(o.data.vertices) for o in meshes))
        if not meshes or not any(len(o.data.polygons)>0 for o in meshes):
            raise RuntimeError("Importer produced no triangle mesh")
        bpy.ops.export_scene.gltf(filepath=str(dest),export_format="GLB",export_animations=True,export_skins=True,export_texcoords=True)
        raw=dest.read_bytes()
        if len(raw)<20 or raw[:4]!=b"glTF" or struct.unpack_from("<I",raw,8)[0]!=len(raw):
            raise RuntimeError("Invalid GLB header/length")
        size,typ=struct.unpack_from("<I4s",raw,12)
        if typ!=b"JSON": raise RuntimeError("Missing GLB JSON")
        doc=json.loads(raw[20:20+size])
        entry.update(ok=bool(doc.get("meshes")),meshes=len(doc.get("meshes",[])),
                     skins=len(doc.get("skins",[])),animations=len(doc.get("animations",[])),
                     animation_channels=sum(len(a.get("channels",[])) for a in doc.get("animations",[])))
        if not entry["ok"]: raise RuntimeError("GLB contains no meshes")
    except Exception as exc:
        entry["error"]=str(exc)
        if dest.exists(): dest.unlink()
        print("FAILED",rel,exc,flush=True)
    results.append(entry)
report.parent.mkdir(parents=True,exist_ok=True)
report.write_text(json.dumps(results,indent=2))
print("SUMMARY",json.dumps({"total":len(results),"converted":sum(x["ok"] for x in results),
    "skin_models":sum(x.get("skins",0)>0 for x in results),
    "animated_models":sum(x.get("animations",0)>0 for x in results)}),flush=True)
if not results or sum(x["ok"] for x in results) < len(results): sys.exit(2)
