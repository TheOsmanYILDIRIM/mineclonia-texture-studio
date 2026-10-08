# ACTIVE HANDOFF — 2026-10-07

Branch: `main` · Production: GitHub Pages.

## Current focus — Canonical prompt system
- Authored prompt storage is now standardized to one file per texture: `prompts/<family>/tex_<id>.json`.
- Canonical schema v2 is `{schema_version:2,family,id,path,name,stages}`; manifests are indexes only.
- Production prompt payloads no longer use `.txt` or batch JSON. Migration commit `6bf9fed` converted existing ready prompts: blocks 202, mobs 30 ready (+211 pending metadata), armor 32, items 100.
- Single runtime path: `js/prompt-registry.js` owns all manifest/file loading and exposes one registry API; `js/app.js` no longer fetches or parses family prompt files directly. Refactor commits: `4fd4c36`, `69113ab`, `623626b`.
- Legacy txt/batch loaders and family-specific prompt registries are removed.
- Missing authored prompt coverage no longer renders the old synthetic `PROMPT YOK + ALPHA/BACKGROUND LOCK` body. Missing stages are empty/disabled.
- Item Creative → A+B Correction remains the item-only workflow; item Creative is not source-mask/silhouette locked.
- Item import Action was upgraded to write schema v2 canonical files, so future 50-item batches must not reintroduce schema v1.
- Prompt authoring rules and AGENTS invariants were updated in `4353bec` and `78ab267`.
- Immediate verification target: open `tex_626ae22e78` / `mcl_fishing_clownfish_raw.png`; it must resolve to canonical `stages.creative` ("Raw Tropical Fish") with no missing-prompt or source-alpha-lock fallback.

## Runtime standardization and data preservation
- Browser persistence was standardized without migrating or clearing user data. Storage identities remain unchanged: `MinecloniaTextureStudio` v1 / `edits`, local edit prefix `mts:`, `MinecloniaTextureStudioScaled` / `scaled`, prompt/recent/resolution keys, and `mts_uv_islands_v1:`.
- Shadowed duplicate core functions were removed; each of `putEdit/getEdit/delEdit/allEdits/importPng/importZip/exportPack/importProjectBackup/normalizeTextureBlob/applyFilter/render` now has exactly one runtime implementation. Commits: `272cc7c`, `057538f`.
- Storage literals were centralized into the stable edit-storage contract; no IndexedDB version bump, object-store rename, localStorage-key rename, wipe, or migration was performed.
- UV launch paths now use one router, `js/uv-repair-router.js`; Variant Lab primary repair routes to Vertex UV Studio and optional island repair routes through the same router. The unused duplicate `js/uv-mapper.js` module was removed.
- Prompt import is now family-agnostic through `.github/workflows/import-prompts.yml`; the old item-only importer was removed.
- `scripts/check-standardization.mjs` plus Runtime Guards now fail CI if duplicate core functions, legacy prompt storage, multiple prompt loaders, UV-router regressions, or persistent browser-storage identity changes return.
- No browser-stored edit, prompt override, resolution preference, recent-texture entry, scaled cache, or Island Studio mapping was intentionally deleted or renamed by this refactor.

## Current focus — Island warp / repack split
- Warp and restore are now separate paths. `js/ordered-contour-warp.js` provides ordered perimeter fitting for Vertex UV Studio auto-fit; commit chain: `44b25cf`, `4ac5f68`, wired in `4f30c09`.
- `js/island-repack.js` now reconstructs the normal atlas directly from V3 `slot.rects` / `slot.src` metadata and corrected slot frames. `islandStudioRestore()` no longer redetects/fits islands from image content; commits `2bae9c9`, `987d950`.
- `index.html` loads both modules before the feature editors (`59606c8`).
- Non-regression: component detection may scope/edit an island, but restore identity/placement must come from persisted slot metadata. Never reintroduce bbox guessing, foreground-search repack, or forced canonical low-resolution output.
- Next verification: device-test the V3 export → AI import → Vertex UV correction → save/restore round trip on Pig, then inspect restored resolution and rect placement before changing warp heuristics further.

## Current focus — Vertex UV Studio
- Variant Lab → `UV Eşle` opens the dedicated `js/vertex-uv-studio.js` + `css/vertex-uv-studio.css` editor. This is the primary entity-atlas repair workflow.
- Islands are the editor's segmentation/pairing model, not the retired automatic Island Studio restore experiment. Source/target island IDs remain stable during a session; used pairs are tracked as `Ü# → O#` and merged one-by-one into the final atlas.
- Automatic detection can be overridden with `+ Kaynak Ada` / `+ Hedef Ada` by drawing a rectangle around merged/touching regions. Manual islands disable overlapping automatic parents.
- Source crops preserve real detected foreground/alpha. Never fill bbox background by pulling nearest edge RGB.
- Mesh density supports 3×3 through 15×15 nodes; D-pad precision is 0.10/0.25/0.50/1 px.
- After source→target selection, the pair auto-fits immediately. Outer source UV sampling and destination mesh nodes snap to real detected island contours; interior nodes conform between those boundaries instead of remaining a rectangular grid.
- Centered scale controls are ±1% and ±2.5%; scaling must not shift the island center.
- Undo/redo tracks mesh edits plus committed canvas/pair state. `Adayı Birleştir` bakes one pair; `✓ Varyanta Kaydet` returns the repaired atlas to Variant Lab.
- Key commits: `c0af865` mask-preserving island core, `3cf1b88` pair history/manual split, `9058c98` manual island rectangles, `87eb1b1` pair UI, `7f7c4b3` 15×15 controls, `9358327` auto-fit/real contour perimeter, `db001a7` centered scale UI, `b512f06` contour-conforming interior mesh, `5804803` publish bump.
- Old Island Studio and legacy rectangle UV mapper remain optional/experimental. Do not route primary `UV Eşle` back to them unless explicitly requested.

## Catalog / thumbnail state
- P1→P0 material-block promotion must run only after async `CATALOG_READY`; commit `3c5d462` fixed the prior order bug.
- Thumbnail cache is edit-versioned and visible cards switch immediately to the new edit blob before the 192px derived thumbnail is rebuilt. Relevant commit: `42ac030`.
- Device validation of these cache/catalog fixes is still useful if symptoms recur; do not assume old P0=41/cache diagnoses without checking current runtime.

## Pages build/cache invariant
- Normal Chrome can retain stale `index.html`; Pages deploy stamps `js/build-status.js`, fingerprints local JS/CSS, and publishes `latest.html`.
- Update checks probe deployed Pages with `cache: no-store`; ready updates navigate to `latest.html?build=<sha>&_=<timestamp>`.
- Never clear user IndexedDB/localStorage texture/edit data as part of update/cache handling.

## Architecture constraints
- Keep substantial editors/labs in separate JS + CSS modules. `js/app.js` is the shared application core/orchestrator.
- Variant Lab and Vertex UV Studio communicate through explicit public bridges; optional feature failure must not block catalog boot.
- GitHub `main` is canonical; current code outranks stale prose.

## Visual review automation
- Added `.github/workflows/mts-visual-capture.yml` in commit `f0e45c7`.
- It captures the live GitHub Pages app at mobile (390×844), tablet (768×1024), and desktop (1440×1000), saving fold + full-page screenshots and console/page-error diagnostics as the `mts-visual-review` artifact.
- First run `37751309978` completed capture successfully with no console or page errors. Visual findings: mobile header/update controls are cramped and wrap heavily; desktop/tablet waste a large lower viewport area while the fixed bottom action bar dominates; desktop texture cards are oversized relative to information density; top status/build controls do not align as one intentional header system.
- Next visual-design pass should fix responsive header hierarchy, card density, and bottom action-bar proportions before adding more UI chrome.

## Verification
- Latest Vertex UV Studio JavaScript passed syntax validation after the contour/scale changes.
- `7b293ac` fixes the reload/import continuity bug: the V3 slot map was persisted, but the exported reference sheet canvas was memory-only. Import now rebuilds that reference automatically from the saved island definitions, so the user no longer has to reopen the wizard and press Forward just to make Import/Düzelt remember the export.
- `153ba16` briefly made saved export slots authoritative, but this was superseded because AI can shift/change slot layout.
- `c2bd345` is the current pairing rule: Import/Düzelt keeps detected AI objects independent, scales/projects original-object positions into AI/work resolution, and pairs the selected AI object with the nearest unused original object by position. Size/aspect is only a weak tie-breaker.
- `1a56bd3` first separated coarse alignment from vertex editing.
- `418e30b` ports the proven Vector Character Studio v5.7 architecture instead of continuing ad-hoc mesh transforms: whole-part `offsetX/offsetY/scale` is independent transform state over an immutable local mesh, while vertex deformation remains a later local-geometry operation. During `Üst üste getir`, target masking is disabled so the full AI object visibly moves/scales; the transform is baked only when advancing to vertex editing. This mirrors the supplied v5.7 separation between custom part transform and mesh warp.
- Final device visual validation is still required for the real-contour node placement, centered scale behavior, and the reload→Import/Düzelt path on problematic pig/cat AI atlases.

## Next concrete step
On device, export an island sheet once, reload/leave the page, then choose `AI PNG Import / Düzelt` directly. Verify AI objects are detected independently even if AI shifted the old slot layout; selecting an AI object must auto-pair the nearest unused original object after original coordinates are scaled to AI resolution. In `Üst üste getir`, verify one-finger whole-island drag, two-finger whole-island scale, stronger foreground original ghost, and only then advance to vertex deformation. Then validate contour nodes at 3×3 and 15×15, centered ±1% scale, manual `+ Ada` splitting, `Adayı Birleştir`, and save.
