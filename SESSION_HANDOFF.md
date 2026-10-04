# Texture Studio — Session Handoff

Updated: 2026-10-04

## Current direction

The Texture Studio remains focused on editing Mineclonia textures while preserving each texture's gameplay/UV structure.

### 1. Entity 3D preview was intentionally removed

Do NOT resume the Piglin/B3D 3D-preview experiments unless explicitly requested again.

Tested paths included third-party B3D→GLB, Irrlicht OBJ baking, Assimp B3D→GLB, IrrlichtMt/WASM attempts, runtime material replacement, and packaged-texture GLB. Geometry could render correctly with Assimp, but reliable Mineclonia texture/material mapping in-browser was not completed. Experimental 3D UI/assets/workflows were removed.

### 2. Entity textures are NOT animation strips

Textures under ENTITIES/** must never be classified as animated strips merely because their dimensions form a strip-like ratio. They are structural UV atlases and require entity-specific handling.

### 3. Current priority: animation atlas resolution bug

Suspected failing path: animated strip → square atlas → edited atlas import → reconstructed strip.

Observed symptom: importing a high-resolution edited atlas appears to reconstruct an extremely low-resolution texture. Likely the imported atlas is being forced back to the original low-resolution frame/strip dimensions.

Next session must inspect atlas export dimensions, frame cell dimensions, imported atlas dimensions, reconstruction canvas dimensions, and final stored edited-PNG dimensions before patching.

Desired behavior: preserve the edited atlas resolution; infer new per-frame resolution from the imported atlas grid; reconstruct the strip at that new frame resolution; never force it back to the original low-resolution texture dimensions.

### 4. Current priority: zoomable top comparison preview

The main Original/New comparison preview needs mobile navigation, especially for long animated strips.

Required: two-finger pinch zoom; one-finger pan while zoomed; double-tap reset desirable; Original and New layers transform together; existing comparison slider/clip keeps working; Android touch friendly; preview-only, never modify texture data.

### 5. Animation UI principle

Long animated textures should be handled specially instead of being shown only as a tiny fitted strip. The square-atlas workflow exists to make AI editing practical and then reconstruct the original animation layout at the edited resolution.

### 6. Deployment

Production is GitHub Pages, not Netlify.

https://theosmanyildirim.github.io/mineclonia-texture-studio/

GitHub Pages deploys from main using GitHub Actions.

### 7. Cleanup state

The unfinished entity 3D preview UI and experimental OBJ/GLB/WASM preview artifacts/workflows were removed. Do not reintroduce them unless deliberately requested.

## Next concrete work

1. Inspect and fix animation atlas import/reconstruction resolution handling.
2. Add pinch-zoom + pan to the top Original/New comparison preview.
3. Test both with a long animated texture.
4. Confirm that importing a high-resolution edited atlas produces a correspondingly high-resolution reconstructed strip.