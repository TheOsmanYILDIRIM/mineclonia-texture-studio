# SESSION_HANDOFF — 2026-10-08 · CLOSED

Repository: `TheOsmanYILDIRIM/mineclonia-texture-studio` · branch `main`.
Last code-work baseline checked before this documentation close: `53fc5ca79be5bef5bad1e9f2392722dfdd10e6e8`. Pre-close documentation HEAD `082077b14f6efa57c5106fd75151333848903733` had **successful** Runtime Guards and Pages deployment; later `[skip ci]` documentation commits are **not** evidence of a new deployed build. GitHub current code/Actions always outranks this snapshot.

## Current working priority — experimental UV generation reliability

Prevent AI image generation from distorting true Mineclonia entity UV layout; use postprocessing only as a guarded fallback. **Read [`tools/uv-pipeline/CONNECTED_NET_EXPERIMENTS.md`](tools/uv-pipeline/CONNECTED_NET_EXPERIMENTS.md)** for verified dimensions, experiments, A/B metrics, invalid claims and next experiment. Historical policy/limits: `tools/uv-pipeline/PREVENTION_FIRST_HANDOFF.md` and directory `README.md`.

- Keep `creeper_outer_rigid_truevoid.py` immutable. The guarded V2 aligner is offline, *not universally validated*; old cat/Enderman `validated` claims obtained by pre-applying target mask to AI were circular.
- Cat source: native **64×32**, temporary connected-net **64×64**, ×24 AI presentation. Original→pack→unpack is pixel-exact by integer translation, but this proves mapping only — **not** generated texture semantics.
- Latest user-created cat outputs: **solid cyan matte (no line)** vs **cyan + external 1-px magenta guard**. Before final mask restoration, measured source-mask IoU **0.983031 vs 0.964209** respectively; in 3D they differ especially in eyes/face. Both still need semantic UV approval. Exact original alpha is applied only *after* the independent mask audit.
- Attempted guard-line cleanup did **not** actually detect/inpaint the visible line: detected magenta pixels **0**. A reported cleaned IoU **1.0** came solely from forcing the original target mask; it is *not evidence* guard pixels are gone or semantically aligned.
- Transparent output is not guaranteed even from RGBA-transparent input. Hidden-RGB/edge-bleed experiment did **not** demonstrate a clear benefit. Gray-square, stretched-square and independently generated head-crop trials were not winners in these individual samples. A successful horse AI atlas remains a user observation, unverified as a benchmark.
- **Source recovery committed** at `e8e81f6`: `tools/uv-pipeline/experiments/cat-connected-net/` contains the four *exact archived* Python scripts, native 64×32 source PNG, mapping JSON, GPT Image prompt, validation JSON and original archive manifest; all GitHub paths were verified. Larger **binary fixtures remain only in the 25-entry conversation ZIP** `MTS_ConnectedNet_UV_Closeout_2026-10-08.zip`: cat B3D mesh, generated input/output PNGs and rendered comparison images. They are not uploaded to GitHub, so reconstruct or retrieve them before claiming a fully reproducible model/AI fixture test.

## Browser application — stable separate workstream

- Startup no longer eagerly hydrates node-face metadata, prompt records or offscreen thumbnails; preserve lazy loading. Relevant commits: `d93da3b`, `25e843d`, `5ff593a`, `fb5071f`, `ac89e94`.
- Mineclonia-source-driven 3D block profile/face resolution includes sibling texture lookup; key commits `29552911`, `ee9cc1e5`, `fda4285b`, `5aa65f05`. Keep block faces/profile data authoritative rather than cube fallback.
- Schema-v2 per-texture prompts use `js/prompt-registry.js`. `js/locked-parent-composite.js` is opt-in ore mask compositing: completed Stone/Deepslate remains byte-identical outside a user-confirmed mineral mask. Relevant commits `1c2277a`, `be51540`.
- Browser persistent edits, import/export, UV wizard/routing and build-cache semantics are protected by `AGENTS.md`; no runtime files or storage were changed during this closeout.

## Verification and open work

**Confirmed previously:** runtime guards and Pages deployment both succeeded at documentation commit `082077b`; offline recovered Creeper regression was previously 12/12 (not re-run at closure); connected-net pure pack/unpack was verified pixel-exact. Experiment measurements above are single local examples, not repeated model benchmarks. Documentation-only changes have no production verification claim.

**Next concrete UV step:** finish archiving missing binary AI/B3D fixtures from the chat ZIP; implement **actual** inside/outside guard-pixel detection near the source contour; perform controlled no-guard vs guard comparison *without* pre-masking raw AI, then 3D landmark/edge checks at identical camera angles. Repeat multiple generations before selecting a default. Keep source face semantics/alpha fixed; no hard-coded creature-specific pixel patches as a purported general solution.

**Separate app checks remaining:** real-device Diamond Ore mask paint/erase, unchanged parent pixels, save/reload, touch-size/mismatch handling, and `Mineral birleştir` discoverability; spot-check Bone Block/barrel/beehive/TNT multi-face previews; measure first usable catalog paint if startup slows.

No manual GitHub Actions dispatch, no browser storage migration, no deployed feature changes as part of this closure.
