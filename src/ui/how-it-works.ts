import type { Galaxy } from '../types';

/** Fills the "How it works" modal with the real numbers of the current galaxy. */
export function renderPipeline(g: Galaxy) {
  const n = g.stars.length;
  const k = g.constellations.length;
  const steps = [
    { icon: '📄', title: 'Split', stat: `${n} ideas`, body: 'The text is cut into sentences, and fragments are merged so each star holds one complete thought.' },
    { icon: '🧠', title: 'Embed', stat: `${n} × 384 numbers`, body: 'MiniLM-L6-v2, a sentence-embedding transformer, turns every idea into a 384-dimensional vector of meaning. It runs in a Web Worker via Transformers.js.' },
    { icon: '🌀', title: 'Project', stat: '384-D → 3-D', body: 'UMAP folds those 384 dimensions into three while keeping neighbours together, so ideas that mean similar things end up close in space.' },
    { icon: '✦', title: 'Cluster', stat: `${k} constellations`, body: 'k-means groups nearby stars. TF-IDF then names each group after the words that set it apart from the rest of the sky.' },
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
