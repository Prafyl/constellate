import type { Galaxy } from '../types';

/** Composites the live render with typography into a share-ready 16:9 poster. */
export function renderPoster(source: HTMLCanvasElement, galaxy: Galaxy) {
  const W = 2400, H = 1350;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#03040b';
  ctx.fillRect(0, 0, W, H);
  // cover-fit the render
  const s = Math.max(W / source.width, H / source.height);
  ctx.drawImage(source, (W - source.width * s) / 2, (H - source.height * s) / 2, source.width * s, source.height * s);

  const fade = ctx.createLinearGradient(0, H * 0.55, 0, H);
  fade.addColorStop(0, 'rgba(3,4,11,0)');
  fade.addColorStop(1, 'rgba(3,4,11,0.92)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '500 24px "Geist Mono"';
  ctx.fillText('✦  C O N S T E L L A T E', 90, 110);

  ctx.fillStyle = '#fff';
  ctx.font = '600 132px "Geist"';
  ctx.letterSpacing = '-6px';
  ctx.fillText(galaxy.title, 86, H - 190);

  ctx.letterSpacing = '0px';
  ctx.font = '500 28px "Geist"';
  let x = 92;
  for (const con of galaxy.constellations) {
    ctx.fillStyle = con.color;
    ctx.beginPath(); ctx.arc(x + 8, H - 110, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(con.name, x + 26, H - 100);
    x += ctx.measureText(con.name).width + 70;
  }

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '400 22px "Geist Mono"';
  ctx.textAlign = 'right';
  ctx.fillText(`${galaxy.stars.length} ideas · mapped on-device by a neural network`, W - 90, 110);

  return c;
}

export function downloadPoster(source: HTMLCanvasElement, galaxy: Galaxy) {
  const c = renderPoster(source, galaxy);
  const a = document.createElement('a');
  a.download = `constellate-${galaxy.title.toLowerCase().replace(/\W+/g, '-')}.png`;
  a.href = c.toDataURL('image/png');
  a.click();
}
