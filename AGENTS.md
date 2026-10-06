# AGENTS.md — Mineclonia Texture Studio

This repository is the canonical source of truth for the Mineclonia Texture Studio project.

## Read order for a new working session

1. `AGENTS.md` — working contract and source-of-truth rules.
2. `README.md` — project/deployment entry point.
3. `SESSION_HANDOFF.md` — concise current state, verification, open work, and next concrete step.
4. `PROMPT_AUTHORING_GUIDE.md` — persistent texture-prompt methodology.

Current code on `main` always outranks stale prose. If a handoff note conflicts with the repository state, verify the code/history and repair the handoff instead of forcing the code to match old notes.

## Source of truth and memory

- GitHub repository: `TheOsmanYILDIRIM/mineclonia-texture-studio`.
- Canonical branch: `main`.
- Production: GitHub Pages from `main` through GitHub Actions.
- The repository is authoritative for code, prompts, classifications, project decisions, and current work state.
- Avenox/Beyin is a continuity index, not a second project database. It should store only concise pointers/outcomes needed to rediscover this repository and its current continuation point.
- If Beyin and the repository disagree, verify current GitHub state first; GitHub wins for project state and Beyin should then be refreshed.

Do not duplicate large prompt catalogs, source files, or long handoff history into Beyin.

## Core project invariants

Texture Studio edits Mineclonia textures while preserving gameplay structure and identity.

Protect, as applicable:

- UV/mask layout
- transparency
- animation topology/frame order
- tileability
- silhouette and occupied/empty regions
- runtime compositing/tint behavior
- gameplay readability

The shared visual target is grounded dark-fantasy material realism: weathered, somber, muted, tactile, physically believable, restrained in saturation and lighting, and never merely enlarged HD pixel art.

## Runtime semantics rule

Do not infer a texture's real role from filename, folder, dimensions, or appearance alone when runtime use is ambiguous.

Trace the exact filename through Mineclonia source and determine its actual runtime role. Runtime code wins over naming intuition.

This is especially important for:

- entity skins vs overlays
- tintable layers
- particle/effect sprites
- item masks
- HUD assets
- animations
- node faces
- reusable/composited textures

For particle/effect textures, determine the trigger/context and relevant runtime behavior before authoring or revising the prompt.

## Prompt rules

`PROMPT_AUTHORING_GUIDE.md` is the canonical prompt-authoring method.

Key non-negotiables:

- P0 material work is reference-first: **Ref prompt** creates a style/world reference; **Üretim prompt** is the shared Image A (source structure/function) + Image B (dominant style) production prompt.
- Reference prompts describe the world/art direction and material identity, but avoid checklists of visual details; the reference image should carry the style.
- Only the literal outer canvas boundary is seam-critical for ordinary tile materials; internal cracks, stone edges, bark lines, leaf contours, etc. are not seam constraints.
- Tree/log top textures are end-grain/cut-trunk surfaces, not foliage. Oriented faces must be semantically distinguished.
- The former P0 “creative alternative” workflow is retired; do not reintroduce it unless explicitly requested.
- P0/P1/P2… are priority only. Browsing/classification is a separate axis based on Mineclonia creative-inventory groups plus deeper technical/runtime classes.
- Promote only true material **Block** records into material-P0; do not automatically promote Functional Block/UI/sprite/system records.
- Production prompts outside the P0 material flow remain asset-specific or deliberately controlled variants.
- Locked UV/entity atlases must preserve their exact islands/masks.
- Entity dimensions alone must never trigger animation-strip treatment.
- Animated textures preserve frame topology while edited resolution may increase.
- Runtime role and gameplay function outrank decorative realism.

## Existing decisions that must not silently regress

- 3D preview is intentionally supported: blocks use Lua-derived node-face composition with semantic/name fallback; supported entity skins use Mineclonia's real `.b3d` mesh + UV data in a lazy WebGL renderer. Do not replace real runtime/mesh mapping with guessed cube wrapping.
- High-resolution edited animation atlases must reconstruct at the edited cell resolution, not be forced back to the original low resolution.
- Main Original/New comparison preview supports mobile pinch zoom/pan without modifying texture data.
- Runtime-role classification exists because directory names are not semantically sufficient.
- P0–P6 is only the priority axis. Browsing/classification is separate and follows Mineclonia creative-inventory categories plus deeper technical/runtime classes; do not overload P0/P1 as asset categories.
- Variant Lab is a temporary comparison gallery. Non-winning variants stay session-only; only `Aktif yap` writes through the normal persistent edit store.
- Static technical asset tags are additive catalog metadata only. Prompt status and browser `Değiştirildi` state remain separate runtime concerns and must stay compatible with existing IndexedDB/localStorage records.
- Mineclonia Lua/source is authoritative for node faces, overlays, composition and palette/tint semantics. Minecraft naming assumptions are not a source of truth.

## Session / handoff protocol

Before meaningful changes:

1. Read `SESSION_HANDOFF.md`.
2. Inspect current `main` HEAD/recent commits.
3. Verify relevant implementation before assuming an old note is still true.

After meaningful changes:

1. Commit the actual project change first.
2. Update `SESSION_HANDOFF.md` so it contains:
   - what changed,
   - why,
   - evidence/commit references,
   - what remains open,
   - the next concrete step,
   - important non-regression constraints.
3. Keep the handoff concise enough to resume work; do not turn it into a raw chronological log.
4. Record only a compact source-backed outcome/pointer in Avenox/Beyin. The repository remains canonical.

Do not store private chain-of-thought or raw tool logs in the repository.

## Deployment discipline

Production is GitHub Pages. Netlify configuration may remain as legacy/supporting project material, but Netlify is not the production source of truth unless the user explicitly changes that decision.

When changing deployment-sensitive files, verify the GitHub Pages workflow/result before claiming production is updated.

## Default continuation point

Unless newer repository state says otherwise, use the `Next concrete work` section in `SESSION_HANDOFF.md` as the continuation queue.
