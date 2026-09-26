/**
 * Interactive demo: a spotlight follows real UI elements while the app performs
 * each feature live, with a coach card explaining what it does and how to use it.
 */
export interface Step {
  /** What to spotlight; several elements are spotlit together. */
  target: () => Element | (Element | null)[] | null;
  eyebrow: string;
  title: string;
  body: string;
  how: string;
  /** Runs the feature for real when the step opens. */
  run?: () => unknown;
}

const $ = (id: string) => document.getElementById(id)!;
let steps: Step[] = [];
let at = 0;
let raf = 0;
let onEnd: () => void = () => {};

export const touring = () => document.body.classList.contains('walkthrough');

export function startWalkthrough(list: Step[], done: () => void = () => {}) {
  steps = list;
  onEnd = done;
  document.body.classList.add('walkthrough');
  $('coach-dots').innerHTML = steps.map(() => '<i></i>').join('');
  go(0);
  cancelAnimationFrame(raf);
  follow();
}

export function endWalkthrough() {
  if (!touring()) return;
  document.body.classList.remove('walkthrough');
  cancelAnimationFrame(raf);
  onEnd();
}

function go(i: number) {
  if (i >= steps.length) return endWalkthrough();
  at = Math.max(0, i);
  const s = steps[at];
  $('coach-eyebrow').textContent = `${s.eyebrow} · ${at + 1} of ${steps.length}`;
  $('coach-title').textContent = s.title;
  $('coach-body').textContent = s.body;
  $('coach-how').textContent = s.how;
  ($('coach-back') as HTMLButtonElement).disabled = at === 0;
  $('coach-next').textContent = at === steps.length - 1 ? 'Finish ✦' : 'Next →';
  $('coach-dots').querySelectorAll('i').forEach((d, j) => d.classList.toggle('on', j <= at));
  const coach = $('coach');
  coach.style.animation = 'none';
  void coach.offsetWidth;
  coach.style.animation = '';
  s.run?.();
}

/** Keeps the spotlight and card glued to the target as panels open and the camera moves. */
function follow() {
  const spot = $('spot');
  const coach = $('coach');
  const vw = innerWidth, vh = innerHeight;
  const cw = coach.offsetWidth, ch = coach.offsetHeight;
  const r = bounds(steps[at]?.target());
  if (!r) {
    spot.style.opacity = '0';
    place(coach, (vw - cw) / 2, vh - ch - 24);
  } else {
    const pad = 8;
    spot.style.opacity = '1';
    Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    const gap = 22;
    const clampX = (x: number) => Math.min(vw - cw - 16, Math.max(16, x));
    const clampY = (y: number) => Math.min(vh - ch - 16, Math.max(16, y));
    if (vw < 760) place(coach, (vw - cw) / 2, r.top > vh - r.bottom ? 16 : vh - ch - 16);
    else if (r.left - gap - cw > 16) place(coach, r.left - gap - cw, clampY(r.top + r.height / 2 - ch / 2));
    else if (r.right + gap + cw < vw - 16) place(coach, r.right + gap, clampY(r.top + r.height / 2 - ch / 2));
    else if (r.top - gap - ch > 16) place(coach, clampX(r.left + r.width / 2 - cw / 2), r.top - gap - ch);
    else place(coach, clampX(r.left + r.width / 2 - cw / 2), clampY(r.bottom + gap));
  }
  raf = requestAnimationFrame(follow);
}

/** Union of the visible targets' rectangles. */
function bounds(t: Element | (Element | null)[] | null | undefined) {
  const rects = [t].flat().map((e) => e?.getBoundingClientRect()).filter((r): r is DOMRect => !!r && r.width > 0); // hidden elements have an empty rect
  if (!rects.length) return null;
  const left = Math.min(...rects.map((r) => r.left)), top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.right)), bottom = Math.max(...rects.map((r) => r.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function place(el: HTMLElement, x: number, y: number) {
  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
}

$('coach-next').onclick = () => go(at + 1);
$('coach-back').onclick = () => go(at - 1);
$('coach-skip').onclick = endWalkthrough;
window.addEventListener('keydown', (e) => {
  if (!touring()) return;
  if (e.key === 'ArrowRight') go(at + 1);
  if (e.key === 'ArrowLeft') go(at - 1);
});
