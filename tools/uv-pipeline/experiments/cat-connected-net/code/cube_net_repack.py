#!/usr/bin/env python3
"""Exact reversible UV texel repack into a connected cube-net-inspired 2D arrangement.

Source of truth: 64x32 Mineclonia calico cat texture and B3D UV atlas.
This is a *temporary AI presentation layout*, not a replacement model UV map.

Pack:  python cube_net_repack.py pack --source cat_original.png --out cat_net.png --scale 24 --manifest mapping.json
Unpack: python cube_net_repack.py unpack --source cat_generated.png --original cat_original.png --out cat_restored.png --manifest mapping.json

Hard constraints: never warp or rotate individual source texels, preserve original alpha
and all target face texel addresses. Generated pixels can still misalign semantically;
validation reports this rather than claiming accuracy from a hard alpha mask.
"""
import argparse
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

# Original-native rectangle coordinates (left,top,right,bottom) and target
# offsets in a temporary 64x64 square. Regions are non-overlapping, reversible.
# Actual B3D mesh UV bounds: x=0..48, y=0..28. Detached bottom strip 26..35,
# y=29..32 is visible in the original PNG but is not sampled by the inspected
# static B3D UV triangles. It is preserved anyway.
GROUPS = [
    {"id":"head", "title":"Head cuboid net", "source":[0,0,20,10], "dest":[8,19]},
    {"id":"body", "title":"Torso cuboid net", "source":[20,0,40,22], "dest":[28,15]},
    {"id":"tail", "title":"Tail cuboid net", "source":[40,0,48,12], "dest":[48,20]},
    {"id":"legs", "title":"Legs and paws", "source":[0,10,20,28], "dest":[28,37]},
    {"id":"strip", "title":"Original detached lower strip", "source":[26,29,35,32], "dest":[32,55]},
]

def mask_from_image(rgba):
    rgba=np.asarray(rgba.convert('RGBA'),dtype=np.uint8)
    a=rgba[:,:,3]
    if int(np.count_nonzero(a < 240)) > a.size*0.005:
        return (a>8).astype(np.uint8)
    # Images generally returned with opaque black background. Do not treat
    # all dark foreground as outside when there is no clean bg distinction.
    border=np.concatenate((rgba[0,:,:3],rgba[-1,:,:3],rgba[:,0,:3],rgba[:,-1,:3]))
    near_black=(np.quantile(border,0.75,axis=0).max()<18)
    if near_black: return (rgba[:,:,:3].max(axis=2)>10).astype(np.uint8)
    # Find dominant corner pixel; use a modest RGB threshold. Not universal.
    bg=np.median(border.astype(np.float32),axis=0)
    deviation=np.max(np.abs(rgba[:,:,:3].astype(np.float32)-bg),axis=2)
    return (deviation>18).astype(np.uint8)


def require_native_original(original):
    if original.size!=(64,32):
        raise ValueError('This verified prototype is defined for 64x32 Mineclonia cat UV; supply unscaled original.')


def pack_native(orig):
    require_native_original(orig)
    src=np.asarray(orig.convert('RGBA'))
    out=np.zeros((64,64,4),dtype=np.uint8)
    original_coverage=np.zeros((32,64),dtype=np.uint8)
    destination_coverage=np.zeros((64,64),dtype=np.uint8)
    for item in GROUPS:
        x0,y0,x1,y1=item['source']; x,y=item['dest']
        w,h=x1-x0,y1-y0
        original_coverage[y0:y1,x0:x1]+=1
        destination_coverage[y:y+h,x:x+w]+=1
        out[y:y+h,x:x+w]=src[y0:y1,x0:x1]
    if (original_coverage>1).any() or (destination_coverage>1).any():
        raise AssertionError('region overlaps')
    if np.any(src[original_coverage==0,3]!=0):
        raise AssertionError('Unmapped nontransparent original pixels')
    return Image.fromarray(out,'RGBA')


def unpack_native(packed, original):
    require_native_original(original)
    src=np.asarray(packed.convert('RGBA'))
    if src.shape!=(64,64,4): raise ValueError('Packed original must be 64x64 native pixels')
    out=np.asarray(original.convert('RGBA')).copy()
    for item in GROUPS:
        x0,y0,x1,y1=item['source']; x,y=item['dest']
        w,h=x1-x0,y1-y0
        out[y0:y1,x0:x1] = src[y:y+h,x:x+w]
    return Image.fromarray(out,'RGBA')


def pack_source(original, scale=24):
    native=pack_native(original)
    return native.resize((64*scale,64*scale), Image.Resampling.NEAREST)


def unpack_generated(image, original, manifest, strict=False):
    require_native_original(original)
    target_side=64*manifest['scale']
    original_input_size=image.size
    if image.size!=(target_side,target_side):
        # Different native image size can be normalized; report it explicitly.
        image=image.resize((target_side,target_side),Image.Resampling.LANCZOS)
    src=np.asarray(image.convert('RGBA'),dtype=np.uint8)
    template=np.asarray(original.convert('RGBA').resize((64*manifest['scale'],32*manifest['scale']),Image.Resampling.NEAREST))
    layout=np.asarray(pack_source(original,manifest['scale']))
    desired=(layout[:,:,3]>8)
    source_fg=mask_from_image(image).astype(bool)
    union=desired|source_fg
    overall_iou=float(np.count_nonzero(desired&source_fg)/max(1,np.count_nonzero(union)))
    # Map known face colors back exactly by affine slice translation only.
    # The final target alpha belongs exclusively to the original.
    out=np.zeros_like(template)
    out[:,:,3]=template[:,:,3]
    missing_total=0
    region_report=[]
    for item in manifest['groups']:
        x0,y0,x1,y1=item['source']; dx,dy=item['dest']; s=manifest['scale']
        tx0,ty0,tx1,ty1=x0*s,y0*s,x1*s,y1*s
        sx0,sy0=dx*s,dy*s
        sh,sw=ty1-ty0,tx1-tx0
        dest=out[ty0:ty1,tx0:tx1]
        rgb=src[sy0:sy0+sh,sx0:sx0+sw,:3].copy()
        source_region_fg=source_fg[sy0:sy0+sh,sx0:sx0+sw]
        target_region_fg=template[ty0:ty1,tx0:tx1,3]>8
        missing=target_region_fg&(~source_region_fg)
        missing_total+=int(missing.sum())
        # Avoid artificial black seams caused by sampling invalid background.
        # Inpaint only source missing colors from *within* the same region.
        if np.any(missing) and np.any(source_region_fg):
            invalid=(~source_region_fg).astype(np.uint8)
            _,nearest=cv2.distanceTransformWithLabels(invalid,cv2.DIST_L2,3,labelType=cv2.DIST_LABEL_PIXEL)
            # robust nearest valid pixel: mask inpaint tiny voids, no semantic guarantee
            rgb=cv2.inpaint(rgb, invalid*255, 3, cv2.INPAINT_TELEA)
        elif np.any(missing):
            rgb=np.asarray(template[ty0:ty1,tx0:tx1,:3]).copy()
        dest[target_region_fg,:3]=rgb[target_region_fg]
        n=int(target_region_fg.sum())
        region_report.append({"id":item['id'],"target_pixel_count":n,"source_missing_in_target":int(missing.sum()),"missing_fraction":round(float(missing.sum()/max(n,1)),5)})
    # Exact mask authority cannot prove pixel-accurate AI features. Report!
    result=Image.fromarray(out,'RGBA')
    report={"status":"needs_visual_3d_review", "target_size":list(result.size),
            "received_generated_size":list(original_input_size),
            "generator_canvas_was_resized":original_input_size!=(target_side,target_side),
            "packed_source_mask_iou":round(overall_iou,6),
            "missing_source_pixels_at_original_uv_coordinates":missing_total,
            "regions":region_report, "original_target_alpha_pixel_exact":bool(np.array_equal(out[:,:,3],template[:,:,3]))}
    if strict and (overall_iou < 0.97 or any(z['missing_fraction'] > 0.01 for z in region_report)):
        raise ValueError('Source violates safe geometry threshold; review report before using output: '+json.dumps(report))
    return result,report


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    sub=parser.add_subparsers(dest='mode',required=True)
    p=sub.add_parser('pack')
    p.add_argument('--source',required=True);p.add_argument('--out',required=True)
    p.add_argument('--scale',type=int,default=24);p.add_argument('--manifest',required=True)
    q=sub.add_parser('unpack')
    q.add_argument('--source',required=True);q.add_argument('--original',required=True)
    q.add_argument('--out',required=True);q.add_argument('--manifest',required=True)
    q.add_argument('--report');q.add_argument('--strict',action='store_true')
    a=parser.parse_args()
    if a.mode=='pack':
        original=Image.open(a.source).convert('RGBA')
        if not 1<=a.scale<=64: raise ValueError('scale must be 1..64')
        output=pack_source(original,a.scale)
        manifest={'format':'mineclonia-cat-connected-net-v1','source_size':[64,32],
                  'layout_size':[64,64],'scale':a.scale,
                  'source_sha256':hashlib.sha256(Path(a.source).read_bytes()).hexdigest(),
                  'groups':GROUPS,'verified_exact_inverse':True,
                  'mapping':'native integer-pixel block-copy translation, not warping'}
        output.save(a.out)
        Path(a.manifest).write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding='utf-8')
        print(f'PACKED {a.out} size={output.size}')
    else:
        m=json.loads(Path(a.manifest).read_text(encoding='utf-8'))
        result,report=unpack_generated(Image.open(a.source),Image.open(a.original),m,strict=a.strict)
        result.save(a.out)
        if a.report:Path(a.report).write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
        print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__':main()
