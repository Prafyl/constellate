/**
 * Captures the README / Devpost screenshots from the running dev server.
 * Usage: npm run dev -- --port 4317   then   npx tsx scripts/screenshots.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import puppeteer, { type Page } from 'puppeteer-core';

const URL = process.env.URL ?? 'http://localhost:4317/';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = 'docs/screenshots';
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--enable-unsafe-swiftshader'],
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function open(sky: string, w = 1920, h = 1080, dpr = 1) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('PAGE ERROR', e));
  await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr });
  await page.goto(`${URL}?sky=${sky}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: '.hint{display:none}' });
  return page;
}
const shot = (page: Page, name: string) => page.screenshot({ path: `${OUT}/${name}.png` as `${string}.png` });
const js = <T>(page: Page, fn: string) => page.evaluate(fn) as Promise<T>;

// 1–4. Hero shots of every demo galaxy
for (const sky of ['nepal', 'biology', 'history', 'machine-learning']) {
  const page = await open(sky);
  await sleep(4200);
  await shot(page, `galaxy-${sky}`);
  if (sky === 'nepal') {
    // 5. The poster export
    const data = await js<string>(page, 'app.poster()');
    writeFileSync(`${OUT}/poster-nepal.png`, Buffer.from(data.split(',')[1], 'base64'));
  }
  await page.close();
}

// 6. Big bang: the galaxy mid-formation
{
  const page = await open('biology');
  await js(page, `app.universe.load(app.galaxy)`);
  await sleep(650);
  await shot(page, 'big-bang');
  await page.close();
}

// 7. A focused star with its closest ideas
{
  const page = await open('nepal');
  await sleep(3500);
  await js(page, `app.selectStar(app.galaxy.stars.find(s => s.text.includes('Tenzing')).id)`);
  await sleep(2200);
  await shot(page, 'star-focus');
  await page.close();
}

// 8. Quiz mode, mid-streak
{
  const page = await open('biology');
  await sleep(3500);
  await js(page, `app.startQuiz()`);
  for (let i = 0; i < 6; i++) {
    await sleep(1700);
    await js(page, `[...document.querySelectorAll('.option')].find(b => b.textContent === app.quiz.answer).click()`);
  }
  await sleep(1600);
  await shot(page, 'quiz');
  await page.close();
}

// 9. Constellation fly-to (tour view)
{
  const page = await open('machine-learning');
  await sleep(3500);
  await js(page, `app.openConstellation([...app.galaxy.constellations].sort((a,b)=>b.size-a.size)[0].id)`);
  await sleep(2000);
  await shot(page, 'constellation');
  await page.close();
}

// 10. Paste your own text → the model at work
{
  const page = await open('nepal');
  await sleep(1500);
  await js(page, `document.getElementById('open-paste').click(); document.getElementById('paste-sample').click()`);
  await sleep(800);
  await shot(page, 'paste');
  await js(page, `document.getElementById('paste-go').click()`);
  await page.waitForFunction(`document.getElementById('forming-stage').textContent === 'Mapping the sky'`, { timeout: 120000 });
  await sleep(300);
  await shot(page, 'forming');
  await page.waitForFunction(`document.getElementById('forming').classList.contains('hidden')`, { timeout: 120000 });
  await sleep(4200);
  await shot(page, 'your-galaxy');
  await page.close();
}

// 12. First-visit intro
{
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('PAGE ERROR', e));
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await sleep(4500);
  await shot(page, 'intro');
  await page.close();
}

// 13. Ask the sky (semantic search)
{
  const page = await open('nepal');
  await sleep(3000);
  await js(page, `document.getElementById('ask-input').value = 'Who first climbed Everest?'; document.getElementById('ask').requestSubmit()`);
  await page.waitForFunction(`!document.getElementById('card').classList.contains('hidden')`, { timeout: 120000 });
  await sleep(2400);
  await shot(page, 'ask-the-sky');
  await page.close();
}

// 14. How it works
{
  const page = await open('machine-learning');
  await sleep(3000);
  await js(page, `document.getElementById('open-info').click()`);
  await sleep(1200);
  await shot(page, 'how-it-works');
  await page.close();
}

// 11. Phone
{
  const page = await open('nepal', 390, 844, 3);
  await sleep(4200);
  await shot(page, 'mobile');
  await page.close();
}

await browser.close();
console.log('screenshots saved to', OUT);
