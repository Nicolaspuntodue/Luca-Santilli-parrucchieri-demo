import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  BufferGeometry,
  BufferAttribute,
  ShaderMaterial,
  LineSegments,
  AdditiveBlending,
  Vector2,
  Color,
} from 'three';

/*
  Procedural hair: thousands of line strands whose shape is computed entirely
  in the vertex shader. The page drives five scalar states (0..1) that tell the
  story of an appointment:
    uComb   loose strands in the wind  -> combed, parallel curtain  (check-up)
    uCut    long                       -> blunt, shorter length     (taglio)
    uColor  natural brunette           -> hand-painted copper tips  (colore)
    uGloss  matte                      -> glossy waves, glass bands (glass hair)
    uFade   full presence              -> ambient background
*/

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uComb;
  uniform float uCut;
  uniform float uGloss;
  uniform float uOffsetX;
  uniform vec2  uMouse;
  uniform float uPixel;

  attribute float aT;
  attribute vec4  aSeed;

  varying float vT;
  varying vec4  vSeed;
  varying float vY;
  varying float vDense;

  void main() {
    float t = aT;

    // A: a twisting ribbon of hair crossing the screen, lifted by the wind
    float lane = aSeed.x - 0.5;
    float ang  = t * 2.4 + uTime * 0.22 + aSeed.w * 0.9;
    float r    = lane * 3.0 + (aSeed.z - 0.5) * 0.35;
    vec3 A;
    A.x = mix(-10.0, 10.0, t) + sin(uTime * 0.2 + aSeed.y * 6.2831) * 0.25;
    A.y = sin(t * 3.1 - uTime * 0.45) * 1.15 * (0.4 + t)
        + r * cos(ang) * 0.62
        + sin(t * 9.0 + uTime * 0.9 + aSeed.y * 6.2831) * 0.06 * t;
    A.z = r * sin(ang) * 0.62 + cos(t * 2.0 + uTime * 0.35) * 0.6;
    A.y += 1.25 + (t - 0.5) * 0.9; // ride above the hero headline, rising to the right

    // B: combed curtain, cut to a blunt line, then waved and glossed
    float len = mix(1.0, 0.56 + aSeed.y * 0.05, smoothstep(0.0, 1.0, uCut));
    float tb  = t * len;
    vec3 B;
    B.x = (aSeed.x - 0.5) * 6.4 + uOffsetX;
    B.y = 3.9 - tb * 8.4;
    B.z = (aSeed.z - 0.5) * 1.4;
    // tiny natural flyaways
    B.x += sin(tb * 7.0 + aSeed.y * 6.2831 + uTime * 0.7) * 0.03 * tb;
    // glass hair waves
    float wave = sin(B.y * 1.35 + uTime * 0.55 + aSeed.x * 0.4);
    B.x += wave * 0.34 * uGloss * (0.35 + tb);
    B.z += cos(B.y * 1.35 + uTime * 0.55) * 0.35 * uGloss;

    // staggered morph so strands settle one after another
    float k = clamp(uComb * 1.5 - aSeed.w * 0.5, 0.0, 1.0);
    k = k * k * (3.0 - 2.0 * k);
    vec3 p = mix(A, B, k);

    // pointer parts the hair, more at the tips than at the roots
    vec2 d = p.xy - uMouse;
    float f = exp(-dot(d, d) * 0.7) * 0.55 * (0.2 + t);
    p.xy += normalize(d + 1e-4) * f;

    vT = t;
    vDense = 1.0 - k; // the ribbon packs strands tightly, so it gets dimmer strands
    vSeed = aSeed;
    vY = p.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform float uTime;
  uniform float uColor;
  uniform float uGloss;
  uniform float uFade;
  uniform vec3  uCopperA;
  uniform vec3  uCopperB;

  varying float vT;
  varying vec4  vSeed;
  varying float vY;
  varying float vDense;

  void main() {
    vec3 root = vec3(0.07, 0.065, 0.07);
    vec3 mid  = vec3(0.36, 0.33, 0.33);
    vec3 base = mix(root, mid, smoothstep(0.0, 1.0, vT));

    vec3 copper = mix(uCopperA, uCopperB, vT);
    float mask = smoothstep(0.22, 0.85, vT + (vSeed.y - 0.5) * 0.4) * uColor;
    vec3 col = mix(base, copper, mask);

    // silver sheen that travels along every strand
    float sheen = pow(0.5 + 0.5 * sin(vT * 11.0 - uTime * 1.1 + vSeed.z * 6.2831), 6.0);
    col += sheen * vec3(0.55, 0.58, 0.62) * 0.35;

    // horizontal glass bands, like light on polished waves
    float band = pow(0.5 + 0.5 * sin(vY * 2.7 - uTime * 0.6 + vSeed.x * 0.6), 14.0);
    col += band * uGloss * vec3(1.0, 0.9, 0.82) * 1.1;

    float edge = smoothstep(0.0, 0.05, vT) * (1.0 - smoothstep(0.9, 1.0, vT));
    float alpha = (0.16 + 0.26 * vSeed.w) * edge * uFade * mix(1.0, 0.42, vDense);
    gl_FragColor = vec4(col, alpha); // additive: src * alpha + dst
  }
`;

export function createHair(canvas, { reducedMotion = false } = {}) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  if (!renderer.getContext()) return null;

  const isSmall = Math.min(window.innerWidth, window.innerHeight) < 700;
  const STRANDS = isSmall ? 900 : 1900;
  const SEG = isSmall ? 36 : 48;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.75 : 2));
  renderer.setClearColor(new Color('#0b0c0e'), 1);

  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 14);

  // geometry: per-vertex (t along strand, 4 random seeds per strand)
  const count = STRANDS * SEG;
  const aT = new Float32Array(count);
  const aSeed = new Float32Array(count * 4);
  const pos = new Float32Array(count * 3);
  const index = new Uint32Array(STRANDS * (SEG - 1) * 2);
  let v = 0;
  let ii = 0;
  for (let s = 0; s < STRANDS; s++) {
    const s0 = Math.random();
    const s1 = Math.random();
    const s2 = Math.random();
    const s3 = Math.random();
    for (let i = 0; i < SEG; i++) {
      aT[v] = i / (SEG - 1);
      aSeed.set([s0, s1, s2, s3], v * 4);
      if (i < SEG - 1) {
        index[ii++] = v;
        index[ii++] = v + 1;
      }
      v++;
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('aT', new BufferAttribute(aT, 1));
  geo.setAttribute('aSeed', new BufferAttribute(aSeed, 4));
  geo.setIndex(new BufferAttribute(index, 1));

  const uniforms = {
    uTime: { value: 0 },
    uComb: { value: 0 },
    uCut: { value: 0 },
    uColor: { value: 0 },
    uGloss: { value: 0 },
    uFade: { value: 0 },
    uOffsetX: { value: 0 },
    uMouse: { value: new Vector2(99, 99) },
    uPixel: { value: renderer.getPixelRatio() },
    uCopperA: { value: new Color('#7a2a10') },
    uCopperB: { value: new Color('#f08a52') },
  };

  const mat = new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  });

  const lines = new LineSegments(geo, mat);
  lines.frustumCulled = false;
  scene.add(lines);

  // target state written by scroll; uniforms ease toward it every frame
  const state = { comb: 0, cut: 0, color: 0, gloss: 0, fade: 1, camZ: 0, rotY: 0 };
  const mouseTarget = new Vector2(99, 99);
  const mouse = new Vector2(99, 99);
  let baseZ = 14;
  let offsetX = 0;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the curtain readable on portrait screens
    baseZ = camera.aspect < 1 ? 14 + (1 - camera.aspect) * 12 : 14;
    offsetX = w >= 900 ? 2.3 : 0;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  function onPointer(e) {
    // project pointer to the z=0 plane
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = -(e.clientY / window.innerHeight) * 2 + 1;
    const halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    mouseTarget.set(nx * halfH * camera.aspect, ny * halfH);
  }
  if (!reducedMotion) window.addEventListener('pointermove', onPointer, { passive: true });

  const damp = (a, b, k) => a + (b - a) * k;
  let last = performance.now();
  let time = 3.0;
  let running = true;

  function frame(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!reducedMotion) time += dt;

    const k = reducedMotion ? 1 : 1 - Math.pow(0.001, dt); // ~frame-rate independent easing
    uniforms.uTime.value = time;
    uniforms.uComb.value = damp(uniforms.uComb.value, state.comb, k);
    uniforms.uCut.value = damp(uniforms.uCut.value, state.cut, k);
    uniforms.uColor.value = damp(uniforms.uColor.value, state.color, k);
    uniforms.uGloss.value = damp(uniforms.uGloss.value, state.gloss, k);
    uniforms.uFade.value = damp(uniforms.uFade.value, state.fade, k * 0.6);
    uniforms.uOffsetX.value = damp(uniforms.uOffsetX.value, offsetX * state.comb, k);
    mouse.lerp(mouseTarget, k * 0.5);
    uniforms.uMouse.value.copy(mouse);

    camera.position.z = damp(camera.position.z, baseZ + state.camZ, k);
    lines.rotation.y = damp(lines.rotation.y, state.rotY, k);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) {
      last = performance.now();
      requestAnimationFrame(frame);
    }
  });

  return { state };
}
