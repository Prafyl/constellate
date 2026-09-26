import * as THREE from 'three';
import type { Galaxy } from '../types';

export const enum StarState { Normal = 0, Dim = 1, Lit = 2, Mastered = 3, Wrong = 4 }

const vertex = /* glsl */ `
  attribute vec3 aStart;
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aState;
  attribute float aDelay;
  uniform float uTime;
  uniform float uForm;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vState;
  varying float vAlpha;

  void main() {
    float t = clamp((uForm - aDelay) / 0.55, 0.0, 1.0);
    float e = 1.0 - pow(1.0 - t, 4.0);
    vec3 p = mix(aStart, position, e);
    // gentle spiral while forming
    float a = (1.0 - e) * 3.0;
    p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float twinkle = 0.85 + 0.15 * sin(uTime * 2.2 + aDelay * 40.0);
    float boost = aState == 2.0 ? 2.1 : aState == 3.0 ? 1.8 : aState == 4.0 ? 1.8 : aState == 1.0 ? 0.6 : 1.0;
    gl_PointSize = min(aSize * boost * twinkle * uPixelRatio * (260.0 / -mv.z), 90.0);

    vColor = aState == 3.0 ? vec3(1.0, 0.82, 0.35) : aState == 4.0 ? vec3(1.0, 0.3, 0.35) : aColor;
    vState = aState;
    vAlpha = aState == 1.0 ? 0.25 : 1.0;
  }
`;

const fragment = /* glsl */ `
  varying vec3 vColor;
  varying float vState;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float core = smoothstep(0.1, 0.04, d);
    float halo = pow(smoothstep(0.5, 0.0, d), 3.6);
    vec3 col = vColor * halo * 1.6 + mix(vColor, vec3(1.0), 0.75) * core;
    gl_FragColor = vec4(col, (halo + core) * vAlpha);
  }
`;

export class Stars {
  readonly points: THREE.Points;
  private state: THREE.BufferAttribute;
  private material: THREE.ShaderMaterial;

  constructor(galaxy: Galaxy) {
    const n = galaxy.stars.length;
    const pos = new Float32Array(n * 3);
    const start = new Float32Array(n * 3);
    const color = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const delay = new Float32Array(n);
    const c = new THREE.Color();

    galaxy.stars.forEach((s, i) => {
      pos.set(s.pos, i * 3);
      // born from a tight, hot core: the "big bang"
      start.set([s.pos[0] * 0.02, s.pos[1] * 0.02, s.pos[2] * 0.02], i * 3);
      c.set(galaxy.constellations[s.cluster].color);
      color.set([c.r, c.g, c.b], i * 3);
      size[i] = 5 + Math.min(4, s.text.length / 40);
      delay[i] = (Math.hypot(...s.pos) / 60) * 0.45;
    });

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aStart', new THREE.BufferAttribute(start, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aDelay', new THREE.BufferAttribute(delay, 1));
    this.state = new THREE.BufferAttribute(new Float32Array(n), 1);
    g.setAttribute('aState', this.state);

    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uTime: { value: 0 }, uForm: { value: 0 }, uPixelRatio: { value: Math.min(devicePixelRatio, 2) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.material);
  }

  update(time: number, form: number) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uForm.value = form;
  }

  setStates(fn: (i: number) => StarState) {
    const arr = this.state.array as Float32Array;
    for (let i = 0; i < arr.length; i++) arr[i] = fn(i);
    this.state.needsUpdate = true;
  }
}
