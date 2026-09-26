import { UMAP } from 'umap-js';
import { extractKeywords } from './keywords';
import type { Galaxy, Star, Constellation } from '../types';

export type Embedder = (texts: string[]) => Promise<number[][]>;
export type Progress = (stage: string, pct: number) => void;

const PALETTE = [
  '#7cc4ff', '#ff7ac6', '#ffd36e', '#8affc1', '#b89cff', '#ff9a6b', '#6ef2ff', '#f5a3ff',
  '#c6ff7a', '#ffb3b3', '#9fa8ff', '#ffe29a', '#7affe4', '#e0a3ff', '#ffc27a', '#a3d8ff',
];
/** Upper bound on stars. Longer documents group consecutive sentences into passages instead of being cut off. */
export const MAX_STARS = 600;

export interface Chunk { text: string; section?: string }

/**
 * Cleans raw text (Wikipedia citation marks, URLs, stray whitespace), tracks
 * section headings, and splits it into idea-sized chunks covering the WHOLE document.
 */
export function chunkText(raw: string): Chunk[] {
  const text = stripLatex(raw)
    .replace(/\r/g, '')
    .replace(/\[(?:\d+|[a-z]|citation needed|edit|note \d+|clarification needed)\]/gi, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[ \t  ]+/g, ' ');

  const sentences: Chunk[] = [];
  let section: string | undefined;
  for (const para of text.split(/\n+/)) {
    const line = para.trim();
    if (!line) continue;
    // "== History ==" (Wikipedia API) or a short line without end punctuation: a heading
    const md = line.match(/^=+\s*(.+?)\s*=+$/) ?? line.match(/^#+\s+(.+)$/);
    if (md || (line.length < 70 && !/[.!?:;,"”)]$/.test(line) && line.split(' ').length <= 9)) {
      section = (md ? md[1] : line).replace(/[#=]/g, '').trim();
      continue;
    }
    for (const s of line.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(‘'])/)) {
      const t = s.trim();
      // skip fragments that are mostly symbols (formulas, tables)
      if (t.length > 25 && (t.match(/[a-z]/gi)?.length ?? 0) / t.length > 0.6) sentences.push({ text: t, section });
    }
  }

  // Merge fragments into their neighbours; group sentences into passages for long documents.
  const per = Math.max(1, Math.ceil(sentences.length / MAX_STARS));
  const chunks: Chunk[] = [];
  let buf: Chunk | null = null;
  let count = 0;
  for (const s of sentences) {
    if (buf && buf.section === s.section && (count < per || buf.text.length < 60)) {
      buf.text += ` ${s.text}`;
      count++;
    } else {
      if (buf) chunks.push(buf);
      buf = { ...s };
      count = 1;
    }
  }
  if (buf) chunks.push(buf);
  return chunks.slice(0, MAX_STARS);
}

/** Removes LaTeX that Wikipedia leaves in plain-text extracts, e.g. {\displaystyle \frac{a}{b}}. */
function stripLatex(text: string) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith('{\\displaystyle', i)) {
      let depth = 0;
      for (; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}' && --depth === 0) break;
      }
      out += '…';
      continue;
    }
    out += text[i];
  }
  return out.replace(/\\[a-z]+/gi, '').replace(/(…\s*){2,}/g, '… ');
}

export const countWords = (text: string) => (text.match(/\S+/g) ?? []).length;

/** Seeded PRNG so the same text always yields the same galaxy. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const d2 = (a: number[], b: number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** k-means with k-means++ seeding. */
function kmeans(points: number[][], k: number, rand: () => number): number[] {
  const centers = [points[Math.floor(rand() * points.length)]];
  while (centers.length < k) {
    const dist = points.map((p) => Math.min(...centers.map((c) => d2(p, c))));
    let r = rand() * dist.reduce((a, b) => a + b, 0);
    let i = 0;
    while ((r -= dist[i]) > 0 && i < points.length - 1) i++;
    centers.push(points[i]);
  }
  let labels = new Array(points.length).fill(0);
  let cs = centers.map((c) => [...c]);
  for (let iter = 0; iter < 50; iter++) {
    labels = points.map((p) => {
      let best = 0, bestD = Infinity;
      cs.forEach((c, ci) => { const d = d2(p, c); if (d < bestD) { bestD = d; best = ci; } });
      return best;
    });
    cs = cs.map((c, ci) => {
      const m = points.filter((_, i) => labels[i] === ci);
      return m.length ? [0, 1, 2].map((d) => m.reduce((s, p) => s + p[d], 0) / m.length) : c;
    });
  }
  return labels;
}

/** Mean silhouette: how much closer each star is to its own constellation than to the nearest other one. */
function silhouette(points: number[][], labels: number[], k: number) {
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const sum = new Array(k).fill(0), cnt = new Array(k).fill(0);
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      sum[labels[j]] += Math.sqrt(d2(points[i], points[j]));
      cnt[labels[j]]++;
    }
    const a = cnt[labels[i]] ? sum[labels[i]] / cnt[labels[i]] : 0;
    let b = Infinity;
    for (let c = 0; c < k; c++) if (c !== labels[i] && cnt[c]) b = Math.min(b, sum[c] / cnt[c]);
    total += b === Infinity ? 0 : (b - a) / Math.max(a, b);
  }
  return total / points.length;
}

/**
 * The number of constellations is chosen by the content: we try a range of k and keep the
 * richest split that is still clean (within 6% of the best silhouette score).
 */
function chooseClusters(points: number[][], rand: () => number) {
  const n = points.length;
  const maxK = Math.max(3, Math.min(PALETTE.length, Math.round(Math.sqrt(n / 2)) + 3));
  const tries: { k: number; labels: number[]; score: number }[] = [];
  for (let k = 3; k <= maxK; k++) {
    const labels = kmeans(points, k, rand);
    tries.push({ k, labels, score: silhouette(points, labels, k) });
  }
  const best = Math.max(...tries.map((t) => t.score));
  return tries.filter((t) => t.score >= best * 0.94).sort((a, b) => b.k - a.k)[0];
}

const dot = (a: number[], b: number[]) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

export async function buildGalaxy(title: string, text: string, embed: Embedder, onProgress: Progress = () => {}, source?: string): Promise<Galaxy> {
  const chunks = chunkText(text);
  const texts = chunks.map((c) => c.text);
  onProgress('Reading ideas', 0.1);

  const vectors = await embed(texts);
  onProgress('Mapping the sky', 0.55);

  // 1. Project meaning-space (384-D) into 3-D. Bigger documents get a bigger sky.
  const rand = mulberry32(42);
  const umap = new UMAP({ nComponents: 3, nNeighbors: Math.min(12, texts.length - 1), minDist: 0.1, spread: 1.6, random: rand });
  const raw = await umap.fitAsync(vectors, (epoch) => {
    if (epoch % 25 === 0) onProgress('Mapping the sky', 0.55 + 0.25 * Math.min(1, epoch / 500));
  });
  const radius = 60 * Math.min(2.2, Math.max(1, Math.sqrt(texts.length / 70)));
  const mean = [0, 1, 2].map((d) => raw.reduce((s, p) => s + p[d], 0) / raw.length);
  const centered = raw.map((p) => p.map((v, d) => v - mean[d]));
  const maxR = Math.max(...centered.map((p) => Math.hypot(p[0], p[1], p[2])));
  const pos = centered.map((p) => p.map((v) => (v / maxR) * radius));

  // 2. Group nearby ideas into constellations; how many depends on how rich the content is.
  onProgress('Finding constellations', 0.82);
  await new Promise((r) => setTimeout(r));
  const { k, labels } = chooseClusters(pos, rand);

  // 3. Name each constellation from its most distinctive words.
  onProgress('Naming constellations', 0.93);
  const docs = Array.from({ length: k }, (_, ci) => texts.filter((_, i) => labels[i] === ci).join(' '));
  const { clusterKeywords, bestTermIn } = extractKeywords(docs);

  const constellations: Constellation[] = Array.from({ length: k }, (_, ci) => {
    const members = pos.filter((_, i) => labels[i] === ci);
    const center = [0, 1, 2].map((d) => members.reduce((s, m) => s + m[d], 0) / Math.max(1, members.length)) as [number, number, number];
    const kw = clusterKeywords[ci];
    return { id: ci, name: kw.slice(0, 2).map(titleCase).join(' & '), keywords: kw, color: PALETTE[ci % PALETTE.length], center, size: members.length };
  });

  // 4. Each star links to its three most similar ideas, anywhere in the document.
  const stars: Star[] = chunks.map((c, i) => {
    const top: { j: number; s: number }[] = [];
    for (let j = 0; j < vectors.length; j++) {
      if (j === i) continue;
      const s = dot(vectors[i], vectors[j]);
      if (top.length < 3 || s > top[2].s) { top.push({ j, s }); top.sort((a, b) => b.s - a.s); top.length = Math.min(3, top.length); }
    }
    return {
      id: i,
      text: c.text,
      section: c.section,
      pos: pos[i].map((v) => +v.toFixed(2)) as [number, number, number],
      cluster: labels[i],
      neighbors: top.map((x) => x.j),
      scores: top.map((x) => +x.s.toFixed(3)),
      vec: vectors[i].map((v) => +v.toFixed(3)),
      term: bestTermIn(c.text, labels[i]),
    };
  });

  onProgress('Ignition', 1);
  return { title, source, words: countWords(text), createdAt: new Date().toISOString(), stars, constellations };
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
