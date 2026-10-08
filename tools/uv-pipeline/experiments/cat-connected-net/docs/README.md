# Connected cube-net-inspired UV presentation: cat (experimental)

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
