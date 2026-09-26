import type { Galaxy } from '../types';

/** Thin promise wrapper around the embedding worker. The model loads once and is shared. */
let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, (vec: number[]) => void>();
let onProgress: (stage: string, pct: number) => void = () => {};
let onGalaxy: (g: Galaxy) => void = () => {};
let onError: (message: string) => void = () => {};

function get() {
  if (worker) return worker;
  worker = new Worker(new URL('./embed.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'progress') onProgress(m.stage, m.pct);
    else if (m.type === 'done') onGalaxy(m.galaxy);
    else if (m.type === 'error') onError(m.message);
    else if (m.type === 'query') { pending.get(m.id)?.(m.vec); pending.delete(m.id); }
  };
  worker.onerror = (e) => onError(e.message || 'The AI worker crashed.');
  return worker;
}

export function buildInWorker(title: string, text: string, source: string | undefined, progress: typeof onProgress) {
  onProgress = progress;
  return new Promise<Galaxy>((resolve, reject) => {
    onGalaxy = resolve;
    onError = (m) => reject(new Error(m));
    get().postMessage({ type: 'build', title, text, source });
  });
}

export function embedQuery(text: string, progress: typeof onProgress = () => {}) {
  onProgress = progress;
  return new Promise<number[]>((resolve, reject) => {
    const id = nextId++;
    pending.set(id, resolve);
    onError = (m) => reject(new Error(m));
    get().postMessage({ type: 'query', id, text });
  });
}

export const cosine = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
