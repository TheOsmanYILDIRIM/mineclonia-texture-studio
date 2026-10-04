# Texture Studio — Session Handoff

Updated: 2026-10-04

## Project

Repository:
`TheOsmanYILDIRIM/mineclonia-texture-studio`

Production:
https://theosmanyildirim.github.io/mineclonia-texture-studio/

Deployment is GitHub Pages from `main` via GitHub Actions. Netlify is not the production source of truth.

Current main HEAD at this handoff:
`bf0a5b2fe9a455f4fd54365af9e61da85bb88892`
— `fix: make detail close button reliable on mobile`

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

The user later reported that the × close button did not work on mobile.

This was fixed on main in two commits:

- `71c13828a077428a26deda116102fee86c7bb1d5`
  — restore texture detail close button
- `bf0a5b2fe9a455f4fd54365af9e61da85bb88892`
  — make detail close button reliable on mobile

At this handoff the close-button issue is considered patched in code. The next session should verify it on the live Android site before changing it again.

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

## Next concrete work

1. Open the live site on Android and verify the × close-button fix from `bf0a5b2...`.
2. Continue runtime-role auditing beyond entity assets, especially ambiguous P1 ITEMS/effects/overlays:
   - trace exact filename in Mineclonia source
   - identify node/item/HUD/particle/overlay/state/tint behavior
   - identify relevant mesh/model or node registration when applicable
   - identify trigger/event semantics for effects
3. Revise any P1 prompt whose current semantic assumptions conflict with runtime code.
4. Preserve `PROMPT_AUTHORING_GUIDE.md` as the persistent methodology and extend it when new semantic asset classes are discovered.
5. Do not regress the completed animation atlas/high-resolution or pinch-zoom work.
