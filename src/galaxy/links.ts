import * as THREE from 'three';
import type { Galaxy } from '../types';

const d2 = (a: number[], b: number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/**
 * Draws each constellation's "figure": the minimum spanning tree of its stars,
 * which reads like the line drawings on a real star chart.
 */
export function createConstellationLines(galaxy: Galaxy) {
  const verts: number[] = [];
  const colors: number[] = [];
  const c = new THREE.Color();

  for (const con of galaxy.constellations) {
    const members = galaxy.stars.filter((s) => s.cluster === con.id);
    if (members.length < 2) continue;
    c.set(con.color);
    const inTree = new Set([0]);
    while (inTree.size < members.length) {
      let best: [number, number, number] = [0, 0, Infinity];
      for (const i of inTree) {
        members.forEach((m, j) => {
          if (inTree.has(j)) return;
          const d = d2(members[i].pos, m.pos);
          if (d < best[2]) best = [i, j, d];
        });
      }
      inTree.add(best[1]);
      verts.push(...members[best[0]].pos, ...members[best[1]].pos);
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
}

/** Bright threads from a selected star to its closest ideas (by meaning, not distance). */
export class NeighborThreads {
  readonly lines: THREE.LineSegments;

  constructor() {
    this.lines = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
  }

  show(galaxy: Galaxy, starId: number | null) {
    const verts: number[] = [];
    if (starId != null) {
      const s = galaxy.stars[starId];
      for (const n of s.neighbors) verts.push(...s.pos, ...galaxy.stars[n].pos);
    }
    this.lines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  }
}
