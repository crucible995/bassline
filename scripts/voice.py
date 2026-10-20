"""Voice: TTS on fal -> word timestamps -> timings aligned onto the source words.

Two engines, picked by the voice name:
  ElevenLabs v4 (`George`, `Daniel`, `Alice`, ...): the house voice. Its own character timestamps are the clock.
  Kokoro (`af_heart`, `bm_george`, ...: names with an underscore): the cheap voice. fal Whisper is the clock.

The typed text on screen is the post itself (with its 'quotes' and punctuation), so the STT words
are only used as a clock: each source token gets the time of the STT word it matches, and tokens
the recogniser heard differently get times interpolated between their matched neighbours.
"""
import difflib
import json
import re
import subprocess
import time
import urllib.request

import os

ELEVEN_MODEL = "elevenlabs/tts/eleven-v4"
TTS_MODEL = "fal-ai/kokoro/american-english"
TTS_MODEL_BRITISH = "fal-ai/kokoro/british-english"
STT_MODEL = "fal-ai/whisper"          # fastest fal model with word-level chunks (~2.5 s); wizper is segment-only
UA = "bassline/0.1"
VAULT = os.path.expanduser("~/Desktop/.env_vault")   # the user's key vault. never print, log, or copy its contents


def fal_key():
    """FAL_KEY from the environment, else from the vault. The key is a paid credential: keep it out of files, logs and commits."""
    k = os.environ.get("FAL_KEY") or os.environ.get("FAL_API_KEY")
    if k:
        return k
    try:
        for line in open(VAULT):
            n, _, val = line.strip().partition("=")
            if n.strip() in ("FAL_KEY", "FAL_API_KEY") and val:
                return val.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    raise SystemExit(f"no FAL_KEY in env or {VAULT}")


def _fal(model, args, timeout=600):
    req = urllib.request.Request("https://fal.run/" + model, json.dumps(args).encode(),
                                 {"Authorization": "Key " + fal_key(), "Content-Type": "application/json", "User-Agent": UA})
    last = None
    for attempt in range(3):
        try:
            return json.load(urllib.request.urlopen(req, timeout=timeout))
        except urllib.error.HTTPError as e:
            last = RuntimeError(f"{model}: HTTP {e.code} {e.read()[:400]!r}")
            if e.code < 500:
                raise last
        except (urllib.error.URLError, TimeoutError) as e:
            last = e
        time.sleep(2 + attempt * 3)
    raise last


def clean_text(text):
    """The post as it will be typed and spoken: separators and stray whitespace removed."""
    text = re.sub(r"^\s*[*_\-=~#]{3,}\s*$", " ", text, flags=re.M)   # ***** separators between posts
    text = re.sub(r"[*_]{3,}", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def is_kokoro(voice):
    return "_" in voice


def eleven(text, out_wav, voice="George", speed=1.05):
    """ElevenLabs v4 on fal. `speed` is an ffmpeg atempo on the result (George reads well at 1.05).
    Returns STT-style chunks [{text, timestamp: [t0, t1]}] built from its character timestamps, scaled to the tempo."""
    res = _fal(ELEVEN_MODEL, {"text": text, "voice": voice, "stability": 0.5, "similarity_boost": 0.75,
                              "language_code": "en", "output_format": "mp3_44100_192", "timestamps": True})
    raw = out_wav[:-4] + ".raw.mp3"
    urllib.request.urlretrieve(res["audio"]["url"], raw)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-af", f"atempo={speed}", "-ar", "48000", "-ac", "1", out_wav], check=True)
    os.remove(raw)
    chars, t0s, t1s = [], [], []
    for seg in res.get("timestamps") or []:
        chars += seg["characters"]; t0s += seg["character_start_times_seconds"]; t1s += seg["character_end_times_seconds"]
    chunks, cur = [], None
    for c, a, b in zip(chars, t0s, t1s):
        if c.isspace():
            cur = None; continue
        if cur is None:
            cur = {"text": "", "timestamp": [a / speed, b / speed]}; chunks.append(cur)
        cur["text"] += c; cur["timestamp"][1] = b / speed
    return {"model": ELEVEN_MODEL, "voice": voice, "chunks": chunks}


def tts(text, out_wav, voice="af_heart", speed=1.0):
    model = TTS_MODEL_BRITISH if voice.startswith("b") else TTS_MODEL
    res = _fal(model, {"prompt": text, "voice": voice, "speed": speed})
    url = res["audio"]["url"]
    urllib.request.urlretrieve(url, out_wav)
    return url


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def stt(audio_url):
    res = _fal(STT_MODEL, {"audio_url": audio_url, "task": "transcribe", "language": "en", "chunk_level": "word"})
    return res


_norm = lambda s: re.sub(r"[^a-z0-9]+", "", s.lower())


def align(text, chunks, dur):
    """One {w, t0, t1} per whitespace token of `text`, timed from the STT chunks."""
    toks = text.split()
    stt_words = []
    for c in chunks:
        a, b = c["timestamp"]
        b = b if b is not None else dur
        # whisper sometimes glues a hyphenated or quoted pair into one chunk: split it back up evenly
        parts = c["text"].split()
        for k, p in enumerate(parts):
            stt_words.append((_norm(p), a + (b - a) * k / len(parts), a + (b - a) * (k + 1) / len(parts)))
    src = [_norm(t) for t in toks]
    sm = difflib.SequenceMatcher(None, src, [w[0] for w in stt_words], autojunk=False)
    t0 = [None] * len(toks); t1 = [None] * len(toks)
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            _, a, b = stt_words[blk.b + k]
            t0[blk.a + k], t1[blk.a + k] = a, b
    # interpolate unmatched runs between anchors, by character length
    i = 0
    while i < len(toks):
        if t0[i] is not None:
            i += 1; continue
        j = i
        while j < len(toks) and t0[j] is None:
            j += 1
        lo = t1[i - 1] if i > 0 else 0.0
        hi = t0[j] if j < len(toks) else dur
        lens = [max(1, len(toks[k])) for k in range(i, j)]; tot = sum(lens); acc = 0
        for k, L in zip(range(i, j), lens):
            t0[k] = lo + (hi - lo) * acc / tot; acc += L; t1[k] = lo + (hi - lo) * acc / tot
        i = j
    out, prev = [], 0.0
    for k, w in enumerate(toks):
        a = max(prev, t0[k]); b = max(a + 0.04, t1[k])
        out.append({"w": w, "t0": round(a, 3), "t1": round(b, 3)}); prev = a
    return out


def make(text, outdir, voice="George", speed=None, log=print):
    """Writes voice.wav, stt.json, words.json into outdir. Returns the words payload."""
    text = clean_text(text)
    if speed is None:
        speed = 1.0 if is_kokoro(voice) else 1.05
    t = time.time()
    if is_kokoro(voice):
        url = tts(text, f"{outdir}/voice.wav", voice, speed)
    else:
        res = eleven(text, f"{outdir}/voice.wav", voice, speed)
    dur = duration(f"{outdir}/voice.wav")
    log(f"tts {voice} x{speed}: {dur:.2f} s of audio in {time.time() - t:.1f} s")
    t = time.time()
    if is_kokoro(voice):
        res = stt(url)
    json.dump(res, open(f"{outdir}/stt.json", "w"), indent=1)
    words = align(text, res.get("chunks") or [], dur)
    payload = {"text": text, "dur": round(dur, 3), "voice": voice, "speed": speed, "words": words}
    json.dump(payload, open(f"{outdir}/words.json", "w"), indent=1)
    log(f"timings: {len(res.get('chunks') or [])} chunks -> {len(words)} words in {time.time() - t:.1f} s")
    return payload


if __name__ == "__main__":
    import argparse, sys
    ap = argparse.ArgumentParser(description="text.txt -> voice.wav + stt.json + words.json (ElevenLabs v4 or Kokoro on fal)")
    ap.add_argument("dir", help="film folder containing text.txt")
    ap.add_argument("--voice", default="George", help="ElevenLabs name (George, Daniel, Alice) or Kokoro id (af_heart, bm_george)")
    ap.add_argument("--speed", type=float, default=None, help="default 1.05 for ElevenLabs (atempo), 1.0 for Kokoro")
    a = ap.parse_args()
    make(open(os.path.join(a.dir, "text.txt")).read().strip(), a.dir, a.voice, a.speed)
