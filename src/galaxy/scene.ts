import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Galaxy, Vec3 } from '../types';
import { Stars, StarState } from './stars';
import { createNebula, createStarfield } from './nebula';
import { createConstellationLines, NeighborThreads } from './links';
import { Meteors } from './meteors';

interface Flight { fromPos: THREE.Vector3; toPos: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; t: number; dur: number }

export class Universe {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  onStarClick: (id: number | null) => void = () => {};
  onStarHover: (id: number | null, x: number, y: number) => void = () => {};
  onConstellationClick: (id: number) => void = () => {};

  private scene = new THREE.Scene();
  private composer: EffectComposer;
  private labels: CSS2DRenderer;
  private world = new THREE.Group();
  private stars: Stars | null = null;
  private figures: THREE.LineSegments | null = null;
  private threads = new NeighborThreads();
  private galaxy: Galaxy | null = null;
  private formStart = 0;
  private flight: Flight | null = null;
  private raycaster = new THREE.Raycaster();
  private clock = new THREE.Clock();
  private hovered: number | null = null;
  private meteors = new Meteors();
  private shift = 0;
  private shiftTarget = 0;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x03040b);
    container.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = 'label-layer';
    container.appendChild(this.labels.domElement);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 3000);
    this.camera.position.set(0, 40, 150);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.35;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 320;
    this.controls.addEventListener('start', () => (this.flight = null));

    this.scene.add(createStarfield(), this.world, this.threads.lines, this.meteors.group);
    this.scene.fog = new THREE.FogExp2(0x03040b, 0.0022);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.95, 0.55, 0.12));
    this.composer.addPass(new OutputPass());

    this.raycaster.params.Points = { threshold: 2.6 };
    this.bindPointer();
    addEventListener('resize', () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  load(galaxy: Galaxy) {
    this.galaxy = galaxy;
    this.world.clear();
    this.stars = new Stars(galaxy);
    this.figures = createConstellationLines(galaxy);
    this.world.add(createNebula(galaxy), this.figures, this.stars.points);
    this.threads.show(galaxy, null);

    for (const con of galaxy.constellations) {
      const el = document.createElement('button');
      el.className = 'con-label';
      el.style.setProperty('--c', con.color);
      el.innerHTML = `<span class="dot"></span>${con.name}`;
      el.onclick = () => this.onConstellationClick(con.id);
      const label = new CSS2DObject(el);
      // anchor the label on the constellation's outermost star so labels fan outward
      const edge = galaxy.stars.filter((s) => s.cluster === con.id).sort((a, b) => Math.hypot(...b.pos) - Math.hypot(...a.pos))[0];
      const p = new THREE.Vector3(...con.center).lerp(new THREE.Vector3(...edge.pos), 0.75);
      label.position.copy(p.addScaledVector(p.clone().normalize(), 6));
      this.world.add(label);
    }

    this.formStart = this.clock.getElapsedTime();
    this.flyTo([0, 0, 0], this.homePosition(), 2.6);
  }

  /** Fly the camera so `target` is centered, at `distance` units away. */
  focus(target: Vec3, distance = 34) {
    const t = new THREE.Vector3(...target);
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.flyTo(target, t.clone().add(dir.multiplyScalar(distance)), 1.4);
  }

  overview() {
    this.flyTo([0, 0, 0], this.homePosition(), 1.8);
  }

  /** Pull back further on tall screens so the whole galaxy fits. */
  private homePosition() {
    return new THREE.Vector3(0, 30, 112).multiplyScalar(Math.max(1, 0.75 / this.camera.aspect));
  }

  setStates(fn: (i: number) => StarState) {
    this.stars?.setStates(fn);
  }

  showThreads(id: number | null, targets?: number[]) {
    if (this.galaxy) this.threads.show(this.galaxy, id, targets);
  }

  /** Screen position of a star, for placing HTML overlays. */
  project(pos: Vec3) {
    const v = new THREE.Vector3(...pos).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height, visible: v.z < 1 };
  }

  snapshot() {
    this.composer.render();
    return this.renderer.domElement;
  }

  private flyTo(target: Vec3, pos: THREE.Vector3, dur: number) {
    this.flight = {
      fromPos: this.camera.position.clone(), toPos: pos,
      fromTarget: this.controls.target.clone(), toTarget: new THREE.Vector3(...target),
      t: 0, dur,
    };
  }

  private tick() {
    const dt = this.clock.getDelta();
    const time = this.clock.getElapsedTime();
    const form = Math.min(1.5, (time - this.formStart) / 2.4);
    this.stars?.update(time, form);
    // constellation figures are drawn in once the stars have arrived
    if (this.figures) (this.figures.material as THREE.LineBasicMaterial).opacity = 0.32 * Math.min(1, Math.max(0, (form - 0.7) / 0.5));

    if (this.flight) {
      const f = this.flight;
      f.t = Math.min(1, f.t + dt / f.dur);
      const e = f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2;
      this.camera.position.lerpVectors(f.fromPos, f.toPos, e);
      this.controls.target.lerpVectors(f.fromTarget, f.toTarget, e);
      if (f.t >= 1) this.flight = null;
    }

    this.meteors.update(dt);
    if (Math.abs(this.shift - this.shiftTarget) > 1e-4) {
      this.shift += (this.shiftTarget - this.shift) * Math.min(1, dt * 3);
      this.applyShift();
    }
    this.controls.update();
    this.composer.render();
    this.labels.render(this.scene, this.camera);
  }

  /** Slide the galaxy sideways (or up, on tall screens) to make room for overlay text. */
  setShift(fraction: number) {
    this.shiftTarget = fraction;
  }

  private applyShift() {
    const w = innerWidth, h = innerHeight;
    if (Math.abs(this.shift) < 1e-3) this.camera.clearViewOffset();
    else if (w >= h) this.camera.setViewOffset(w, h, -this.shift * w, 0, w, h);
    else this.camera.setViewOffset(w, h, 0, this.shift * h * 0.9, w, h);
  }

  private resize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h;
    this.applyShift();
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.labels.setSize(w, h);
  }

  private pick(e: PointerEvent): number | null {
    if (!this.stars) return null;
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.stars.points)[0];
    return hit?.index ?? null;
  }

  private bindPointer() {
    const el = this.renderer.domElement;
    let down = { x: 0, y: 0 };
    el.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    el.addEventListener('pointerup', (e) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return; // it was a drag
      this.onStarClick(this.pick(e));
    });
    el.addEventListener('pointermove', (e) => {
      const id = this.pick(e);
      if (id !== this.hovered) {
        this.hovered = id;
        el.style.cursor = id == null ? 'grab' : 'pointer';
      }
      this.onStarHover(id, e.clientX, e.clientY);
    });
  }
}
