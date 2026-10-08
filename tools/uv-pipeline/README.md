# Creeper UV pipeline — recovered reference

This directory preserves the recovered Python implementation of the Creeper UV alignment pipeline. **Do not overwrite the reference script when experimenting.** New fixes belong in separately named versioned scripts.

## Reference implementation

- `creeper_outer_rigid_truevoid.py` — recovered, working baseline (commit `7ab8192`).
- Inputs: original Creeper UV PNG and AI-generated Creeper PNG.
- Outputs: final aligned RGBA PNG, optionally an outer-warp intermediate.
- Dependencies: Python 3, `opencv-python`, `numpy`, `Pillow`.

```bash
python -m pip install opencv-python numpy Pillow
python tools/uv-pipeline/creeper_outer_rigid_truevoid.py \
  --original original.png --ai ai.png \
  --output creeper_final.png \
  --outer-output creeper_outer.png
```

## Algorithm overview

1. Detect foreground components using RGB brightness and alpha thresholds; pair original and AI components by relative location, size, and aspect ratio.
2. Extract and rectify external contours; order horizontal/vertical edges and derive axis-wise correspondence constraints.
3. Warp AI component pixels into original component bounds with OpenCV remapping (`INTER_CUBIC`, `BORDER_REFLECT_101`); copy pixels under the original component mask.
4. Detect enclosed true-void regions in the original atlas. Copy a large neighborhood from the already outer-warped result and hard-lock each void to opaque black.

**Important implementation detail:** The rigid-neighborhood copy currently copies pixels from `outer` back onto an identical `result=outer.copy()`. Its observable change is the hard-black void lock, not a separate spatial correction. Do not describe this stage as a proven independent rigid transform.

## Known issue / next work

The recovered code produces **line-like texture stretching along some edges**. Possible investigation points (not yet proven): ordered edge correspondence, monotonic axis interpolation, cubic sampling, and reflected border handling. Diagnose with original/AI reference images and visual difference crops before changing behavior.

Preserve this baseline byte-for-byte. Develop a `v2` separately, compare outputs at original resolution, check silhouette and true-void topology, and retain rollback to the baseline. No claim of pixel-identical reproduction of any earlier accepted historical PNG has been established.

## Scope and deployment

This script is an offline Python tool, **not wired into the browser UI or its data storage**. Do not change browser persistence, prompt schemas, or existing UV tools as part of archiving it. The preservation commit used `[skip ci]`; no GitHub Actions run was observed for that commit. Do not manually dispatch workflows for documentation-only work.
