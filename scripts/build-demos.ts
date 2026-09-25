/**
 * Pre-computes the demo galaxies so the landing page renders instantly,
 * with no model download. Run with `npm run demos`.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pipeline } from '@huggingface/transformers';
import { buildGalaxy } from '../src/ml/pipeline';

const DEMOS = [
  { slug: 'nepal', title: 'Nepal' },
  { slug: 'biology', title: 'Biology' },
  { slug: 'history', title: 'World History' },
  { slug: 'machine-learning', title: 'Machine Learning' },
];

const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' });
const embed = async (texts: string[]) =>
  (await extractor(texts, { pooling: 'mean', normalize: true })).tolist() as number[][];

mkdirSync('public/demos', { recursive: true });
for (const { slug, title } of DEMOS) {
  const galaxy = await buildGalaxy(title, readFileSync(`demos/${slug}.txt`, 'utf8'), embed);
  writeFileSync(`public/demos/${slug}.json`, JSON.stringify(galaxy));
  console.log(`✦ ${title}: ${galaxy.stars.length} stars → ${galaxy.constellations.map((c) => c.name).join(' | ')}`);
}
