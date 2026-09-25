import * as THREE from 'three';

interface Meteor { line: THREE.Line; dir: THREE.Vector3; life: number; speed: number }

/** Occasional shooting stars streaking across the far background. */
export class Meteors {
  readonly group = new THREE.Group();
  private active: Meteor[] = [];
  private cooldown = 2;

  update(dt: number) {
    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      this.spawn();
      this.cooldown = 2.5 + Math.random() * 4;
    }
    for (const m of this.active) {
      m.life += dt;
      m.line.position.addScaledVector(m.dir, m.speed * dt);
      (m.line.material as THREE.LineBasicMaterial).opacity = Math.sin(Math.min(1, m.life / 1.1) * Math.PI);
    }
    this.active = this.active.filter((m) => {
      if (m.life < 1.1) return true;
      this.group.remove(m.line);
      m.line.geometry.dispose();
      return false;
    });
  }

  private spawn() {
    const start = new THREE.Vector3().randomDirection().multiplyScalar(260 + Math.random() * 120);
    const dir = new THREE.Vector3().randomDirection().projectOnPlane(start.clone().normalize()).normalize();
    const tail = 26 + Math.random() * 20;
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), dir.clone().multiplyScalar(-tail)]);
    // head white, tail fades to black (invisible under additive blending)
    g.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 0, 0, 0], 3));
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    line.position.copy(start);
    this.group.add(line);
    this.active.push({ line, dir, life: 0, speed: 160 + Math.random() * 80 });
  }
}
