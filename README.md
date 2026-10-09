# Mineclonia Texture Studio

Browser-based texture authoring and inspection tool for Mineclonia. The canonical branch is `main`; production is deployed to GitHub Pages by GitHub Actions.

The app preserves gameplay-facing texture structure while supporting high-resolution edits, prompt workflows, animation handling, temporary variant comparison, runtime-aware classification, and lazy 3D preview.

3D preview uses Mineclonia/Luanti source semantics for block faces and real Mineclonia `.b3d` meshes for supported entity skins. **Entity animation preview** lazily decodes native B3D bones, keyframes and skin weights, with play/pause, source-defined clip choices where verified (cat/pig/Creeper/Enderman), speed and frame-range scrubbing. Preview deforms mesh vertices in memory without modifying saved atlas pixels or UV coordinates. Other animated models can play their full B3D timeline; unsupported models retain their static preview. Filename inference is a fallback, not the source of truth.

B3D animation parser regression (Node 22+): `node tests/b3d-animation.test.cjs`. Animation controls load only for supported entity previews; model/skin editing and browser persistence are unchanged.

Project working rules and continuation state:
- `AGENTS.md` — repository contract and invariants.
- `SESSION_HANDOFF.md` — concise current implementation state and next work.
- `PROMPT_AUTHORING_GUIDE.md` — persistent prompt methodology.

## AI UV generation round-trip (experimental)

Use **AI UV** in the catalog header or entity detail to open [AI UV Grid Studio](uv-generation.html). It creates a square magenta-grid production input with an 8px UV clearance, saves a source-authoritative inverse map, and restores a generated PNG to native Mineclonia UV without rescaling individual faces. Includes limited grid shift registration and near-edge magenta repair; exact final alpha is by construction and **not** a geometry-success score. See [UV pipeline documentation](docs/UV_GENERATION_ROUNDTRIP.md). Run `node tests/uv-generation-roundtrip.test.mjs` and `node scripts/build-uv-generation.mjs --check`.
