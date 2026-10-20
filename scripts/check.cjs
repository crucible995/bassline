// bassline review tool. Serves nothing itself: point it at a running `python3 -m http.server` in the film folder.
//   node check.cjs <port> every                 render every frame at 1/120 s, report exceptions (a throw kills playback)
//   node check.cjs <port> sheet a,b,step,cols out.png   contact sheet from a to b
//   node check.cjs <port> t 12.3 out.png        one frame at full size
//   node check.cjs <port> play out.png          click play, wait 9 s, check the clock advanced (~0:08)
const path = require('path');
// Playwright: $PLAYWRIGHT if set, else a normal install (`npm i playwright && npx playwright install chromium`).
function loadPW() {
  for (const p of [process.env.PLAYWRIGHT, 'playwright', path.join(require('os').homedir(), 'Desktop/C10/tools/node_modules/playwright')]) {
    if (!p) continue; try { return require(p); } catch (e) {}
  }
  throw new Error('playwright not found: npm i playwright, or set PLAYWRIGHT to its path');
}
const { chromium } = loadPW();
(async () => {
  const [, , port, mode, arg, out] = process.argv;
  const base = `http://127.0.0.1:${port}/index.html`;
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 1500 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  if (mode === 'every') {
    await p.goto(base + '?t=0'); await p.waitForFunction(() => document.title === 'ready');
    const r = await p.evaluate(() => {
      const c = document.createElement('canvas'); c.width = c.height = SIZE; const g = c.getContext('2d'); const bad = [];
      for (let t = FILM.start; t <= FILM.end; t += 1 / 120) { try { render(g, t); } catch (e) { bad.push(t.toFixed(3) + ' ' + e.message); } }
      return { frames: Math.round((FILM.end - FILM.start) * 120), nbad: bad.length, bad: bad.slice(0, 8) };
    });
    console.log(JSON.stringify(r));
  } else if (mode === 'play') {
    await p.setViewportSize({ width: 900, height: 940 });
    await p.goto(base); await p.waitForTimeout(1500); await p.mouse.click(450, 450); await p.waitForTimeout(9000);
    console.log('timecode', await p.textContent('#tc')); await p.screenshot({ path: arg || 'play.png' });
  } else {
    await p.goto(base + (mode === 't' ? '?t=' : '?sheet=') + arg);
    await p.waitForFunction(() => document.title === 'ready', null, { timeout: 60000 });
    await (await p.$('canvas')).screenshot({ path: out });
    console.log('wrote', path.resolve(out));
  }
  console.log('errors:', errs); await b.close();
})();
