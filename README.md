# Luca Santilli Parrucchieri, demo homepage

Scroll-driven homepage concept for **Luca Santilli Parrucchieri** (Esselle s.a.s. di Santilli Luca & C.), Via Firenze 52, Pescara.

The hero visual is procedural hair rendered in WebGL: about 1,900 strands are drawn as lines, and their shape is computed in the vertex shader. Scrolling through the "Metodo" section tells the story of an appointment and changes the hair at each step:

| Chapter | Hair state |
|---|---|
| Prima ascoltiamo (check-up) | loose ribbon, then combed into a curtain |
| Poi diamo forma (taglio) | blunt cut, shorter length |
| Il colore, su misura | hand-painted copper tips (balayage) |
| Infine, la luce (Glass Hair) | glossy waves with light bands |

After the story the hair becomes a dim backdrop. At the contacts it flows free again, now copper.

## Stack

- Vite, vanilla JS
- three.js (custom `ShaderMaterial` on `LineSegments`)
- GSAP ScrollTrigger (pinned story, horizontal services pan, clip and zoom reveals) + Lenis smooth scroll
- Self-hosted fonts: Cormorant Garamond (display) + Manrope (body); Phosphor icons

## Design system

- Theme: dark only ("cold luxury" graphite and silver) with one accent, copper `#e8703f`
- Radii: pill for interactive elements, square for images and panels
- `prefers-reduced-motion`: no smooth scroll and no pinning; the hair is a still image in its final state
- No WebGL: falls back to a gradient background

## Run

```bash
npm install
npm run dev
```

Netlify: `netlify.toml` builds with `npm run build` and publishes `dist/`.

## Notes

- Business info (address, phone, email, hours, L'Oréal Professionnel services) comes from public listings: MyPescara, L'Oréal Professionnel salon locator, Fresha, PagineGialle. The listings disagree on opening hours; the page uses the MyPescara hours and they should be confirmed with the salon.
- All photos are AI-generated (Higgsfield) for illustration only, including the salon interior. They do not show the real salon or its staff. Replace them with real photography before going live.
