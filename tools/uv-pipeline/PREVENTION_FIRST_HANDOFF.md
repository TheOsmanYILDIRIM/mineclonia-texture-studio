# Entity UV atlases — prevention-first handoff (2026-10-08)

## Decision and goal

**New primary direction: prevent AI generation from damaging a valid UV atlas in the first place.** Post-generation registration/warping remains a fallback, not the main workflow. The goal is a repeatable, model-agnostic production system that keeps Mineclonia's authentic B3D UV layout, source island topology, alpha/voids and face identity intact while replacing surface material. The production system must handle already-good AI outputs without unnecessary resampling.

**Important distinction:** The visual complexity/number of islands in the original atlas is not by itself a predictor of AI success. The user reports that a complex horse atlas was correct in one generation while some simpler cat/Enderman/pig cases failed. The horse AI file has NOT been independently measured in this work; treat this as a test hypothesis, not verified causation.

## What is actually saved in this repository

- `creeper_outer_rigid_truevoid.py`: recovered Creeper baseline; preserve unchanged.
- `uv_geometry.py`, `uv_align_guarded_v2.py`, `test_uv_align_guarded_v2.py`: offline guarded alignment prototype and its regressions. See `README.md`.
- The guarded V2 Creeper benchmark previously passed 12 local tests with the 1536×768 original/AI pair. Those tests establish limited numeric/topology properties, **not** guaranteed correct eye/face placement on arbitrary mobs.
- The app already has `js/vertex-uv-studio.js` for manual UV mapping; **do not confuse this with proven automatic Python registration.**

## Latest experiments and known failures — local only, not merged

With chat-supplied AI PNGs and original textures/B3D models extracted from the locally supplied `mineclonia_texturepack.zip`:

| Case | Findings | Confidence |
| --- | --- | --- |
| Creeper | Baseline preserves important face placement but can generate streak-like edge stretching. Guarded axis-map V2 improves some repeats. | Previously tested locally; not universal |
| Cat (calico) | AI islands shift/change shape. Black holes appear on the actual 3D mesh when pre-masked AI atlas is used. An independent-source-island experiment rejects ambiguous component matching. | Failure, not solved |
| Enderman | Dark materials, white AI background, small/overlay regions and a separate eyes texture complicate segmentation. Independent-source experiment rejects unsafe remapping. | Failure, not solved |
| Pig | A limited independent-island case produced an output, but no general semantic correctness guarantee follows. | Partial prototype |
| Horse | User reports successful AI atlas on a visually more complex layout; its AI/original pair has not yet been quantitatively compared. | User observation, not a verified benchmark |

**Critical former false-positive:** In early cat/Enderman/pig tests the original UV occupancy mask was imposed on the AI image *before* registration. Matching masks and minimal changed-pixel counts then became circular, giving a misleading `validated` result while the 3D texture was still wrong. **Never apply target alpha/mask to AI as a prerequisite to independently discovering AI islands.** Only use the original mask when constructing/validating the final output, after correspondence is established.

**3D visualization note:** An ad-hoc local B3D renderer initially interpreted the UV vertical axis incorrectly and mishandled masking, causing spurious placement artifacts. A later local renderer fixed the UV orientation, kept transparent-vs-black separate, and added Enderman's eyes overlay. Its review ZIP, models and comparison PNGs were shared in chat but are **not installed or checked into this repository**. Browser Texture Studio's real B3D renderer is a separate implementation. Previous bad 3D screenshots cannot be used as evidence.

Local experimental files `uv_align_islands_v3.py` and `uv_align_islands_v3b.py` were **not committed**; they still reject cat/Enderman, so do not promote them to production or claim the cases are fixed. Binary example PNGs from these tests are also not part of this GitHub folder.

## Next engineering phase — generation-time safeguards (proposed, not implemented)

1. **Capture trusted structure:** obtain the actual Mineclonia source PNG, its RGBA/alpha/voids, and real B3D mesh UV faces. Record per-face polygon boundaries, face identity, small detached islands, overlays and texture-specific exceptions. Do not infer face semantics solely from connected-component count.
2. **Constrain the AI request:** use the source UV atlas as a strict structural reference, require material-only edits, unchanged canvas/UV polygon positions, island count and small islands, opaque/transparent topology, face orientation, and preserved semantic anchors (eyes, nose, mouth, etc.). Compare prompts/conditioning that show both an annotated UV boundary guide and style reference. Prompt wording alone cannot guarantee geometric invariants.
3. **Keep pixel ownership enforceable:** where supported by the generator, create/edit *within fixed original face masks* rather than regenerating the whole atlas. Reapply exact original alpha only at final composition; doing so must never count as fixing missing/shifted semantic content.
4. **Independent post-generation audit:** first detect AI foreground/face landmarks independently; verify geometry, topology, face identity, overlay handling and no missing/shifted material under original UV faces. Reject or request regeneration on failure; keep source intact and don't silently mark it valid.
5. **Real 3D preview before acceptance:** original / raw AI / constrained AI / fallback-corrected on the same authentic B3D model and camera angles (front, sides, top); verify face landmarks and visible gaps. Renderer itself must pass UV-orientation, alpha, overlay and geometry regression tests.
6. **Benchmark successful + unsuccessful generations:** horse (reported success), Creeper, cat, Enderman, pig; preserve original/AI pair provenance; measure not just mask IoU but face-level occupancy, landmark displacement, distortions, seam continuity, alpha exactness, and 3D appearance. Never optimize only on Creeper.

## Definition of success

A generated atlas is accepted only when its original UV faces are geometrically intact, semantic details land on the correct B3D faces, transparent/void regions and overlays retain proper behavior, no obvious edge streaks occur, and a reproducible record (source, AI, generation conditions, outputs, diagnostics) is saved. A numerical `validated` flag alone is insufficient.

## Continuation / boundaries

This file captures the earlier **prevention-first** decision and cat/Enderman/pig/Creeper baseline. Subsequent, more specific cat work — square padding vs stretching, connected-net reversible repacking, hidden RGB, cyan matte vs external magenta guard, and the failed guard-pixel detection — is documented in **[`CONNECTED_NET_EXPERIMENTS.md`](CONNECTED_NET_EXPERIMENTS.md)**. That later experiment document and `SESSION_HANDOFF.md` supersede the former horse-first next-step suggestion.

**Next concrete action:** make latest cat experimental fixtures reproducible and measure whether the guard truly contaminates pixels *inside* the original UV silhouette, compared with no-guard at identical 3D camera angles. Explicitly do not treat a forced target-alpha IoU of 1.0 as model compliance. Benchmark successful horse original+AI when available, but not as a prerequisite for fixing the present guard detector.

Keep historical Python baseline and browser data intact; no GitHub Actions dispatch or deployed browser behavior changes as part of documentation-only work.
