import { UMAP } from 'umap-js';
import { extractKeywords } from './keywords';
import type { Galaxy, Star, Constellation } from '../types';

export type Embedder = (texts: string[]) => Promise<number[][]>;
export type Progress = (stage: string, pct: number) => void;

const PALETTE = ['#7cc4ff', '#ff7ac6', '#ffd36e', '#8affc1', '#b89cff', '#ff9a6b', '#6ef2ff', '#f5a3ff', '#c6ff7a'];
const MAX_STARS = 260;
const RADIUS = 60;

/** Split raw text into idea-sized chunks (sentences, short ones merged). */
export function chunkText(text: string): string[] {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);

  const chunks: string[] = [];
  for (const s of sentences) {
    const last = chunks[chunks.length - 1];
    if (last && last.length < 45) chunks[chunks.length - 1] = `${last} ${s}`;
    else chunks.push(s);
  }
  return chunks.slice(0, MAX_STARS);
}

/** Seeded PRNG so the same text always yields the same galaxy. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function kmeans(points: number[][], k: number, rand: () => number): number[] {
  let centers = Array.from({ length: k }, (_, i) => [...points[Math.floor((i / k) * points.length)]]);
  let labels = new Array(points.length).fill(0);
  for (let iter = 0; iter < 40; iter++) {
    labels = points.map((p) => {
      let best = 0, bestD = Infinity;
      centers.forEach((c, ci) => {
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < bestD) { bestD = d; best = ci; }
      });
      return best;
    });
    centers = centers.map((c, ci) => {
      const members = points.filter((_, i) => labels[i] === ci);
      if (!members.length) return [...points[Math.floor(rand() * points.length)]];
      return [0, 1, 2].map((d) => members.reduce((s, m) => s + m[d], 0) / members.length);
    });
  }
  return labels;
}

const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);

export async function buildGalaxy(title: string, text: string, embed: Embedder, onProgress: Progress = () => {}): Promise<Galaxy> {
  const chunks = chunkText(text);
  onProgress('Reading ideas', 0.1);

  const vectors = await embed(chunks);
  onProgress('Mapping the sky', 0.55);

  // 1. Project meaning-space (384-D) into 3-D.
  const rand = mulberry32(42);
  const umap = new UMAP({ nComponents: 3, nNeighbors: Math.min(15, chunks.length - 1), minDist: 0.25, random: rand });
  const raw = await umap.fitAsync(vectors, (epoch) => {
    if (epoch % 50 === 0) onProgress('Mapping the sky', 0.55 + 0.3 * (epoch / 500));
  });

  // Normalise to a sphere of RADIUS.
  const mean = [0, 1, 2].map((d) => raw.reduce((s, p) => s + p[d], 0) / raw.length);
  const centered = raw.map((p) => p.map((v, d) => v - mean[d]));
  const maxR = Math.max(...centered.map((p) => Math.hypot(p[0], p[1], p[2])));
  const pos = centered.map((p) => p.map((v) => (v / maxR) * RADIUS));

  // 2. Group nearby ideas into constellations.
  onProgress('Naming constellations', 0.88);
  const k = Math.max(3, Math.min(9, Math.round(Math.sqrt(chunks.length / 1.8))));
  const labels = kmeans(pos, k, rand);

  // 3. Name each constellation from its most distinctive words.
  const docs = Array.from({ length: k }, (_, ci) => chunks.filter((_, i) => labels[i] === ci).join(' '));
  const { clusterKeywords, bestTermIn } = extractKeywords(docs);

  const constellations: Constellation[] = Array.from({ length: k }, (_, ci) => {
    const members = pos.filter((_, i) => labels[i] === ci);
    const center = [0, 1, 2].map((d) => members.reduce((s, m) => s + m[d], 0) / Math.max(1, members.length)) as [number, number, number];
    const kw = clusterKeywords[ci];
    return {
      id: ci,
      name: kw.slice(0, 2).map(titleCase).join(' & '),
      keywords: kw,
      color: PALETTE[ci % PALETTE.length],
      center,
      size: members.length,
    };
  });

  // 4. Each star links to its two most similar ideas.
  const stars: Star[] = chunks.map((t, i) => {
    const sims = vectors.map((v, j) => ({ j, s: j === i ? -1 : dot(vectors[i], v) })).sort((a, b) => b.s - a.s);
    return {
      id: i,
      text: t,
      pos: pos[i].map((v) => +v.toFixed(2)) as [number, number, number],
      cluster: labels[i],
      neighbors: sims.slice(0, 3).map((x) => x.j),
      term: bestTermIn(t, labels[i]),
    };
  });

  onProgress('Ignition', 1);
  return { title, createdAt: new Date().toISOString(), stars, constellations };
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
