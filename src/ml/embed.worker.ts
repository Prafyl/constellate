/// <reference lib="webworker" />
import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
import { buildGalaxy } from './pipeline';

const MODEL = 'Xenova/all-MiniLM-L6-v2';
let extractor: Promise<FeatureExtractionPipeline> | null = null;

type Msg = { type: 'build'; title: string; text: string; source?: string } | { type: 'query'; id: number; text: string };

const post = (stage: string, pct: number) => self.postMessage({ type: 'progress', stage, pct });

async function create(device: 'webgpu' | 'wasm') {
  return (await pipeline('feature-extraction', MODEL, {
    device,
    dtype: device === 'webgpu' ? 'fp32' : 'q8',
    progress_callback: (p: { status: string; progress?: number }) => {
      if (p.status === 'progress' && p.progress != null) post('Downloading the model (once)', (p.progress / 100) * 0.1);
    },
  })) as FeatureExtractionPipeline;
}

/** Uses the GPU when the browser supports WebGPU, otherwise WebAssembly on the CPU. */
function load() {
  extractor ??= ('gpu' in navigator ? create('webgpu').catch(() => create('wasm')) : create('wasm'));
  return extractor;
}

async function embed(texts: string[], report = true) {
  const model = await load();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 16) {
    const t = await model(texts.slice(i, i + 16), { pooling: 'mean', normalize: true });
    out.push(...(t.tolist() as number[][]));
    if (report) post(`Reading ideas · ${out.length} of ${texts.length}`, 0.1 + 0.45 * (out.length / texts.length));
  }
  return out;
}

self.onmessage = async (e: MessageEvent<Msg>) => {
  const msg = e.data;
  try {
    if (msg.type === 'query') {
      const [vec] = await embed([msg.text], false);
      self.postMessage({ type: 'query', id: msg.id, vec });
      return;
    }
    post('Waking the model', 0);
    const galaxy = await buildGalaxy(msg.title, msg.text, (t) => embed(t), post, msg.source);
    self.postMessage({ type: 'done', galaxy });
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
