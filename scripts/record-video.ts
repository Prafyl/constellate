/**
 * Records the demo video: a scripted "journey" through the real app, with a visible cursor,
 * chapter cards and captions, captured frame by frame and encoded to MP4 with ffmpeg.
 * Usage: npm run dev -- --port 4317   then   npx tsx scripts/record-video.ts
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const URL = process.env.URL ?? 'http://localhost:4317/';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const W = 1920, H = 1080, FPS = 30;
const OUT = 'video';
const FRAMES = `${OUT}/frames`;
rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });

// ─── In-page overlay: fake cursor, captions, chapter cards ───────────
const CSS = `
  .hint, .tooltip { display: none !important; }
  #rec-cursor { position: fixed; left: 0; top: 0; width: 26px; height: 26px; z-index: 100; pointer-events: none; filter: drop-shadow(0 2px 6px rgba(0,0,0,.6)); }
  #rec-ripple { position: fixed; z-index: 99; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%; border: 2px solid #ffd36e; pointer-events: none; opacity: 0; box-shadow: 0 0 18px #ffd36e; }
  #rec-ripple.go { animation: rec-rip .55s ease-out; }
  @keyframes rec-rip { from { transform: scale(.3); opacity: 1; } to { transform: scale(1.4); opacity: 0; } }
  #rec-caption { position: fixed; left: 50%; bottom: 30px; transform: translate(-50%, 10px); z-index: 90; max-width: 780px; padding: 14px 24px 16px;
    border-radius: 18px; background: rgba(8, 10, 24, .78); border: 1px solid rgba(255,255,255,.12); backdrop-filter: blur(16px); text-align: center;
    opacity: 0; transition: opacity .45s, transform .45s; pointer-events: none; box-shadow: 0 20px 60px rgba(0,0,0,.5); }
  #rec-caption.on { opacity: 1; transform: translate(-50%, 0); }
  #rec-caption.top { bottom: auto; top: 92px; }
  #rec-caption small { display: block; font: 500 11px 'Geist Mono', monospace; letter-spacing: .16em; text-transform: uppercase; color: #ffd36e; margin-bottom: 4px; }
  #rec-caption span { font: 500 23px/1.35 Geist, sans-serif; letter-spacing: -.015em; color: #eef1ff; }
  #rec-card { position: fixed; inset: 0; z-index: 95; display: grid; place-content: center; justify-items: center; text-align: center; gap: 14px;
    background: radial-gradient(ellipse at center, rgba(12, 12, 34, .9), rgba(3, 4, 11, .97)); opacity: 0; transition: opacity .5s; pointer-events: none; }
  #rec-card.on { opacity: 1; }
  #rec-card small { font: 500 14px 'Geist Mono', monospace; letter-spacing: .22em; text-transform: uppercase; color: #ffd36e; }
  #rec-card h1 { font: 600 76px/1.05 Geist, sans-serif; letter-spacing: -.045em; color: #eef1ff; max-width: 1300px; }
  #rec-card h1 em { font-style: normal; background: linear-gradient(100deg, #ffd36e, #ff7ac6 50%, #7cc4ff); -webkit-background-clip: text; background-clip: text; color: transparent; }
  #rec-card p { font: 400 26px/1.4 Geist, sans-serif; color: rgba(238,241,255,.62); max-width: 1000px; }
  #rec-card svg { width: 64px; height: 64px; fill: #ffd36e; filter: drop-shadow(0 0 18px rgba(255,211,110,.9)); }
  #rec-card.on > * { animation: rec-rise .8s ease-out both; }
  #rec-card.on > :nth-child(2) { animation-delay: .12s; } #rec-card.on > :nth-child(3) { animation-delay: .24s; } #rec-card.on > :nth-child(4) { animation-delay: .36s; }
  @keyframes rec-rise { from { opacity: 0; transform: translateY(16px); } }
  #rec-badge { position: fixed; top: 24px; left: 50%; transform: translateX(-50%); z-index: 96; padding: 6px 14px; border-radius: 999px; font: 500 12px 'Geist Mono', monospace;
    letter-spacing: .14em; color: #0b0b18; background: #ffd36e; opacity: 0; transition: opacity .3s; }
  #rec-badge.on { opacity: 1; }
`;
const JS = `
  const cursor = document.createElement('div');
  cursor.id = 'rec-cursor';
  cursor.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 2l15 11.5-6.6 1.2 3.9 7.3-2.9 1.5-3.9-7.4L4 21z" fill="#fff" stroke="#0b0b18" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  const ripple = Object.assign(document.createElement('div'), { id: 'rec-ripple' });
  const caption = Object.assign(document.createElement('div'), { id: 'rec-caption' });
  const card = Object.assign(document.createElement('div'), { id: 'rec-card' });
  const badge = Object.assign(document.createElement('div'), { id: 'rec-badge', textContent: '⏩ SPED UP' });
  document.body.append(cursor, ripple, caption, card, badge);
  let cx = ${W / 2}, cy = ${H * 0.62};
  const put = () => (cursor.style.transform = 'translate(' + (cx - 5) + 'px,' + (cy - 3) + 'px)');
  put();
  const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  window.rec = {
    move(x, y, ms) {
      const x0 = cx, y0 = cy, t0 = performance.now();
      // a slight arc feels like a hand, not a robot
      const bend = Math.min(80, Math.hypot(x - x0, y - y0) * 0.12);
      return new Promise((done) => {
        const step = (now) => {
          const t = Math.min(1, (now - t0) / ms), e = ease(t);
          cx = x0 + (x - x0) * e;
          cy = y0 + (y - y0) * e - Math.sin(Math.PI * e) * bend;
          put();
          t < 1 ? requestAnimationFrame(step) : done();
        };
        requestAnimationFrame(step);
      });
    },
    click() {
      ripple.style.left = cx + 'px'; ripple.style.top = cy + 'px';
      ripple.classList.remove('go'); void ripple.offsetWidth; ripple.classList.add('go');
    },
    say(eyebrow, text, top) {
      caption.classList.toggle('top', !!top);
      caption.innerHTML = (eyebrow ? '<small>' + eyebrow + '</small>' : '') + '<span>' + text + '</span>';
      caption.classList.add('on');
    },
    hush() { caption.classList.remove('on'); },
    card(html) { card.innerHTML = html; card.classList.add('on'); },
    uncard() { card.classList.remove('on'); },
    badge(on) { badge.classList.toggle('on', on); },
  };
`;

// ─── Browser + frame capture ──────────────────────────────────────────
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', `--window-size=${W},${H}`],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGE ERROR', e));
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await (await browser.target().createCDPSession()).send('Browser.setDownloadBehavior', { behavior: 'deny' });
await page.goto(URL, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
await page.addStyleTag({ content: CSS });
await page.addScriptTag({ content: JS });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const js = <T = unknown>(code: string) => page.evaluate(code) as Promise<T>;

// Warm the model up off-camera so "Ask the sky" answers instantly on camera.
await sleep(3000);
await js(`document.getElementById('ask-input').value = 'warm up'; document.getElementById('ask').requestSubmit()`);
await page.waitForFunction(`!document.getElementById('ask').classList.contains('busy') && document.getElementById('card-list').children.length > 0`, { timeout: 180000 });
await js(`app.clearFocus(); document.getElementById('ask-input').value = ''`);
await sleep(1500);

const frames: { file: string; t: number }[] = [];
const cdp = await page.createCDPSession();
cdp.on('Page.screencastFrame', async (f) => {
  const file = `f${String(frames.length).padStart(5, '0')}.jpg`;
  frames.push({ file, t: f.metadata.timestamp ?? Date.now() / 1000 });
  writeFileSync(`${FRAMES}/${file}`, Buffer.from(f.data, 'base64'));
  await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
});
const speedUps: { from: number; to: number }[] = [];

// ─── Director helpers ────────────────────────────────────────────────
async function moveTo(x: number, y: number, ms = 750) {
  await js(`rec.move(${x}, ${y}, ${ms})`);
  await page.mouse.move(x, y);
}
async function center(sel: string, text?: string) {
  const r = await js<{ x: number; y: number } | null>(`(() => {
    const els = [...document.querySelectorAll(${JSON.stringify(sel)})];
    const el = ${text ? `els.find((e) => e.textContent.includes(${JSON.stringify(text)}))` : 'els[0]'};
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!r) throw new Error(`not found: ${sel} ${text ?? ''}`);
  return r;
}
async function clickAt(x: number, y: number, ms?: number) {
  await moveTo(x, y, ms);
  await sleep(120);
  await js('rec.click()');
  await page.mouse.click(x, y);
}
const click = async (sel: string, text?: string, ms?: number) => { const c = await center(sel, text); await clickAt(c.x, c.y, ms); };
const hover = async (sel: string, text?: string, ms?: number) => { const c = await center(sel, text); await moveTo(c.x, c.y, ms); };
const say = (eyebrow: string, text: string, top = false) => js(`rec.say(${JSON.stringify(eyebrow)}, ${JSON.stringify(text)}, ${top})`);
const hush = () => js('rec.hush()');
async function chapter(eyebrow: string, title: string, sub = '', ms = 2600) {
  await hush();
  await js(`rec.card(${JSON.stringify(`<small>${eyebrow}</small><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}`)})`);
  await sleep(ms);
  await js('rec.uncard()');
  await sleep(600);
}
async function scrollCard(dy: number, steps = 8) {
  const c = await center('#card');
  await moveTo(c.x, c.y + 80, 500);
  for (let i = 0; i < steps; i++) { await page.mouse.wheel({ deltaY: dy / steps }); await sleep(70); }
}
async function clickStar(id: number) {
  const p = await js<{ x: number; y: number }>(`app.universe.project(app.galaxy.stars[${id}].pos)`);
  await clickAt(p.x, p.y, 900);
  await sleep(300);
  // fall back to a direct selection if the click landed between stars
  await js(`document.getElementById('card').classList.contains('hidden') || !document.getElementById('card-head').querySelector('blockquote') ? app.selectStar(${id}) : 0`);
}

// ─── The story ───────────────────────────────────────────────────────
await js(`rec.card(${JSON.stringify('<small>11:40 PM</small><h1>Philosophy exam at <em>9 AM.</em></h1><p>6,364 words to get through, and no idea where to start.</p>')})`);
await sleep(1200); // the opening card is already on screen when recording starts
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
const t0 = Date.now();
await sleep(3800);
await js('rec.uncard()');
await sleep(2600); // the intro: "Every idea is a star."
await hover('#intro-go', undefined, 1100);
await sleep(500);
await click('#intro-go', undefined, 300);
await sleep(1800);

await say('The map', 'The AI read every word and found 13 topics on its own. Each colour is one.');
for (const name of ['Methods & Wisdom', 'Period & Bce', 'Moral & Ethics']) { await hover('#legend li', name, 600); await sleep(450); }
await sleep(900);
await click('#legend li', 'Moral & Ethics', 400);
await sleep(900);
await say('Topics', 'Open a topic: its key idea comes first, then its key terms and the topics it connects to.');
await sleep(4200);
const ethics = await js<number>(`app.galaxy.constellations.find((c) => c.name === 'Moral & Ethics').id`);
const starId = await js<number>(`app.galaxy.stars.filter((s) => s.cluster === ${ethics})[4].id`);
await clickStar(starId);
await sleep(700);
await say('Stars', 'Every star is one idea. Threads link it to the closest ideas, even chapters apart.');
await sleep(4200);

await chapter('Chapter 2', 'Short on time?');
await click('#btn-keys');
await sleep(800);
await say('Key ideas', 'The single most central idea of every topic: the whole chapter in one minute.');
await sleep(2400);
await scrollCard(520);
await sleep(2600);

await chapter('Chapter 3', 'Stuck on a question?');
await click('#ask-input');
await page.keyboard.type('How do we know what is true?', { delay: 55 });
await sleep(350);
await page.keyboard.press('Enter');
await sleep(900);
await say('Ask the sky', 'Ask in your own words. It searches by meaning, not by keywords.');
await sleep(3400);
await click('#card-list li');
await sleep(3000);

await chapter('Chapter 4', 'But do you actually <em>get it?</em>');
await click('#legend li', 'Moral & Ethics');
await sleep(1400);
await click('#card-actions button', 'Explain it back');
await sleep(700);
await say('Explain it back', 'Explain the topic from memory, in your own words.', true);
await page.keyboard.type('Ethics is about what is morally right and wrong. Normative ethics looks for principles to judge actions, for example by their consequences or by duties.', { delay: 22 });
await sleep(600);
await click('#explain-go');
await hush();
await page.waitForFunction(`document.getElementById('card-head').textContent.includes('You explained')`, { timeout: 60000 });
await sleep(600);
await say('Explain it back', 'The AI checks it against the core ideas: what you explained, and exactly what to reread.');
await sleep(3000);
await scrollCard(380, 6);
await sleep(2400);

await hush();
await scrollCard(-380, 6);
await sleep(400);
await chapter('Chapter 5', 'Lock it in.');
await click('#card-actions button', 'Quiz this topic');
await sleep(600);
await say('Quiz', 'Questions come straight from the text. Stars burn gold as you master them.', true);
for (let i = 0; i < 3; i++) {
  await sleep(2300);
  const answer = await js<string>('app.quiz.answer');
  await click('.option', answer, 650);
  await sleep(1500);
}
await sleep(500);
await click('#quiz-close');
await sleep(700);
await say('Saved progress', 'Progress is saved on your device. The gold bars show how much is left.');
await hover('#legend li', 'Moral & Ethics', 700);
await sleep(3400);

await chapter('Chapter 6', 'Tomorrow morning.', 'Take it with you.');
await hover('#btn-guide', undefined, 800);
await say('Study guide', 'One click: a study guide with every topic’s key idea, key terms and a checklist.');
await sleep(900);
await click('#btn-guide', undefined, 200);
await sleep(3000);

await chapter('Next week', 'A new chapter?', 'Any Wikipedia article, PDF or lecture notes.');
await click('#open-paste');
await sleep(900);
await say('Map a document', 'Paste a link, drop a PDF, or paste your notes.', true);
await click('#wiki-input');
await page.keyboard.type('Photosynthesis', { delay: 70 });
await sleep(500);
await click('#wiki-form button');
await sleep(1200);
await say('On your device', 'A neural network reads it right here in the browser. No servers, no sign-up.');
await js('rec.badge(true)');
const from = Date.now() / 1000;
await page.waitForFunction(`document.getElementById('forming').classList.contains('hidden')`, { timeout: 300000 });
speedUps.push({ from, to: Date.now() / 1000 });
await js('rec.badge(false)');
await sleep(1600);
const topics = await js<number>('app.galaxy.constellations.length');
await say('Photosynthesis', `A brand-new galaxy: ${topics} topics, ready to explore.`);
await sleep(2400);
await click('#btn-tour');
await sleep(7500);
await hush();

await js(`rec.card(${JSON.stringify('<svg viewBox="0 0 32 32"><path d="M16 2l2.6 10.1L28 16l-9.4 3.9L16 30l-2.6-10.1L4 16l9.4-3.9z"/></svg><h1>Every idea <em>is a star.</em></h1><p>Constellate · constellate-black.vercel.app</p><small>Runs 100% in your browser</small>')})`);
await sleep(5500);

await cdp.send('Page.stopScreencast');
await sleep(500);
await browser.close();
console.log(`captured ${frames.length} frames over ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// ─── Encode: variable-rate frames → constant 30 fps, long waits sped up ──
const speed = (t: number) => {
  const s = speedUps.find((x) => t >= x.from && t < x.to);
  return s ? Math.max(1, (s.to - s.from) / 5) : 1; // any wait becomes ~5 seconds on screen
};
const lines = ['ffconcat version 1.0'];
for (let i = 0; i < frames.length; i++) {
  const dur = i + 1 < frames.length ? frames[i + 1].t - frames[i].t : 1 / FPS;
  lines.push(`file frames/${frames[i].file}`, `duration ${(dur / speed(frames[i].t)).toFixed(4)}`);
}
lines.push(`file frames/${frames[frames.length - 1].file}`);
writeFileSync(`${OUT}/frames.ffconcat`, lines.join('\n'));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${OUT}/frames.ffconcat`,
  '-vf', `fps=${FPS},format=yuv420p`, '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', `${OUT}/constellate-demo.mp4`], { stdio: 'inherit' });
console.log(`wrote ${OUT}/constellate-demo.mp4`);
