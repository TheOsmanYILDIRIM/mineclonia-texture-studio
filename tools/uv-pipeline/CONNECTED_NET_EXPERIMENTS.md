# Connected-net cat UV research — handoff (2026-10-08)

**Status: experimental / offline only; no browser integration or accepted production method.**

## Goal

Prevent GPT Image from shifting, enlarging or destroying Mineclonia entity UV faces *during generation*. Avoid assuming that forcing the output into the original alpha mask proves geometric or semantic correctness. The working cat source is a **64×32** Mineclonia calico texture; comparisons at **1536×768** are ×24 enlargements, not native UV resolution.

## What worked and what did not

1. **Original 2:1 atlas and multiple reference images:** high-quality fur, but detached 9×3 native-pixel bottom strip commonly expanded vertically. Prompt-only geometry locking did not make the output pixel-accurate.
2. **Square transparent padding (1:1):** improved the small-strip shape in the local examples. Bottom-aligned square padding looked better than centered square. Gray matte square was worse in that batch. **Single generations are observations, not proof of a model property.**
3. **Non-uniformly stretching the 2:1 atlas to 1:1:** worse layout after inverse scaling; reject that approach as the current default. Splitting a head crop and generating it independently also harmed face semantics and scaled the UV crop unpredictably.
4. **Connected cube-net-like presentation:** a *temporary 64×64* arrangement of five macro-regions (head, body, tail, legs, detached strip), enlarged to 1536×1536. Native pack→unpack copies texels by integer translations only, with no per-face resampling; original→packed→original verified pixel-exact (including alpha). This is not a certified physical mesh unwrap: some connections are synthetic. The authentic B3D mesh still uses the original 64×32 UV.
5. **Generated connected-net output:** reverse packing works. A previous generated image gave source-mask IoU **0.982589** and **1** missing target-foreground pixel before restoring the original mask; original atlas alpha became pixel-exact *by construction*. That does **not** validate the cat's eyes, material direction or real 3D seams.
6. **Hidden-RGB experiment:** transparent packed input originally had `RGBA=(0,0,0,0)` in empty pixels. A second PNG changed only RGB under alpha=0 to nearest visible fur RGB; all visible pixels and alpha were identical. The corresponding generated output yielded IoU **0.979081** vs earlier **0.982589** (one generation each; not a paired stochastic test). This does **not** establish that GPT Image reads hidden RGB.
7. **Visible cyan matte:** opaque, solid RGB **(75,226,234)** outside the connected shape. User tested (A) cyan only and (B) cyan plus an external one-pixel magenta guard (**245,30,204** in source). These are the latest two AI generations. Raw generated-mask IoU: **A 0.983031**, **B 0.964209**. Both outputs had **0** missing target source pixels at fixed UV addresses in that detector, but B showed different face/eye placement. Matte may aid chroma-key segmentation; no superiority over all transparent workflows is proven.
8. **Latest guard-removal attempt:** an offline script reapplied the original packed silhouette, cleared the external cyan, attempted to detect and inpaint magenta, then inverse-packed the result. The magenta threshold detected **zero** candidate pixels, so it actually inpainted **zero** pixels. The reported `guard_cleaned` IoU **1.0** arose from **forcing the original mask**. It is **not evidence that the guard line was cleaned or the generated geometry fixed**. The corresponding 3D image remains a comparison only. Fix this before any claim that guard lines help.

## Source/provenance and artifacts

**Committed baseline in this repository:** `tools/uv-pipeline/creeper_outer_rigid_truevoid.py`, `uv_align_guarded_v2.py`, `uv_geometry.py` and tests are *separate* from these latest cat experiments.

**Experimental Python and generated PNGs were run/shared in chat, NOT checked into the repository:** `cat_cube_net_prototype/cube_net_repack.py`, `mapping.json`, `render_b3d_correct.py`, `cat_connected_cube_net_input.png`, `cat_connected_cube_net_input_alpha_safe.png`, `cat_chroma_matte_experiment/`, `119496.png` (A), `119497.png` (B), `cat_guard_cleanup_test/` (including `uv_compare.png`, `render_compare_yaw20.png`, and `summary.json`). Chat artifact ZIP: `cat_connected_cube_net_test.zip`. Path/name mentions here are **provenance pointers, not GitHub download URLs**. Preserve/copy these inputs to durable repo fixtures before depending on them for automation.

The ad-hoc B3D renderer was corrected for UV vertical orientation and separate alpha/overlay treatment in previous local work; it is not the deployed browser renderer. Use consistent front/side/rear views when validating texture placement.

## Next controlled experiment

1. **Archive a minimal reproducible cat set** (source 64×32 PNG, true 64×64 mapping, generator outputs A/B, packed/unpacked examples, independent mask detector, fixed renderer) with hashes/licenses. Do not overwrite Creeper baseline. Store model binaries only with proper provenance.
2. **Repair guard-line analysis**: inspect pixels in a narrow ring around the *known source contour*, separately inside vs outside; capture actual color distribution rather than assuming exact magenta survives AI. Inpaint only demonstrably contaminated **inside-UV** pixels, using adjacent valid material; do not mark a forced-mask IoU as an improvement. Compare guard and no-guard after applying the *same* geometry/alpha policy.
3. Measure unmodified generated-mask overlap **and** semantic landmarks/3D renders. Verify no eye duplication/movement, no black/cyan fringe, no missing surfaces and no synthetic-joint texture artifacts.
4. Re-run multiple samples per condition under the same prompt and model version before selecting a default. Keep bottom-aligned square-transparent and connected-net cyan as comparison candidates; consider a source-controlled internal-only compositing method if prompt-based masking remains unreliable.
5. Horse was user-reported to work on a complex original atlas but no corresponding AI/original pair has been independently benchmarked. Do not infer that complexity or aspect ratio alone drives success.

## Do not regress

- Original 64×32 topology, pixel ownership, face identity and alpha are authoritative. Do not first apply original mask to the raw AI and then claim it was already aligned.
- Output image is **not** production-valid merely because reverse pack is exact or a postprocess sets alpha exactly.
- No image-specific hard-coded pixel patches in the generic aligner; local cat mapping is explicitly a prototype.
- No browser storage/schema changes, Github Actions dispatch, production integration or modification of the recovered Creeper baseline during experiments.
