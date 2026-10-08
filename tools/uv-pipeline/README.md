# Creeper UV pipeline — recovered reference

This directory preserves the recovered Python implementation of the Creeper UV alignment pipeline. **Do not overwrite the reference script when experimenting.** New fixes belong in separately named versioned scripts.

## Purpose and success criteria

This pipeline solves a specific problem in Mineclonia Texture Studio: AI-generated mob texture atlases can contain much better surface materials than the game's original texture, but their UV islands, boundaries, and enclosed transparent/black voids may shift. Simply placing the AI image on the mob's original UV mesh then misaligns faces and openings.

**Goal:** Use the **original Creeper PNG as the geometric/topological authority**, while transferring the **AI PNG's new surface detail** onto that layout. Keep each UV island in its expected position and size, preserve the original occupied/empty structure (including Creeper face openings), and minimize deformation, stretched edge streaks, seams, blur, and loss of AI material detail. The output is a texture atlas intended to fit the existing in-game Creeper UV mapping **without modifying the 3D model**.

This is a *geometry-constrained texture transfer*, not a new image generator, not a generic background remover, and not a license to redraw the atlas or change its UV layout. The recovered baseline is useful but **not yet artifact-free**; especially edge streaks remain to be fixed in a separate version.

## Current research decision (2026-10-08): prevention first

The Python aligner below is a **preserved fallback/prototype**, not the desired primary production method. The current goal is to prevent an AI image generator from shifting, merging or redrawing authentic B3D UV faces in the first place. A generated atlas should retain exactly the original topology, face identity, small islands, alpha/void behavior and overlays, with only material detail replaced.

See **[`PREVENTION_FIRST_HANDOFF.md`](PREVENTION_FIRST_HANDOFF.md)** for the cat/Enderman/pig failures, user-reported successful horse case, false-positive tests caused by premasking AI with original UV, the 3D renderer correction, and the next controlled comparison experiments. Those independent-island V3 attempts are local/unmerged; the unsolved cases are **not** represented as validated outputs.

## Reference PNGs

- `original.png`: original Creeper texture; reference for UV island boundaries, dimensions, placement, and enclosed voids. Supplied in chat as `119110.png` (1536×768).
- `ai.png`: AI-generated Creeper texture to correct; source for the realistic moss/rock material. Supplied in chat as `119116.png` (1536×768).
- `creeper_final.png`: output of the script; not an accepted pixel-perfect historical reference.

**Asset status:** The two images were supplied in the conversation; this README records their identities and intended names. Do not assume they are committed until their binary files can be verified in GitHub. Do not substitute screenshots or resized images.

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


## General-purpose guarded aligner (V2)

**Status: working offline prototype, not connected to the Texture Studio browser UI.** Known-good validation environment: Python 3.13.5 and versions in `requirements-tested.txt` (install with `python -m pip install -r tools/uv-pipeline/requirements-tested.txt`). This is a repeatable algorithm, not a collection of Creeper-only pixel patches.

- `uv_geometry.py` — independent contour, component and ordered-edge helpers extracted from the recovered baseline without changing it.
- `uv_align_guarded_v2.py` — guarded alignment engine and CLI; **no Creeper-specific pixel coordinates or face strips**.
- `test_uv_align_guarded_v2.py` — synthetic regression cases plus optional real Creeper face-alignment regression.
- `creeper_outer_rigid_truevoid.py` — immutable historical baseline / rollback.

```bash
python -m pip install numpy opencv-python Pillow
python tools/uv-pipeline/uv_align_guarded_v2.py \
  --original original.png --ai ai.png \
  --output aligned.png --report alignment-report.json

# Synthetic tests (no binary fixtures required):
python -m unittest discover -s tools/uv-pipeline -p 'test_uv_align_guarded_v2.py' -v

# Additional real regression when PNG fixtures are available locally:
UV_TEST_ORIGINAL=/path/to/119110.png \
UV_TEST_AI=/path/to/119116.png \
python -m unittest discover -s tools/uv-pipeline -p 'test_uv_align_guarded_v2.py' -v
```

### Contract: preserve geometry, not patch examples

1. Determine original and AI foreground components using true alpha when available, otherwise an opaque-black background threshold. Reject missing or drastically mismatched islands.
2. When UV foreground masks already match exactly, skip all geometric resampling and transfer AI RGB directly (zero interpolation drift).
3. Keep the original canvas, component locations, holes, background pixels and alpha **exactly**. Only occupied RGB pixels receive AI material sampling.
4. Build ordered contour constraints and analyze the inverse sampling rate *before rendering*. Detect intervals mapping wide destination strips to nearly one source pixel, including atlas component boundaries.
5. Automatically condition only problematic axis-coordinate intervals. Keep safe coordinates unchanged. Protect the component world position; never reposition the original atlas islands to make their holes look aligned.
6. Reject impossible/nonmonotonic transforms or large displacement rather than silently publishing an incorrect atlas; write optional JSON diagnostics for every component and X/Y axis.
7. Preserve the archived baseline for rollback. No image-specific exception tables belong in the production algorithm; fixture-specific coordinates belong only in tests.

### Verified on the supplied Creeper pair

Local verification on `119110.png` and `119116.png` (both 1536×768): 2 components paired; 3 degenerate Y intervals repaired in the large atlas island; 2 X + 2 Y degenerate edge intervals repaired in the detached square. The face crop covering the eyes and mouth (x=200..409, y=210..351) matches the archived baseline pixel-for-pixel. Original background/void pixels were unchanged. Twelve local regression tests passed, including the real PNG case.

**Limits:** This prototype currently requires equal canvas dimensions and a sufficiently similar arrangement of non-tiny UV islands. It is primarily suited to axis-aligned texture atlases with opaque-black or alpha backgrounds. It does not guarantee semantic face/eye alignment for arbitrary differently arranged UV layouts, independently rotated islands or aggressive AI rearrangements: those should be rejected or handled by an explicit per-island registration workflow. A `validated` report means numeric/topological checks passed, not that a human has approved every aesthetic detail.

**Fixture provenance:** The original and AI PNGs are known from chat as `119110.png` / `119116.png`. They are **not included in this source commit**; the optional real-image regression requires local copies until image binaries are explicitly uploaded and verified in GitHub.


## Scope and deployment

This script is an offline Python tool, **not wired into the browser UI or its data storage**. Do not change browser persistence, prompt schemas, or existing UV tools as part of archiving it. The preservation commit used `[skip ci]`; no GitHub Actions run was observed for that commit. Do not manually dispatch workflows for documentation-only work.
