from pathlib import Path
import json
import sys
import zipfile

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0,str(Path(__file__).parent))
import cube_net_repack as converter
from render_b3d_correct import load_mesh,render

out=Path(__file__).parent
original=Image.open('/mnt/data/mob_test/cat_original.png').convert('RGBA')
net=converter.pack_native(original)
net_hi=converter.pack_source(original,scale=24)
manifest=json.loads((out/'mapping.json').read_text())
original_recovered=converter.unpack_native(net,original)
assert np.array_equal(np.array(original_recovered),np.array(original))
original_recovered.resize((1536,768),Image.Resampling.NEAREST).save(out/'cat_original_roundtrip_proof.png')

# Realistic example is a strictly rearranged already-produced texture, NOT an AI output for this new layout.
real=Image.open('/mnt/data/cat_ai_pack_grid/cat_component_bbox_seam_safe_v2.png').convert('RGBA')
s=24
r=np.array(real)
alt=np.zeros((64*s,64*s,4),dtype=np.uint8)
for it in manifest['groups']:
    x0,y0,x1,y1=it['source'];dx,dy=it['dest']
    alt[dy*s:(dy+y1-y0)*s,dx*s:(dx+x1-x0)*s]=r[y0*s:y1*s,x0*s:x1*s]
example=Image.fromarray(alt,'RGBA')
example.save(out/'cat_realistic_example_repacked.png')
# Inverse raw proof for authored/generated pixels without any inpaint/resizing.
back=r.copy()
for it in manifest['groups']:
    x0,y0,x1,y1=it['source'];dx,dy=it['dest']
    back[y0*s:y1*s,x0*s:x1*s] = alt[dy*s:(dy+y1-y0)*s,dx*s:(dx+x1-x0)*s]
assert np.array_equal(back,r)
Image.fromarray(back,'RGBA').save(out/'cat_realistic_roundtrip_proof.png')

# Guide diagram. Outline boxes in a SECONDARY reference only; do not contaminate AI texture.
colors=[(232,113,99),(79,161,215),(186,131,221),(89,185,127),(226,184,89)]
board=Image.new('RGBA',(1536,1536),(28,31,37,255))
from PIL import ImageDraw
c=24
checker=Image.new('RGBA',board.size,(0,0,0,0))
draw=ImageDraw.Draw(checker)
for yy in range(0,1536,c):
    for xx in range(0,1536,c):
        draw.rectangle((xx,yy,xx+c-1,yy+c-1),fill=(60,64,69,255) if (xx//c+yy//c)%2==0 else (72,76,82,255))
board.alpha_composite(checker)
board.alpha_composite(net_hi)
d=ImageDraw.Draw(board)
try:
    font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',27)
except OSError:
    font=ImageFont.load_default()
for col,it in zip(colors,manifest['groups']):
    x0,y0,x1,y1=it['source']; dx,dy=it['dest']; w=x1-x0;h=y1-y0
    rect=(dx*c,dy*c,(dx+w)*c-1,(dy+h)*c-1)
    d.rectangle(rect,outline=col,width=5)
    label=it['id'].upper()
    tx=rect[0]+6;ty=max(0,rect[1]-35)
    bb=d.textbbox((tx,ty),label,font=font)
    d.rectangle((bb[0]-6,bb[1]-3,bb[2]+6,bb[3]+3),fill=(14,17,22,230))
    d.text((tx,ty),label,font=font,fill=col)
board.convert('RGB').save(out/'cat_connected_cube_net_guide.png')

# 3D render of recovered exact atlas, compared with original: same pixel texel mapping.
mesh=load_mesh(out/'cat_model.b3d')
for yaw in (20,145):
    im,rep=render(mesh, original.resize((1536,768),Image.Resampling.NEAREST),width=700,height=700,yaw=yaw,pitch=12)
    im.save(out/f'cat_original_3d_yaw{yaw}.png')
    im2,rep2=render(mesh,Image.open(out/'cat_original_roundtrip_proof.png'),width=700,height=700,yaw=yaw,pitch=12)
    assert np.array_equal(np.array(im),np.array(im2))

# Comparison layout
old=original.resize((768,384),Image.Resampling.NEAREST)
new=net.resize((768,768),Image.Resampling.NEAREST)
canvas=Image.new('RGBA',(1600,930),(23,25,30,255))
fontbig=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',26)
canvas.alpha_composite(old,(26,112))
canvas.alpha_composite(new,(824,95))
dc=ImageDraw.Draw(canvas)
dc.text((28,36),'ORIGINAL MINECLONIA 64x32',font=fontbig,fill=(245,245,245))
dc.text((826,36),'CONNECTED CUBE-NET PRESENTATION 64x64',font=fontbig,fill=(245,245,245))
dc.text((28,540),'Same texels, rearranged without stretch / rotation.',font=fontbig,fill=(170,188,210))
dc.text((28,596),'AI generates on right; conversion restores original left layout.',font=fontbig,fill=(170,188,210))
canvas.convert('RGB').save(out/'cat_original_vs_connected_net.png')

prompt='''Edit the uploaded image directly. It is a connected, cube-net-inspired UV surface layout for an existing calico cat 3D model.

TASK: Replace ONLY the low-resolution surface colors with natural, finely detailed, realistic calico cat fur.

STRICT STRUCTURE: Treat all regions as parts of ONE fixed unfolded texture. Do not create an animal portrait, redesign the shape, move, expand, shrink, separate, or rearrange any region. Preserve all connected edges and the relative position of the face and body markings. The head, torso, legs, tail and narrow attached strip belong to the same original game model. They must not be reinterpreted as extra limbs or distinct objects.

STITCHING: The shared edges are intentional; make fur shading and color continuous across existing touching borders without changing their geometry or painting outside them. Avoid border glows, outlines, shadows, halos and bleed into empty areas.

COLOR/SEMANTICS: Keep the source calico pattern in the same regions; preserve recognizable eye/nose positions, and do not paint new facial features on body or limbs. Use soft diffuse lighting, realistic hair fibers, restrained contrast and no neon/glossy effects.

BACKGROUND: Preserve the empty background. Do not fill holes, add padding, extra objects or labels. This is a technical texture replacement, not a new layout illustration.

Return only the edited connected atlas, no annotations or grid.'''
(out/'GPT_IMAGE_PROMPT.txt').write_text(prompt+'\n',encoding='utf-8')
readme='''# Connected cube-net-inspired UV presentation: cat (experimental)

**Goal:** A single physically meaningful connected net-like presentation to reduce independent island expansion when editing in GPT Image. This is NOT a new game UV map; Mineclonia B3D always uses original 64x32 texture UVs.

The five macro-regions are exact pixel-translations from the original 64x32 atlas. A deliberately synthetic join between macro-regions makes one connected component, but it must not be mistaken for a certified physical 3D seam or actual mesh unwrap. The internal rectangular cuboid face arrangement remains unrotated.

Input image to send to AI: `cat_connected_cube_net_input.png` (1536x1536). Only upload this image on the first controlled test. `cat_connected_cube_net_guide.png` identifies groups for human inspection; do not ask the image generator to render its colored lines. `cat_realistic_example_repacked.png` demonstrates what an already realistic texture looks like after the same reversible repack; it is not the requested newly generated result.

Use `GPT_IMAGE_PROMPT.txt` unchanged. Send the resulting PNG for validation.

## Mapping and reversal

```
python cube_net_repack.py pack --source cat_original.png --out connected.png --scale 24 --manifest mapping.json
python cube_net_repack.py unpack --source your_ai_output.png --original cat_original.png --out original_uv_restored.png --manifest mapping.json --report diagnostics.json
```

All original opaque texels are mapped exactly once. At pixel scale original --> rearranged --> original is **pixel-exact**. The realistic sample similarly returns exactly to its source texture; this tests only the mapping, not AI generation. AI output is treated as untrusted: a report measures mask IoU and missing source pixels; restored UV alpha is locked to original. Geometry being locked after reversal does not guarantee correct generated eyes/fur semantics, seam continuity, or an error-free 3D model.

## Known limitations

- Current transformation is cat-specific, using actual source atlas group ranges; generic B3D face grouping is future work.
- Texture-only bottom strip has no corresponding sampled B3D triangles in the inspected static model; it is retained for complete reversibility.
- AI may alter pixel coordinates and/or return a different canvas size. Inverse script resizes such output to expected square, flags this in report, and can still have material distortion.
- Joining originally disconnected regions may make the generator hallucinate continuity across synthetic boundaries. Judge objectively against previously tested square-padding method.
- Do not present generated-output quality as validated before receiving an actual AI edit and checking on the real B3D model.
- No browser app, persistent storage, GitHub repository, or Actions workflow was modified for this standalone experiment.
'''
(out/'README.md').write_text(readme,encoding='utf-8')

# Smoke tests for rendering/geometry.
mask=np.asarray(net)[:,:,3]>8
n,labels,stats,cents=cv2.connectedComponentsWithStats(mask.astype('uint8'),8)
assert n==2, ('unexpected islands',n-1)
summary={'status':'prototype_ready','source_native':[64,32], 'packed_native':[64,64],
         'visible_connected_components_original':2,'visible_connected_components_packed':n-1,
         'covered_source_texels':int(np.count_nonzero(np.asarray(original)[:,:,3]>8)),
         'covered_packed_texels':int(np.count_nonzero(mask)),
         'exact_native_roundtrip':True,'exact_realistic_24x_roundtrip':True,
         'real_3d_render_pixel_match_at_two_yaws':True}
(out/'validation.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
print(json.dumps(summary))

zip_path=Path('/mnt/data/cat_connected_cube_net_test.zip')
with zipfile.ZipFile(zip_path,'w',compression=zipfile.ZIP_DEFLATED) as z:
    for p in sorted(out.iterdir()):
        if p.is_file() and not p.name.startswith('preview'):
            z.write(p,arcname=p.name)
print('ZIP',zip_path, zip_path.stat().st_size)
