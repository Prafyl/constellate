/**
 * Captures the Devpost gallery at 3:2 (1800×1200): 15 images, one per feature (Devpost's limit).
 * Usage: npm run dev -- --port 4317   then   npx tsx scripts/gallery.ts
 */
import { mkdirSync } from 'node:fs';
import puppeteer, { type Page } from 'puppeteer-core';

const URL = process.env.URL ?? 'http://localhost:4317/';
const OUT = 'docs/gallery';
mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'],
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function open(query = '?sky=philosophy', w = 1500, h = 1000, dpr = 1.2) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('PAGE ERROR', e));
  await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr });
  await page.goto(URL + query, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: '.hint, .tooltip { display: none !important; }' });
  await sleep(4500);
  return page;
}
const js = <T = unknown>(page: Page, code: string) => page.evaluate(code) as Promise<T>;
const shot = (page: Page, name: string) => page.screenshot({ path: `${OUT}/${name}.png` as `${string}.png` });
const ethics = `app.galaxy.constellations.find((c) => c.name === 'Moral & Ethics').id`;

// 01 — first impression
{
  const page = await open('');
  await shot(page, '01-intro');
  await page.close();
}

const page = await open();
// 02 — the whole map
await shot(page, '02-galaxy');
// 03 — a topic
await js(page, `app.openConstellation(${ethics})`);
await sleep(2200);
await shot(page, '03-topic');
// 04 — a star and its closest ideas
await js(page, `app.selectStar(app.galaxy.stars.filter((s) => s.cluster === ${ethics})[4].id)`);
await sleep(2200);
await shot(page, '04-star');
// 05 — ask the sky (first search downloads the model)
await js(page, `app.clearFocus(); document.getElementById('ask-input').value = 'How do we know what is true?'; document.getElementById('ask').requestSubmit()`);
await page.waitForFunction(`document.getElementById('card-head').textContent.includes('How do we know')`, { timeout: 180000 });
await sleep(2400);
await shot(page, '05-ask-the-sky');
// 06 — key ideas
await js(page, 'app.showKeyIdeas()');
await sleep(2400);
await shot(page, '06-key-ideas');
// 07 — explain it back
await js(page, `app.tryFeature('explain')`);
await sleep(1200);
await shot(page, '07-explain-it-back-write');
await js(page, `document.getElementById('explain-go').click()`);
await page.waitForFunction(`document.getElementById('card-head').textContent.includes('You explained')`, { timeout: 60000 });
await sleep(2400);
await shot(page, '08-explain-it-back-result');
// 09 — topic quiz with a couple of stars already gold
await js(page, `app.startQuiz(${ethics})`);
for (let i = 0; i < 3; i++) {
  await sleep(900);
  await js(page, `[...document.querySelectorAll('.option')].find((b) => b.textContent === app.quiz.answer).click()`);
  await sleep(1600);
}
await sleep(1200);
await shot(page, '09-quiz');
await js(page, `document.getElementById('quiz-close').click()`);
// 10 — connections between topics
await js(page, `app.tryFeature('connect')`);
await sleep(2600);
await shot(page, '10-connections');
// 11 — for students page
await js(page, `app.clearFocus(); document.getElementById('open-guide').click()`);
await sleep(1200);
await shot(page, '11-for-students');
// 12 — interactive demo
await js(page, 'app.startDemo()');
await sleep(800);
await js(page, `document.getElementById('coach-next').click()`);
await sleep(2600);
await shot(page, '12-interactive-demo');
await js(page, `document.getElementById('coach-skip').click()`);
// 13 — map a document
await js(page, `document.getElementById('open-paste').click()`);
await sleep(600);
await page.type('#wiki-input', 'Photosynthesis');
await sleep(400);
await shot(page, '13-map-a-document');
// 14 — the galaxy it builds, live in the browser
await js(page, `document.querySelector('#wiki-form button').click()`);
await page.waitForFunction(`document.getElementById('forming').classList.contains('hidden')`, { timeout: 300000 });
await sleep(4500);
await shot(page, '14-new-galaxy');
await page.close();

// 15 — phones: three mobile screens composed on one 3:2 canvas
const phones: string[] = [];
for (const setup of [
  '',
  `app.selectStar(app.galaxy.stars.filter((s) => s.cluster === ${ethics})[4].id)`,
  `app.startQuiz(${ethics})`,
]) {
  const p = await open('?sky=philosophy', 390, 844, 2);
  if (setup) { await js(p, setup); await sleep(2200); }
  phones.push((await p.screenshot({ encoding: 'base64' })) as string);
  await p.close();
}
{
  const p = await browser.newPage();
  await p.setViewport({ width: 1500, height: 1000, deviceScaleFactor: 1.2 });
  await p.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;600&display=swap" rel="stylesheet"></head>
  <body style="margin:0;height:1000px;display:grid;place-content:center;gap:34px;background:radial-gradient(ellipse at 50% 40%,#1a1640,#03040b 70%);font-family:Geist,sans-serif;color:#eef1ff">
    <div style="display:flex;gap:40px;justify-content:center">${phones.map((b) => `<img src="data:image/png;base64,${b}" style="width:360px;border-radius:40px;border:8px solid #1c1f33;box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 60px rgba(124,196,255,.12)">`).join('')}</div>
    <p style="margin:0;text-align:center;font-size:30px;font-weight:600;letter-spacing:-.02em">Study anywhere. <span style="color:rgba(238,241,255,.6);font-weight:400">The whole app works on your phone.</span></p>
  </body></html>`, { waitUntil: 'networkidle0' });
  await p.screenshot({ path: `${OUT}/15-mobile.png` });
  await p.close();
}

await browser.close();
console.log('gallery done');
