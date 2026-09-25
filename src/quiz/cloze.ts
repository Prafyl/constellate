import type { Galaxy } from '../types';

export interface Question {
  starId: number;
  prompt: string; // sentence with the key term blanked out
  answer: string;
  options: string[];
}

const shuffle = <T>(a: T[]) => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map(([, v]) => v);

/**
 * Builds a fill-in-the-blank question from a star. Distractors come from the
 * same constellation first, so the wrong answers are plausible, not silly.
 */
export function makeQuestion(galaxy: Galaxy, mastered: Set<number>): Question | null {
  const pool = galaxy.stars.filter((s) => s.term && !mastered.has(s.id) && new RegExp(`\\b${s.term}`, 'i').test(s.text));
  if (!pool.length) return null;
  const star = pool[Math.floor(Math.random() * pool.length)];

  const sameCluster = galaxy.stars.filter((s) => s.cluster === star.cluster).map((s) => s.term);
  const everywhere = galaxy.stars.map((s) => s.term);
  const distractors: string[] = [];
  for (const t of [...shuffle(sameCluster), ...shuffle(everywhere)]) {
    if (t && t !== star.term && !distractors.includes(t) && distractors.length < 3) distractors.push(t);
  }

  return {
    starId: star.id,
    prompt: star.text.replace(new RegExp(`\\b${star.term}\\w*`, 'i'), '_____'),
    answer: star.term,
    options: shuffle([star.term, ...distractors]),
  };
}
