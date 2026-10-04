# Mineclonia Texture Studio

Web-hosted Mineclonia texture workflow.

## Source of truth

- Repository: `TheOsmanYILDIRIM/mineclonia-texture-studio`
- Canonical branch: `main`
- Production: GitHub Pages via GitHub Actions
- Live site: https://theosmanyildirim.github.io/mineclonia-texture-studio/

The GitHub repository is the authoritative source for code, prompts, runtime-role classifications, project decisions, and current work state.

For future agent sessions, read:

1. `AGENTS.md`
2. `SESSION_HANDOFF.md`
3. `PROMPT_AUTHORING_GUIDE.md`

Avenox/Beyin is used only as a compact continuity/index layer. If project memory and current repository state ever disagree, verify `main`; the repository wins and memory should be refreshed.

## Deployment

The project is a static site and requires no build step for the site content itself.

`netlify.toml` remains in the repository as legacy/supporting configuration, but Netlify is not the production source of truth.
