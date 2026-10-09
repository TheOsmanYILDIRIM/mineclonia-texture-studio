# SESSION_HANDOFF — Mineclonia Texture Studio
Updated: 2026-10-09. Canonical branch: `main`.

## Current state and verification
- Last feature HEAD: `a57f82b32180968bc235eb2cacb4adaa628eca06` (experimental B3D UV triangle picker). Read current `main` on resume; closeout documentation commit follows.
- For feature HEAD: Runtime Guards **success**: https://github.com/TheOsmanYILDIRIM/mineclonia-texture-studio/actions/runs/37989239694 ; GitHub Pages deploy **success**: https://github.com/TheOsmanYILDIRIM/mineclonia-texture-studio/actions/runs/37989239674 ; visual capture **in progress at check**: https://github.com/TheOsmanYILDIRIM/mineclonia-texture-studio/actions/runs/37989239755 . Do not claim Android visual correctness from these.
- Open PR #15: `feat: classify runtime animations and harden atlas editing`; review before merging.
- B3D rig remains **not validated**. PR #25 reverted unsafe owner-node deformation; PR #26 added static-mesh fallback on bind mismatch. Neither proves correct animated skinning. Earlier local B3D parsing checks are not rig/rendering validation.

## Regional UV editor — shipped
- `js/island-region-studio.mjs`: active target and independently loaded source PNG, explicit source/target selection, non-destructive preview and confirmation, 1–12× editor zoom, Pan/Edit, sticky joystick and separate five-node selector (four corners + move), 1/2/4/8 px movement, saved-island thumbnail gallery, full-screen 1–16× inspection, selection undo/redo (not persisted texture undo).
- Saved **single-rectangle** islands can be edited; multi-rectangle per-piece editing is still open. Pixel compositor `js/island-region-core.mjs` preserves all RGBA outside chosen rects and active alpha. Keep storage `mts_uv_islands_v1:` and edit database unchanged.
- `js/b3d-uv-selection.mjs` + `tests/b3d-uv-selection.test.mjs`: experimental geometry-only triangle UV mapping. The UI button `B3D UV’den seç` overlays triangles on the atlas and converts the clicked triangle to a rectangular UV selection. It does **not** yet select a surface by touching the 3D model; does **not** apply an exact triangle mask. B3D metadata/remote model fetch and UV orientation require real-asset validation. The new test file is not yet explicitly included in Runtime Guards.
- The full-screen island inspection is read-only. Some historic `SESSION_HANDOFF` claims about older branch-only PR #27 are superseded; verify PR status in GitHub rather than relying on those notes.

## Next concrete work
1. Validate B3D UV picker with authentic cat, skeleton and another B3D model: model URL, metadata, UV orientation, triangle bounds, selection in Android and whether overlapping UV triangles are ambiguous. Add `node tests/b3d-uv-selection.test.mjs` to Runtime Guards.
2. Implement real **3D surface click → triangle UV selection** using the existing WebGL preview's geometry/picking without modifying skeletal transforms; eventually replace bbox-only selection with triangle/polygon masks. Preserve existing manual workflow.
3. Extend undo/redo to texture operations only with explicit safe edit snapshots; add multi-rectangle saved-island per-part editing. Verify source PNG reimport, zoom/pan and sticky joystick on real Android.
4. Independently diagnose B3D animated rig/bind-pose parity against authentic source models before any animation transform change. Maintain static fallback and check Lua animation frame ranges.
5. Recheck visual capture, runtime guards and Pages for the latest **code** commit; avoid treating doc-only closeout as a feature deploy.

## Resume
Read `AGENTS.md`, `README.md`, `PROMPT_AUTHORING_GUIDE.md`, then this handoff and relevant source. Preserve modular ES modules and single-file production build strategy. Never clear user edits or silently migrate local storage.
