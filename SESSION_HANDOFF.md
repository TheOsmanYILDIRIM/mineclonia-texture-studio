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
