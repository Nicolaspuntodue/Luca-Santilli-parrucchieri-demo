import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  BufferGeometry,
  BufferAttribute,
  ShaderMaterial,
  LineSegments,
  NormalBlending,
  Vector2,
  Color,
} from 'three';

/*
  Procedural hair: thousands of line strands whose shape is computed entirely
  in the vertex shader and lit with a Kajiya-Kay style anisotropic model, the
  classic approximation for hair fibres (light follows the strand direction,
  giving the soft sheen and the sharp highlight bands of real hair).

  The page drives five scalar states (0..1) that tell the story of an appointment:
    uComb   loose ribbon in the wind   -> combed, parallel curtain  (check-up)
    uCut    long                       -> blunt, shorter length     (taglio)
    uColor  natural brunette           -> hand-painted honey tips   (colore)
    uGloss  soft sheen                 -> glossy waves, glass bands (glass hair)
    uFade   full presence              -> ambient background
*/

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uComb;
  uniform float uCut;
  uniform float uGloss;
  uniform float uOffsetX;
  uniform vec2  uMouse;

  attribute float aT;
  attribute vec4  aSeed;

  varying float vT;
  varying vec4  vSeed;
  varying vec3  vTan;
  varying float vZ;
  varying float vDense;

  vec3 hairPos(float t, float k) {
    // A: a twisting ribbon of hair crossing the screen, lifted by the wind
    float lane = aSeed.x - 0.5;
    float ang  = t * 2.4 + uTime * 0.22 + aSeed.w * 0.9;
    float r    = lane * 3.0 + (aSeed.z - 0.5) * 0.35;
    vec3 A;
    A.x = mix(-10.0, 10.0, t) + sin(uTime * 0.2 + aSeed.y * 6.2831) * 0.25;
    A.y = sin(t * 3.1 - uTime * 0.45) * 1.15 * (0.4 + t)
        + r * cos(ang) * 0.62
        + sin(t * 9.0 + uTime * 0.9 + aSeed.y * 6.2831) * 0.05 * t;
    A.z = r * sin(ang) * 0.62 + cos(t * 2.0 + uTime * 0.35) * 0.6;
    A.y += 1.25 + (t - 0.5) * 0.9; // ride above the hero headline, rising to the right

    // B: combed curtain, cut to a blunt line, then waved and glossed
    float len = mix(1.0, 0.56 + aSeed.y * 0.05, smoothstep(0.0, 1.0, uCut));
    float tb  = t * len;
    vec3 B;
    B.x = (aSeed.x - 0.5) * 6.4 + uOffsetX;
    B.y = 3.9 - tb * 8.4;
    B.z = (aSeed.z - 0.5) * 1.4;
    B.x += sin(tb * 7.0 + aSeed.y * 6.2831 + uTime * 0.7) * 0.03 * tb; // flyaways
    float wave = sin(B.y * 1.35 + uTime * 0.55 + aSeed.x * 0.4);
    B.x += wave * 0.34 * uGloss * (0.35 + tb);
    B.z += cos(B.y * 1.35 + uTime * 0.55) * 0.35 * uGloss;

    return mix(A, B, k);
  }

  void main() {
    float t = aT;
    // staggered morph so strands settle one after another
    float k = clamp(uComb * 1.5 - aSeed.w * 0.5, 0.0, 1.0);
    k = k * k * (3.0 - 2.0 * k);

    vec3 p  = hairPos(t, k);
    float dt = t < 0.99 ? 0.01 : -0.01;
    vec3 tan = normalize(hairPos(t + dt, k) - p) * sign(dt);

    // pointer parts the hair, more at the tips than at the roots
    vec2 d = p.xy - uMouse;
    float f = exp(-dot(d, d) * 0.7) * 0.55 * (0.2 + t);
    p.xy += normalize(d + 1e-4) * f;

    vT = t;
    vSeed = aSeed;
    vTan = tan;
    vZ = p.z;
    vDense = 1.0 - k;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform float uColor;
  uniform float uGloss;
  uniform float uFade;
  uniform vec3  uRoot;
  uniform vec3  uLength;
  uniform vec3  uHoneyA;
  uniform vec3  uHoneyB;

  varying float vT;
  varying vec4  vSeed;
  varying vec3  vTan;
  varying float vZ;
  varying float vDense;

  void main() {
    // natural brunette, darker at the root, every strand slightly different
    vec3 base = mix(uRoot, uLength, smoothstep(0.0, 0.9, vT));
    base *= 0.8 + 0.4 * vSeed.y;

    // hand-painted balayage: lighter towards the tips, uneven like a brush
    vec3 honey = mix(uHoneyA, uHoneyB, smoothstep(0.3, 1.0, vT));
    float mask = smoothstep(0.25, 0.8, vT + (vSeed.z - 0.5) * 0.45) * uColor;
    base = mix(base, honey, mask * (0.65 + 0.35 * vSeed.x));

    // Kajiya-Kay anisotropic lighting
    vec3 T = normalize(vTan);
    vec3 L = normalize(vec3(-0.35, 0.65, 0.7));
    vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 H = normalize(L + V);
    float TL = dot(T, L);
    float diffuse = sqrt(max(0.0, 1.0 - TL * TL));
    // fake head curvature: the tangent tilts along the length, so a soft
    // highlight band (the "halo" of real hair) sits across the lengths
    // band centre: ~35% down the combed lengths, mid-ribbon in the hero
    float curve = mix(0.35, 0.19, vDense) + (0.36 - vT) * 0.9;
    float shift = curve + (vSeed.w - 0.5) * 0.12;
    float th1 = dot(T, H) + shift;
    float th2 = dot(T, H) + shift - 0.16;
    float spec1 = pow(sqrt(max(0.0, 1.0 - th1 * th1)), mix(60.0, 180.0, uGloss));
    float spec2 = pow(sqrt(max(0.0, 1.0 - th2 * th2)), 14.0);

    vec3 col = base * (0.35 + 0.75 * diffuse);
    col += spec1 * vec3(1.0, 0.9, 0.78) * mix(0.42, 0.95, uGloss);
    col += spec2 * base * 0.9;

    // depth: strands at the back fall into shadow, giving the mass volume
    col *= 0.62 + 0.38 * smoothstep(-1.6, 1.4, vZ);

    float edge = smoothstep(0.0, 0.06, vT) * (1.0 - smoothstep(0.88, 1.0, vT));
    float alpha = (0.45 + 0.45 * vSeed.w) * edge * uFade * mix(1.0, 0.75, vDense);
    gl_FragColor = vec4(col, alpha);
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
  const STRANDS = isSmall ? 1400 : 2800;
  const SEG = isSmall ? 36 : 48;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.75 : 2));
  renderer.setClearColor(new Color('#0a0a0a'), 1);

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
    const seed = [Math.random(), Math.random(), Math.random(), Math.random()];
    for (let i = 0; i < SEG; i++) {
      aT[v] = i / (SEG - 1);
      aSeed.set(seed, v * 4);
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
    uRoot: { value: new Color('#24170f') },
    uLength: { value: new Color('#6e4c36') },
    uHoneyA: { value: new Color('#9a653a') },
    uHoneyB: { value: new Color('#e2b57e') },
  };

  const mat = new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: NormalBlending,
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
    if (e.pointerType === 'touch') return; // on phones a finger would just smear the hair while scrolling
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
