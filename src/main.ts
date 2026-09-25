import './styles/theme.css';
import { Universe } from './galaxy/scene';
import { StarState } from './galaxy/stars';
import { makeQuestion, type Question } from './quiz/cloze';
import { downloadPoster, renderPoster } from './ui/poster';
import { chunkText } from './ml/pipeline';
import type { Galaxy } from './types';

const DEMOS = [
  { slug: 'nepal', title: 'Nepal' },
  { slug: 'biology', title: 'Biology' },
  { slug: 'history', title: 'World History' },
  { slug: 'machine-learning', title: 'Machine Learning' },
];

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const universe = new Universe($('universe'));

let galaxy: Galaxy;
let selected: number | null = null;
let quiz: Question | null = null;
let streak = 0;
let tourTimer = 0;
const mastered = new Set<number>();

// ─── Galaxy switching ────────────────────────────────────────────────
function renderSkies(active: string) {
  $('skies').innerHTML = '';
  for (const d of DEMOS) {
    const b = document.createElement('button');
    b.className = `pill${d.title === active ? ' active' : ''}`;
    b.textContent = d.title;
    b.onclick = () => loadDemo(d.slug);
    $('skies').appendChild(b);
  }
}

async function loadDemo(slug: string) {
  const g: Galaxy = await (await fetch(`demos/${slug}.json`)).json();
  show(g);
}

function show(g: Galaxy) {
  galaxy = g;
  mastered.clear();
  endQuiz();
  stopTour();
  select(null);
  universe.load(g);
  renderSkies(g.title);

  $('galaxy-title').textContent = g.title;
  $('galaxy-stats').textContent = `${g.stars.length} ideas · ${g.constellations.length} constellations`;
  $('legend').innerHTML = '';
  for (const c of [...g.constellations].sort((a, b) => b.size - a.size)) {
    const li = document.createElement('li');
    li.style.setProperty('--c', c.color);
    li.innerHTML = `<span class="dot"></span><b>${c.name}</b><em>${c.size}</em>`;
    li.onclick = () => flyToConstellation(c.id);
    $('legend').appendChild(li);
  }
  paintStates();
}

// ─── Selection ───────────────────────────────────────────────────────
function select(id: number | null) {
  selected = id;
  universe.showThreads(id);
  paintStates();
  const card = $('star-card');
  if (id == null) return card.classList.add('hidden');

  const s = galaxy.stars[id];
  const con = galaxy.constellations[s.cluster];
  card.style.setProperty('--c', con.color);
  $('card-con').textContent = `✦ ${con.name}`;
  $('card-text').textContent = s.text;
  $('card-neighbors').innerHTML = '';
  for (const n of s.neighbors) {
    const li = document.createElement('li');
    const ns = galaxy.stars[n];
    li.style.setProperty('--c', galaxy.constellations[ns.cluster].color);
    li.textContent = ns.text.length > 110 ? `${ns.text.slice(0, 110)}…` : ns.text;
    li.onclick = () => select(n);
    $('card-neighbors').appendChild(li);
  }
  card.classList.remove('hidden');
  universe.focus(s.pos);
}

function flyToConstellation(id: number) {
  select(null);
  const c = galaxy.constellations[id];
  universe.focus(c.center, 55);
  universe.setStates((i) => (mastered.has(i) ? StarState.Mastered : galaxy.stars[i].cluster === id ? StarState.Lit : StarState.Dim));
}

function paintStates() {
  const lit = new Set(selected != null ? [selected, ...galaxy.stars[selected].neighbors] : []);
  universe.setStates((i) => {
    if (quiz?.starId === i) return StarState.Lit;
    if (mastered.has(i)) return StarState.Mastered;
    if (selected == null) return StarState.Normal;
    return lit.has(i) ? StarState.Lit : StarState.Dim;
  });
}

universe.onStarClick = (id) => !quiz && select(id);
universe.onConstellationClick = flyToConstellation;
universe.onStarHover = (id, x, y) => {
  const tip = $('tooltip');
  if (id == null || quiz) return tip.classList.add('hidden');
  const s = galaxy.stars[id];
  tip.textContent = s.text.length > 90 ? `${s.text.slice(0, 90)}…` : s.text;
  tip.style.transform = `translate(${x + 16}px, ${y + 12}px)`;
  tip.style.setProperty('--c', galaxy.constellations[s.cluster].color);
  tip.classList.remove('hidden');
};
$('card-close').onclick = () => select(null);

// ─── Quiz ────────────────────────────────────────────────────────────
function nextQuestion() {
  quiz = makeQuestion(galaxy, mastered);
  const total = galaxy.stars.length;
  $('quiz-count').textContent = `${mastered.size} / ${total} mastered`;
  ($('quiz-bar') as HTMLElement).style.width = `${(mastered.size / total) * 100}%`;
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
  if (right) {
    mastered.add(q.starId);
    streak++;
  } else {
    btn.classList.add('wrong');
    streak = 0;
  }
  universe.setStates((i) => (i === q.starId ? (right ? StarState.Mastered : StarState.Wrong) : mastered.has(i) ? StarState.Mastered : StarState.Normal));
  $('quiz-prompt').textContent = galaxy.stars[q.starId].text;
  setTimeout(nextQuestion, right ? 1300 : 2600);
}

function startQuiz() {
  stopTour();
  select(null);
  streak = 0;
  $('quiz').classList.remove('hidden');
  $('hud').classList.add('faded');
  nextQuestion();
}

function endQuiz() {
  quiz = null;
  $('quiz').classList.add('hidden');
  $('hud').classList.remove('faded');
  if (galaxy) paintStates();
}

$('btn-quiz').onclick = startQuiz;
$('quiz-close').onclick = () => { endQuiz(); universe.overview(); };

// ─── Tour ────────────────────────────────────────────────────────────
function startTour() {
  endQuiz();
  let i = 0;
  const order = [...galaxy.constellations].sort((a, b) => b.size - a.size);
  const step = () => {
    if (i === order.length) return stopTour(true);
    flyToConstellation(order[i++].id);
    tourTimer = window.setTimeout(step, 3600);
  };
  $('btn-tour').classList.add('active');
  step();
}

function stopTour(backToOverview = false) {
  clearTimeout(tourTimer);
  tourTimer = 0;
  $('btn-tour').classList.remove('active');
  if (backToOverview) { paintStates(); universe.overview(); }
}

$('btn-tour').onclick = () => (tourTimer ? stopTour(true) : startTour());
$('btn-poster').onclick = () => downloadPoster(universe.snapshot(), galaxy);

// ─── Paste your own text ─────────────────────────────────────────────
const pasteText = $<HTMLTextAreaElement>('paste-text');
$('open-paste').onclick = () => { $('paste').classList.remove('hidden'); pasteText.focus(); };
$('paste-close').onclick = () => $('paste').classList.add('hidden');
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

let worker: Worker | null = null;
$('paste-go').onclick = () => {
  const title = $<HTMLInputElement>('paste-title').value.trim() || 'My Galaxy';
  $('paste').classList.add('hidden');
  $('forming').classList.remove('hidden');
  worker ??= new Worker(new URL('./ml/embed.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    if (e.data.type === 'progress') {
      $('forming-stage').textContent = e.data.stage;
      $('forming-bar').style.width = `${Math.round(e.data.pct * 100)}%`;
    } else {
      $('forming').classList.add('hidden');
      show(e.data.galaxy);
      renderSkies(e.data.galaxy.title);
      const b = document.createElement('button');
      b.className = 'pill active mine';
      b.textContent = `✦ ${e.data.galaxy.title}`;
      $('skies').appendChild(b);
    }
  };
  worker.postMessage({ title, text: pasteText.value });
};

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { select(null); endQuiz(); stopTour(); $('paste').classList.add('hidden'); }
});
setTimeout(() => $('hint').classList.add('gone'), 7000);

if (import.meta.env.DEV) Object.assign(window, { app: { universe, select, startQuiz, flyToConstellation, get galaxy() { return galaxy; }, get quiz() { return quiz; }, poster: () => renderPoster(universe.snapshot(), galaxy).toDataURL('image/png') } });

loadDemo(new URLSearchParams(location.search).get('sky') ?? 'nepal');
