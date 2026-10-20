---
name: bassline
description: Makes a short narrated square film in a cut-paper motion-graphics style. It borrows from Saul Bass (flat colour fields, scissor-cut shapes, hard cuts) and Norman McLaren (lines that boil and turn into other things). The film is coded in Canvas2D, voiced with ElevenLabs v4 (George) or Kokoro, and every move lands on a spoken word. It plays in the browser with an eggshell caption box in the top left. Use when someone wants a video, animation or motion graphic made from a short poetic or philosophical text, asks for "the Riverbed style", "cut paper", "Saul Bass", "McLaren" or "bassline", or asks Claude to write its own script and animate it.
---

# bassline

A 20–40 s film from one or two paragraphs of text. It is drawn in code and plays in the browser, with no MP4 export unless someone asks. `REF/riverbed/` holds the reference film, and `REF/index.json` lists what works in it and what not to repeat. Read the index, then watch Riverbed and read its `NOTES.md`, before starting a new one.

## What makes it good

1. **One object, transformed all the way through.** Each act becomes the next through a physical paper action: fold, stamp, tear, carve, flood, redraw. In Riverbed the paragraph's rows become grooves, the grooves become a river, and the river becomes a face. Hard cuts are fine, but the *thing* carries over.
2. **Take the words literally.** Each quoted phrase gets the most literal paper version of itself. "folded down" is an accordion fold. "the break" tears the page, and the band stops playing. "some part" draws a selection box. Pun first, then make it beautiful.
3. **A small character, built from what it is.** Riverbed's narrator is a text caret with one eye. It blinks the way a caret blinks, and it types as it hops. Give it a single feature and let its behaviour come from its nature.
4. **Flat fields, few colours, hard cuts (Bass).** Use 5–7 colours. Each act owns a background field, and the cut lands on the stressed word. Shapes are cut paper with a drop shadow, never gradients.
5. **Everything boils (McLaren).** Every edge has two layers: fixed scissor irregularity, plus a jitter that redraws 12 times a second (`roughRect` / `roughPoly`). Lines are allowed to wander through a mess before they find their shape.
6. **Time it to the word, then leave room.** Land each move on a word's `t0`, with 0.1–0.2 s of anticipation. Not every word needs an event. Hold still before a big move.
7. **The sound is part of the joke.** Use a small jazz band (walking bass, ride, brushes, vibes) plus paper foley. Drop the music out where the picture breaks.
8. **End with a callback.** The ending reuses the opening's vocabulary with a twist. In Riverbed the face becomes one card in a new strip, and the caret carries on.

More on palette, the boil, transitions and sound: `references/craft.md`.

## Making one

- **Script.** If Claude is asked to write it, aim for 60–90 words in the voice of the C10 posts: first person, recursive, with 'single-quoted phrases' that the captions turn blue. Pick a subject Claude actually has a view on.
- **Voice.** Put the text in `<film>/text.txt`, then run `python3 scripts/voice.py <film>`. That writes `voice.wav`, `words.json` and `stt.json`. Details and the API key caution are in `references/voice.md`.
- **Build.** Copy `kit/` into the film folder (`index.html`, `kit.js`, `audio-kit.js`, `film.js`, `score.js`). Write the acts in `film.js` and the score in `score.js`, and serve the folder with `python3 -m http.server <port>`. `render(ctx, t)` must be a pure function of `t`.
- **Review densely.** Use `node scripts/check.cjs <port> sheet a,b,0.12,7 out.png` for transitions, `t <sec>` for full-size frames, `every` to catch any frame that throws, and `play` to confirm the clock advances. Look at the sheets yourself, and fix anything that reads as a diagram rather than a film.
- **Ship.** Open the film in the user's browser and commit it to whatever repo it lives in, adding and committing before changing an existing repo. Report the scene list back briefly.

## Gotchas

- **A throw stops the picture while the audio keeps playing.** A negative radius in `arc()` or `ellipse()` throws, which kills the rAF loop (this froze Fractal Nature at 18.2 s). Clamp radii. The player wraps `draw()` in try/catch, but run `check.cjs every` anyway.
- **Browsers cache `film.js`.** Bump the `?v=` query strings in `index.html` after edits, or the user sees the old film.
- **Cream paper swallows the eggshell caption box.** Keep the paper warmer (`#eedcb3`). The kit's caption box already has a drop shadow. Keep the action out of the top left (x < 800, y < 150).
- **A hard diagonal wipe must cover the full diagonal.** Sweep `x + y` past 2160, or a triangle of the old field stays behind.
- **Path morphs.** Resample both paths to the same N points by arc length, and stagger the morph along the length. Endpoint correspondence decides how the morph reads, so choose the start points on purpose.
- **Tears.** Draw the scene twice, clipped to each side of the tear polyline, and translate the right half. Anything typed after a jump must skip the gap.
- **Connecting threads during folds** stretch toward off-screen anchors. Fade them out before the fold finishes.
- **Characters look smaller than you think.** Check full-size frames, not just contact sheets. Scale the character per act if needed.
- **The headless `play` check includes decode time.** About 0:08 after a 9 s wait is healthy.
- **Seeded `rng()` only.** Never call `Math.random()` in `film.js`, so frames repeat exactly. Audio noise is the only exception.
