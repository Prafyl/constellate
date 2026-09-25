import * as THREE from 'three';
import type { Galaxy } from '../types';

let hazeTexture: THREE.Texture | null = null;

/** A soft radial cloud, painted once on a canvas and reused for every nebula sprite. */
function haze() {
  if (hazeTexture) return hazeTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  hazeTexture = new THREE.CanvasTexture(c);
  return hazeTexture;
}

const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

/** Colored gas clouds and star dust around each constellation. */
export function createNebula(galaxy: Galaxy) {
  const group = new THREE.Group();

  for (const con of galaxy.constellations) {
    const members = galaxy.stars.filter((s) => s.cluster === con.id);
    const spread = Math.max(8, Math.sqrt(members.reduce((s, m) => s + dist2(m.pos, con.center), 0) / Math.max(1, members.length)));
    const color = new THREE.Color(con.color);

    // gas: a few big overlapping sprites
    for (let i = 0; i < 7; i++) {
      const m = new THREE.SpriteMaterial({ map: haze(), color, transparent: true, opacity: 0.026, depthWrite: false, blending: THREE.AdditiveBlending });
      const s = new THREE.Sprite(m);
      const anchor = members[i % members.length]?.pos ?? con.center;
      s.position.set(...anchor).lerp(new THREE.Vector3(...con.center), 0.5);
      s.scale.setScalar(spread * (1.8 + Math.random() * 1.2));
      group.add(s);
    }

    // dust: faint particles that make each constellation feel dense and alive
    const n = 320;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = members[Math.floor(Math.random() * members.length)]?.pos ?? con.center;
      pos.set([a[0] + gauss() * spread * 0.8, a[1] + gauss() * spread * 0.8, a[2] + gauss() * spread * 0.8], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dust = new THREE.Points(g, new THREE.PointsMaterial({
      color, map: haze(), size: 0.9, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    }));
    group.add(dust);
  }
  return group;
}

/** Distant background stars. */
export function createStarfield() {
  const n = 5000;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 400 + Math.random() * 600;
    const t = Math.random() * Math.PI * 2;
    const p = Math.acos(2 * Math.random() - 1);
    pos.set([r * Math.sin(p) * Math.cos(t), r * Math.sin(p) * Math.sin(t), r * Math.cos(p)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fb4ff, map: haze(), size: 2.6, sizeAttenuation: false, transparent: true, opacity: 0.55, depthWrite: false }));
}

const dist2 = (a: number[], b: number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
