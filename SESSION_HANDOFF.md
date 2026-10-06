
## Front-end modularization (2026-10-06)
- Repository invariant is now documented in `AGENTS.md`: substantial independent screens/editors/labs must use isolated JS + CSS modules; optional feature failure must not block core catalog boot.
- Island Studio: `js/island-studio.js` + `css/island-studio.css`.
- Variant Lab: `js/variant-lab.js` + `css/variant-lab.css`.
- Manual UV Mapper: `js/uv-mapper.js` + `css/uv-mapper.css`.
- `js/app.js` now exposes narrow `MTSIslandBridge`, `MTSVariantBridge`, and `MTSUvBridge` APIs instead of owning those feature implementations.
- Next: verify GitHub Pages boot plus Entity → Variant Lab → UV Eşle and Entity → Ada flows on mobile before further feature changes.

# SESSION HANDOFF — Mineclonia Texture Studio

Updated: 2026-10-06
Canonical branch: `main`
Production: GitHub Pages from `main`

## Current architecture

The app edits the Mineclonia texture catalog while keeping browser edits backward-compatible. Existing IndexedDB/localStorage edit records remain authoritative for the user's `Değiştirildi` state. Prompt status is separate from technical asset metadata.

Static technical tags are computed cheaply at catalog load. A texture may carry multiple simultaneous tags such as `animated`, `face:side`, `runtime-tint`, `composite`, `ore`, and `lua:node`. These tags are additive metadata only; they do not replace the proven animation, prompt, edit-storage, or 3D fallbacks.

## Prompt system

`PROMPT_AUTHORING_GUIDE.md` is canonical.

Important current decisions:
- P0 material flow is reference-first: Ref image, then Image A structural master + Image B appearance/material reference.
- Runtime-tinted grayscale/mask assets must stay neutral/value-driven; final biome/dye/state hue must not be baked into generated texture data.
- Tint-aware prompt rewriting removes contradictory color-language rather than relying only on a final warning.
- Material dependencies are Mineclonia-source verified, not inferred from Minecraft. Examples include grass continuity and ore host-rock references.
- Entity UV atlases keep source UV/alpha geometry locked. Entity imports reapply the source alpha mask.
- Variant Lab drafts are temporary; only the activated winner is persisted as the normal edit. For entity UV maps with a real `.b3d` mapping, Variant Lab exposes a 3D button that opens the real mesh with the whole temporary variant gallery. The 2D Variant Lab and the in-place 3D UV strip both prepend two fixed comparison sources: `Orijinal` (pack source PNG) and `Aktif` (current persisted edit, or original when no edit exists). These are comparison-only system entries, not user variants. The 3D view keeps the same camera/zoom while its thumbnail strip hot-swaps all sources/variants directly on the existing WebGL texture.

## 3D preview

The 3D module is lazy-loaded only when opened.

### Blocks
- Preferred source: `js/data/node-faces.json`, derived from Mineclonia/Luanti node semantics.
- Renderer understands 1/2/3/6-tile face expansion, `overlay_tiles`, palette/tint behavior and `^` texture composition.
- Shared/base textures must not accidentally claim a composite node. If a strong Lua node match is unavailable, semantic/name face-family fallback remains.
- Grass behavior was used to harden the generic Lua interpretation: top is palette-tinted grass, bottom is dirt, and four sides are dirt/composition plus alpha-preserving tintable overlay.
- Filename/semantic fallback remains for assets not yet covered by the Lua manifest.
- Object mode supports Block/Functional Block. World mode is only for true Block assets and clones one prepared cube into a small 5x5 context patch.

### Entities
- Supported full/base/variant/coat entity skins use Mineclonia's real `.b3d` meshes, not guessed cuboids.
- `runtimeRoleInfo()` supplies the real mesh filename.
- A small built-in B3D static-mesh parser reads vertices, UVs and triangle/material groups; rendering uses lightweight WebGL and the active edited texture.
- Parser was validated on real zombie, cow, pig and cat B3D files.
- Multi-material meshes are respected. Known Mineclonia skin slots include zombie=1, skeleton=2, wither skeleton=1, horse=1; ordinary simple models default to slot 0.
- Standalone collar/eye/marking/equipment/effect overlays are deliberately excluded from entity 3D rather than rendered misleadingly.
- Entity preview is static/bind pose only; animation playback is not implemented.
- Drag rotates, pinch/wheel zooms. Horizontal drag direction was corrected in commit `f488262`.

## Asset/source analysis

- `scripts/extract-luanti-node-faces.mjs` is the reusable static Luanti node extractor foundation.
- `scripts/analyze-assets.mjs` documents the unified technical-tag model, but runtime catalog tagging is now computed directly at load to avoid a large generated `asset-tags.json`.
- Prompt state, edit/change state, verification state, variant winners and timestamps must never be encoded into static tags.
- Runtime guards protect this separation and preserve existing browser-storage compatibility.

## Current verification

- Current JavaScript changes were syntax-checked before commit.
- GitHub Pages deploy for the Lua face fixes completed successfully.
- Real Mineclonia B3D files parse into vertex/UV/triangle data.
- 3D lazy-load cache key is currently `preview3d.js?v=20261006-entity1`.
- No external Three.js/game-engine dependency was added.

## Manual UV fallback

Variant Lab exposes `UV Eşle` for Entity textures. The mapper now has Orijinal / Üretilen / Düzeltilmiş / Üst üste views, fixed-viewport pan/pinch zoom, pixel-grid snapping, global X/Y alignment, live rectangular correction, sizing/fit tools, joystick nudging, and live 3D comparison. It also includes a contour-based smart repair engine: source/target UV islands are extracted from alpha when available, otherwise opaque black/dark backgrounds are identified by edge-connected background flood-fill so interior dark texture detail is preserved. Green target and orange source boundaries are drawn with visible boxes/IDs and can be auto-matched or manually linked; blue links visualize correspondences. `Elle Eşle` is input-locked so selecting a contour does not trigger pan/selection/global movement. `Oto Bük` uses minimum-displacement local boundary correction: near-matching alpha contours (including 1–2 px errors) only deform a narrow neighborhood around the boundary, with compact support and a hard displacement cap. Interior texture is preserved instead of receiving a full-field Gaussian warp. Re-running the same auto warp is non-compounding/idempotent from its stored pre-warp baseline. Tool groups are collapsible to keep the mobile workspace uncluttered. Only `Bitti → Varyant` exports one temporary `_UV_FIXED` candidate back to Variant Lab.

## Open work

1. Device-test several entity families in the live Android UI: cow/pig/cat, zombie/skeleton, horse, wolf/spider/creeper where runtime mesh mapping exists.
2. Multipart object preview now composes two-node doors (including bamboo), Mineclonia double-plant top/bottom families, and normal/trapped double-chest atlas families. Beds are not yet implemented because the current catalog contains no bed texture family to map safely; resolve their actual Mineclonia runtime asset/model source before adding them.
3. Expand `node-faces.json` coverage from Mineclonia source. Keep Lua/source mapping authoritative and filename matching as fallback.
4. If a composite/tinted block renders incorrectly, fix the generic Lua render-plan interpretation first. Add a manual override only as a safe fallback for a genuinely exceptional runtime behavior.
5. Keep runtime guards green; the recent guard failure around metadata migration should be inspected before treating guards as fully healthy.

## Non-regression constraints

- Work directly on `main` for this project unless the user explicitly changes that workflow.
- Do not break existing browser edits or require a storage migration merely for technical tags.
- Do not merge prompt status or `Değiştirildi` state into static tags.
- Do not infer Mineclonia runtime behavior from Minecraft.
- Do not classify entity UV atlases as animations from dimensions alone.
- Do not persist Variant Lab non-winners.
- Keep 3D lazy; normal browsing should pay no entity/WebGL rendering cost.
- Preserve fallback behavior when Lua/source metadata is incomplete.

## Voxel Model Studio sidecar

- Added a deliberately isolated `model-studio/` prototype for fast cuboid creature editing.
- It starts with a Komodo draft and now loads Mineclonia upstream's actual `mobs_mc_cat.b3d` at runtime as a geometry reference using the same lightweight B3D vertex/triangle parser approach as the main 3D preview. The real mesh can be toggled behind the editable cuboids; the old hand-authored cat cuboids are not presented as the authoritative Mineclonia model. The sidecar B3D parser's root identity matrix was corrected after the first live load failed; load failures now expose the actual HTTP/parser reason and disable the misleading reference toggle.
- Mobile-first controls: select a box, resize/move/rotate on XYZ, choose 1/4, 1/2 or 1-voxel steps, duplicate/delete/add boxes, and save/load a standalone JSON project.
- The editor now has a higher-quality Model/Animation workspace, orthographic view shortcuts, improved mobile UI, and procedural Komodo animation previews for idle/breathing, walk, attack and tail motion. Animation is role/name driven so proportion edits continue to animate, and the current procedural pose can be baked into the cuboid model.\n- This remains a cuboid project editor: it does **not** rewrite Mineclonia B3D files, preserve/import the original B3D skeleton, or export a game-ready animated mesh yet. Procedural animation is an authoring preview until a verified Luanti exporter is added.

## Next concrete step

Open the deployed app after the latest Pages build and spot-check classic and modern door families (including edited upper/lower parts), then one simple entity skin (cow/cat), one multi-material entity (zombie/skeleton), grass/dirt block separation, and one ordinary top/side block. Fix incorrect mappings at the source-family/Lua/B3D interpretation layer before expanding multipart coverage to beds and other source-verified multipart objects.
