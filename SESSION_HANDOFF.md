# SESSION_HANDOFF — 2026-10-09 · B3D ANIMATION IMPLEMENTATION

Repository: `TheOsmanYILDIRIM/mineclonia-texture-studio` · branch `main`.
Last code-work baseline checked before this documentation close: `53fc5ca79be5bef5bad1e9f2392722dfdd10e6e8`. Pre-close documentation HEAD `082077b14f6efa57c5106fd75151333848903733` had **successful** Runtime Guards and Pages deployment; later `[skip ci]` documentation commits are **not** evidence of a new deployed build. GitHub current code/Actions always outranks this snapshot.

## Current working priority — experimental UV generation reliability

**New in this implementation:** Opt-in browser `uv-generation.html` (AI UV Grid Studio) and standalone ES modules + deterministic single-file production bundle. A native Mineclonia PNG becomes a square magenta-grid AI reference (8px UV clearance by default) plus inverse mapping JSON; generated PNG returns to the original native UV coordinates with optional bounded grid-shift recognition and magenta-edge repair. Cat ConnectedNet uses the committed explicit map; Enderman/general square-center does not guess islands by brightness. Unlike earlier one-off enderman crops, every output has an inverse manifest. See `docs/UV_GENERATION_ROUNDTRIP.md` for limits. Node synthetic regression and bundle freshness test were run locally; deployed Pages and real-device 3D need verification after the merge. No user edit store, B3D UV or animation tracks changed.


Prevent AI image generation from distorting true Mineclonia entity UV layout; use postprocessing only as a guarded fallback. **Read [`tools/uv-pipeline/CONNECTED_NET_EXPERIMENTS.md`](tools/uv-pipeline/CONNECTED_NET_EXPERIMENTS.md)** for verified dimensions, experiments, A/B metrics, invalid claims and next experiment. Historical policy/limits: `tools/uv-pipeline/PREVENTION_FIRST_HANDOFF.md` and directory `README.md`.

- Keep `creeper_outer_rigid_truevoid.py` immutable. The guarded V2 aligner is offline, *not universally validated*; old cat/Enderman `validated` claims obtained by pre-applying target mask to AI were circular.
- Cat source: native **64×32**, temporary connected-net **64×64**, ×24 AI presentation. Original→pack→unpack is pixel-exact by integer translation, but this proves mapping only — **not** generated texture semantics.
- Latest user-created cat outputs: **solid cyan matte (no line)** vs **cyan + external 1-px magenta guard**. Before final mask restoration, measured source-mask IoU **0.983031 vs 0.964209** respectively; in 3D they differ especially in eyes/face. Both still need semantic UV approval. Exact original alpha is applied only *after* the independent mask audit.
- Attempted guard-line cleanup did **not** actually detect/inpaint the visible line: detected magenta pixels **0**. A reported cleaned IoU **1.0** came solely from forcing the original target mask; it is *not evidence* guard pixels are gone or semantically aligned.
- Transparent output is not guaranteed even from RGBA-transparent input. Hidden-RGB/edge-bleed experiment did **not** demonstrate a clear benefit. Gray-square, stretched-square and independently generated head-crop trials were not winners in these individual samples. A successful horse AI atlas remains a user observation, unverified as a benchmark.
- **Recovery committed:** `tools/uv-pipeline/experiments/cat-connected-net/` now contains the four *byte-identical archived* Python scripts, native 64×32 PNG, mapping, prompt, validation JSON, two historical READMEs, guard comparison JSON, manifest, and a verified `restore_binary_fixtures.py` helper. Primary source commit `e8e81f6`; follow-up archival commits `055e5fe` and `a183160`; all checked through GitHub. **13 larger binary fixtures** (B3D model, four AI-input variations, five AI/restored PNGs, three visual reports) still exist only in the conversation ZIP `MTS_ConnectedNet_UV_Closeout_2026-10-08.zip`, not in GitHub. Local restore helper validated 14 binary checksums, restored 13 missing files and was idempotent, but this does not itself push them to GitHub.

## New entity 3D animation preview (2026-10-09)

- Added isolated `js/b3d-animation.js` (B3D node hierarchy + ANIM / BONE / KEYS decoding, interpolated node transforms and CPU skinning), `js/b3d-preview-controls.js` and `css/b3d-animation.css`. The existing `js/preview3d.js` lazily loads them only for entity skins and writes sampled positions to a dynamic WebGL vertex buffer. `js/app.js` lazy viewer cache version changed.
- UI: play/pause, restart, animation presets sourced from inspected Mineclonia `ocelot.lua` (cat), `pig.lua`, `creeper.lua`, `enderman.lua`; arbitrary start/end frame, frame scrub and speed. Entities lacking valid animation data still use the static preview; stop/close cancels animation frames.
- Fixed B3D root chunk byte-length calculation in both animation parser and existing static parser. Original UV coordinates, texture blobs and IndexedDB/localStorage remain untouched.
- `tests/b3d-animation.test.cjs` checks a synthetic weighted B3D triangle: static UV, index integrity and expected half/end-keyframe translations. Added to `.github/workflows/runtime-guards.yml`; run `37938833902` succeeded (initial assertion error corrected in commit `d532769b`). Deploy run `37938833929` succeeded.
- **Verification:** all three JS files compiled; synthetic weighted B3D test passed in Runtime Guards for commit `d532769b`, and GitHub Pages deployment for that commit completed successfully. Authentic Mineclonia B3D samples include cat 277 frames / pig 81 / Enderman 200 across subtrees, but **interactive mobile WebGL animation is not yet visually verified** in this chat. Confirm B3D skin deformation, per-clip model pose, optional overlays, and static fallback on actual device before treating as finished. Never claim the test proves all real model animation tracks.
- Keep entity animation modules lazy and isolated; browser edit storage / UV atlas data are not changed. Any remaining animation parser fallback should be surfaced in console as a warning.

## Browser application — stable separate workstream

- Startup no longer eagerly hydrates node-face metadata, prompt records or offscreen thumbnails; preserve lazy loading. Relevant commits: `d93da3b`, `25e843d`, `5ff593a`, `fb5071f`, `ac89e94`.
- Mineclonia-source-driven 3D block profile/face resolution includes sibling texture lookup; key commits `29552911`, `ee9cc1e5`, `fda4285b`, `5aa65f05`. Keep block faces/profile data authoritative rather than cube fallback.
- Schema-v2 per-texture prompts use `js/prompt-registry.js`. `js/locked-parent-composite.js` is opt-in ore mask compositing: completed Stone/Deepslate remains byte-identical outside a user-confirmed mineral mask. Relevant commits `1c2277a`, `be51540`.
- Browser persistent edits, import/export, UV wizard/routing and build-cache semantics are protected by `AGENTS.md`; no runtime files or storage were changed during this closeout.

## Verification and open work

**Confirmed previously:** runtime guards and Pages deployment both succeeded at documentation commit `082077b`; offline recovered Creeper regression was previously 12/12 (not re-run at closure); connected-net pure pack/unpack was verified pixel-exact. Experiment measurements above are single local examples, not repeated model benchmarks. Documentation-only changes have no production verification claim.

**Next concrete UV step:** Verify the new AI UV Grid Studio on the actual MTS Pages build with the user's enderman 1536×1536 AI output and original 64×32 texture, plus cat ConnectedNet mapping. Check 3D UV landmarks/eye overlay, magenta halo at black borders, and source-mask IoU **on raw AI before restoration**. Add a safe same-image real fixture pair to tests and finish binary archive recovery (13 files still external). Compare multiple grid/no-grid generations before picking a global default; do not claim output-mask equality measures AI geometry.

**Separate app checks remaining:** real-device Diamond Ore mask paint/erase, unchanged parent pixels, save/reload, touch-size/mismatch handling, and `Mineral birleştir` discoverability; spot-check Bone Block/barrel/beehive/TNT multi-face previews; measure first usable catalog paint if startup slows.

No manual GitHub Actions dispatch, no browser storage migration, no deployed feature changes as part of this closure.
