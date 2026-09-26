/** The right-hand glass panel, reused for a star, a constellation, and search results. */
export interface PanelItem {
  label?: string;
  text: string;
  color: string;
  score?: number;
  onClick: () => void;
}

export interface PanelContent {
  eyebrow: string;
  color: string;
  quote?: string;
  heading?: string;
  meta?: string;
  chips?: string[];
  actions?: { label: string; onClick: () => void; primary?: boolean }[];
  related?: { label: string; color: string; onClick: () => void }[];
  listLabel: string;
  items: PanelItem[];
}

const $ = (id: string) => document.getElementById(id)!;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

export function showPanel(c: PanelContent) {
  const card = $('card');
  card.style.setProperty('--c', c.color);
  $('card-eyebrow').textContent = c.eyebrow;

  const head = $('card-head');
  head.innerHTML = '';
  if (c.quote) {
    const q = document.createElement('blockquote');
    q.textContent = c.quote;
    if (c.quote.length > 180) q.classList.add('long');
    head.appendChild(q);
  }
  if (c.heading) {
    const h = document.createElement('h3');
    h.textContent = c.heading;
    head.appendChild(h);
  }
  if (c.meta) {
    const m = document.createElement('p');
    m.className = 'meta';
    m.textContent = c.meta;
    head.appendChild(m);
  }

  $('card-chips').innerHTML = (c.chips ?? []).map((k) => `<span class="chip">${k}</span>`).join('');
  const actions = $('card-actions');
  actions.innerHTML = '';
  for (const a of c.actions ?? []) {
    const b = document.createElement('button');
    b.className = `btn small${a.primary ? ' primary' : ''}`;
    b.textContent = a.label;
    b.onclick = a.onClick;
    actions.appendChild(b);
  }

  const related = $('card-related');
  related.innerHTML = '';
  if (c.related?.length) {
    related.insertAdjacentHTML('beforeend', '<p class="eyebrow dim">Connects to</p>');
    for (const r of c.related) {
      const b = document.createElement('button');
      b.className = 'link-chip';
      b.style.setProperty('--c', r.color);
      b.innerHTML = '<span class="dot"></span>';
      b.append(r.label);
      b.onclick = r.onClick;
      related.appendChild(b);
    }
  }

  $('card-list-label').textContent = c.listLabel;

  const list = $('card-list');
  list.innerHTML = '';
  for (const it of c.items) {
    const li = document.createElement('li');
    li.style.setProperty('--c', it.color);
    if (it.label) {
      const label = document.createElement('span');
      label.className = 'item-label';
      label.textContent = it.label;
      li.appendChild(label);
    }
    const text = document.createElement('span');
    text.textContent = clip(it.text, it.label ? 260 : 120);
    li.appendChild(text);
    if (it.score != null) {
      const pct = Math.round(Math.max(0, it.score) * 100);
      li.insertAdjacentHTML('beforeend', `<span class="match"><i style="width:${pct}%"></i><b>${pct}% match</b></span>`);
    }
    li.onclick = it.onClick;
    list.appendChild(li);
  }

  card.classList.remove('hidden');
  card.scrollTop = 0;
  // restart the entrance animation
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = '';
}

export const hidePanel = () => $('card').classList.add('hidden');
