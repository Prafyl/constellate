import './styles/theme.css';
import { Universe } from './galaxy/scene';
import { StarState } from './galaxy/stars';
import { makeQuestion, type Question } from './quiz/cloze';
import { downloadPoster, renderPoster } from './ui/poster';
import { showPanel, hidePanel } from './ui/panel';
import { renderPipeline } from './ui/how-it-works';
import { chunkText } from './ml/pipeline';
import { buildInWorker, embedQuery, cosine } from './ml/client';
import { fromWikipedia, fromFile, type Document } from './io/sources';
import { downloadStudyGuide } from './ui/study-guide';
import type { Galaxy } from './types';

const DEMOS = [
  { slug: 'philosophy', title: 'Philosophy', ask: 'How do we know what is true?' },
  { slug: 'nepal', title: 'Nepal', ask: 'Who first climbed Everest?' },
  { slug: 'biology', title: 'Biology', ask: 'How do cells get energy?' },
  { slug: 'history', title: 'World History', ask: 'What ended the Cold War?' },
  { slug: 'machine-learning', title: 'Machine Learning', ask: 'How do chatbots read text?' },
];

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const universe = new Universe($('universe'));

let galaxy: Galaxy;
let custom: Galaxy | null = null;
let selected: number | null = null;
let lit: Set<number> | null = null; // stars highlighted by a constellation or a search
let quiz: Question | null = null;
let streak = 0;
let tourTimer = 0;
const mastered = new Set<number>();

const colorOf = (starId: number) => galaxy.constellations[galaxy.stars[starId].cluster].color;

// ─── Galaxy switching ────────────────────────────────────────────────
function renderSkies() {
  $('skies').innerHTML = '';
  const add = (label: string, active: boolean, onClick: () => void, mine = false) => {
    const b = document.createElement('button');
    b.className = `pill${active ? ' active' : ''}${mine ? ' mine' : ''}`;
    b.textContent = label;
    b.onclick = onClick;
    $('skies').appendChild(b);
  };
  for (const d of DEMOS) add(d.title, d.title === galaxy?.title, () => loadDemo(d.slug));
  if (custom) add(`✦ ${custom.title}`, custom === galaxy, () => show(custom!), true);
}

async function loadDemo(slug: string) {
  show(await (await fetch(`demos/${slug}.json`)).json());
}

function show(g: Galaxy) {
  galaxy = g;
  mastered.clear();
  endQuiz();
  stopTour();
  clearFocus();
  universe.load(g);
  renderSkies();
  renderPipeline(g);

  $('galaxy-title').textContent = g.title;
  const minutes = Math.max(1, Math.round(g.words / 230));
  $('galaxy-stats').innerHTML = `<span><b>${g.words.toLocaleString()}</b> words</span><span><b>${g.stars.length}</b> ideas</span><span><b>${g.constellations.length}</b> topics</span>`;
  $('galaxy-source').innerHTML = g.source
    ? `≈${minutes} min read · <a href="${/^https?:/.test(g.source) ? g.source : '#'}" target="_blank" rel="noopener">${g.source.replace(/^https?:\/\/(www\.)?/, '').slice(0, 42)}</a>`
    : `≈${minutes} min read`;
  $('legend').innerHTML = '';
  for (const c of [...g.constellations].sort((a, b) => b.size - a.size)) {
    const li = document.createElement('li');
    li.style.setProperty('--c', c.color);
    li.innerHTML = `<span class="dot"></span><b>${c.name}</b><em>${c.size}</em>`;
    li.onclick = () => openConstellation(c.id);
    $('legend').appendChild(li);
  }
  const demo = DEMOS.find((d) => d.title === g.title);
  $<HTMLInputElement>('ask-input').placeholder = `Ask the sky… “${demo?.ask ?? 'What is the main idea?'}”`;
  $<HTMLInputElement>('ask-input').value = '';
}

// ─── Focus: a star, a constellation, or search results ──────────────
function paintStates() {
  const near = selected != null ? new Set([selected, ...galaxy.stars[selected].neighbors]) : lit;
  universe.setStates((i) => {
    if (quiz?.starId === i) return StarState.Lit;
    if (mastered.has(i)) return StarState.Mastered;
    if (!near) return StarState.Normal;
    return near.has(i) ? StarState.Lit : StarState.Dim;
  });
}

function clearFocus() {
  selected = null;
  lit = null;
  universe.showThreads(null);
  hidePanel();
  if (galaxy) paintStates();
}

function selectStar(id: number) {
  stopTour();
  selected = id;
  lit = null;
  const s = galaxy.stars[id];
  const con = galaxy.constellations[s.cluster];
  universe.showThreads(id);
  paintStates();
  universe.focus(s.pos);
  showPanel({
    eyebrow: `✦ ${con.name}`,
    color: con.color,
    quote: s.text,
    meta: s.section ? `§ ${s.section}` : undefined,
    listLabel: 'Closest ideas anywhere in the text',
    items: s.neighbors.map((n, i) => ({ text: galaxy.stars[n].text, color: colorOf(n), score: s.scores[i], onClick: () => selectStar(n) })),
  });
}

function openConstellation(id: number, withPanel = true) {
  selected = null;
  const c = galaxy.constellations[id];
  const members = galaxy.stars.filter((s) => s.cluster === id);
  lit = new Set(members.map((s) => s.id));
  universe.showThreads(null);
  paintStates();
  universe.focus(c.center, 55);
  if (!withPanel) return hidePanel();
  showPanel({
    eyebrow: 'Constellation',
    color: c.color,
    heading: c.name,
    meta: `${members.length} of ${galaxy.stars.length} ideas · ${Math.round((members.length / galaxy.stars.length) * 100)}% of the sky`,
    chips: c.keywords,
    listLabel: 'Ideas in this constellation',
    items: members.map((s) => ({ text: s.text, color: c.color, onClick: () => selectStar(s.id) })),
  });
}

universe.onStarClick = (id) => { if (quiz) return; id == null ? clearFocus() : selectStar(id); };
universe.onConstellationClick = (id) => openConstellation(id);
universe.onStarHover = (id, x, y) => {
  const tip = $('tooltip');
  if (id == null || quiz) return tip.classList.add('hidden');
  const s = galaxy.stars[id];
  tip.textContent = s.text.length > 90 ? `${s.text.slice(0, 90)}…` : s.text;
  tip.style.transform = `translate(${x + 16}px, ${y + 12}px)`;
  tip.style.setProperty('--c', colorOf(id));
  tip.classList.remove('hidden');
};
$('card-close').onclick = () => { clearFocus(); universe.overview(); };

// ─── Ask the sky: semantic search ───────────────────────────────────
$<HTMLFormElement>('ask').onsubmit = async (e) => {
  e.preventDefault();
  const q = $<HTMLInputElement>('ask-input').value.trim();
  if (!q) return;
  endQuiz();
  stopTour();
  const status = $('ask-status');
  $('ask').classList.add('busy');
  status.textContent = 'thinking…';
  const vec = await embedQuery(q, (_stage, pct) => (status.textContent = `loading model ${Math.round(pct * 1000)}%`));
  $('ask').classList.remove('busy');
  status.textContent = 'semantic search';

  const ranked = galaxy.stars.map((s) => ({ id: s.id, score: cosine(vec, s.vec) })).sort((a, b) => b.score - a.score).slice(0, 5);
  const best = ranked[0].id;
  selected = null;
  lit = new Set(ranked.map((r) => r.id));
  universe.showThreads(best, ranked.map((r) => r.id));
  paintStates();
  universe.focus(galaxy.stars[best].pos, 45);
  showPanel({
    eyebrow: '⌕ Ask the sky',
    color: '#ffd36e',
    heading: `“${q}”`,
    meta: 'Ranked by meaning, not keywords: the model compares your question to every star.',
    listLabel: 'Brightest matches',
    items: ranked.map((r) => ({ text: galaxy.stars[r.id].text, color: colorOf(r.id), score: r.score, onClick: () => selectStar(r.id) })),
  });
};

// ─── Quiz ────────────────────────────────────────────────────────────
function nextQuestion() {
  quiz = makeQuestion(galaxy, mastered);
  const total = galaxy.stars.length;
  $('quiz-count').textContent = `${mastered.size} / ${total} mastered`;
  $('quiz-bar').style.width = `${(mastered.size / total) * 100}%`;
  $('quiz-streak').textContent = `🔥 ${streak}`;
  if (!quiz) {
    $('quiz-prompt').textContent = 'Every star is burning gold. You have mastered this galaxy. ✦';
    $('quiz-options').innerHTML = '';
    return universe.overview();
  }
  $('quiz-prompt').textContent = quiz.prompt;
  $('quiz-options').innerHTML = '';
  for (const opt of quiz.options) {
    const b = document.createElement('button');
    b.className = 'option';
    b.textContent = opt;
    b.onclick = () => answer(opt, b);
    $('quiz-options').appendChild(b);
  }
  paintStates();
  universe.focus(galaxy.stars[quiz.starId].pos, 50);
}

function answer(opt: string, btn: HTMLButtonElement) {
  if (!quiz) return;
  const q = quiz;
  const right = opt === q.answer;
  document.querySelectorAll<HTMLButtonElement>('.option').forEach((b) => {
    b.disabled = true;
    if (b.textContent === q.answer) b.classList.add('right');
  });
  if (right) { mastered.add(q.starId); streak++; } else { btn.classList.add('wrong'); streak = 0; }
  universe.setStates((i) => (i === q.starId ? (right ? StarState.Mastered : StarState.Wrong) : mastered.has(i) ? StarState.Mastered : StarState.Normal));
  $('quiz-prompt').textContent = galaxy.stars[q.starId].text;
  setTimeout(() => quiz === q && nextQuestion(), right ? 1300 : 2600);
}

function startQuiz() {
  stopTour();
  clearFocus();
  streak = 0;
  $('quiz').classList.remove('hidden');
  document.body.classList.add('quizzing');
  nextQuestion();
}

function endQuiz() {
  quiz = null;
  $('quiz').classList.add('hidden');
  document.body.classList.remove('quizzing');
  if (galaxy) paintStates();
}

$('btn-quiz').onclick = startQuiz;
$('quiz-close').onclick = () => { endQuiz(); universe.overview(); };

// ─── Tour ────────────────────────────────────────────────────────────
function startTour() {
  endQuiz();
  clearFocus();
  let i = 0;
  const order = [...galaxy.constellations].sort((a, b) => b.size - a.size);
  const step = () => {
    if (i === order.length) return stopTour(true);
    openConstellation(order[i++].id, false);
    tourTimer = window.setTimeout(step, 3600);
  };
  $('btn-tour').classList.add('active');
  step();
}

function stopTour(backToOverview = false) {
  if (!tourTimer && !backToOverview) return;
  clearTimeout(tourTimer);
  tourTimer = 0;
  $('btn-tour').classList.remove('active');
  if (backToOverview) { clearFocus(); universe.overview(); }
}

$('btn-tour').onclick = () => (tourTimer ? stopTour(true) : startTour());
$('btn-poster').onclick = () => downloadPoster(universe.snapshot(), galaxy);
$('btn-guide').onclick = () => downloadStudyGuide(galaxy, mastered);

// ─── Bring your own document ────────────────────────────────────────
const pasteText = $<HTMLTextAreaElement>('paste-text');
const openModal = (id: string) => $(id).classList.remove('hidden');
const closeModal = (id: string) => $(id).classList.add('hidden');

function setTab(tab: string) {
  document.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll<HTMLElement>('[data-pane]').forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== tab));
  $('import-error').textContent = '';
}
document.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => (b.onclick = () => setTab(b.dataset.tab!)));

$('open-paste').onclick = () => { openModal('paste'); setTab('wiki'); $('wiki-input').focus(); };
$('paste-close').onclick = () => closeModal('paste');

async function ingest(load: () => Promise<Document>) {
  $('import-error').textContent = '';
  let doc: Document;
  try {
    doc = await load();
  } catch (err) {
    $('import-error').textContent = (err as Error).message;
    return;
  }
  const n = chunkText(doc.text).length;
  if (n < 8) { $('import-error').textContent = `That's only ${n} ideas. Constellate needs at least a few paragraphs.`; return; }

  closeModal('paste');
  openModal('forming');
  $('forming-title').textContent = doc.title;
  $('forming-error').classList.add('hidden');
  let best = 0;
  try {
    custom = await buildInWorker(doc.title, doc.text, doc.source, (stage, pct) => {
      best = Math.max(best, pct);
      $('forming-stage').textContent = stage;
      $('forming-bar').style.width = `${Math.round(best * 100)}%`;
    });
    closeModal('forming');
    show(custom);
  } catch (err) {
    $('forming-error').classList.remove('hidden');
    $('forming-error-msg').textContent = (err as Error).message;
  }
}

$<HTMLFormElement>('wiki-form').onsubmit = (e) => {
  e.preventDefault();
  const q = $<HTMLInputElement>('wiki-input').value.trim();
  if (q) ingest(() => fromWikipedia(q));
};
document.querySelectorAll<HTMLElement>('[data-wiki]').forEach((b) => (b.onclick = () => ingest(() => fromWikipedia(b.dataset.wiki!))));

const fileInput = $<HTMLInputElement>('file-input');
fileInput.onchange = () => fileInput.files?.[0] && ingest(() => fromFile(fileInput.files![0]));
const drop = $('drop');
drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
drop.ondragleave = () => drop.classList.remove('over');
drop.ondrop = (e) => {
  e.preventDefault();
  drop.classList.remove('over');
  const f = e.dataTransfer?.files[0];
  if (f) ingest(() => fromFile(f));
};

pasteText.oninput = () => {
  const n = chunkText(pasteText.value).length;
  $('paste-count').textContent = `${n} ideas`;
  $<HTMLButtonElement>('paste-go').disabled = n < 8;
};
$('paste-sample').onclick = async () => {
  pasteText.value = await (await fetch('samples/solar-system.txt')).text();
  $<HTMLInputElement>('paste-title').value = 'The Solar System';
  pasteText.dispatchEvent(new Event('input'));
};
$('paste-go').onclick = () => ingest(async () => ({ title: $<HTMLInputElement>('paste-title').value.trim() || 'My notes', text: pasteText.value }));
$('forming-close').onclick = () => closeModal('forming');

// ─── Intro & info ────────────────────────────────────────────────────
function dismissIntro() {
  document.body.classList.remove('intro-open');
  universe.setShift(0);
  try { localStorage.setItem('constellate:intro', '1'); } catch { /* private mode */ }
}
$('intro-go').onclick = dismissIntro;
// Any interaction outside the intro (switching skies, importing, searching…) dismisses it.
document.addEventListener('pointerdown', (e) => {
  if (document.body.classList.contains('intro-open') && !(e.target as Element).closest('.intro')) dismissIntro();
}, true);
$('intro-how').onclick = () => { dismissIntro(); openModal('info'); };
$('open-info').onclick = () => openModal('info');
$('info-close').onclick = () => closeModal('info');
for (const id of ['info', 'paste']) $(id).addEventListener('click', (e) => e.target === $(id) && closeModal(id));

window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  clearFocus(); endQuiz(); stopTour(); closeModal('paste'); closeModal('info'); dismissIntro();
});
setTimeout(() => $('hint').classList.add('gone'), 9000);

const params = new URLSearchParams(location.search);
let seen = false;
try { seen = !!localStorage.getItem('constellate:intro'); } catch { /* private mode */ }
if (!seen && !params.has('sky')) {
  document.body.classList.add('intro-open');
  universe.setShift(0.2);
}

if (import.meta.env.DEV) {
  Object.assign(window, {
    app: {
      universe, selectStar, openConstellation, startQuiz, dismissIntro,
      get galaxy() { return galaxy; },
      get quiz() { return quiz; },
      poster: () => renderPoster(universe.snapshot(), galaxy).toDataURL('image/png'),
    },
  });
}

loadDemo(params.get('sky') ?? 'philosophy');
