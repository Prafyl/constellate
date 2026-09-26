/**
 * Pre-computes the demo galaxies so the landing page renders instantly,
 * with no model download. Run with `npm run demos`.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pipeline } from '@huggingface/transformers';
import { buildGalaxy } from '../src/ml/pipeline';

const DEMOS: { slug: string; title: string; source?: string }[] = [
  { slug: 'philosophy', title: 'Philosophy', source: 'https://en.wikipedia.org/wiki/Philosophy' },
  { slug: 'nepal', title: 'Nepal' },
  { slug: 'biology', title: 'Biology' },
  { slug: 'history', title: 'World History' },
  { slug: 'machine-learning', title: 'Machine Learning' },
];
const only = process.argv[2];

const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' });
const embed = async (texts: string[]) => {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 32) out.push(...((await extractor(texts.slice(i, i + 32), { pooling: 'mean', normalize: true })).tolist() as number[][]));
  return out;
};

mkdirSync('public/demos', { recursive: true });
for (const { slug, title, source } of DEMOS.filter((d) => !only || d.slug === only)) {
  const t0 = Date.now();
  const galaxy = await buildGalaxy(title, readFileSync(`demos/${slug}.txt`, 'utf8'), embed, undefined, source);
  writeFileSync(`public/demos/${slug}.json`, JSON.stringify(galaxy));
  console.log(`✦ ${title}: ${galaxy.words} words → ${galaxy.stars.length} stars, ${galaxy.constellations.length} constellations (${((Date.now() - t0) / 1000).toFixed(1)}s)
   ${galaxy.constellations.map((c) => `${c.name} (${c.size})`).join(' | ')}`);
}
