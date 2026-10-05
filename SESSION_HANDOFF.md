## Armor category + authored-prompt filter — 2026-10-05

- Added dedicated `Armor UV · 32` category in the UI; it selects only the 32 worn 64×32 armor UV atlases.
- Armor UV textures are explicitly excluded from rectangular-strip animation detection, so 64×32 armor no longer appears as a 2-frame animation.
- Added independent `Promptlu` filter beside `Değişenler`.
- `Promptlu` means a real authored prompt exists: Block authored refs, authored Mob/Armor refs, or a manual prompt override. Generic dynamic fallback alone does not count.
- Filters can combine (for example Armor UV + Promptlu, or Promptlu + Değişenler).
- Also fixed the Armor authored-reference fallback bug: authored first; real dynamic armor fallback second.
- Category/filter commit: `d6b78e3e4ddfe63bb56fbd11a9bc6b2e6117d6ba`.
- Filter state initialization fix: `bceb9a449ca549474670d72473007a4ac0efd5e6`.

## Armor authored-ref fallback fix — 2026-10-05

- Fixed the remaining authored-reference wiring bug: `referencePromptFor()` no longer calls nonexistent `mobArmorRefPromptFor()`.
- Precedence remains: authored Mob/Armor reference first; dynamic fallback second.
- Added real `dynamicArmorRefPromptFor()` using the existing armor-aware metadata/material logic.
- Verified no stale `mobArmorRefPromptFor` reference remains; Mob fallback still routes to `mobCreatureRefPromptFor()`; Armor/Mob button labels remain distinct.
- Fix commit: `bd2ca019e37bd9f0b3a4eaf805686b89a440a127`.

## Armor authored-ref fallback repair — 2026-10-05

- Fixed the authored-reference wiring fallback bug introduced after the authored-first loader.
- Root cause: `referencePromptFor()` called nonexistent `mobArmorRefPromptFor()` when an Armor authored ref was unavailable.
- Added real `dynamicArmorRefPromptFor()` using the existing armor-aware `mobPromptMeta()` material metadata.
- Precedence remains: authored Mob/Armor reference first; dynamic fallback second.
- Verified there are zero remaining references to the nonexistent helper and both Mob/Armor fallback branches remain defined.
- Fix commit: `c33b95aa944dee19bcaccdf5590a30ea8aac32d4`.

## Authored UV reference runtime wiring — 2026-10-05

- Fixed the three-stage UV reference path so authored prompts are actually consumed by the UI.
- **Authored reference prompts are now actually consumed by the UI; authored-first, dynamic-fallback-second.**
- Added one shared `AUTHORED_UV_REFS` loader/cache for both Mobs and Armor.
- Mobs loader reads `status=done` + `file` entries from `prompts/mobs/manifest.json`; authored `.txt` contents are stored verbatim by texture ID.
- Armor loader reads the manifest batch and stores each `reference_prompt` verbatim by texture ID.
- `copyMobPrompt('ref')` now calls `referencePromptFor(active)`: authored Map lookup first, dynamic `mobCreatureRefPromptFor` / `mobArmorRefPromptFor` fallback second.
- Ref button remains a local Map lookup after initialization; no per-click GitHub/fetch operation.
- Corrected only the four `leather_desat` Armor reference prompts to explicitly remain neutral/tint-friendly for runtime colorization.
- Acceptance checks: `extra_mobs_cod.png` and Mob #30 resolve to their authored TXT contents; Mob #31 (`mobs_mc_horse_creamy.png`) remains pending and therefore uses fallback; Armor chain and another Armor entry resolve to their batch-authored references; Armor inventory exclusion remains clean.
- Block regression check: the existing `loadBlockReferencePrompts()` implementation is byte-for-byte unchanged from the pre-wiring commit.
- Both inline JavaScript blocks parse successfully with `new Function`.

Commits:
- `ee77fe53defb224f499c698deeab2f9647e55e49` — tint-friendly `leather_desat` authored references.
- `11e3028f33305b3a6e438b4fe6c21c16890859ca` — authored-first UV reference runtime wiring.

Next concrete work: continue Mob reference authoring from manifest order 31 when explicitly requested.

## Armor UV reference completion — 2026-10-05

- Authored deliberate Armor Reference prompts for all **32** worn player-armor UV atlases in `prompts/armor/batch_001_032.json`.
- Coverage: **32 / 32 done; 0 pending; next_id=null; next_name=null**.
- Scope remains frozen to the existing 32-entry Armor manifest: chain, copper, diamond, gold, iron, leather, leather_desat and netherite × boots/chestplate/helmet/leggings.
- Inventory icons, `mcl_armor_inv_*`, trim/smithing-template item sprites, HUD/slot graphics and other flat item imagery were not added.
- Verified all 32 manifest paths resolve in the app catalog as **64×32, non-animated** worn UV atlases.
- HQ UV and Final UV remain shared/dynamic. Armor Reference is the only per-texture authored stage.
- Armor UI now displays **2 · Armor Ref** while Mobs retains **2 · Creature Ref**.
- Existing Mobs three-stage routing and Blocks 202/202 manifest remain untouched by this change.

Commits:
- Armor reference batch: `78550418b4a5bfb3fe4f05eb1d031290c87a53eb`
- Armor manifest completion: `6dedbe5bc5ad26413b9e1d642b9dacd55438bffd`
- Armor UI label/routing: `d14af24cd7df53f7eb0b42601877b316a6a4ba5e`

Verification:
- Armor manifest: 32/32 complete.
- All 32 Armor paths: 64×32, non-animated.
- Inventory/icon exclusion scan: clean.
- Remaining runtime-guard workflow verification is pending against the final handoff commit.

Next concrete work: none for the requested Armor UV queue. Continue with Mobs only when explicitly resumed.

## Armor UV workflow — 2026-10-05

- Added a dedicated Armor UV queue containing **32 worn player-armor UV atlases**.
- Inclusion rule: the actual 64×32 armor textures mapped onto the worn player armor model.
- Explicitly excluded inventory/UI assets: all `mcl_armor_inv_*` 16×16 icons, smithing-template icons, trim item sprites, HUD armor graphics and other flat inventory imagery.
- Current included materials: chain, copper, diamond, gold, iron, leather, leather_desat and netherite × boots/chestplate/helmet/leggings.
- Manifest: `prompts/armor/manifest.json`.
- Armor uses the same compact three-stage UV UI as Mobs: HQ UV → reference → Final UV, with armor-specific dynamic material descriptions.
- Manifest commit: `0cc1e659da7c93072da3d1e5ef874986569b768d`.
- UI routing commit: `1f6d8f45499b77da492f61a85fa720ddc977a954`.
- Elytra was not added to this armor queue: the intact texture is 64×32 but is a separate wearable wing/model case; broken Elytra is a 16×16 item texture. Handle Elytra separately if desired.

## Blocks prompt queue COMPLETE — 2026-10-05

- Authored the final Block reference prompts, manifest orders **161–202**.
- Block reference-prompt coverage is now **202 / 202 complete; 0 pending**.
- Final batch: `prompts/blocks/batch_161_202.json`.
- Final set deliberately distinguishes cracked/top/tuff Deepslate roles, live vs dead coral materials, dried-kelp general/bottom/side/top faces, prismarine/sea-lantern, and each wool dye identity.
- Last completed: `wool_yellow.png` (`tex_92f3681369`).
- Block manifest has `next_id=null` and `next_name=null`; there is no remaining Block authoring queue.
- Final 42 prompt commit: `6e281a63748cc3f71d46ceaf3136eac56b31127d`.
- Completion manifest commit: `ffae642f87879e214f962a6b455c98b102bf9080`.
- The dynamic shared Block production prompt remains the production path; per-texture authored files/batches are reference prompts only.

## Block prompt authoring 61–160 + dynamic production template — 2026-10-05

- The standard Image A + Image B Block production prompt is now metadata-aware instead of a fixed literal string.
- It dynamically injects the selected material subject, face/component role and whether the asset should use free four-edge material tiling or preserve component placement.
- The core production philosophy is unchanged: Image A defines semantic/gameplay identity and orientation; Image B dominates actual material appearance; ordinary material blocks may rebuild internal composition; seamlessness is true physical continuation across the outer canvas edges.
- Authored **100 deliberate Block reference prompts**, manifest orders **61–160**.
- Progress: **160 / 202 done, 42 pending**.
- The 100 prompts are stored in `prompts/blocks/batch_061_160.json`; the loader now supports prompt batches while preserving the existing individual-file format for earlier prompts.
- Distinct treatment includes frosted-ice damage stages, stained-glass base vs detail components, sandstone top/side/bottom/carved/smooth roles, stripped-log side vs end-grain top, and individual deepslate ore/material variants.
- Dynamic production prompt commit: `489828091e4a4c7c5665fe1df74c61956aa0d35c`.
- 100-prompt batch: `f2aa2795d0e64079de3afa9e6d8f3e6831eda8a2`.
- Batch loader: `55923dacd66cd43b455b411a32b87111d698ff38`.
- Manifest progress: `fc7de1181e939195b3b76b9c4901557fad058382`.
- Last completed: `mcl_deepslate_tiles.png`.
- Next: `mcl_deepslate_tiles_cracked.png`.

## Mobs Creature Ref authoring — first 30 — 2026-10-05

- Authored deliberate Creature Reference prompts for Mobs manifest entries **1–30**.
- Progress: **30 / 241 done, 211 pending**.
- These are per-texture reference prompts only; shared/dynamic HQ UV and Final UV templates remain centralized in the app.
- Variant identities were deliberately differentiated rather than generated by filename substitution.
- UV-aligned layers were authored according to runtime function: cat collar remains tint-friendly, Charged Creeper is a state/energy overlay, Enderman eyes are an emissive eye layer.
- Last completed: `mobs_mc_horse_chestnut.png` (`tex_be7e0afdef`).
- Next: `mobs_mc_horse_creamy.png`.
- Manifest progress commit: `a8bdd487da26c8c150f0e35c232d4de5e99ad256`.

## Dynamic three-stage Mobs prompt UI — 2026-10-05

- Mobs UV assets now use a compact three-button production UI: `1 · HQ UV`, `2 · Creature Ref`, `3 · Final UV`.
- The app loads `prompts/mobs/manifest.json` at runtime, so only the corrected 241-entry UV queue receives this UI.
- HQ UV and Final UV are shared dynamic templates rather than duplicated per-texture prompt files.
- Templates auto-fill texture identity, runtime role, linked model when known, and a material-family description inferred from the entity/variant.
- Creature Ref is also generated from the selected texture metadata as the starting reference-art prompt; future deliberate per-texture refinements can extend this without duplicating the two structural templates.
- Existing Block/P0 prompt behavior remains separate.
- Implementation commit: `0023c855c6625d4d929291f0857875646bec7bda`.
- Next: verify the three buttons on Android with `extra_mobs_cod.png`, inspect the three copied prompts, then begin deliberate Creature Ref refinement in manifest order.

## Mobs UV queue correction — 2026-10-05

- The first Mobs manifest over-counted assets because it treated broad `ENTITIES/**` inventory as mob UV work.
- The production queue is now restricted to **actual entity/model UV atlases and UV-aligned entity material/state/overlay layers**.
- Variant/state/layer textures remain separate when they occupy model UV coordinates; they are not collapsed into one entry per creature.
- Removed from this queue: particles/effect sprites, HUD/formspec assets, spawn icons/egg templates, projectiles, rails, boats, paintings, potion/UI sprites and other non-UV images.
- Corrected queue: **241 UV textures, 0 done, 241 pending**.
- First/next: `extra_mobs_cod.png` (`tex_4c96b854a2`).
- Manifest correction commit: `59171b75016e3342bb0cfa92463c187deb9b1fd6`.
- Continue sequentially with the two-pass Mobs workflow: strict HQ UV first, then HQ UV as Image A + creature reference as Image B.

## Editor performance / preview cache — 2026-10-05

- Full-resolution imported edits are now preserved in storage. Target resolution is applied for export/scaled derivatives instead of destructively shrinking the saved master edit.
- Main gallery thumbnails are generated at a maximum 192px edge and cached as lightweight object URLs; visible card images use lazy loading + async decoding.
- Detail editor comparison previews are capped at 1024px per edge while downloads/exports continue to use the full stored edit.
- Cached edited-preview URLs are invalidated when an edit changes so stale thumbnails are not reused.
- P0 block prompt manifest/files no longer block first paint; they load after the UI is usable and use browser cache.
- Static verification: both inline JavaScript blocks parse successfully after the change.
- Implementation commit: `925956c4172919d7206931b0a7e2fdd6910fb9f0`.
- Open verification: Android/Pages cold-start and scrolling should be checked after deployment; if memory pressure remains, Variant Lab thumbnails should get the same capped-preview path.

## Production prompt seam correction — 2026-10-05

- Replaced the shared P0 Image A + Image B production prompt. Image A now explicitly defines semantic identity/function/scale rather than exact internal geometry; Image B controls actual material appearance.
- True seamlessness must come from physical continuation of material features across opposite edges. Smoothing, fading, averaging, flattening lighting, reducing contrast and suppressing detail at borders are explicitly forbidden.
- Commit: `29a5bfa5db42c376aa76aa4e3bdf5b80d39c855b`.

## Per-texture block prompt files — 2026-10-05

- Block reference prompts are no longer intended to live only inside index.html. HTML loads completed prompts from `prompts/blocks/manifest.json` and each completed texture has its own `prompts/blocks/<texture-id>.json` file.
- Runtime material-block scope is frozen at **202** textures for this pass: 35 original P0 + 167 P1 textures promoted by the current true-Block rule.
- Progress is explicit: **60 / 202 done, 142 pending**. Do not create placeholder files for pending textures; a per-texture file means its prompt was deliberately authored and reviewed.
- Last completed: `mcl_core_dirt_podzol_side.png` (`tex_776d382769`). Next: `mcl_core_dirt_podzol_top.png` (`tex_cc04d97fd0`).
- The shared Image A + Image B production prompt remains in HTML. Per-texture files contain the authored **reference prompt**.
- First 10 were individually authored around distinct material logic (drought-stressed acacia, humid jungle growth, compact soil, unsorted gravel, layered ice, old cobble, etc.), not generated by name substitution.

Commits:
- loader: `20c4bac52291cf6fe8e44f021c59fbffa350b40b`
- manifest: `25fa5100b31b19d91104c27226b0d415dc40ae3b`

# Texture Studio — Session Handoff

Updated: 2026-10-05

## Current state

- **Priority stays separate:** P0–P6 is only work priority.
- **Browsing classification:** filters use Mineclonia-style creative inventory groups (Building Blocks, Tools, Combat, Foodstuffs, Mobs, etc.) plus deeper technical/runtime classes. A texture may have multiple meaningful classes.
- **P0 promotion:** suitable material Blocks may move from P1 to P0; Functional Blocks and technical/sprite-like assets are not promoted automatically.
- **Prompt workflow:** P0 uses two buttons only. **Ref prompt** creates the artistic/material reference; **Üretim prompt** copies the standard Image A = structure/function, Image B = dominant style reference prompt. No creative-alternative mode.
- **Reference style rule:** describe the grounded dark-fantasy world and material identity, but leave visual surface details to the image model. Do not over-specify the reference image.
- **Orientation rule:** top/side/bottom semantics matter. Tree/log top = cut trunk cross-section/end-grain; side = bark/trunk side. Do not infer foliage or another material from loose name matching.
- **Seam rule:** in the production prompt, only the literal outer canvas boundary is seam-critical; internal contours are not seam boundaries.
- **Variant Lab:** comparison-only. Multi-select any number of PNGs, horizontal thumbnails, 1×1/3×3/6×6 tile preview, mixed mode, and per-variant enable/disable. No prompts in Variant Lab.
- **Runtime semantics:** ambiguous entity/effect/overlay/animation assets must still be resolved from Mineclonia runtime code; runtime behavior wins over filename/folder intuition.

## Next concrete work

1. Audit the remaining P0 reference subjects using the new orientation/material semantics.
2. Spot-check inventory + technical filters on Android while keeping P0/P1 independent.
3. Verify Ref prompt / Üretim prompt copy behavior and Variant Lab multi-PNG/mixed mode after Pages deployment.

## Project

Repository:
`TheOsmanYILDIRIM/mineclonia-texture-studio`

Production:
https://theosmanyildirim.github.io/mineclonia-texture-studio/

Deployment is GitHub Pages from `main` via GitHub Actions. Netlify is not the production source of truth.

Current canonical `main` HEAD before PR #2:
`8e45165ccb132e3d57e48a1c9500e72e05c5c87e`
— `fix: normalize identical textures across resolutions`

Continuity standard:
- `AGENTS.md` defines the working contract for future agents.
- This repository and current `main` are the canonical project state.
- `SESSION_HANDOFF.md` is the concise resume card, not a second source tree.
- Avenox/Beyin stores only a compact pointer/outcome needed to rediscover this repo and continuation point.
- If memory conflicts with current GitHub state, verify `main`; GitHub wins and memory must be refreshed.

## Core direction

Texture Studio edits Mineclonia textures while preserving gameplay structure, UV/mask structure, transparency, animation topology, and source identity.

The visual target is grounded dark-fantasy material realism:
ancient, weathered, somber, muted, tactile, physically believable, restrained saturation, soft diffuse light, realistic micro-detail, and no HD-pixel-art upscaling.

## Prompt-authoring memory

Persistent prompt instructions are stored in:

`PROMPT_AUTHORING_GUIDE.md`

Important rules:

- Generic fallback prompts are intentionally not used.
- Do not infer semantic role only from filename, folder, dimensions, or aspect ratio.
- Before authoring an ambiguous prompt, trace the exact texture filename through Mineclonia source code.
- Runtime code wins over directory naming or same-name model guesses.
- Determine whether the texture is a base skin, variant skin, overlay, tintable layer, marking layer, particle, item mask, animation, node face, HUD layer, etc.
- For particle/effect textures, also determine **when and why the particle appears**, not merely that it is a particle.
- Prompt visual logic should reflect trigger, lifetime, motion, size, glow, tint/compositing behavior, and reuse contexts when the runtime code exposes them.

## P1 prompt state

P1 has 673 textures.

- 193 pre-existing prompts were preserved.
- 480 previously missing prompts were added.
- A second-pass QA/refinement was applied to all 480 generated prompts.
- Coverage after QA: **673 / 673**
- Missing P1 prompts: **0**
- Exact duplicate full prompts: **0**

Relevant commits:

- `3f662441b07617b42ba393b46aa49497c67c6dcd`
  — add prompts for all P1 textures
- `95f1dc0f5d71123672d738aa8a54cb9d36ed5b59`
  — second-pass QA for generated P1 prompts

## Runtime-role classification

The old assumption “ENTITIES/** = entity UV skin” is wrong.

Mineclonia code was inspected to distinguish runtime roles and actual mesh/model relationships.

A runtime-aware classification layer was added to the app.

Commit:
`9b58905fa9bd3715794fbe674932f768ad8761ef`
— runtime-role and model-aware texture classification

The detail view can show:
- runtime role
- linked mesh/model when known
- source-code evidence

A “runtime role” filter was also added.

The previous V5.1 `applyFilter()` override had accidentally dropped the asset-type filter. This was corrected while adding the runtime-role filter.

### Entity-side role map

For the 146 P1 files under `ENTITIES/**`, the currently handled runtime-role mapping has no unresolved entries in the app classification.

Important examples:

### Glow Squid

`extra_mobs_glow_squid.png`
- Role: Entity Base Skin
- Runtime mesh: `mobs_mc_squid.b3d`
- Source: `mods/ENTITIES/mobs_mc/squid+glow_squid.lua`

Important: even though an `extra_mobs_glow_squid.b3d` exists in the Mineclonia repository, the active Glow Squid Lua definition uses `mobs_mc_squid.b3d`. Runtime `mesh = ...` wins over filename matching.

`extra_mobs_glow_squid_glint1.png` through `glint4.png`
- Role: Particle / Effect Sprite
- NOT a body UV atlas
- Used in the Glow Squid's persistent `particlespawners`
- Ambient glow effect around the living Glow Squid
- Not the damage ink jet

Runtime parameters found in code:
- amount: 8
- lifetime: ~1–2 s
- size: ~0.8–1.5
- glow: 5
- small random movement around the creature
- collision detection/removal

Their prompts were rewritten around this real gameplay context.

### Wolf splash particles

`mobs_mc_wolf_splash_0.png` through `splash_3.png`
- Role: Particle / Effect Sprite
- NOT wolf skin / UV overlay
- Reused in two runtime contexts:

1. Wet wolf shake:
   - wolf becomes wet in water or rain
   - after leaving wet conditions and standing on ground, it starts ~1 s shake animation
   - `add_shake_particles()` emits these droplets
   - amount 180 over 1 s
   - upward initial velocity
   - gravity
   - size ~1.5–2.1
   - attached to wolf

2. Terrified villager effect:
   - same four sprite files reused by `terrified_villager_effect()`
   - amount 12
   - lifetime ~0.9–1.5 s
   - size ~1.8–2.8
   - functions visually as panic/sweat-like liquid droplets

Therefore the prompt must stay generic enough to work as both shaken-off water and panic/sweat droplets. It must not paint wolf fur or a large water splash scene.

Prompt-trigger-context refinement commit:
`230315de0a7bff7f8452801641f6824c35cafbd9`

Prompt guide update:
`156716178306c8fbd1d144ac51deb5ed45cae3ac`

### Other code-traced roles

`mobs_mc_creeper_charge.png`
- Entity State Overlay
- mesh: `mobs_mc_creeper.b3d`
- second texture layer with opacity modifier

`mobs_mc_spider_eyes.png`
- Emissive / Eye Overlay
- mesh: `mobs_mc_spider.b3d`
- opacity / makealpha composition

`mobs_mc_enderman_eyes.png`
- Emissive eye overlay on Enderman
- also used by a separate glowing effect entity
- base Enderman mesh: `mobs_mc_enderman.b3d`
- glow helper entity uses `mobs_mc_spider.b3d`

`mobs_mc_cat_collar.png`
- Tintable Entity Overlay
- mesh: `mobs_mc_cat.b3d`
- engine applies collar color using `colorize`
- prompt must remain tint-friendly rather than baking a final collar color

`mobs_mc_wolf_collar.png`
- Tintable Entity Overlay
- mesh: `mobs_mc_wolf.b3d`
- colorized at runtime

`mobs_mc_sheep_fur.png`
- Tintable Entity Material Layer
- mesh: `mobs_mc_sheepfur.b3d`
- wool color is applied by the engine

`mobs_mc_sheep_sheared.png`
- Tintable Entity Overlay / sheared layer
- composed with sheep base

`mobs_mc_horse_markings_*.png`
- Entity Marking Overlays
- mesh: `mobs_mc_horse.b3d`
- combined with base horse coat

`mobs_mc_pig_saddle.png`
- Reusable Equipment Overlay
- used on pig and also reused by Strider code
- linked meshes include `mobs_mc_pig.b3d` and `extra_mobs_strider.b3d`

Villager and Zombie Villager assets were separated into:
- Entity Base Layer
- Entity Biome Overlay
- Entity Profession Overlay

These layers are composed at runtime by `get_overlaid_texture()` and must remain stack-compatible.

Wolf assets were separated into:
- coat/variant skin
- angry/tame state skin
- tintable collar overlay
- particle splash sprites

`mobs_chicken_egg.png` is not an entity skin:
- used as a spawn-egg inventory template/mask in `mcl_mobs/init.lua`

## Entity 3D preview

The previous Piglin/B3D browser 3D-preview experiment was intentionally removed.

Do NOT resume it unless explicitly requested.

Attempted methods included B3D→GLB conversion, Irrlicht/OBJ, Assimp, WASM experiments, runtime material replacement, and packaged-texture GLB. Geometry could render, but reliable Mineclonia texture/material mapping in-browser was not completed.

The original B3D source still exists in the project where relevant, but the experimental viewer/assets/workflows were removed.

## Entity textures and animation detection

Entity textures must not be treated as animation strips merely because dimensions form an integer strip ratio.

Current logic explicitly excludes `assetTypeOf(x) === 'Entity'` from strip detection.

However runtime semantics take priority over folder semantics: particle sprites under `ENTITIES/**` are classified as effects, not entity UV skins.

## Animation atlas workflow

The previously open high-resolution animation atlas reconstruction problem is solved.

Relevant commits:
- `6bc1db9fa9fa20c860df1a49230b1bc193b6f707`
  — preserve high-resolution animation atlas cells when rebuilding strips
- `816b65c9d94b5ac278a9f370c913f8b40f135bc0`
  — preserve animation atlas resolution and add pinch zoom preview

Current intended behavior:
- strip → square atlas for AI editing
- imported edited atlas may be higher resolution
- infer edited cell resolution from the imported atlas
- reconstruct the strip at the edited resolution
- do not force back to original 16px frame size

## Comparison preview

Pinch zoom/pan support was added to the main Original/New comparison preview.

The intent:
- two-finger pinch zoom
- pan while zoomed
- Original and New transform together
- comparison clip remains functional
- preview manipulation never changes texture data

## Detail close button

The mobile close button unreliability was diagnosed and resolved:
- **Root Cause**: The previous `bf0a5b2` fix registered both `click` and `pointerup` handlers on `#close`. On touch devices, `pointerup` fired and removed `.open` (`display: none`), immediately unmasking the background grid. The browser's synthetic `click` at the touch coordinates then fell through to the underlying `<button class="card">`, triggering `card.onclick -> openDetail()`, instantly reopening the sheet.
- **Fix**: Replaced dual `click`/`pointerup` bindings with a single canonical `closeDetailSheet()` triggered via `closeBtn.onclick` (with `preventDefault` & `stopPropagation`). Added `type="button"`, `aria-label="Kapat"`, and styling (`flex-shrink:0; position:relative; z-index:2; touch-action:manipulation; pointer-events:auto`) to ensure clear layering and touch handling. Extracted binding to `bindDetailSheetEvents()`.
- **Verification**: Verified JS syntax with Node.js and simulated click propagation/tap-through and backdrop click behaviors.

Relevant commits:
- `71c13828a077428a26deda116102fee86c7bb1d5` — restore texture detail close button
- `bf0a5b2fe9a455f4fd54365af9e61da85bb88892` — initial mobile close button attempt
- `e0ed308` — streamline mobile close button with single canonical click activation

## README

The live site URL was added to `README.md`.

Commit:
`657a39c36af8b4cbd046a82253476ef7cc4e4e44`

## Most important design lesson

Do not ask “what does this filename sound like?”

Ask:

1. Where is this exact filename referenced?
2. Which Lua registration/function uses it?
3. Which mesh/model receives it?
4. Is it standalone, composited, tinted, animated, or a particle?
5. If a particle: exactly what gameplay event/condition spawns it?
6. What are lifetime, amount, size, velocity, acceleration, glow, attachment and reuse contexts?
7. How should those runtime facts change the visual prompt?

The prompt must describe the asset's **actual gameplay job**, not merely its apparent visual subject.

## Continuity standardization completed

- Added `AGENTS.md` with source-of-truth, prompt, runtime-role, deployment, and handoff rules.
- Corrected `README.md` so GitHub Pages / `main` is clearly canonical and Netlify is legacy/supporting only.
- Repo remains the authoritative home for detailed project knowledge; Beyin should carry only compact continuity pointers.

Relevant commits:
- `1f5bf0053d45705787d825f086a08f3f226fe759` — add canonical agent workflow and Brain handoff rules
- `89d30348bae45a4496cb243b8948c907d717f1aa` — make GitHub the canonical project source

## Detail close-button fix — 2026-10-04

The mobile/detail × close path is now hardened in two steps:

- `80bcdee63aa45f04c74ecb6088ebcd6403e42d69`
  — centralized the close flow in `closeDetail()` and removed the old click + pointerup double-close path.
- `0b67c73db8fc133b0fa5a91ac630552ee23e0f65`
  — made the close header sticky, gave the × control an explicit 44×44 mobile touch target, raised it above gesture/preview layers, and reduced activation to one normal `click` listener.

The previous implementation mixed pointer-specific handlers around a small control inside a scrollable touch drawer. The current implementation uses one close function and one activation path; backdrop and Escape still reuse the same close behavior. Closing also stops animation, resets preview gesture state, and clears the active texture.

Verification after the latest commit:
- both inline JavaScript blocks parse successfully;
- exactly one × click listener is present;
- no × pointerdown/pointerup listener remains;
- backdrop close remains wired;
- the close button is `type="button"` and has a dedicated mobile hit target.

Physical Android tap verification on the deployed page is still required before calling the device behavior fully verified.

## Prompt transparency enforcement — 2026-10-04

All effective app prompts now receive a mandatory transparency/background requirement at prompt-output time.

Code commit:
- `7ade4f3893b352cc3a457890f38a6215850032c6`
  — adds a shared transparency suffix for every prompt and an additional locked-alpha atlas rule for Entity assets.

Guide commit:
- `2e93aaf4db9d8bd340fcb7deb9819fe76a19bd76`
  — records the mandatory transparency-output standard.

Behavior:
- built-in prompts, manual/JSON overrides, single-prompt export, and bulk prompt export all receive the rule through `promptFor()`;
- source-transparent/empty regions must remain transparent;
- solid/colored/scenic backgrounds are explicitly forbidden;
- Entity UV atlases additionally treat transparent space outside islands as locked;
- duplicate suffixes are prevented by marker checks.

Static verification: the current inline JavaScript parses successfully after the change.

## Entity UV/alpha drift correction — 2026-10-04

Production testing showed that generic transparency wording reduced UV-map consistency by encouraging the image model to redraw or clean up alpha edges.

Current rule:
- entity atlases do NOT receive the generic transparency/background instruction;
- entity alpha is treated as read-only structural data;
- visual edits are RGB/material replacement strictly inside the existing occupied mask;
- no alpha-value changes, edge smoothing, anti-aliasing, feathering, erosion/dilation, island expansion/contraction, halo, outline, or regenerated silhouette;
- exact UV/alpha alignment wins over realism and transparency aesthetics.

Relevant commits:
- `96ce3fd35f4f6e9223be2d765dde7f4a349b9426` — lock entity UV masks before transparency
- `078fe282c089e92e31d52af981ecbc09b8b9c229` — make entity alpha channel read-only

Inline JavaScript syntax parsing passes after the change.

## Texturepack ZIP export performance — 2026-10-04

The previous export path was expensive on mobile because it:
- re-compared every saved edit against the original texture at export time;
- synchronously generated missing scaled copies while exporting;
- then DEFLATE-compressed thousands of PNG files even though PNG data is already compressed;
- gave almost no visible progress during the slowest phase.

Fixed in:
- `e8358dc6f04d294a6967c657838c02a30e6eb96c`
  — `perf: make texturepack export fast and observable`

Current behavior:
- export reads the already-saved edit set directly;
- uses an existing target-resolution cache when present, otherwise packages the saved edited PNG without blocking to rescale it;
- stores PNG entries with ZIP `STORE` instead of wasting CPU recompressing PNGs;
- updates the Texturepack ZIP button and save-status text throughout preparation and ZIP generation;
- yields to the browser periodically so Android UI remains responsive;
- surfaces a real error message if ZIP generation fails.

Static parsing of both inline JavaScript blocks passed after the change.

## Texturepack ZIP export fix — 2026-10-04

Texturepack export was slow/silent because it first compared every edited PNG against the original byte-by-byte and then recompressed already-compressed PNG files with DEFLATE level 6 on-device.

Fixed in:
- `3f54862ce0d960feab31844fc7780f2279fc321d`
  — `fix: make texturepack export fast and visible`

Current export behavior:
- waits for pending edit writes to settle;
- exports the edit store directly instead of refetching/comparing every original;
- stores PNGs in ZIP with `STORE` (no redundant recompression);
- uses streaming ZIP generation;
- shows file-count progress first, then ZIP percentage on the export button/status line;
- disables the export button while a ZIP is being built;
- restores the normal button/status state on success or failure;
- backup ZIP export also uses `STORE`.

Verification:
- both inline JavaScript blocks parse successfully;
- Texturepack export no longer contains DEFLATE;
- progress callback and pending-write wait are present.

## Next concrete work

1. After PR #5 deploys, open the Android site once and let legacy/unknown records finish the one-time verification pass.
2. Confirm the changed counter settles near the real edited count and subsequent reloads skip known changed records.
3. Use P2–P6 reset now if those priorities should not carry any stored edits while work is still in P1.
4. Verify 128 density behavior on both a 16×16 block and a 64×32 entity atlas.
5. Continue P1 runtime-role/prompt work only after these storage/scaling checks pass.
## UI regression fix — 2026-10-04

A live UI regression (white main background and visually lost top/bottom controls) was traced to unresolved Git merge conflict markers accidentally committed inside `index.html` around the main stylesheet and detail-sheet markup. The browser therefore parsed the style block inconsistently.

Fixed in:
- `b0d9508939b93fc41c65805222ce2a364e360253` — resolve stylesheet conflict and restore dark UI

Verification:
- no `<<<<<<< / ======= / >>>>>>>` markers remain;
- both inline JavaScript blocks parse successfully;
- dark page background, top bar, bottom bar and button theme rules are present;
- the close button remains `type="button"` with the simplified mobile-safe interaction.


## UV/alpha prompt correction — 2026-10-04

Production feedback showed that the earlier generic transparency suffix reduced entity UV-map edge fidelity. The app now treats entity alpha/UV geometry as the highest-priority locked structure and no longer appends the generic transparency/background block to entity prompts.

Relevant commits:
- `96ce3fd35f4f6e9223be2d765dde7f4a349b9426` — lock entity UV masks before transparency
- `4959fe6478af4e43c9547887993f2e00c59f49f3` — document exact UV/alpha priority
- `96a243810561857fdf727599eaf97ca08f6aa557` — pin dark app surfaces on mobile

Entity prompt rule now explicitly forbids edge expansion/contraction, feathering, blur, anti-aliasing, erosion/dilation, gap bridging, halo/background creation, and any repaint across the source mask boundary. Exact source UV alignment wins over realism and transparency aesthetics.


## Entity UV consistency hardening — 2026-10-04

User testing showed that even the stricter transparency wording could reduce UV-edge consistency because the image model was still being asked to reason heavily about transparency/mask reconstruction.

The fix is now structural rather than prompt-only:

- `8aca51587cb0adcbb18caaaea3841f30940ddd32` — Entity imports now replace generated alpha with the original source texture alpha mask. Generated RGB/material detail is preserved; source alpha is authoritative.
- `c1b418d4ee052d6dac425e08a87594d301c709bf` — Entity prompt suffix was shortened to a compact UV/alpha lock and Entity seam-offset editing was disabled.
- `a3f72ebe13d6e825c4d06e141f4665bba4363ebc` — prompt guide updated to avoid long repeated transparency instructions for Entity atlases.

Current Entity invariant:
- source UV geometry and alpha mask are authoritative;
- prompt asks only for RGB/material replacement within the existing structure;
- on PNG/ZIP import, source alpha is reapplied with nearest-neighbor scaling to the edited image dimensions;
- no Entity seam-offset transform is allowed;
- no generic long transparency suffix is stacked onto Entity prompts.

Verification:
- both inline JavaScript blocks parse successfully;
- no merge-conflict markers remain;
- dark mobile theme pinning remains present;
- Entity alpha-lock helper is wired into single PNG import and ZIP import.

## Texture target resolutions + ZIP export — 2026-10-04

- Texture target selector now supports **64 / 128 / 256 / 512 px**.
- Selected target remains a downscale ceiling: larger imports are reduced with the existing Lanczos path; smaller source images are not upscaled.
- Backup restore accepts all four target values and scaled-cache cleanup covers all four sizes.
- Texturepack export no longer performs original-vs-edit byte comparisons. It exports the app's recorded edits directly, waits for pending edit persistence, stores PNGs in ZIP without redundant DEFLATE recompression, and shows file/progress status during generation.

Resolution support commit:
- `4a16b72e7ff8976fee4e056e1399eabe7dc4dfe8` — add 64px and 128px texture targets


## Resolution + unchanged-texture fix — 2026-10-04

Commit:
- `428d8043e16d0f2700e8766c3d4711a3020780f3`
  — `fix: enforce target resolution and ignore unchanged textures`

What changed:
- The final/runtime-winning `importPng()` now calls `prepareImportedTextureBlob()`, so the selected 64/128/256/512 target is actually applied instead of being bypassed by a later override.
- ZIP import uses the same normalization path before storing textures.
- Persisted textures are compared once against their canonical originals during changed-state hydration; byte-identical PNGs are not marked changed.
- ZIP export now uses `changedPathsFast`, so exact-original records left in storage are excluded without repeating expensive comparisons during export.
- Direct single-file import also rejects a byte-identical original as a change.

Verification:
- Both inline JavaScript blocks parse successfully.
- The runtime-winning import path contains `prepareImportedTextureBlob(file,target)`.
- ZIP import contains `prepareImportedTextureBlob(blob,meta)`.
- Export filters by `changedPathsFast`.
- 64/128/256/512 options are all present.

Workflow note:

## High-resolution animation preview fix — 2026-10-05

Restored high-resolution animation atlases could look correct in the main Original/New preview while the live animation canvas below rendered black/incorrect frames.

Root cause:
- animation preview and strip-to-atlas export used the catalog/original frame size (for example 16px) even after the saved strip had 128px or 256px frames;
- frame cropping therefore sampled the wrong regions of the high-resolution strip.

Branch fix:
- `164f02f52597eba6b71699ea82f7cf288af31c60` — derive frame size and strip trims from the actual saved strip dimensions for both live preview and strip-to-atlas export.
- `915ac13f2042cbacc9686a36f2b56f82836c53c4` — add runtime regression guards for high-resolution animation frame geometry.

Runtime guard run #23 passed. After merge/deploy, verify one edited high-resolution animation atlas on Android: upper comparison preview and lower live animation should show the same edited frames.

## Late-loaded thumbnail refresh fix — 2026-10-05

A startup race remained after storage hydration was moved off the critical path: the first render could cache the original texture under the edited-thumbnail cache key (`e:<path>`) before IndexedDB edits were available. When persisted edits arrived later, the cache key remained valid, so cards kept showing the default/original thumbnail even though the edit record had loaded.

Branch fix:
- `4e40959ca487a82a47bd576ef17f512172f0c783` — persisted edits now populate `hotEdits`, replace stale `e:` object URLs, and refresh visible cards immediately.
- `ffe82597dd929ab0eb568655e6e863d4d58e0453` — runtime regression guard verifies late-loaded thumbnail installation and cache invalidation.

Hydration behavior:
- persisted edit blobs are installed locally without waiting for remote originals;
- visible cards switch to the edited thumbnail immediately;
- exact-original verification continues in the background;
- if a persisted record is proven identical to the original, its changed badge is removed and the edited cache entry is invalidated.

PR #4 runtime guard completed successfully. Merge PR #4 to `main`, then verify on Android after Pages deployment.

## Startup/storage hang fix — 2026-10-04

The first-load “kayıt hazırlanıyor…” hang was traced to startup synchronously awaiting changed-state hydration. That hydration can fetch the original Mineclonia texture for every persisted edit and compare pixels, so slow/stalled upstream requests kept the UI in the preparing state indefinitely.

Branch fixes:
- `678e50e2f6a3dba07bdc402a5cbcacbbbe40bfbe` — make startup/storage initialization nonblocking.
- `fe0adab532c47cf481614200ac5ee9f287e3e701` — extend regression guards to startup/storage behavior and inline-JS syntax.

Current behavior:
- filters, controls, detail bindings, and first render are initialized before storage hydration;
- the status immediately leaves the indefinite “preparing” state and reports background loading;
- primary and scaled IndexedDB opens fall back after 2.5 seconds instead of hanging forever;
- original Mineclonia texture fetches abort after 12 seconds;
- persisted edit paths are surfaced quickly, then exact unchanged/original detection runs in the background;
- Texturepack export waits for changed-state verification and pending writes before packaging;
- background verification failures conservatively keep an edit marked changed rather than silently losing it.

GitHub Actions runtime guard run #4 passed on the startup fix and also parses the inline JavaScript for syntax errors.

## Resolution/runtime-override regression status — 2026-10-04

PR #1 was squash-merged to `main` as:
- `8e45165ccb132e3d57e48a1c9500e72e05c5c87e` — cross-resolution identical-texture comparison.

Verified on current `main` after that merge:
- runtime-winning single PNG import uses `prepareImportedTextureBlob(file,target)` and `textureMatchesOriginal(b,target)`;
- runtime-winning ZIP import uses the same normalization and unchanged detection;
- runtime-winning Texturepack export filters through `changedPathsFast` and re-normalizes each changed PNG to the selected target;
- normalization remains a downscale ceiling and does not upscale textures already within the target.

A remaining duplicate-function override was then found: the final/runtime-winning `importProjectBackup()` still accepted only 256/512 even though an earlier definition had been updated for 64/128/256/512.

PR #2 was squash-merged to `main` as `2cb178b850bba9eb89bb22ecfbeed67da1069b32` (`fix: harden texture startup and resolution runtime paths`). Main runtime guards and the GitHub Pages deployment both completed successfully. Remaining verification is device-side Android behavior and a real export using the user's persisted edits.

## Persistent changed-state + density-aware scaling — 2026-10-05

Branch/PR: `fix/verified-changes-and-density-scaling` / PR #5.

Changed-state model:
- persisted edit records carry `verification: changed` once confirmed;
- new PNG edits are persisted as verified changed immediately after their import-time original check;
- startup trusts known `changed` records and does not recompute them;
- only legacy/unknown records are rechecked, with 8 bounded concurrent workers;
- records proven equivalent to the original are permanently removed from edit storage and scaled cache;
- failed verification remains pending/unknown and is not counted as changed;
- the visible counter reports verified changed separately from “doğrulanıyor”.

Resolution model:
- 64/128/256/512 now mean the target density for a native 16px texture unit, not the literal width of every file;
- target dimensions scale both original axes from catalog-native dimensions;
- examples at 128: 16×16 block → 128×128, 64×32 entity atlas → 512×256, 32×64 atlas → 256×512;
- malformed aspect output is fitted back to source aspect ratio without upscaling: e.g. 256×256 generated for a 64×32 entity becomes 256×128, not 512×256;
- visually equivalent legacy rescale drift is tolerated when deciding whether an old record is actually unchanged.

Management:
- Prompt/backup manager now includes P0–P6 edit reset buttons and a fast P2–P6 reset.
- These bulk-delete only stored texture edits + scaled cache for those priorities; prompts are preserved.

Key commits:
- `84ebcbf57c5fc673839eaf333ea138ed11fb5a4f` density scaling
- `150bc47975c60e1bc5857c05fa0ea5e836917e49` tolerant unchanged detection
- `905eb740de2642c1fd509e6718bf6061faa3d23f` verified-only counter
- `5a729bbb1ede4c48ae5e6b151fc6aef6f32c1173` persistent verification + unknown-only concurrent scan
- `ad05796726bb5286cfe69ca6d5d8fe16617a2c6b` priority reset controls
- `e8664a3306274b49eb961d30e176988b99ed6208` no-upscale source-aspect fitting
- `3cd7093873ded451a331bab6673acf0a970f1ff4` final regression guards

PR #5 was squash-merged to `main` as `ac312ef5295dbda0116cb497f6fdd6102168196f` (`fix: persist verified changes and scale by source density`). Main runtime guards and GitHub Pages deployment both completed successfully. Remaining checks are device-side: let the one-time legacy/unknown verification finish, confirm later reloads skip known changed records, use P2–P6 reset if desired, and spot-check density scaling on block/entity assets.



## Mobile toolbar cleanup — 2026-10-05

Branch: `fix/mobile-toolbar-layout`.

Observed on Android: the search field collapsed to a tiny pill because six controls were squeezed into the legacy four-column toolbar grid. The recently added runtime-role select also read like a duplicate/invalid general filter on mobile.

Changes:
- search now owns a full-width first row on mobile;
- remaining controls use a readable two-column grid;
- desktop gets an explicit five-column layout;
- the runtime-role select was removed from the top toolbar while runtime-role classification/detail metadata remains intact;
- stale `runtimeRole` DOM/filter bindings were removed so the toolbar cannot throw after the select is gone.

Commits:
- `491ad01ef9ec636d1545db480dbf274b88196470` — responsive toolbar layout and remove duplicate role select
- `cd88cf425c13bbbac462e8ce0b063741f9f879dd` — remove stale role-filter bindings

Next check: run runtime guards on the PR, then verify Android search width and that category/type/resolution/changed filters remain functional.


## P0 creative prompt alternatives — 2026-10-05

Branch: `feat/p0-creative-prompts`.

User feedback: the existing texture prompts over-constrained the image model and reduced creative variation. Existing P0 prompts must remain intact.

Implemented:
- kept the original 41-entry `P0_PROMPT_LIBRARY` unchanged;
- added a separate 41/41 `P0_CREATIVE_DIRECTIONS` set with shorter, art-direction-first prompts;
- creative prompts preserve only hard runtime constraints (gameplay role, tile/alpha behavior, animation topology) and deliberately leave more room for material reinterpretation, weathering, color nuance, age and environmental storytelling;
- detail view now has a `Yaratıcı alternatif` / `Mevcut prompt` toggle for P0 assets;
- creative mode is read-only in the UI so it cannot overwrite the existing saved/classic prompt;
- Prompt JSON manager can export `mineclonia_P0_creative_prompts.json` separately;
- normal all-prompts and P0 exports continue to use the classic prompt set.

Coverage verification: 41 classic P0 IDs, 41 unique creative P0 IDs, no missing or extra IDs.

Commits:
- `4c5f9e2f42dec573e9c7edcf10314e3593b449e5` — creative P0 library, toggle and export
- `4e636891c2c5eb3dcb264ecb408e390f406e6b75` — insertion cleanup

Next check: runtime guards, then Android spot-check of one leaf, one wood/stone and one animation asset in both classic and creative prompt modes.


## Creative P0 macro-composition reset — 2026-10-05

User clarified the creative goal: the pack is not trying to make the original Mineclonia textures HD. The main failure mode was full-square textures inheriting the old texture's large cracks, patches, stones, knots, stains, veins, tonal islands and other macro features too faithfully.

Fix:
- creative mode now explicitly states that it is NOT an HD remake or faithful reconstruction;
- source macro-composition is not preserved by default;
- full-square material textures receive a strong `MACRO-COMPOSITION RESET` instruction to regenerate major forms and spatial distribution;
- similarity should come from gameplay material identity, not source layout matching;
- alpha/UV/frame structure remains locked only where functionally required.

Commits:
- `114015de7ee591aa4068f276a190a370fee53dcb` — reset macro composition in creative prompts
- `f247cfc7bf196c265a191bb7e0f98851cefd4158` — document creative composition reset


## Variant Lab — source-strategy comparison — 2026-10-05

Branch: `feat/variant-lab`.

Purpose: compare three generation strategies for the same texture before choosing the version that becomes active in the main app.

Modes:
1. Original PNG reference — source image is provided for identity/seam behavior, but prompt explicitly rejects source macro-composition copying.
2. Current generated PNG reference — the app's currently edited texture is provided as the second-pass seed; prompt asks to preserve its new composition while pushing style/material quality.
3. No image reference — prompt-only generation from scratch; maximum freedom with explicit seamless/tile warning.

UI:
- new `Varyant Lab` entry in the bottom bar and texture detail actions;
- texture selector inside the lab;
- reference preview/download where applicable;
- per-mode prompt copy;
- per-mode PNG result upload;
- fast visual comparison in three cards;
- `Aktif yap` marks a winner and writes that blob through the normal texture-edit persistence path, so the main grid/export uses the selected result.

Non-winners remain temporary comparison drafts for the current page session; the chosen winner is persisted as the normal active edit.

Commit:
- `78d596771c63dcce452b7a215b2dc94ee33a29aa` — add Variant Lab comparison page.

Next check: runtime guard + Android UI spot-check, then merge/deploy.


## Variant Lab UX refinement — 2026-10-05

User feedback: the first Variant Lab was too tall and did not make seamless comparison fast enough.

Refined behavior:
- the three generation strategies are now horizontal tabs: Original / Yeni ref. / Görselsiz;
- only the selected mode is open at a time instead of three stacked cards;
- one large result stage is shown for the selected mode;
- 1×1 / 3×3 / 6×6 buttons instantly switch the same result into tiled repeat view for seam inspection;
- switching among the three generation methods is one tap while keeping the selected tile zoom mode;
- prompt text is collapsed by default inside a minimal `Prompt ▾` disclosure;
- reference/download/upload/activate controls stay compact under the stage;
- active winner is marked in the selected mode.

Commit:
- `1593cfcb53f0c12d095b21ea15dd19c4612cd7a1` — tabbed Variant Lab + 1×1/3×3/6×6 seamless preview.
