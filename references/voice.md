# Voice and timings

`python3 scripts/voice.py <film-dir> [--voice af_heart] [--speed 1.0]` reads `<film-dir>/text.txt` and writes:
- `voice.wav`: Kokoro TTS on fal (`fal-ai/kokoro/american-english`; voices starting with `b` use the British model).
- `stt.json`: fal Whisper (`fal-ai/whisper`, `chunk_level: word`), kept raw.
- `words.json`: `{text, dur, voice, speed, words: [{w, t0, t1}]}`. There is one entry per whitespace token of the source text, so the captions show the text exactly as written, quotes and all. Whisper is used only as a clock: tokens it misheard are interpolated between their matched neighbours.

A run takes about 10 s in total. 85 words come out to about 24 s at speed 1.0.

## The house voice (changeable)
- Kokoro **`af_heart`** at **speed 1.0**. This is the woman's voice used for Fractal Nature and Riverbed.
- To try another voice, change the `--voice` flag. Other Kokoro options include `af_bella`, `af_nicole`, `am_michael`, `bf_emma` and `bm_george`. Speed between 0.9 and 1.1 still sounds natural.

## The fal API key: be careful
- The key is read from the `FAL_KEY` environment variable or, failing that, from **`~/Desktop/.env_vault`** (the user's vault, a `FAL_KEY=…` line).
- It is a paid credential. Never print it, log it, paste it into a film folder, embed it in HTML or JS, or commit it. The scripts only read it at request time.
- Browser code never calls fal. Voice generation happens once, offline, and the film ships with the finished `voice.wav`.
