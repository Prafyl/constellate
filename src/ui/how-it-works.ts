import type { Galaxy } from '../types';

/** Fills the "How it works" modal with the real numbers of the current galaxy. */
export function renderPipeline(g: Galaxy) {
  const n = g.stars.length;
  const k = g.constellations.length;
  const steps = [
    { icon: '📄', title: 'Read', stat: `${g.words.toLocaleString()} words → ${n} ideas`, body: 'Citations and formulas are cleaned out, section headings are kept, and the text is cut into complete thoughts. Long documents group sentences into passages so nothing is dropped.' },
    { icon: '🧠', title: 'Embed', stat: `${n} × 384 numbers`, body: 'MiniLM-L6-v2, a sentence-embedding transformer, turns every idea into a 384-dimensional vector of meaning. It runs in a Web Worker via Transformers.js.' },
    { icon: '🌀', title: 'Project', stat: '384-D → 3-D', body: 'UMAP folds those 384 dimensions into three while keeping neighbours together, so ideas that mean similar things end up close in space.' },
    { icon: '✦', title: 'Cluster', stat: `${k} topics`, body: 'k-means is run with 3 to 16 topics, and a silhouette score keeps the richest split that stays clean, so the number of topics comes from the content itself. TF-IDF names each one after its distinctive words.' },
    { icon: '🔭', title: 'Render', stat: '1 draw call', body: 'A custom GLSL shader draws every star. Each constellation figure is its minimum spanning tree, finished with bloom and nebula light.' },
  ];
  document.getElementById('info-title')!.textContent = g.title;
  document.getElementById('pipeline')!.innerHTML = steps
    .map((s, i) => `
      <li style="--i:${i}">
        <span class="step-icon">${s.icon}</span>
        <span class="step-title">${i + 1}. ${s.title}</span>
        <span class="step-stat">${s.stat}</span>
        <span class="step-body">${s.body}</span>
      </li>`)
    .join('');
}
