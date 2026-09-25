/// <reference lib="webworker" />
import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
import { buildGalaxy } from './pipeline';

const MODEL = 'Xenova/all-MiniLM-L6-v2';
let extractor: Promise<FeatureExtractionPipeline> | null = null;

type Msg = { type: 'build'; title: string; text: string } | { type: 'query'; id: number; text: string };

const post = (stage: string, pct: number) => self.postMessage({ type: 'progress', stage, pct });

function load() {
  extractor ??= pipeline('feature-extraction', MODEL, {
    dtype: 'q8',
    progress_callback: (p: { status: string; progress?: number }) => {
      if (p.status === 'progress' && p.progress != null) post('Waking the model', (p.progress / 100) * 0.1);
    },
  }) as Promise<FeatureExtractionPipeline>;
  return extractor;
}

async function embed(texts: string[], report = true) {
  const model = await load();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 16) {
    const t = await model(texts.slice(i, i + 16), { pooling: 'mean', normalize: true });
    out.push(...(t.tolist() as number[][]));
    if (report) post('Reading ideas', 0.1 + 0.45 * (out.length / texts.length));
  }
  return out;
}

self.onmessage = async (e: MessageEvent<Msg>) => {
  const msg = e.data;
  if (msg.type === 'query') {
    const [vec] = await embed([msg.text], false);
    self.postMessage({ type: 'query', id: msg.id, vec });
    return;
  }
  post('Waking the model', 0);
  const galaxy = await buildGalaxy(msg.title, msg.text, (t) => embed(t), post);
  self.postMessage({ type: 'done', galaxy });
};
