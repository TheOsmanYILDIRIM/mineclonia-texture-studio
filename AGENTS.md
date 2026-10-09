# AGENTS.md — Mineclonia Texture Studio

This repository is the **canonical source of truth**. Branch: `main`; production: GitHub Pages. If memory/handoff disagrees with current code or Git history, verify `main` first and repair the documentation. Avenox/Beyin is only a short continuation index, not a duplicate project database.

## Work / close protocol

At the start: read `AGENTS.md`, `README.md`, `SESSION_HANDOFF.md`, and `PROMPT_AUTHORING_GUIDE.md`; inspect current HEAD, relevant source, and latest relevant Actions/deploy results. Continue from the handoff's **Next concrete work**, unless the user gives a new priority.

At the end: commit actual code changes first, verify relevant tests/deploys, and update `SESSION_HANDOFF.md` to contain **current state, evidence, unresolved work, next step**, not a chronological diary. Keep stable rules here and detailed domain findings in their own README. Never store private reasoning or secrets in the repository.

Do not manually dispatch Actions for documentation, UV experiments, or a closeout. A doc-only commit must not be described as a deployed feature. Check whether CI/deploy ran before claiming a result.

## Core texture / model invariants

- Preserve gameplay identity, correct original UV/mask/alpha/void geometry, animation frame topology/order, tileability at literal canvas borders, entity face identity, overlay/tint behavior and game-distance readability.
- Visual target: **grounded dark-fantasy material realism** — weathered, somber, muted, tactile, diffusely lit, restrained saturation, believable scale; not simply upscaled pixel art.
- Mineclonia **Lua/runtime** is authoritative for the meaning of a file: node faces, particles, HUD sprites, items, palette tint, overlays, animation and combined textures. Filename, aspect ratio, folder and Minecraft naming intuition alone are insufficient. For particle/effect textures also establish the trigger/runtime use.
- Entity `.b3d` UV data, source PNG and relevant overlays (e.g. Enderman eyes) define the real 3D presentation; do not invent cuboid UV mappings or assume that every visible RGB feature is a separate UV island.

## Prompt / catalog system

- `PROMPT_AUTHORING_GUIDE.md` defines full methodology. For P0 materials, make a reference/world image first and then use the image-A **source structure/function** + image-B **style reference** production method. Reference prompts describe material identity without a feature-by-feature visual checklist. Material family continuity and runtime role outrank decorative creativity.
- Only literal outer canvas boundaries of tileable materials are seam-critical. Tree/log top means cut-trunk end grain, not leaves. Prior P0 “creative alternative” flow is retired.
- P0–P6 indicates **priority**, not texture family. Catalog classification follows creative-inventory groups plus deeper runtime/technical categories. Only true material Block records enter P0 automatically; functional/UI/sprite/system records do not.
- Authored prompts have exactly one canonical home: `prompts/<family>/tex_<id>.json`, schema v2 `{schema_version:2,family,id,path,name,stages}`. Manifests are indexes. `js/prompt-registry.js` is the sole runtime prompt loader/resolver; do not restore per-family loaders, production `.txt` batches, synthetic “PROMPT YOK” fallback or generic alpha-lock body.
- Real inventory items use the item-only two-stage **Creative → A+B Correction** flow; first-pass Creative is not source-silhouette locked. Entity atlas dimensions alone never imply animation strips. High-resolution animations must reconstruct at edited frame/cell resolution.
- Canonical prompt-import workflow: `.github/workflows/import-prompts.yml`, trigger `imports/mts-prompt-import.json` — never reintroduce per-family import workflows.

## Browser architecture and data safety

- Keep code modular: `index.html` mainly structure; `js/app.js` orchestrates shared runtime; distinct editors/screens and styles belong in `js/` and `css/` ES modules, isolated so a broken optional feature cannot prevent core catalog startup. Prefer explicit public bridges over touching other modules' private state; avoid duplicate/shadowed core function implementations.
- **Never wipe or silently migrate user edits.** Existing identities stay readable: IndexedDB `MinecloniaTextureStudio` v1/`edits`, local prefix `mts:`; scaled cache `MinecloniaTextureStudioScaled`/`scaled`; prompt overrides `mts:promptOverrides:v1`; recent textures `mts_recent_textures_v1`; resolution preference `mineclonia_texture_target_resolution_v1`; Island Studio prefix `mts_uv_islands_v1:`. Any DB version/storage name change requires an explicit lossless tested migration.
- Variant Lab is a session-only comparison gallery except `Aktif yap`, which commits through the normal edit store. Static asset tags and prompt authoring status must not change `Değiştirildi` semantics.
- `js/locked-parent-composite.js` (opt-in ore workflow) must copy AI mineral pixels only inside the user-approved mask; preserve finalized Stone/Deepslate source-parent pixels exactly elsewhere. Never auto-pick uncertain minerals or save before confirmation.

## Renderers and UV editing

- Entity 3D preview: real Mineclonia B3D mesh/UV in lazy WebGL, not guessed cube wrapping.
- Valid zero-byte B3D subchunks (including empty BONE entries in Mineclonia cat models) must not abort parsing; the chunk header already advances the reader. Preserve this regression in `tests/b3d-animation.test.cjs`.
- Entity animation is a separate lazy B3D parser/CPU skinner (`js/b3d-animation.js`) and UI controller (`js/b3d-preview-controls.js`, `css/b3d-animation.css`). Preserve the exact original UV/texture data and release animation frames on close/switch. Source animation ranges must be traced to corresponding Mineclonia Lua definitions. Use `node tests/b3d-animation.test.cjs` when changing parsing/interpolation. Block preview: Mineclonia Lua-derived node-face composition with semantic fallback and data-driven `js/data/preview3d-profiles.json` (generic orthographic default; perspective optional). Face layers can combine dirt+grass overlays while the scene background remains independent. Sibling/base textures should be resolved from catalog or source. Add face behaviors by profile data, not one-off JS rules.
- `js/uv-repair-router.js` routes Island actions into `js/island-region-studio.mjs`, the **primary regional active-UV editor**. It uses the current edit (`MTSVariantBridge.getEdit`) or source fallback, and reads existing `mts_uv_islands_v1:` rectangles with dimension scaling. `js/island-region-core.mjs` composites only inside the explicit selected rectangle union, preserves all outside RGBA bytes and preserves active alpha everywhere. Save only through the normal edit bridge after preview/confirmation; never overwrite whole source as an island side effect. Keep old `js/island-studio.js`/slot repack as compatible experimental fallback; don't route the primary entry there. Run `node tests/island-region-core.test.mjs`.
- `js/uv-repair-router.js` routes all UV repair entrypoints. Primary: `js/vertex-uv-studio.js` and its CSS. Preserve island IDs, one-to-one pairing, optional manual split/add, independent whole-part drag/offset/scale before local vertex warp, centered fine scale and real contour-node placement (3×3 through 15×15). Do not extend bbox background pixels as fake material.
- Keep `js/ordered-contour-warp.js` (island deformation) separate from `js/island-repack.js` (atlas reconstruction). Repack deterministically consumes persisted V3 `slot.rects`/`slot.src`, not a new guessing/redetection pass. Old Island Studio/rectangle mapper are optional experimental paths.
- Main compare viewer must preserve mobile pinch-zoom/pan and not change actual texture pixels.

## Offline entity UV research — prevention first

- Preserve recovered `tools/uv-pipeline/creeper_outer_rigid_truevoid.py` **unchanged**. `uv_geometry.py`, `uv_align_guarded_v2.py` and tests are **offline fallback prototypes**, not proof of universal semantic registration. Detailed historical findings: `tools/uv-pipeline/README.md`, `PREVENTION_FIRST_HANDOFF.md`.
- Current separate cat research: `tools/uv-pipeline/CONNECTED_NET_EXPERIMENTS.md`. Connected-net temporary layout can be invertible while generated eye placement, seams and alpha still fail. **Do not claim successful AI geometry merely because final target mask is forced or pack→unpack is exact.**
- Never pre-mask raw AI using original occupancy before independent source/target correspondence; that caused false-positive “validated” results. Distinguish true transparent pixels, opaque black/cyan matte, guard-line contamination, and renderer UV orientation/overlays. Do not infer that GPT Image consumes invisible RGB.
- Favor *preventing* AI UV damage during generation over Creeper-specific coordinate repairs. Test generated geometry, semantic landmarks, real B3D views and masked-edge contamination independently. Treat successful-horse-atlas claim as user observation until original+AI are measured.
- Experimental Python aligners, source fixtures or model changes do **not** automatically enter browser runtime/IndexedDB, production builds or workflows.

## AI UV generation round-trip (opt-in)

- `uv-generation.html` plus modular `js/uv-generation-roundtrip.mjs` and `js/uv-generation-ui.mjs` form a separate, no-storage, reversible AI presentation tool. Build the standalone single-file production runtime via `node scripts/build-uv-generation.mjs`; never hand-edit the generated bundle.
- The original PNG alpha and explicit manifest mappings are authoritative; for the verified cat ConnectedNet use the committed source mapping, for Enderman/general 2:1 source use square centering. Never infer cat-region topology for other entities, classify black as outside, or claim perfect AI UV accuracy from the forced output mask.
- Grid registration and magenta boundary fixes are small bounded optional image repairs, not verified semantic correspondence. Preserve raw AI output and separate 3D/landmark validation. See `docs/UV_GENERATION_ROUNDTRIP.md`.

## Pages build and cache discipline

- Production is **GitHub Pages**, not legacy Netlify config. Verify real Pages/Runtime Guards outcome before claiming deployment.
- Deployed workflow stamps `js/build-status.js` and fingerprints local JS/CSS by commit SHA; publishes a `latest.html` stamped entrypoint. Build badge shows the **loaded deployed artifact SHA**, not necessarily repository HEAD.
- `Güncellemeyi kontrol et` checks deployed `js/build-status.js?probe=<timestamp>` with `cache: no-store`; if newer, navigate to `latest.html?build=<sha>&_=<timestamp>`. Do not regress to repeated normal `index.html` reloads or confuse a GitHub commit with deployed build. Cache Storage/service workers may be cleared defensively, **never** application IndexedDB/localStorage edits.

## Separate Voxel Model Studio

`model-studio/` is an isolated mobile-first cuboid prototype (select, transform, duplicate, delete, save/load); no Texture Studio persistence coupling. It is **not** a lossless B3D rig or animation editor; do not claim otherwise.
