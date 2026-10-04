# Texture Studio — Session Handoff

Updated: 2026-10-04

## Project

Repository:
`TheOsmanYILDIRIM/mineclonia-texture-studio`

Production:
https://theosmanyildirim.github.io/mineclonia-texture-studio/

Deployment is GitHub Pages from `main` via GitHub Actions. Netlify is not the production source of truth.

Repository state immediately before this handoff refresh:
`89d30348bae45a4496cb243b8948c907d717f1aa`
— `docs: make GitHub the canonical project source`

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

## Next concrete work

1. Verify the mobile close button on the live Android site after Pages deployment.
2. Continue runtime-role auditing beyond entity assets, especially ambiguous P1 ITEMS/effects/overlays:
   - trace exact filename in Mineclonia source
   - identify node/item/HUD/particle/overlay/state/tint behavior
   - identify relevant mesh/model or node registration when applicable
   - identify trigger/event semantics for effects
3. Revise any P1 prompt whose current semantic assumptions conflict with runtime code.
4. Preserve `PROMPT_AUTHORING_GUIDE.md` as the persistent methodology and extend it when new semantic asset classes are discovered.
5. Do not regress the completed animation atlas/high-resolution or pinch-zoom work.

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
