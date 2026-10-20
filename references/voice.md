# Voice and timings

`python3 scripts/voice.py <film-dir> [--voice George] [--speed 1.05]` reads `<film-dir>/text.txt` and writes:
- `voice.wav`: the narration, 48 kHz mono.
- `stt.json`: the raw timing source, kept for debugging.
- `words.json`: `{text, dur, voice, speed, words: [{w, t0, t1}]}`. There is one entry per whitespace token of the source text, so the captions show the text exactly as written, quotes and all. The timings are only used as a clock: tokens that don't match are interpolated between their matched neighbours.

The voice name picks the engine. Names with an underscore (`af_heart`) are Kokoro; plain names (`George`) are ElevenLabs.

## The house voice: ElevenLabs v4 George (recommended)
- **`George`** on fal's `elevenlabs/tts/eleven-v4`: a warm British male narrator. `--speed` (default **1.05**) is an ffmpeg `atempo` on the result; 1.045 to 1.09 all sound natural.
- Settings: `stability 0.5`, `similarity_boost 0.75`. Lower stability is more expressive and less consistent.
- Timing comes from ElevenLabs' own character timestamps (`timestamps: true`), scaled by the tempo, so no speech-to-text pass is needed.
- About 8 s for a 30 s clip. 85 words come out to about 30 s at 1.05.
- **Alternatives:** **`Daniel`** (male, British, deeper and more formal) and **`Alice`** (female, British, clear and confident). Any ElevenLabs premade name works; the API rejects unknown names with a 422.

## The cheap voice: Kokoro
- `fal-ai/kokoro/american-english` (voices starting with `b` use the British model), at a fraction of the cost. Timing comes from fal Whisper (`fal-ai/whisper`, `chunk_level: word`).
- **`af_heart`** at speed 1.0 is the female default; Riverbed was voiced with it. The male alternative is **`bm_george`** (British, the closest match to George) or **`am_michael`** (American).
- Other options include `af_bella`, `af_nicole` and `bf_emma`. Speed between 0.9 and 1.1 still sounds natural. About 10 s per run; 85 words come out to about 24 s at 1.0.

## The fal API key: be careful
- The key is read from the `FAL_KEY` environment variable or, failing that, from **`~/Desktop/.env_vault`** (a `FAL_KEY=…` line; on a new machine just `export FAL_KEY=…`).
- It is a paid credential. Never print it, log it, paste it into a film folder, embed it in HTML or JS, or commit it. The scripts only read it at request time.
- Browser code never calls fal. Voice generation happens once, offline, and the film ships with the finished `voice.wav`.
