# ACTIVE HANDOFF — 2026-10-07

Branch: `main` · Production: GitHub Pages.

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
- `153ba16` fixes island-sheet detection: in Import/Düzelt mode, saved export slots now define logical island identity. Global connected-component detection no longer gets to split/merge exported islands across the sheet. Source and target objects are rebuilt per slot from the real foreground mask, so auto-overlap uses the correct source/target bbox inside that slot.
- Final device visual validation is still required for the real-contour node placement, centered scale behavior, and the reload→Import/Düzelt path on problematic pig/cat AI atlases.

## Next concrete step
On device, export an island sheet once, reload/leave the page, then choose `AI PNG Import / Düzelt` directly. Verify each saved slot appears as exactly one logical island, selecting a source auto-pairs the same slot target, and `Üst üste getir` visibly moves/warps the AI foreground bbox onto the original foreground bbox. Then validate contour nodes at 3×3 and 15×15, centered ±1% scale, manual `+ Ada` splitting, `Adayı Birleştir`, and save.
