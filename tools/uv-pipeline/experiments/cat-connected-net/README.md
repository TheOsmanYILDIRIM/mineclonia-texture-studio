# Cat connected-net UV research — archived sources

This is an **offline, experimental** research snapshot, not a feature deployed to Texture Studio. The recovered cat texture, Python scripts, mapping manifest and test/prompt records are preserved here. Refer to [../../CONNECTED_NET_EXPERIMENTS.md](../../CONNECTED_NET_EXPERIMENTS.md) for findings and limitations.

## Contents actually committed

- `source/cat_original_64x32.png` — Mineclonia calico cat reference, **64×32**.
- `code/cube_net_repack.py` — exact reversible five-region pack/unpack experiment.
- `code/render_b3d_correct.py` — static B3D renderer using top-origin UV convention.
- `code/build_experiment.py` — **historical** reproducibility script; still contains original local `/mnt/data` paths and requires porting before stand-alone execution.
- `code/component_bbox_lock_fix_v2.py` — experimental seam-safe bbox repair, **not** semantic registration.
- `config/mapping.json` — five-region mapping at ×24 scale.
- `docs/GPT_IMAGE_PROMPT.txt`, `reports/connected_net_validation.json` — prompt and original pack/unpack test record.

The **complete original 25-file ZIP** from the conversation is named `MTS_ConnectedNet_UV_Closeout_2026-10-08.zip` (3.9 MiB). **Large binary fixtures have NOT been uploaded to GitHub** in this commit: the 193,540-byte B3D model, four generated input PNGs, two GPT Image outputs, restored PNGs and 3D/UV comparison PNGs. The `FILE_MANIFEST.json` lists original paths, sizes and hashes for later verified import. Those missing files must not be marked as existing in GitHub.

## Local usage

Install `numpy`, `Pillow`, `opencv-python`; `component_bbox_lock_fix_v2.py` also requires `scipy`.

```sh
python code/cube_net_repack.py pack --source source/cat_original_64x32.png --out cat-net.png --scale 24 --manifest generated-mapping.json
python code/cube_net_repack.py unpack --source AI_output.png --original source/cat_original_64x32.png --out restored.png --manifest generated-mapping.json --report diagnostic.json
```

For 3D preview, supply `mobs_mc_cat.b3d` from a matching Mineclonia version and run `code/render_b3d_correct.py`; the original model is in the conversation ZIP but not bundled in this GitHub folder.

**Licensing:** The reference model and texture originated in the user-supplied Mineclonia texturepack, with upstream attribution/license requirements documented in Mineclonia's LEGAL/CREDITS and mod folders. Maintain those notices when redistributing derived media.

**Evidence discipline:** pack→unpack identity and forced final alpha prove neither accurate AI texture landmarks nor correct 3D semantics. Cyan without guard vs cyan + guard outputs measured 0.983031 vs 0.964209 raw mask IoU; guard cleanup detected no magenta pixels to inpaint, so forced 1.0 IoU was not a successful inpaint.

This folder is deliberately **not** referenced from the application runtime and does not modify browser persistence.
