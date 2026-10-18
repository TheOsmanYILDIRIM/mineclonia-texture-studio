# AI UV Grid Studio — reversible production presentation (experimental)

**Entry:** `uv-generation.html` from MTS header or a texture's detail sheet. No changes to the main edit store, variant identities or `.b3d` UV data. This is a standalone opt-in workflow. The two ESM sources are `js/uv-generation-roundtrip.mjs` (pure pixel/mapping engine) and `js/uv-generation-ui.mjs` (browser screen). Run `node scripts/build-uv-generation.mjs` to produce the single-file runtime `js/uv-generation.bundle.js`; CI checks it is current.

## User flow

1. Open the entity in MTS and select **AI UV** to load the canonical original texture, or upload the native Mineclonia PNG manually. Native alpha defines the texture footprint, not RGB brightness (near-black Enderman pixels must remain).
2. Choose **Kare · ortada** (Enderman and general 2:1 layouts) or explicitly select **Kedi · ConnectedNet** (verified cat-specific mapping stored at `tools/uv-pipeline/experiments/cat-connected-net/config/mapping.json`). Top/bottom square placements are also supported. A connected-net map is not inferred for other species or guessed from dimensions.
3. Set magenta `#FF00FF`, 48 px spacing, and 8 px gap from all occupied UV pixels (default values). Export *both* the AI reference PNG and the mapping JSON. Two manual download links avoid browser multi-file download blocking.
4. Generate a new image from that PNG using the external image model. Re-open the studio, load the **same native original PNG**, AI-produced square PNG and the saved mapping JSON. Generate the restored Mineclonia PNG and report.
5. The studio refuses mismatched square image sizes, invalid/overlapping maps, unmapped occupied original texels, wrong source fingerprints and unauthorized >12 px manual corrections. No hidden stretch or resample is performed. When a source arrives from the catalog, it uses the pinned Mineclonia upstream ref consistent with the MTS application.

## Tolerance (small corrections only)

- **Automatic global grid registration** tries integer shifts within ±6 px (configurable 0..12). It measures the magenta grid **outside** the known UV occupancy, using horizontal/vertical segment midpoints independently. Ambiguous, damaged or low-confidence grids cause no automatic correction, not arbitrary snapping.
- Manual global X/Y shifts and per-map-group X/Y shifts are bounded to ±12 px each. Per-group offsets never rotate, scale or deform the UV faces.
- Optional magenta-edge cleanup detects magenta-like pixels **inside** the original UV footprint, within 3 px of the contour; it replaces them using the nearest non-magenta sample from the *same mapped region* within 6 px. It does not remove all violet materials, extrapolate missing semantic features or cross group boundaries. Non-magenta dark-gray matte blending may still need manual inspection.
- Original alpha is re-applied **only after** sampling the raw AI output into the known original texel addresses. The output alpha being pixel-exact is a mechanical property, **not** evidence the model preserved landmarks, borders or 3D seams. Reports explicitly leave raw-AI geometry IoU unmeasured.

## Alpha-mask inpainting comparison — 2026-10-18 (experimental)

**Current recommendation for the next experiment:** Evaluate native GPT Image edit/inpainting masks *before* investing further in post-generation UV alignment. This does not retire or replace this reversible Grid/ConnectedNet tool; the two approaches must be compared with the same source and original B3D preview.

### Exact mask semantics

- Input: original entity atlas RGBA (or nearest-neighbor enlarged copy) and a **separate RGBA edit mask of identical dimensions**.
- In the API mask, **alpha 0 / transparent = eligible for AI editing**; **alpha 255 / opaque = protected**. White-versus-black RGB has no masking meaning by itself. The editing mask is not the same as the original atlas occupancy/alpha.
- Build the edit mask from the trusted *source* UV occupancy: occupied source texels are transparent in the edit mask, unused atlas texels are opaque. Never rely on a visually white screenshot of a mask as evidence that its alpha is correct. Verify saved RGBA pixels programmatically.
- The model's mask is a **soft editing instruction**, not a pixel-exact preservation guarantee; ChatGPT's brush-based selection is not the API `mask` input. Supplying a mask as an ordinary second chat image does not activate API masking.
- Preserve the untouched original, generated raw result and the actual mask separately. After generation, perform **deterministic final RGBA composition** using original alpha/UV ownership. Do not mistake that forced output silhouette for independent evidence of correct generative geometry.
- Avoid resampling final faces. When a nearest-neighbor 64x32→1536x768 presentation was used, evaluate the raw model output first, then restore using exact source pixels/regions; do not silently blur or resize original UV boundaries.

### Evidence status and acceptance

- A Creeper masked-edit trial in chat produced a visually promising richly detailed atlas with recognizable face position. **The prior chat's “100% UV overlap” numeric claim has no retained independent measurement report in this repository and must not be treated as verified benchmark evidence.** Its output appeared to have opaque black background; alpha needs explicit repair/checking.
- A calico cat original/mask/prompt test package was prepared; **no resulting generated cat atlas has yet been checked against the real B3D model**. Do not claim the previously failing cat face/seam/landmark problem is solved.
- For comparison, save original/mask/raw generation/prompt/model version, calculate raw occupancy and boundary displacement independently, inspect facial landmarks, seams, true alpha and overlays, and render the authentic B3D with identical views. Run cases: Creeper, calico cat, Enderman and (if available) horse.
- Treat inpainting masks as a *preferred research direction / optional production workflow*, not a universal replacement for Grid/ConnectedNet, until these acceptance checks pass.

## Testing and limitations

`node tests/uv-generation-roundtrip.test.mjs` checks synthetic cat ConnectedNet + Enderman dark-texture examples, full native RGBA round-trip including empty/hide-RGB samples, grid exclusion from UV pixels, independent X/Y global offset detection, bounded magenta fringe repair, map/input rejection and accurate output dimensions. `node scripts/build-uv-generation.mjs --check` asserts the checked-in single-file bundle matches the two ESM sources.

AI image outputs may still drift, blur edges or invent a face. This tool provides reversible *layout coordinates*, not a universal semantic UV aligner. Source original PNG, B3D UV and overlays (e.g. Enderman eye overlay) remain the 3D truth. For research, retain the raw generated PNG and compare it before applying a source mask; evaluate landmarks and identical-angle 3D previews separately. Do not claim a successful UV match based only on mask-protected export.
