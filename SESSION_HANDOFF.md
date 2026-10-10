# SESSION_HANDOFF — Mineclonia Texture Studio
Updated: 2026-10-10. Canonical branch: `main`.

## Current state and verification
- B3D skeletal pivot correction on main: `d1acdedf` (inverse quaternion for bone/world pose) while retaining legacy static mesh-owner transforms and untouched UV/texture/IndexedDB. Asset-cache refs refreshed in `b5a171ad` and `b0ef99e5`.
- Synthetic bind-pivot and static mesh parity regression: `tests/b3d-animation.test.cjs`; isolated GitHub Actions `b3d-rig-parity` **success** on `b0ef99e5`: https://github.com/TheOsmanYILDIRIM/mineclonia-texture-studio/actions/runs/38084125767 ; deploy **success**: https://github.com/TheOsmanYILDIRIM/mineclonia-texture-studio/actions/runs/38084125716 ; Mobile UI visual regression **success**: https://github.com/TheOsmanYILDIRIM/mineclonia-texture-studio/actions/runs/38084125683 . Those tests do not prove real Android skeletal rendering.
- Authentic supplied Mineclonia 85-B3D source pack analyzed without modifying source: 75 weighted rigs, 26 materially improved bone-to-vertex pivot proximity, 49 near unchanged, none worse by that quantitative metric; pig 50th-frame animated model-extent ratio 2.716 before → 1.439 after. Visual animation parity to real Luanti/game footage remains **unverified**. Avoid blanket animation scale factors or extrapolating from synthetic-only tests.
- General Runtime Guards on the feature HEAD still **failure** in the pre-existing `Verify reversible AI UV grid runtime` step, independent of the passing B3D rig job. Do not report full CI green. See https://github.com/TheOsmanYILDIRIM/mineclonia-texture-studio/actions/runs/38084125767 .
- Native Mineclonia source-backed nodebox geometry added for recognized fence, fence gate, door-half, stair and slab profiles; isolated `nodebox-geometry` **success**. Actual neighboring fence connections and complete two-half door states are still open. Keep the original B3D parser and model fallbacks intact.
- Open PRs/issues and current run status must be re-read on resume; historic PR #15/#25/#26 discussion is not current branch validation.

## Regional UV editor — shipped
- `js/island-region-studio.mjs`: active target and independently loaded source PNG, explicit source/target selection, non-destructive preview and confirmation, 1–12× editor zoom, Pan/Edit, sticky joystick and separate five-node selector (four corners + move), 1/2/4/8 px movement, saved-island thumbnail gallery, full-screen 1–16× inspection, selection undo/redo (not persisted texture undo).
- Saved **single-rectangle** islands can be edited; multi-rectangle per-piece editing is still open. Pixel compositor `js/island-region-core.mjs` preserves all RGBA outside chosen rects and active alpha. Keep storage `mts_uv_islands_v1:` and edit database unchanged.
- `js/b3d-uv-selection.mjs` + `tests/b3d-uv-selection.test.mjs`: experimental geometry-only triangle UV mapping. The UI button `B3D UV’den seç` overlays triangles on the atlas and converts the clicked triangle to a rectangular UV selection. It does **not** yet select a surface by touching the 3D model; does **not** apply an exact triangle mask. B3D metadata/remote model fetch and UV orientation require real-asset validation. The new test file is not yet explicitly included in Runtime Guards.
- The full-screen island inspection is read-only. Some historic `SESSION_HANDOFF` claims about older branch-only PR #27 are superseded; verify PR status in GitHub rather than relying on those notes.

## Next concrete work
1. Validate B3D UV picker with authentic cat, skeleton and another B3D model: model URL, metadata, UV orientation, triangle bounds, selection in Android and whether overlapping UV triangles are ambiguous. Add `node tests/b3d-uv-selection.test.mjs` to Runtime Guards.
2. Implement real **3D surface click → triangle UV selection** using the existing WebGL preview's geometry/picking without modifying skeletal transforms; eventually replace bbox-only selection with triangle/polygon masks. Preserve existing manual workflow.
3. Extend undo/redo to texture operations only with explicit safe edit snapshots; add multi-rectangle saved-island per-part editing. Verify source PNG reimport, zoom/pan and sticky joystick on real Android.
4. Verify corrected B3D bone rotations and motion range visually against genuine Mineclonia/Luanti in-game animations (cat, pig, wolf, horse and skeleton) and on real Android. Preserve static mesh parity, fallback, exact UVs, and Lua-defined frame ranges; only revise sign/space calculations with evidence.
5. Recheck visual capture, runtime guards and Pages for the latest **code** commit; avoid treating doc-only closeout as a feature deploy.

## Resume
Read `AGENTS.md`, `README.md`, `PROMPT_AUTHORING_GUIDE.md`, then this handoff and relevant source. Preserve modular ES modules and single-file production build strategy. Never clear user edits or silently migrate local storage.
