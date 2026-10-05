# Mineclonia Texture Studio — Prompt Authoring Guide

Updated: 2026-10-04
Purpose: persistent instruction for future sessions that prepare AI texture-edit prompts for this project.

This document is about **prompt authoring only**. It does not define application architecture or 3D preview work.

## 1. Core principle

Every texture prompt must protect the texture's **gameplay function and structural identity first**, then replace only its low-resolution surface information with higher-detail material information.

The source texture is not a picture to redraw freely. It is a functional game asset.

Priority order when rules conflict:

1. gameplay function
2. UV / mask / transparency / animation structure
3. recognizability and source identity
4. tileability or icon readability where applicable
5. material realism
6. decorative detail

Never sacrifice a higher-priority property for realism.

## 2. Shared visual target

The common pack language is:

- grounded dark-fantasy material realism
- ancient, weathered, somber, muted
- tactile and physically believable
- slightly dirty / environmentally aged when appropriate
- soft diffuse lighting
- low-to-medium contrast
- restrained saturation
- realistic micro-detail
- subtle weathering

Avoid:

- HD pixel art
- enlarged square pixels
- blocky brush strokes
- voxel-like surface detail
- cartoon shading
- clean stock-photo appearance
- strong baked directional light
- glossy highlights unless materially necessary
- fantasy glow unless the asset itself requires restrained emission
- fake deep 3D relief
- excessive photographic noise
- scene context or perspective

## 3. Never upscale the pixel pattern

The original pixels are a structural/material reference, not shapes that should simply be enlarged.

Prompts should explicitly state, when relevant:

- do not preserve or upscale the original pixel shapes
- replace low-resolution pixel information with continuous natural material detail
- preserve broad composition, density, tonal distribution, directionality, color family, transparency and functional structure

The desired result is realistic material information occupying the same gameplay role, not a sharpened version of the source pixels.

## 4. No generic fallback prompts

Do not silently generate a generic prompt for an uncovered texture.

The current project deliberately uses a **PROMPT YOK / missing prompt** state rather than treating a broad material guess as final.

Every production prompt should be intentionally authored for that texture or for a genuinely equivalent controlled variant.

Related textures may share the common visual language, but the asset-specific instructions must remain appropriate to the exact asset.

## 5. Mandatory inspection before writing a prompt

Before authoring, inspect as many of these as are available:

- texture ID
- exact path
- filename
- asset type
- width and height
- transparency / alpha behavior
- whether it tiles
- whether it is top, side, bottom, overlay, item, plant, entity UV atlas, or animation
- source composition and directional rhythm
- gameplay role
- relation to sibling textures from the same object/material

Do not decide the prompt from filename alone when the image or structural role shows something more specific.

## 6. Block textures

For ordinary block surfaces:

- keep the texture flat and game-ready
- preserve block-distance readability
- preserve broad source composition and directional rhythm
- preserve the recognizable color family, usually in a more muted form
- maintain seamless/tileable behavior where applicable
- do not introduce scene lighting, perspective, cast shadows, protruding objects, or dramatic relief

Write material-specific detail rather than saying only “make realistic.”

Examples of useful specificity:

- bark: continuous bark grain, fissures, species-specific rhythm, age staining
- stone: mineral grain, shallow fractures, restrained tonal variation
- cobble: separate worn stone masses, shallow joints, cohesive assembly
- wool: interwoven fibers, felted surface, contained fuzz, matte finish
- sand: compact fine grains, mineral variation, restrained contamination
- glass: source transparency logic, restrained clouding/waviness/grime
- clay: fine-grained compact earth, subtle drying variation
- obsidian: volcanic glass, conchoidal fracture logic, deep muted mineral tones

## 7. Top / side / bottom variants

Do not write one generic material prompt and paste it onto all faces.

Respect the semantic role of the face:

- top may show end grain, cut surface, radial structure, compressed top layer, growth rings, etc.
- side may show vertical grain, stratification, bark, earth body, construction rhythm, etc.
- bottom may be darker, more compressed, less decorative, or materially different if the source indicates it

Sibling faces should feel like the same object while preserving their distinct structural jobs.

## 8. Functional blocks

Doors, chests, furnaces, crafting tables, panes, fences, torches and similar functional blocks must keep visual cues that communicate their role.

Do not let realism erase:

- borders
- openings
- panel divisions
- hinges / seams / bands when represented
- face-specific functional regions
- transparency patterns
- recognizable construction rhythm

Functional readability wins over surface richness.

## 9. Items and HUD-like assets

Items are not ordinary tileable blocks.

Preserve:

- exact silhouette
- transparent background
- occupied vs empty regions
- icon-scale readability
- distinctive object identity
- orientation

Do not turn an inventory item into a scene, product photo, floating object with cast shadow, or background composition.

Material detail must stay inside the original silhouette/mask.

## 10. Plant / foliage textures

Preserve:

- transparency-mask logic
- broad foliage density
- occupied/empty regions
- gameplay readability
- organic breakup without filling major source gaps

Avoid large focal leaves, scene depth, oversized branches, glossy decorative foliage, and dense photographic clutter.

When the texture is intended for engine tinting, do not bake a strong final hue into the image. Produce a neutral or tint-friendly value/material map as required by that asset.

Species identity may affect:

- leaf scale
- density
- dryness
- color tendency
- needle vs broadleaf structure
- environmental aging

## 11. Entity textures — special locked-UV rule

**ENTITIES/** textures are structural UV atlases, not ordinary images and not animation strips.

Treat every UV island as a locked mask.

Absolute priority:

- preserve exact UV layout
- preserve island positions
- preserve island sizes
- preserve island orientation
- preserve spacing
- preserve transparency
- preserve occupied and empty regions

Never:

- move an island
- rotate an island
- resize an island
- merge or split islands
- crop/repack the atlas
- extend painted material beyond the original mask
- invent geometry/body parts through texture painting

For character/entity identity, preserve all structural landmarks represented in the atlas: face placement, eyes, snout/mouth areas, ears, limbs, torso segmentation, clothing coverage, asymmetry, markings, etc.

The prompt is a **surface/material replacement**, not a redesign.

For Piglin-like entity prompts specifically, the source entity must remain unmistakably the same entity. Do not humanize, cute-ify, demonize, exaggerate anatomy, extend tusks/ears/fingers, or invent accessories beyond the original masks.

Entity prompts should explicitly say that anatomy and proportions are not being redesigned.

## 12. Entity dimensions must not imply animation

Do not classify an entity texture as an animation merely because width/height form an integer strip-like ratio.

The application already follows this rule: Entity assets are excluded from animation-strip detection.

Prompt writing must follow the same rule.

## 13. Animated textures

Long animated textures are handled as animation atlases for AI editing.

The prompt must state:

- the image is an animation atlas, not a single texture
- each square cell is one frame
- preserve exact frame count
- preserve exact frame order
- preserve grid/cell boundaries
- never merge adjacent frames
- maintain neighboring-frame continuity
- maintain coherent looping motion

Material direction should be animation-specific.

Examples:

- lava: slow viscous flow, hot channels, heavy molten movement
- water: coherent liquid drift, restrained ripple/turbulence
- fire: upward flicker, heat turbulence, living flame rhythm

Avoid random frame-to-frame redesign, camera/scene changes, unrelated lighting changes, or decorative elements that break loop coherence.

When realism conflicts with animation clarity, animation clarity wins.
When detail conflicts with loop consistency, loop consistency wins.

Do not encode assumptions about the original low resolution into the prompt. The edited atlas may be higher resolution; structure/frame topology must remain the same while detail resolution may increase.

## 14. Transparency and masks

When alpha exists, explicitly preserve its functional logic.

**Important correction from production testing:** transparency instructions must never encourage the model to redraw, clean up, smooth, or reinterpret UV/mask edges. For entity atlases, exact UV/alpha geometry has higher priority than the request for a transparent background.

For entity/locked-atlas assets:
- treat the source alpha mask as coordinate-locked structural data;
- preserve every island contour and internal cutout exactly;
- do not expand, contract, feather, blur, anti-alias, round, erode, dilate, or otherwise alter mask edges;
- do not add or remove even a thin border around an island;
- transparent source pixels remain transparent and occupied source pixels stay within the same footprint;
- material detail must stop exactly at the original mask boundary;
- if realism or transparency aesthetics conflict with UV alignment, exact UV alignment wins.


Do not:

- fill transparent regions accidentally
- invent new large holes unless required by the asset
- add halos
- soften silhouettes so much that masks become ambiguous
- paint outside entity/item/plant masks

Transparency is structural data, not empty canvas.

## 15. Prompt construction pattern

A production prompt should normally contain these layers:

### A. Structural/reference instruction
Explain what must be preserved from the source.

### B. Anti-pixel-art instruction
State that the original low-resolution pixel shapes are not to be enlarged or imitated.

### C. Shared style target
Apply the grounded dark-fantasy realism language.

### D. Functional constraints
Specify tileability, transparency, UV lock, animation cell lock, silhouette, or face role as appropriate.

### E. Asset-specific material target
Describe what this exact texture physically represents and which realistic details belong there.

### F. Explicit avoid list
Name the most likely failure modes for this asset.

Do not rely on vague wording such as “make it realistic.”

## 16. Asset-specific writing standard

The asset-specific section should answer:

- What physical material/object is this?
- What broad structure from the source must survive?
- What micro-detail should replace the pixels?
- What color/material identity must remain recognizable?
- How should aging/weathering appear?
- What must the model specifically avoid?

Prefer concrete material language.

Bad:
> Make this stone realistic and dark fantasy.

Better:
> Preserve the broad stone massing and calm tonal rhythm. Create continuous fine mineral grain, shallow age fractures, restrained lichen/mineral staining in recesses, worn surface variation, and muted cool-gray/earth undertones. Avoid deep black cracks, dramatic cliff-like relief, wet gloss, or oversized photographic pebbles.

## 17. Cross-texture consistency

Textures belonging to the same material/object family should look authored for the same world, but must not become duplicates.

Keep consistent:

- aging intensity
- saturation philosophy
- lighting philosophy
- material family
- dirt/weathering language

Allow asset-specific differences in:

- structure
- face direction
- wear
- color identity
- density
- transparency
- function

## 18. Failure checks before accepting a prompt

Before saving a prompt, verify:

- Does it protect gameplay function?
- Does it protect structure/mask/UV/frame topology?
- Is it specific to this asset?
- Does it explicitly reject pixel-art upscaling?
- Does it avoid scene generation?
- Does it avoid fake relief and overdone gloss?
- Does it preserve transparency when required?
- Is an Entity treated as a locked UV atlas?
- Is an animation treated as frames, not one image?
- Are top/side/bottom roles respected?
- Is the requested realism compatible with in-game readability?
- Could another unrelated texture use this exact prompt unchanged? If yes, it is probably too generic.

## 19. Current project decisions to remember

- Generic fallback is intentionally removed.
- P0/P1 prompts are individually authored or controlled variants.
- Entity textures require entity-specific locked-UV prompts.
- Entity textures must never become animation strips by aspect-ratio inference.
- The abandoned Piglin/B3D 3D-preview experiment is unrelated to prompt authoring and must not be reintroduced as part of this workflow.
- Animation atlas editing preserves frame topology while allowing higher edited resolution.
- Prompt writing should follow the source texture's real gameplay structure rather than forcing every asset into the block-material template.

## 20. Working rule for future sessions

When asked to prepare prompts:

1. inspect the relevant texture(s) and current code/catalog metadata;
2. determine the actual asset type and structural constraints;
3. inspect sibling variants when useful;
4. write an asset-specific prompt using this guide;
5. do not create a generic fallback;
6. keep the prompt tied to the texture ID/path when integrating it into the app;
7. if the source image does not reveal enough to safely infer a structural rule, preserve rather than invent.

This file is the persistent prompt-authoring memory for Mineclonia Texture Studio.

## 21. Resolve the texture's runtime role from Mineclonia code before authoring

Directory location and filename are only hints. They are not authoritative semantic types.

Before writing or revising a prompt for an ambiguous texture, trace how Mineclonia actually uses the file.

Use this evidence order:

1. **Direct code reference**
   - Search the exact filename in Mineclonia source.
   - Inspect the surrounding Lua table/function, not only the matched line.
   - Determine whether the file is assigned to an entity texture list, composed with `^`, colorized, used in a particle spawner, used as inventory/wield image, used as node tiles, used as an animation frame/strip, or used as another dependent layer.

2. **Runtime field / operator semantics**
   - `textures = {...}` on a mesh/entity usually means entity/body or entity overlay material.
   - `particlespawners`, `texpool`, or `p.texture` inside a particle-spawner definition means a particle/effect sprite, even if the file physically lives under `ENTITIES/**`.
   - Texture composition operators such as `base^overlay`, opacity modifiers, `makealpha`, and `colorize` indicate dependent overlays/masks, not standalone skins.
   - A colorized overlay must keep neutral/tintable material behavior; do not bake a conflicting final color.
   - Node `tiles`, inventory images, wield images, HUD masks, and animated definitions must be treated according to those runtime roles.

3. **Conversion/source mapping**
   - Check Mineclonia's conversion table when available to recover the upstream Minecraft asset category/path.
   - Use this as corroborating evidence, not as a replacement for runtime code.

4. **Sibling usage**
   - Inspect adjacent variants and the code that selects between them.
   - Determine whether numbered files are animation frames, particle-pool alternatives, charge states, growth stages, biome/profession layers, dyeable overlays, or independent textures.

5. **Image structure**
   - Only after runtime role is known, use dimensions, alpha, occupied regions, and visual structure to write the material/effect instructions.

### Important examples discovered from code

- `extra_mobs_glow_squid_glint1.png` through `glint4.png` are **particle-spawner sprites**, not Glow Squid body UV overlays. The source code places them into a particle pool with short lifetime, small sprite size, and glow.
- `mobs_mc_wolf_splash_0.png` through `splash_3.png` are **particle-pool splash sprites**, not wolf skin overlays.
- `mobs_mc_creeper_charge.png` is a **dependent entity overlay** composited over the Creeper texture with reduced opacity.
- `mobs_mc_enderman_eyes.png` and `mobs_mc_spider_eyes.png` are **eye overlays/layers** combined with the base entity texture.
- `mobs_mc_cat_collar.png` and `mobs_mc_wolf_collar.png` are **colorized collar overlays**; the engine applies the selected collar color, so prompts must preserve tintability and must not bake one final dye color.
- `mobs_mc_horse_markings_*.png` are **marking overlays** selected and combined with horse base coats.
- `mobs_mc_sheep_fur.png` is a **dye-colorized wool/fur layer**, so its authored texture must remain compatible with engine colorization.
- `mobs_mc_pig_saddle.png` is a **saddle overlay/material layer** reused on the pig and also by the strider code.

### Rule

If runtime code contradicts the directory name or filename intuition, **runtime code wins**.

Do not call something an entity UV atlas, block surface, animation, or item merely because of its folder, dimensions, or name. Determine what the engine actually does with it first.

When runtime role is unresolved after code search, mark the role as unresolved and preserve structure rather than inventing a semantic interpretation.

### Particle/effect prompts must encode the trigger context

For any runtime particle/effect sprite, do not stop at labeling it "particle".

Before authoring, determine and record:
- which entity/system emits it,
- the exact gameplay event or persistent state that causes emission,
- whether it is ambient, impact, damage, attack, movement, weather, panic/status, death, or another context,
- particle amount/count,
- spawner duration,
- particle lifetime,
- rendered size,
- velocity / acceleration / gravity behavior,
- glow/emission level,
- collision behavior,
- whether the sprite pool is reused by more than one system.

These runtime facts should shape the prompt. A particle that exists continuously around a luminous creature needs a different visual treatment from a damage burst, attack spark, rain splash, panic/sweat droplet, or death particle even if their PNG silhouettes look similar.

If one texture is reused in multiple contexts, write the prompt for the **shared semantic denominator**, not for only one caller. Example: `mobs_mc_wolf_splash_0–3.png` are used both when a wet wolf shakes itself dry and by the terrified-villager effect, so they should remain neutral liquid/sweat-like droplet sprites rather than wolf-specific imagery.

Likewise, distinguish ambient particles from event particles. `extra_mobs_glow_squid_glint1–4.png` are persistent ambient Glow Squid glint particles; they are not the damage-triggered ink jet.



## 22. Mandatory transparency output rule

Every effective prompt emitted by the app must explicitly preserve alpha transparency and prohibit generated backgrounds.

Global rule:
- preserve source transparency and alpha-cutout logic;
- keep intended empty/background regions fully transparent;
- never add white, black, colored, scenic, shadow-field, or other generated backgrounds;
- never fill unused transparent regions;
- return a game-ready background-free texture where transparency is part of the source.

Entity / UV atlas rule:
- transparent space outside UV islands is locked;
- every empty region outside the islands remains fully transparent;
- never paint into unused atlas space;
- never add backdrop, canvas color, glow field, shadow field, or environmental background;
- preserve exact atlas alpha structure.

The app enforces these requirements at prompt-output time so built-in prompts, JSON/manual overrides, exported prompts, and future prompt-library additions receive the same transparency constraint without duplicating it into every stored prompt body.


### Entity alpha rule after production feedback

For Entity / locked-UV atlases, keep the prompt-side alpha instruction **short**. Repeating long transparency, edge-cleanup, and mask language can make the image model focus on reconstructing the mask and slightly drift UV boundaries.

Use this principle:

- preserve the exact source UV layout and alpha mask;
- edit RGB/material appearance only inside the existing occupied source pixels;
- do not move/repack islands or regenerate transparency;
- no background;
- if realism conflicts with UV geometry, UV geometry wins.

Do not stack a second long generic transparency block onto Entity prompts.

The app also enforces this structurally on import: for Entity assets, the edited image keeps its generated RGB/material detail but its alpha channel is replaced with the original source texture's alpha mask, scaled with nearest-neighbor semantics to the imported output dimensions. This makes alpha/UV boundary preservation an application invariant instead of relying only on prompt compliance.

Entity seam-offset editing is disabled because offsetting the atlas would intentionally move the structural mask.


## Creative alternative mode — composition reset rule

Creative alternatives are not HD remakes of the source texture. For full-square material textures, preserve the gameplay material/face role and technical behavior, but do **not** preserve the source macro-composition by default.

In creative mode, large cracks, patch boundaries, knots, stones, stains, veins, tonal islands, grain groupings, focal marks and other large spatial features may be redesigned from scratch. Similarity should come from material identity and gameplay role, not from matching the old texture's layout.

Only hard structural constraints remain locked where they are actually functional: tileability, meaningful alpha/mask behavior, UV layout for locked atlases, and frame topology/order for animations. The purpose of the creative set is to produce a genuinely different authored texture for the same game material, not a higher-resolution reconstruction.
