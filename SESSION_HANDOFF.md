# SESSION_HANDOFF — Mineclonia Texture Studio
Updated: 2026-10-09. Canonical branch: `main`.

## Current verified repository state
- Last checked code HEAD before closeout: `696538e0f3f8c7042966c0f238b3cc8b72fa84ef` (regional UV editor visual-flow diagnostics). Documentation closeout updates follow; inspect GitHub HEAD when resuming.
- B3D animation safety guard: PR #26, `eea87f84`. On animated bind-mesh mismatch against the static parser (positions, UV, triangle indices), the viewer falls back to static geometry. This is a safety fallback, **not a rig repair**.
- PR #25, `77d3611`, reverted the unverified owner-node rigid deformation from PR #24. The zero-length B3D chunk parser fix remains.
- The latest animated-rig state is **NOT VALIDATED**. User reports several models malformed immediately on opening, before pressing Play. Do not infer all models are affected; do not assume the last commit introduced the original fault.
- GitHub combined status for code HEAD `696538e0` and B3D PR #26 commit had no statuses; commit-associated workflow query yielded no runs. **Pages deployment and CI success are not confirmed** from these checks. Do not claim the live site is fixed.

## Main application functionality
- Texture detail: grid PNG export and AI-grid import with saved per-texture mapping; aspect-preserving input resize; controls hidden for non-mob-UV textures. Normal import/export and persisted edits retained.
- Regional UV editor: active UV, Pan/Edit, source/target region selection, 1–12× zoom, joystick step 1/2/4/8 px, saved-island thumbnails. Browser/device touch and visual QA remain open.
- UV roundtrip: original → grid → original was pixel-exact in prior local tests; this is **not** AI geometric fidelity proof. Source geometry/alpha is authoritative.
- Original B3D animations: 85 models parsed in an earlier local check, 75 had animation timelines; parsing/sampling is not a correct-rig or real-device rendering test. Only four named-clip mappings are hardcoded; remaining models use generic timeline/keyframe intervals.


## 2026-10-09 original-B3D diagnosis (PR #27; branch-only)
- Authentic `mineclonia_texturepack.zip` contained 85 B3D files; inspected structural records of cat, Enderman, skeleton, zombie, horse, and pig. Valid zero-length BONE sections and multiple TRIS groups appear; BONE weight totals observed equal 1 for tested cat/Enderman/skeleton/zombie meshes. Quaternion lengths were near 1.
- Definitive preview-on-open bug: `b3d-preview-controls.js` called `setClip()` during `attach`, which called `sample(0)` and overwrote bind geometry before the user played the animation. PR #27 prevents that automatic initial sample. Not a proof of correct skinning when playback starts.
- Independent frame-1 numerical probe found substantial differences from bind pose for some original models, especially zombie (up to ~8.81 source units), while Enderman and pig were essentially unchanged at frame 1. Such differences may be valid animation poses and are not themselves evidence of a parser error. Continue rig validation against a reference renderer and the Lua frame ranges; do not infer all models are broken.
- PR #27 includes code commits `6a155b5`, `2636963`, and synthetic owner-motion test `f22ba44`. Root cause for non-weighted geometry: skinning previously assigned `keep` weight to stationary `bindWorld` even when owner NODE had an animated transform, leaving geometry rigidly frozen and splitting model parts. It now applies `world(owner) × inverse(bind(owner))` to those residual unweighted vertices. Verified structurally in code; synthetic test added but full CI/render testing still pending. No deployed fix confirmed.

## Highest priority next session — actual B3D rig diagnosis
1. Inspect current `js/preview3d.js` static `parseB3D` and `js/b3d-animation.js` animation parser on the **same authentic** Mineclonia B3D buffers, including cat and Enderman plus representative rigs. Do not apply speculative rig transforms.
2. Compare vertex count/order, positions, UV, indices, bind pose, mesh-owner hierarchy, BONE weight indexing, matrix convention and weighted skinning at frame 0 and representative frames. Save a compact per-model parity report and reproducible failing fixtures.
3. Fix the actual parser/skinning mismatch; keep the static fallback until authentic B3D tests prove parity. Then validate animation playback and Lua clip ranges, plus Android WebGL rendering.
4. Check GitHub Actions Runtime Guards, visual capture and GitHub Pages **for the actual code commit**. Do not confuse documentation-only commits with deploys.

## Durable rules
Read `AGENTS.md`, `README.md`, `PROMPT_AUTHORING_GUIDE.md`, and relevant UV documentation before changes. Keep source modular; build production bundles deterministically. Preserve existing IndexedDB/localStorage data and original UV, alpha, and game-facing textures. Never clear or silently migrate edits. Keep handoff short and replace stale sections on future closeout.
