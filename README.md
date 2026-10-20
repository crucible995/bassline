# bassline

A Claude Code skill that makes short narrated square films in a cut-paper style (Saul Bass × Norman McLaren): Canvas2D in the browser, Kokoro voice, every move timed to a spoken word.

## Install

```sh
git clone <this repo> ~/.claude/skills/bassline
```

Then ask Claude Code for "a bassline film about …". `SKILL.md` is what Claude reads; `REFS/riverbed/` is the reference film (serve that folder with `python3 -m http.server` and open `index.html` to watch it).

## Needs

- `FAL_KEY` in your environment for the voice (Kokoro via fal.ai), used by `scripts/voice.py`
- Node + Playwright for the review tool `scripts/check.cjs` (`npm i playwright && npx playwright install chromium`)
