import type { Galaxy } from '../types';
import { cosine, embedQuery } from '../ml/client';

/** Mean direction of a set of stars in meaning-space. */
function centroid(g: Galaxy, ids: number[]) {
  const c = new Array(g.stars[0].vec.length).fill(0);
  for (const id of ids) g.stars[id].vec.forEach((v, d) => (c[d] += v));
  const n = Math.hypot(...c) || 1;
  return c.map((v) => v / n);
}

/** Stars of a topic ranked by how central they are: the first one is the topic's key idea. */
export function coreIdeas(g: Galaxy, cluster: number) {
  const ids = g.stars.filter((s) => s.cluster === cluster).map((s) => s.id);
  const c = centroid(g, ids);
  return ids.map((id) => ({ id, score: cosine(c, g.stars[id].vec) })).sort((a, b) => b.score - a.score).map((x) => x.id);
}

/** One key idea per topic, largest topic first: a one-minute summary of the whole document. */
export const keyIdeas = (g: Galaxy) =>
  [...g.constellations].sort((a, b) => b.size - a.size).map((c) => ({ con: c, star: coreIdeas(g, c.id)[0] }));

/** Other topics this topic links to, by counting "closest idea" threads that cross between them. */
export function connections(g: Galaxy, cluster: number) {
  const count = new Map<number, number>();
  for (const s of g.stars) {
    for (const n of s.neighbors) {
      const a = s.cluster, b = g.stars[n].cluster;
      if (a === b || (a !== cluster && b !== cluster)) continue;
      const other = a === cluster ? b : a;
      count.set(other, (count.get(other) ?? 0) + 1);
    }
  }
  return [...count].sort((x, y) => y[1] - x[1]).slice(0, 4).map(([id, links]) => ({ con: g.constellations[id], links }));
}

export interface Coverage { core: number[]; covered: Set<number>; best: Map<number, number> }

/**
 * "Explain it back": embeds each sentence the student wrote and checks which of the topic's
 * core ideas it expresses. Matching is by meaning, so paraphrases count and keyword stuffing doesn't.
 */
export async function checkExplanation(g: Galaxy, cluster: number, text: string, progress: (stage: string, pct: number) => void): Promise<Coverage> {
  const core = coreIdeas(g, cluster).slice(0, 8);
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 12);
  const best = new Map(core.map((id) => [id, 0]));
  const covered = new Set<number>();
  for (const s of sentences.length ? sentences : [text]) {
    const v = await embedQuery(s, progress);
    const sims = core.map((id) => ({ id, sim: cosine(v, g.stars[id].vec) })).sort((a, b) => b.sim - a.sim);
    for (const { id, sim } of sims) best.set(id, Math.max(best.get(id)!, sim));
    // one sentence can explain at most two ideas, so "Ethics is about right and wrong" can't claim the whole topic
    sims.slice(0, 2).filter((x) => x.sim >= COVERED).forEach((x) => covered.add(x.id));
  }
  return { core, best, covered };
}

/** Cosine similarity above which a sentence counts as expressing an idea (MiniLM paraphrases score ~0.6+). */
export const COVERED = 0.58;

// ─── Saved progress ─────────────────────────────────────────────────
const key = (g: Galaxy) => `constellate:mastered:${g.title}:${g.stars.length}`;
export function loadMastered(g: Galaxy) {
  try { return new Set<number>(JSON.parse(localStorage.getItem(key(g)) ?? '[]')); } catch { return new Set<number>(); }
}
export function saveMastered(g: Galaxy, mastered: Set<number>) {
  try { localStorage.setItem(key(g), JSON.stringify([...mastered])); } catch { /* private mode */ }
}
