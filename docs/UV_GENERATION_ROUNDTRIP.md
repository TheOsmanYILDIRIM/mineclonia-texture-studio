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

## Testing and limitations

`node tests/uv-generation-roundtrip.test.mjs` checks synthetic cat ConnectedNet + Enderman dark-texture examples, full native RGBA round-trip including empty/hide-RGB samples, grid exclusion from UV pixels, independent X/Y global offset detection, bounded magenta fringe repair, map/input rejection and accurate output dimensions. `node scripts/build-uv-generation.mjs --check` asserts the checked-in single-file bundle matches the two ESM sources.

AI image outputs may still drift, blur edges or invent a face. This tool provides reversible *layout coordinates*, not a universal semantic UV aligner. Source original PNG, B3D UV and overlays (e.g. Enderman eye overlay) remain the 3D truth. For research, retain the raw generated PNG and compare it before applying a source mask; evaluate landmarks and identical-angle 3D previews separately. Do not claim a successful UV match based only on mask-protected export.
