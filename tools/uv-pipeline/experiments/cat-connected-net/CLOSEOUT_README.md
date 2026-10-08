# Mineclonia Texture Studio — connected-net UV experiment closeout (2026-10-08)

This ZIP contains independent cat test inputs, generated outputs, a local B3D renderer and the cat-specific pack/unpack experiment. The authoritative application remains GitHub: TheOsmanYILDIRIM/mineclonia-texture-studio. These experimental scripts/binaries are NOT deployed or present in GitHub merely because they are in this ZIP.

Cat native atlas: 64x32. Connected presentation: 64x64 at x24, 1536x1536. Pack/unpack is exact for original pixels, not a guarantee that generated eye features preserve semantics.

Before forcing original mask: cyan/plain generation measured 0.983031 source-mask IoU; cyan+magenta guard generation 0.964209. The attempted guard cleanup detected 0 magenta pixels to inpaint; its mask IoU of 1.0 was produced by overriding the silhouette and is NOT genuine AI geometric accuracy.

The separate document tools/uv-pipeline/CONNECTED_NET_EXPERIMENTS.md in GitHub is the canonical detailed finding and next-step note. Further work: find actual guard-color contamination around known source boundary, compare both generations with identical mask policy and fixed 3D B3D camera views, repeat multiple samples before selecting a generation method.

Licensing/provenance: Original Mineclonia model and texture were provided in the user-supplied mineclonia_texturepack.zip; check upstream model/media licenses before redistribution. The generated calico PNGs are user-supplied experimental outputs.
