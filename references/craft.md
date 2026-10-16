# Craft notes

These are reference notes for when a film needs them. They are not steps to follow.

## Palette (Riverbed)
| role | hex |
|---|---|
| ink / void | `#17130f` |
| paper (warmer than the caption box) | `#eedcb3` |
| fibre highlight | `#fbf3df` |
| Bass red (the big hard cut) | `#e2451f` |
| ochre land | `#e7a02a` |
| ultramarine (same blue as the caption quotes) | `#2340c4` |
| teal / sky / violet (water batches) | `#16877b` `#7fb8ec` `#5a3ec8` |
| pink (accent cards) | `#ef7fa6` |

Each act owns one field colour: ink, then paper, then ochre, then red. The cut to a new field lands on a stressed word. When the palette changes for a new film, keep the caption blue in it.

## The boil
- `roughRect(x, y, w, h, seed, amp, step)` and `roughPoly(pts, seed, amp)` combine a fixed scissor offset `hash(seed + i)` with a live jitter `jit(seed + i)`. The live jitter changes when `BF = floor(t * 12)` changes.
- An amp of 2–2.5 suits cards, about 1 suits small bars, and about 0.9 suits the caret. Too much amp reads as wobble rather than paper.
- For a cut-paper shadow, draw the same rough shape offset by (+7, +9) in `rgba(0,0,0,.42)` first, using a different seed.
- Lines use `smoothLine(pts, seed, amp)` with an amp of about 2, so the thread and outlines boil too.
- Paper grain is a static noise and fibre canvas, drawn at 0.5 alpha and offset by `BF % 3`.

## Moves that worked
- **Accordion fold.** Columns contract to the centre column while scaleX squashes and recovers, the panels shear in alternate directions, and odd columns darken while even ones lighten. Then the rows do the same thing vertically. Sort the draw order so the card we were "in the middle of" ends up on top.
- **Stamp.** The card lifts (scale +6 %, shadow grows), then slams down in about 60 ms. Pair it with a thump.
- **Zoom into a detail until you're inside it.** Use log-space zoom anchored so the target glides to its screen spot, then hard-cut the field colour on the character's first blink.
- **Tear.** A jagged polyline splits the world, with a black void between the halves and fibre-white torn edges. Close it with an outBack overshoot, then add an ink scar and red X stitches that draw in.
- **Words fall out.** Each bar lifts 12 px, then drops under gravity with a little spin, staggered by row and x. The grooves they leave become the next act.
- **Grooves to channel.** A thick stroke draws along a boustrophedon path (rows joined at alternate ends). Reading order becomes a meander.
- **Water.** Strokes along the path are coloured by batch `floor((t*v - s) / L)`, with dash highlights running downstream and a foam bar at each new batch. Drain it by dropping alpha to show what's in the bed.
- **Line to face.** Morph a resampled path into a Catmull-Rom profile, with each point's start staggered by its index.
- **Selection box.** Marching ants plus navy handles, the same MS Paint vocabulary as the caption box. This works whenever the text says "this part" or "some".
- **Callback ending.** Shrink the whole frame into one card of a new strip, and let the line or character carry on into the next card.

## Character
- Keep it tiny and specific: one shape, one eye. It's asleep when grey with the eye closed as a curve, and awake when ink with the eye open (outBack).
- It acts like what it is: it blinks on and off, types bars as it hops, squashes on landing, and spins on a big jump.
- Its eye can travel. In Riverbed the caret's eye becomes the eye of the face at the end.

## Sound
- `audio-kit.js` provides a 100 bpm swung walking bass, ride, brushes, vibes comping, and paper, key, thump and ding foley.
- Hold the band out for the break, and thin it to just bass and vibes while things are being "forgotten". A big vibes chord lands on the reveal.
- Sync foley to the picture: paper flaps per fold column, a key click per hop, a rip, the slam, and pizzicato plinks as words fall.
- Keep the voice clear by keeping the band low (bass at about 0.2 gain, ride at about 0.02). The compressor in the kit glues it together.
