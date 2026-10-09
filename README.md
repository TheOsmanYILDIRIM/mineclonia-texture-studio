# Mineclonia Texture Studio

Browser-based texture authoring and inspection tool for Mineclonia. The canonical branch is `main`; production is deployed to GitHub Pages by GitHub Actions.

The app preserves gameplay-facing texture structure while supporting high-resolution edits, prompt workflows, animation handling, temporary variant comparison, runtime-aware classification, and lazy 3D preview.

3D preview uses Mineclonia/Luanti source semantics for block faces and real Mineclonia `.b3d` meshes for supported entity skins. **Entity animation preview** lazily decodes native B3D bones, keyframes and skin weights, with play/pause, source-defined clip choices where verified (cat/pig/Creeper/Enderman), speed and frame-range scrubbing. Preview deforms mesh vertices in memory without modifying saved atlas pixels or UV coordinates. Other animated models can play their full B3D timeline; unsupported models retain their static preview. Filename inference is a fallback, not the source of truth.

Project working rules and continuation state:
- `AGENTS.md` — repository contract and invariants.
- `SESSION_HANDOFF.md` — concise current implementation state and next work.
- `PROMPT_AUTHORING_GUIDE.md` — persistent prompt methodology.
