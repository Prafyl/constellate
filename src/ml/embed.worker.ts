/// <reference lib="webworker" />
import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
import { buildGalaxy } from './pipeline';

const MODEL = 'Xenova/all-MiniLM-L6-v2';
let extractor: FeatureExtractionPipeline | null = null;

self.onmessage = async (e: MessageEvent<{ title: string; text: string }>) => {
  const post = (stage: string, pct: number) => self.postMessage({ type: 'progress', stage, pct });

  if (!extractor) {
    post('Waking the model', 0);
    extractor = (await pipeline('feature-extraction', MODEL, {
      dtype: 'q8',
      progress_callback: (p: { status: string; progress?: number }) => {
        if (p.status === 'progress' && p.progress != null) post('Waking the model', (p.progress / 100) * 0.1);
      },
    })) as FeatureExtractionPipeline;
  }

  const embed = async (texts: string[]) => {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 16) {
      const t = await extractor!(texts.slice(i, i + 16), { pooling: 'mean', normalize: true });
      out.push(...(t.tolist() as number[][]));
      post('Reading ideas', 0.1 + 0.45 * (out.length / texts.length));
    }
    return out;
  };

  const galaxy = await buildGalaxy(e.data.title, e.data.text, embed, post);
  self.postMessage({ type: 'done', galaxy });
};
