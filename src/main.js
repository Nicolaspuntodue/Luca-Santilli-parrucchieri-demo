import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource-variable/manrope';
import '@phosphor-icons/web/light';
import './style.css';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createHair } from './hair.js';

gsap.registerPlugin(ScrollTrigger);

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.toggle('reduced', reduce);

/* ---------- WebGL hair ---------- */
const hair = createHair(document.getElementById('hair'), { reducedMotion: reduce });
if (!hair) document.documentElement.classList.add('no-webgl');

/*
  Scroll progress of each chapter of the page. The hair state is always derived
  from these numbers in one place (applyHair), so jumping anywhere on the page
  (nav links, reload mid-page) lands on the exact right look. Smoothing happens
  in the render loop, not in the scroll tweens.
*/
const prog = { intro: 0, hero: 0, story: 0, dim: 0, end: 0 };
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;

function applyHair() {
  if (!hair) return;
  const s = prog.story * 4;
  const comb = clamp01(s);
  const cut = clamp01(s - 1);
  const color = clamp01(s - 2);
  const gloss = clamp01(s - 3);
  const hs = hair.state;
  hs.comb = comb * (1 - prog.end); // bookend: the transformed hair flows free again
  hs.cut = cut;
  hs.color = color;
  hs.gloss = lerp(gloss, 0.4, prog.end);
  hs.camZ = prog.hero * 2.5 * (1 - comb) - gloss * 1.2;
  hs.rotY = Math.sin(s * Math.PI * 0.75) * 0.1 * (1 - gloss);
  const ambient = lerp(1, 0.28, prog.dim);
  hs.fade = prog.intro * lerp(ambient, 0.4, prog.end);
}

if (reduce) {
  // static: show the finished, fully transformed hair as a quiet backdrop
  Object.assign(prog, { intro: 1, story: 1, dim: 0.6 });
  applyHair();
} else if (hair) {
  gsap.to(prog, { intro: 1, duration: 2.2, ease: 'power2.out', onUpdate: applyHair });
}

/* ---------- Smooth scroll (Lenis drives ScrollTrigger, no scroll listeners) ---------- */
if (!reduce) {
  const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  document.querySelectorAll('a[href^="#"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const el = id.length > 1 && document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el, { duration: 1.4 });
    }),
  );
}

/* ---------- Nav turns solid once the page leaves the very top ---------- */
const nav = document.querySelector('[data-nav]');
const sentinel = document.createElement('div');
sentinel.style.cssText = 'position:absolute;top:80px;left:0;width:1px;height:1px;pointer-events:none';
document.body.prepend(sentinel);
new IntersectionObserver(([e]) => nav.classList.toggle('is-solid', !e.isIntersecting)).observe(sentinel);

/* ---------- Split headings into words for the reveal ---------- */
document.querySelectorAll('[data-split]').forEach((el) => {
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) return frag.append(part);
          const w = document.createElement('span');
          w.className = 'w';
          const i = document.createElement('span');
          i.className = 'wi';
          i.textContent = part;
          w.append(i);
          frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
  };
  walk(el);
});

/* progress-only trigger: records 0..1 and re-derives the hair state */
const track = (key, vars) =>
  ScrollTrigger.create({
    ...vars,
    onUpdate: (self) => {
      prog[key] = self.progress;
      applyHair();
      vars.onProgress && vars.onProgress(self.progress);
    },
    onRefresh: (self) => {
      prog[key] = self.progress;
      applyHair();
    },
  });

const mm = gsap.matchMedia();

mm.add(
  {
    motion: '(prefers-reduced-motion: no-preference)',
    desktop: '(min-width: 768px)',
  },
  (ctx) => {
    const { motion, desktop } = ctx.conditions;
    if (!motion) return; // reduced motion: everything is visible and static

    /* Hero entrance: tells the eye where to start */
    gsap.from('.hero [data-split] .wi', { yPercent: 110, duration: 1.3, ease: 'expo.out', stagger: 0.07, delay: 0.2 });
    gsap.from('.hero [data-fade]', { y: 24, autoAlpha: 0, duration: 1.1, ease: 'expo.out', stagger: 0.12, delay: 0.7 });
    gsap.from('.nav', { y: -20, autoAlpha: 0, duration: 1, ease: 'expo.out', delay: 0.4 });

    /* Section headings and copy enter as they arrive */
    gsap.utils.toArray('section:not(.hero) [data-split]').forEach((h) => {
      gsap.from(h.querySelectorAll('.wi'), {
        yPercent: 110,
        duration: 1.1,
        ease: 'expo.out',
        stagger: 0.06,
        scrollTrigger: { trigger: h, start: 'top 85%' },
      });
    });
    gsap.utils.toArray('section:not(.hero) [data-fade]').forEach((el) => {
      gsap.from(el, { y: 28, autoAlpha: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
    });

    /* Hero: the ribbon drifts back and the copy lifts away as we leave */
    track('hero', { trigger: '.hero', start: 'top top', end: 'bottom top' });
    gsap.to('.hero__inner', {
      yPercent: -18,
      autoAlpha: 0,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'center center', end: 'bottom top', scrub: true },
    });

    /* METODO: pinned story, one chapter per hair state */
    const chapters = gsap.utils.toArray('.chapter');
    const ticks = gsap.utils.toArray('.metodo__progress span');
    track('story', {
      trigger: '.metodo',
      start: 'top top',
      end: () => '+=' + window.innerHeight * 4,
      pin: '.metodo__pin',
      onProgress: (p) => {
        const i = Math.min(3, Math.floor(p * 4 + 0.08));
        chapters.forEach((c, j) => c.classList.toggle('is-active', j === i));
        ticks.forEach((t, j) => t.classList.toggle('is-on', j <= i));
      },
    });

    /* After the story the hair becomes an ambient backdrop, then returns at the contacts */
    track('dim', { trigger: '.checkup', start: 'top 90%', end: 'top 30%' });
    track('end', { trigger: '.contatti', start: 'top 80%', end: 'top 20%' });

    /* Check-up image: clip reveal draws attention to the free consultation */
    gsap.from('[data-reveal-img]', {
      clipPath: 'inset(18% 18% 18% 18%)',
      ease: 'none',
      scrollTrigger: { trigger: '.checkup', start: 'top 85%', end: 'top 25%', scrub: true },
    });
    gsap.from('[data-reveal-img] img', {
      scale: 1.25,
      ease: 'none',
      scrollTrigger: { trigger: '.checkup', start: 'top bottom', end: 'bottom top', scrub: true },
    });

    /* SERVIZI: horizontal pan on desktop (canonical pin + scrub) */
    if (desktop) {
      const trackEl = document.querySelector('[data-track]');
      const wrap = document.querySelector('.servizi');
      const distance = () => trackEl.scrollWidth - window.innerWidth;
      const pan = gsap.to(trackEl, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: wrap,
          start: 'top top',
          end: () => '+=' + distance(),
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
        },
      });
      gsap.utils.toArray('.card img').forEach((img) => {
        gsap.fromTo(
          img,
          { xPercent: -7, scale: 1.18 },
          {
            xPercent: 7,
            scale: 1.18,
            ease: 'none',
            scrollTrigger: {
              trigger: img.closest('.card'),
              containerAnimation: pan,
              start: 'left right',
              end: 'right left',
              scrub: true,
            },
          },
        );
      });
    }

    /* SALONE: the room opens up as it enters */
    gsap.fromTo(
      '[data-zoom]',
      { clipPath: 'inset(12% 22% 12% 22%)' },
      {
        clipPath: 'inset(0% 0% 0% 0%)',
        ease: 'none',
        scrollTrigger: { trigger: '.salone', start: 'top 90%', end: 'top 10%', scrub: true },
      },
    );
    gsap.fromTo(
      '[data-zoom] img',
      { scale: 1.35 },
      { scale: 1, ease: 'none', scrollTrigger: { trigger: '.salone', start: 'top bottom', end: 'bottom top', scrub: true } },
    );

    /* Footer wordmark rises in */
    gsap.from('.footer__word', {
      yPercent: 40,
      autoAlpha: 0,
      ease: 'none',
      scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true },
    });
  },
);

window.addEventListener('load', () => ScrollTrigger.refresh());
