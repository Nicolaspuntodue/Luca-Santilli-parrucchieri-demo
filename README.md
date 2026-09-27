# Luca Santilli Parrucchieri, demo homepage

Scroll-driven homepage concept for **Luca Santilli Parrucchieri** (Esselle s.a.s. di Santilli Luca & C.), Via Firenze 52, Pescara.

The hero visual is procedural hair rendered in WebGL: about 1,900 strands are drawn as lines, and their shape is computed in the vertex shader. The hair is lit with a Kajiya-Kay style anisotropic model (the standard approximation for hair fibres): natural brunette, a soft "halo" highlight across the lengths, honey balayage and glossy waves. Scrolling through the "Metodo" section tells the story of an appointment and changes the hair at each step:

| Chapter | Hair state |
|---|---|
| Prima ascoltiamo (check-up) | loose ribbon, then combed into a curtain |
| Poi diamo forma (taglio) | blunt cut, shorter length |
| Il colore, su misura | hand-painted copper tips (balayage) |
| Infine, la luce (Glass Hair) | glossy waves with light bands |

After the story the hair becomes a dim backdrop. At the contacts it flows free again, now with the balayage.

## Stack

- Vite, vanilla JS
- three.js (custom `ShaderMaterial` on `LineSegments`)
- GSAP ScrollTrigger (pinned story, horizontal services pan, clip and zoom reveals) + Lenis smooth scroll
- Self-hosted fonts: Cormorant Garamond (display) + Manrope (body); Phosphor icons

## Design system

- Palette from the real brand: the logo is white on pure black, staff wear black and the salon is bright white. So the page is monochrome (`#0a0a0a` / `#fafafa`, white CTA pills). The only colour comes from the hair, plus a soft nude `#d8c3af` for emphasis, sampled from the salon's Instagram photos
- One deliberate white colour block (the salon section), like the real room
- Real logo and wordmark in `public/brand/`, extracted from the salon's Facebook profile picture
- Mobile: full-screen menu, "Prenota / Come arrivare" action bar under the thumb, swipeable services, chapter copy clear of the bar
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

- Business info comes from public sources: Instagram and Facebook (logo, K-Scan Kérastase, ghd, Kérastase on the shop window), the L'Oréal Professionnel salon locator (services), Fresha, ParrucchieriAdvisor, MyPescara and PagineGialle.
- Opening hours: Fresha and ParrucchieriAdvisor agree (closed Monday; Tuesday and Wednesday 9:00-13:00 and 15:30-19:30; Thursday to Saturday 9:00-19:00), and an Instagram post says "riapriamo martedì". MyPescara lists older hours. Confirm with the salon.
- All photos are AI-generated (Higgsfield) for illustration only. They are modelled on the real salon (white interior, black shop sign, staff in black) but do not show the real salon or its staff. Replace them with real photography before going live.
