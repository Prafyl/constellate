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
import { startWalkthrough, endWalkthrough, touring, type Step } from './ui/walkthrough';
import { coreIdeas, keyIdeas, connections, checkExplanation, loadMastered, saveMastered } from './study/study';
import type { Galaxy } from './types';

/** `explain` is a sample student answer the interactive demo types into "Explain it back". */
const DEMOS = [
  { slug: 'philosophy', title: 'Philosophy', ask: 'How do we know what is true?', topic: 'moral',
    explain: 'Ethics is about what is morally right and wrong. Normative ethics looks for principles to judge actions, for example by their consequences or by duties. Some philosophers focus on virtue and good character instead.' },
  { slug: 'nepal', title: 'Nepal', ask: 'Who first climbed Everest?', topic: 'everest',
    explain: 'Nepal rises from the low Terai plains in the south to Mount Everest, which Nepalis call Sagarmatha. It has eight of the ten highest mountains on Earth, including Annapurna. Trekkers come from around the world for the Everest Base Camp trek.' },
  { slug: 'biology', title: 'Biology', ask: 'How do cells get energy?', topic: 'dna',
    explain: 'DNA stores genetic information as a sequence of bases that form pairs. Genes are copied into RNA, which is used to build proteins.' },
  { slug: 'history', title: 'World History', ask: 'What ended the Cold War?', topic: 'roman',
    explain: 'Rome started as a republic and became a huge empire around the Mediterranean. The western half of the empire eventually fell.' },
  { slug: 'machine-learning', title: 'Machine Learning', ask: 'How do chatbots read text?', topic: 'gradient',
    explain: 'Gradient descent trains a model by taking small steps that reduce the error. Linear regression fits a straight line by adjusting its weights.' },
];

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const universe = new Universe($('universe'));

let galaxy: Galaxy;
let custom: Galaxy | null = null;
let selected: number | null = null;
let lit: Set<number> | null = null; // stars highlighted by a constellation or a search
let quiz: Question | null = null;
let quizTopic: number | null = null;
let streak = 0;
let asyncId = 0; // bumped on every new focus, so slow answers (search, explain) can't overwrite newer ones
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
  loadMastered(g).forEach((id) => mastered.add(id));
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
  renderLegend();
  const demo = DEMOS.find((d) => d.title === g.title);
  $<HTMLInputElement>('ask-input').placeholder = `Ask the sky… “${demo?.ask ?? 'What is the main idea?'}”`;
  $<HTMLInputElement>('ask-input').value = '';
}

/** Topic list; the gold bar under each topic fills as its ideas are mastered in the quiz. */
function renderLegend() {
  $('legend').innerHTML = '';
  for (const c of [...galaxy.constellations].sort((a, b) => b.size - a.size)) {
    const done = galaxy.stars.filter((s) => s.cluster === c.id && mastered.has(s.id)).length;
    const li = document.createElement('li');
    li.style.setProperty('--c', c.color);
    li.style.setProperty('--p', `${done / c.size}`);
    li.innerHTML = `<span class="dot"></span><b>${c.name}</b><em>${done ? `${done}/${c.size}` : c.size}</em>`;
    li.onclick = () => openConstellation(c.id);
    $('legend').appendChild(li);
  }
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
  asyncId++;
  selected = null;
  lit = null;
  universe.showThreads(null);
  hidePanel();
  if (galaxy) paintStates();
}

function selectStar(id: number) {
  stopTour();
  asyncId++;
  selected = id;
  lit = null;
  const s = galaxy.stars[id];
  const con = galaxy.constellations[s.cluster];
  universe.showThreads(id);
  paintStates();
  universe.focus(s.pos);
  showPanel({
    eyebrow: `✦ ${con.name}${mastered.has(id) ? ' · ★ mastered' : ''}`,
    color: con.color,
    quote: s.text,
    meta: s.section ? `§ ${s.section}` : undefined,
    actions: [{ label: `Open topic: ${con.name}`, onClick: () => openConstellation(con.id) }],
    listLabel: 'Closest ideas anywhere in the text',
    items: s.neighbors.map((n, i) => ({ text: galaxy.stars[n].text, color: colorOf(n), score: s.scores[i], onClick: () => selectStar(n) })),
  });
}

function openConstellation(id: number, withPanel = true) {
  asyncId++;
  selected = null;
  const c = galaxy.constellations[id];
  const members = coreIdeas(galaxy, id);
  lit = new Set(members);
  universe.showThreads(null);
  paintStates();
  universe.focus(c.center, 55);
  if (!withPanel) return hidePanel();
  const done = members.filter((s) => mastered.has(s)).length;
  showPanel({
    eyebrow: 'Topic',
    color: c.color,
    heading: c.name,
    meta: `${members.length} of ${galaxy.stars.length} ideas · ${Math.round((members.length / galaxy.stars.length) * 100)}% of the document${done ? ` · ${done} mastered` : ''}`,
    chips: c.keywords,
    actions: [
      { label: '✎ Explain it back', primary: true, onClick: () => openExplain(id) },
      { label: '◎ Quiz this topic', onClick: () => startQuiz(id) },
    ],
    related: connections(galaxy, id).map((r) => ({ label: `${r.con.name} · ${r.links}`, color: r.con.color, onClick: () => showBridge(id, r.con.id) })),
    listLabel: 'Ideas, most central first',
    items: members.map((s, i) => ({ label: i === 0 ? '★ Key idea' : undefined, text: galaxy.stars[s].text, color: c.color, onClick: () => selectStar(s) })),
  });
}

/** The ideas that tie two topics together: pairs of nearest-neighbour stars across the border. */
function showBridge(a: number, b: number) {
  asyncId++;
  const A = galaxy.constellations[a], B = galaxy.constellations[b];
  const pairs = galaxy.stars.flatMap((s) => s.neighbors.map((n, i) => ({ s: s.id, n, score: s.scores[i] })))
    .filter(({ s, n }) => (galaxy.stars[s].cluster === a && galaxy.stars[n].cluster === b) || (galaxy.stars[s].cluster === b && galaxy.stars[n].cluster === a))
    .sort((x, y) => y.score - x.score);
  const ids = [...new Set(pairs.flatMap((p) => [p.s, p.n]))].slice(0, 8);
  selected = null;
  lit = new Set(ids);
  universe.showThreads(ids[0], ids);
  paintStates();
  universe.focus(A.center.map((v, d) => (v + B.center[d]) / 2) as [number, number, number], 70);
  showPanel({
    eyebrow: '⟷ Connection',
    color: A.color,
    heading: `${A.name} ⟷ ${B.name}`,
    meta: `${pairs.length} links between these topics. These are the ideas that bridge them; a connection like this is often the argument of an essay.`,
    actions: [{ label: `← ${A.name}`, onClick: () => openConstellation(a) }, { label: `${B.name} →`, onClick: () => openConstellation(b) }],
    listLabel: 'Bridging ideas',
    items: ids.map((id) => ({ text: galaxy.stars[id].text, color: colorOf(id), onClick: () => selectStar(id) })),
  });
}

/** A one-minute summary: the most central idea of each topic. */
function showKeyIdeas() {
  endQuiz();
  stopTour();
  asyncId++;
  const keys = keyIdeas(galaxy);
  selected = null;
  lit = new Set(keys.map((k) => k.star));
  universe.showThreads(null);
  paintStates();
  universe.overview();
  showPanel({
    eyebrow: '✧ Key ideas',
    color: '#ffd36e',
    heading: 'The whole document in one minute',
    meta: `The most central idea of each of the ${keys.length} topics, biggest topic first. Read these before anything else.`,
    listLabel: 'One idea per topic',
    items: keys.map((k) => ({ label: k.con.name, text: galaxy.stars[k.star].text, color: k.con.color, onClick: () => selectStar(k.star) })),
  });
}

// ─── Explain it back ─────────────────────────────────────────────────
let explainTopic = 0;
const explainText = $<HTMLTextAreaElement>('explain-text');

function openExplain(id: number, text = '') {
  explainTopic = id;
  $('explain-title').textContent = `Explain “${galaxy.constellations[id].name}” in your own words`;
  explainText.value = text;
  explainText.dispatchEvent(new Event('input'));
  $('explain').classList.remove('hidden');
  explainText.focus();
}
explainText.oninput = () => {
  const n = (explainText.value.match(/\S+/g) ?? []).length;
  $('explain-count').textContent = `${n} words`;
  $<HTMLButtonElement>('explain-go').disabled = n < 6;
};
$('explain-close').onclick = () => $('explain').classList.add('hidden');
$('explain-go').onclick = () => { $('explain').classList.add('hidden'); runExplain(explainTopic, explainText.value); };

async function runExplain(id: number, text: string) {
  openConstellation(id, false);
  const c = galaxy.constellations[id];
  const my = asyncId;
  showPanel({ eyebrow: '✎ Explain it back', color: c.color, heading: 'Checking your explanation…', meta: 'Comparing the meaning of each sentence you wrote with the core ideas of this topic.', listLabel: '', items: [] });
  const res = await checkExplanation(galaxy, id, text, (_s, pct) => my === asyncId && ($('card-head').querySelector('.meta')!.textContent = `Loading the model once… ${Math.round(pct * 1000)}%`));
  if (my !== asyncId) return;
  const got = res.covered.size, total = res.core.length;
  const verdict = got / total >= 0.75 ? 'Excellent: you really understand this topic.'
    : got / total >= 0.35 ? 'Good start. Reread the ideas you missed, then explain it again.'
    : 'You missed most of the core ideas. Read the ones below, then try again.';
  lit = new Set(res.core);
  universe.showThreads(null);
  universe.setStates((i) => (res.covered.has(i) ? StarState.Mastered : lit!.has(i) ? StarState.Lit : StarState.Dim));
  // three states: explained (counted), touched on (close in meaning, but the sentence was spent on other ideas), missed
  const rank = (s: number) => (res.covered.has(s) ? 2 : res.best.get(s)! >= 0.5 ? 1 : 0);
  const order = [...res.core].sort((a, b) => rank(a) - rank(b) || res.best.get(b)! - res.best.get(a)!);
  const label = ['○ Missed, reread this', '◐ Touched on, add detail', '✓ Explained'];
  showPanel({
    eyebrow: `✎ Explain it back · ${c.name}`,
    color: c.color,
    heading: `You explained ${got} of ${total} core ideas`,
    meta: `${verdict} Covered ideas now glow gold in the sky.`,
    actions: [
      { label: '✎ Try again', primary: true, onClick: () => openExplain(id, text) },
      { label: '◎ Quiz this topic', onClick: () => startQuiz(id) },
    ],
    listLabel: 'Core ideas, gaps first · the bar shows how close you came',
    items: order.map((s) => ({ label: label[rank(s)], text: galaxy.stars[s].text, color: res.covered.has(s) ? '#ffd36e' : c.color, score: res.best.get(s), onClick: () => selectStar(s) })),
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
  const my = ++asyncId;
  const status = $('ask-status');
  $('ask').classList.add('busy');
  status.textContent = 'thinking…';
  const vec = await embedQuery(q, (_stage, pct) => (status.textContent = `loading model ${Math.round(pct * 1000)}%`));
  $('ask').classList.remove('busy');
  status.textContent = 'semantic search';
  if (my !== asyncId) return;

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
  quiz = makeQuestion(galaxy, mastered, quizTopic);
  const pool = galaxy.stars.filter((s) => quizTopic == null || s.cluster === quizTopic);
  const done = pool.filter((s) => mastered.has(s.id)).length;
  $('quiz-label').textContent = quizTopic == null ? 'Star Quiz' : `Quiz · ${galaxy.constellations[quizTopic].name}`;
  $('quiz-count').textContent = `${done} / ${pool.length} mastered`;
  $('quiz-bar').style.width = `${(done / pool.length) * 100}%`;
  $('quiz-streak').textContent = `🔥 ${streak}`;
  if (!quiz) {
    $('quiz-prompt').textContent = quizTopic == null ? 'Every star is burning gold. You have mastered this galaxy. ✦' : 'Every idea in this topic is burning gold. Topic mastered. ✦';
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
  if (right) { mastered.add(q.starId); streak++; saveMastered(galaxy, mastered); renderLegend(); } else { btn.classList.add('wrong'); streak = 0; }
  universe.setStates((i) => (i === q.starId ? (right ? StarState.Mastered : StarState.Wrong) : mastered.has(i) ? StarState.Mastered : StarState.Normal));
  $('quiz-prompt').textContent = galaxy.stars[q.starId].text;
  setTimeout(() => quiz === q && nextQuestion(), right ? 1300 : 2600);
}

function startQuiz(topic: number | null = null) {
  stopTour();
  clearFocus();
  quizTopic = topic;
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

$('btn-quiz').onclick = () => startQuiz();
$('btn-keys').onclick = showKeyIdeas;
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

// ─── For students: feature guide + interactive demo ─────────────────
/** The topic and sample answer the demo uses: a hand-written one for built-in skies, generated otherwise. */
function demoPlan() {
  const demo = DEMOS.find((d) => d.title === galaxy.title);
  const biggest = [...galaxy.constellations].sort((a, b) => b.size - a.size)[0];
  const picked = demo && galaxy.constellations.find((c) => c.keywords.includes(demo.topic));
  const topic = picked ?? biggest;
  const key = galaxy.stars[coreIdeas(galaxy, topic.id)[0]].text.split(/(?<=[.!?])\s/)[0];
  const explain = picked ? demo!.explain : `This topic is about ${topic.keywords.slice(0, 3).join(', ')}. ${key}`;
  return { biggest, topic, explain, ask: demo?.ask ?? `What is ${biggest.keywords[0]}?` };
}

let typing = 0;
function typeAndAsk(q: string) {
  clearInterval(typing);
  const input = $<HTMLInputElement>('ask-input');
  let i = 0;
  typing = window.setInterval(() => {
    input.value = q.slice(0, ++i);
    if (i < q.length) return;
    clearInterval(typing);
    $<HTMLFormElement>('ask').requestSubmit();
  }, 38);
}

function tryFeature(name: string) {
  closeModal('guide');
  dismissIntro();
  const plan = demoPlan();
  if (name === 'keys') showKeyIdeas();
  if (name === 'ask') { clearFocus(); typeAndAsk(plan.ask); }
  if (name === 'explain') { openConstellation(plan.topic.id); openExplain(plan.topic.id, plan.explain); }
  if (name === 'quiz') startQuiz();
  if (name === 'connect') showBridge(plan.biggest.id, connections(galaxy, plan.biggest.id)[0].con.id);
  if (name === 'guide') downloadStudyGuide(galaxy, mastered);
  if (name === 'import') { openModal('paste'); setTab('wiki'); }
}
document.querySelectorAll<HTMLElement>('[data-try]').forEach((b) => (b.onclick = () => tryFeature(b.dataset.try!)));

function startDemo() {
  closeModal('guide');
  closeModal('info');
  dismissIntro();
  endQuiz();
  stopTour();
  clearFocus();
  const plan = demoPlan();
  const k = galaxy.constellations.length;
  const card = () => $('card');
  const step = (s: Step): Step => ({ ...s, run: () => { clearInterval(typing); s.run?.(); } });
  const steps: Step[] = [
    { eyebrow: 'The map', target: () => $('hud'), run: () => { clearFocus(); universe.overview(); },
      title: 'Every colour is a topic',
      body: `The AI read all ${galaxy.words.toLocaleString()} words of “${galaxy.title}” and found ${k} topics on its own. Nobody labelled anything: ideas that mean similar things simply ended up close together in space.`,
      how: 'Click a topic in this list, or its label in the sky, to fly to it. Drag to orbit, scroll to zoom.' },
    { eyebrow: 'Topics', target: card, run: () => openConstellation(plan.biggest.id),
      title: `Open a topic: ${plan.biggest.name}`,
      body: 'You get every idea in the topic with the most central one first, its key terms, and which other topics it connects to.',
      how: 'Click a topic label in the sky or a row in the topic list.' },
    { eyebrow: 'Stars', target: card, run: () => selectStar(coreIdeas(galaxy, plan.biggest.id)[1]),
      title: 'Every star is one idea',
      body: 'Click a star to read it and see which section of the document it came from. Its three closest ideas light up with threads, even when they are chapters apart.',
      how: 'Click any star in the sky, or any idea in a list.' },
    { eyebrow: 'Ask the sky', target: () => [$('ask'), $('card')], run: () => { clearFocus(); typeAndAsk(plan.ask); },
      title: 'Search by meaning, not keywords',
      body: 'Ask a question in your own words. The model compares its meaning with every idea and lights up the best answers, even when they share no words with your question.',
      how: 'Type in the bar at the top and press Enter. The first search downloads the model once (~23 MB).' },
    { eyebrow: 'Key ideas', target: card, run: showKeyIdeas,
      title: 'The whole document in one minute',
      body: `The single most representative idea from each of the ${k} topics. Read these first and you already know the shape of the document before the first page.`,
      how: 'Press ✧ Key ideas in the bottom dock.' },
    { eyebrow: 'Explain it back', target: card, run: () => runExplain(plan.topic.id, plan.explain),
      title: 'Check your understanding',
      body: `We wrote a short explanation of “${plan.topic.name}” for you: “${plan.explain.slice(0, 100).replace(/\s\S*$/, '')}…”. The AI marks the core ideas it covers in gold and lists what it missed, so you know exactly what to reread.`,
      how: 'Open a topic and press ✎ Explain it back. Write from memory, then press Check.' },
    { eyebrow: 'Quiz', target: () => $('quiz'), run: () => startQuiz(plan.topic.id),
      title: 'Quiz yourself, star by star',
      body: 'Fill-in-the-blank questions generated from the text itself, with wrong answers taken from the same topic so they are plausible. Mastered stars burn gold, the topic list fills up, and progress is saved on this device.',
      how: 'Press ◎ Quiz for the whole document, or ◎ Quiz this topic inside a topic.' },
    { eyebrow: 'Take it with you', target: () => document.querySelector('.dock'), run: () => { endQuiz(); clearFocus(); universe.overview(); },
      title: 'A study guide in one click',
      body: 'Study guide downloads a Markdown file: every topic with its key idea, key terms and a checklist of ideas, your mastered ones ticked. Tour flies through each topic; Poster saves an image of your galaxy.',
      how: 'Use the buttons in the bottom-right dock.' },
    { eyebrow: 'Your turn', target: () => $('open-paste'), run: () => { clearFocus(); universe.overview(); },
      title: 'Now map your own reading',
      body: 'Paste a Wikipedia link, drop in the PDF of a chapter or your lecture notes, or paste text. Long documents work best, up to about 600 ideas, all processed on your device.',
      how: 'Press ✦ Map a document at the top right.' },
  ].map(step);
  startWalkthrough(steps, () => { clearInterval(typing); endQuiz(); clearFocus(); universe.overview(); });
}

$('open-guide').onclick = () => openModal('guide');
$('guide-close').onclick = () => closeModal('guide');
$('guide-demo').onclick = startDemo;
$('intro-demo').onclick = startDemo;
$('intro-guide').onclick = () => { dismissIntro(); openModal('guide'); };

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
for (const id of ['info', 'paste', 'guide', 'explain']) $(id).addEventListener('click', (e) => e.target === $(id) && closeModal(id));

window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (touring()) return endWalkthrough();
  clearFocus(); endQuiz(); stopTour(); dismissIntro();
  for (const id of ['paste', 'info', 'guide', 'explain']) closeModal(id);
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
      universe, selectStar, openConstellation, startQuiz, dismissIntro, clearFocus, startDemo, showKeyIdeas, runExplain, tryFeature,
      get galaxy() { return galaxy; },
      get quiz() { return quiz; },
      poster: () => renderPoster(universe.snapshot(), galaxy).toDataURL('image/png'),
    },
  });
}

loadDemo(params.get('sky') ?? 'philosophy');
