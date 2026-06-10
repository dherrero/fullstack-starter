---
name: frontend-design
description: Design and build distinctive, production-grade Angular UI with high aesthetic quality — design tokens, named aesthetic philosophies, mobile-first responsive layout, dark mode, and motion. Grounded in this project's stack (Angular 21 + Bootstrap 5 + ng-bootstrap). Trigger when building components, pages, or a visual system, theming, or when the user mentions design, look & feel, UI, tokens, or aesthetics.
argument-hint: '[component/page or aesthetic direction]'
---

# Frontend Design (Angular + Bootstrap)

Create distinctive, production-grade interfaces that avoid generic "AI slop". Commit to
a **clear, intentional aesthetic** and execute it with precision. Bold maximalism and
refined minimalism both work — intentionality matters more than intensity.

## Before you write any code — detect what exists

This project ships a real stack. Respect it; extend, never fork.

1. **UI kit**: **Bootstrap 5 + `@ng-bootstrap/ng-bootstrap`**. Theme through Bootstrap's
   `--bs-*` CSS variables and Sass; use ng-bootstrap components (modal, dropdown,
   toast, etc.) — they are accessible out of the box. Do not add Tailwind / Material.
2. **Icons**: **Lineicons** web font (`apps/front/src/assets/icons.scss`).
3. **Global styles & tokens**: `apps/front/src/styles.scss`. Existing CSS variables and
   classes are the seed of the token system — consolidate them.
4. **Components**: scan `apps/front/src/app/{pages,components}`; if a component matches
   what you need, extend/compose it — do not duplicate.
5. **i18n**: **Transloco**. All copy is translation keys under `src/assets/i18n/`.
6. **State the context** before coding: what problem the UI solves, who uses it, the
   emotional tone, and hard constraints (a11y, performance, devices).

Then **commit to an aesthetic direction** — name it and say why in one line before code.

## Design tokens come first

Every component references tokens; nothing hardcodes color/spacing/type. Put tokens in
`styles.scss` (or a dedicated `tokens.scss` imported there) and **map Bootstrap's
variables onto them** so the whole kit re-themes from one place.

```scss
:root {
  /* Color — semantic, not raw */
  --color-bg-primary: #fcfcf9;
  --color-bg-secondary: #ffffff;
  --color-text-primary: #1a1a17;
  --color-text-secondary: #55554d;
  --color-border: #e3e3db;
  --color-accent: #405123; /* this project's olive accent */
  --color-accent-hover: #4f6330;
  --color-success: #2e7d32;
  --color-warning: #b26a00;
  --color-error: #b3261e;
  --color-info: #0b5cab;

  /* Spacing — 4px base */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;

  /* Type */
  --font-display: 'Roboto', system-ui, sans-serif; /* swap for something distinctive */
  --font-body: 'Roboto', system-ui, sans-serif;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.25rem;
  --text-xl: 1.75rem;
  --text-2xl: 2.5rem;
  --text-hero: clamp(2.5rem, 6vw, 4.5rem);
  --leading-tight: 1.2;
  --leading-body: 1.6;

  /* Radii / shadow / motion */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-full: 999px;
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.08);
  --dur-fast: 150ms;
  --dur-normal: 250ms;
  --ease: cubic-bezier(0.4, 0, 0.2, 1);

  /* Re-theme Bootstrap from the tokens */
  --bs-primary: var(--color-accent);
  --bs-body-bg: var(--color-bg-primary);
  --bs-body-color: var(--color-text-primary);
  --bs-border-color: var(--color-border);
}

[data-theme='dark'] {
  --color-bg-primary: #16160f; /* warm near-black, not pure #000 */
  --color-bg-secondary: #1f1f17;
  --color-text-primary: #e9e9e0; /* off-white, not #fff */
  --color-text-secondary: #a9a99c;
  --color-border: #34342a;
  --color-accent: #9bb368; /* lifted for contrast on dark */
  --shadow-md: 0 6px 20px rgba(0, 0, 0, 0.5);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    /* mirror the dark overrides */
  }
}
```

Rules: dark mode is **not** an inversion — pick warm/cool near-black to match the
philosophy, drop pure-white text to off-white, make shadows darker & more transparent,
and lift accents to keep WCAG contrast.

## Aesthetic philosophies (a menu, not a requirement)

If the user names one, follow its parameters. If they describe a vibe, map it to the
closest. If they say nothing, pick one that fits the context and state your choice.

- **Dieter Rams / Functionalist** — less but better; restrained mono palette + one
  accent; strict grid; 4/8px scale; minimal purposeful motion; borders over shadows.
- **Swiss / International** — sacred grid; dramatic type scale; black/white + one color;
  rules as structure; flat, no gradients.
- **Japanese Minimalism (Ma)** — negative space is content; muted naturals; extreme
  whitespace; slow gentle fades; hairline borders.
- **Brutalist / Raw** — visible structure; mono/system type; black/white + clashing
  accent; tight/uneven spacing; instant or no motion.
- **Scandinavian** — warm + restrained; rounded (8–12px); soft shadows; gentle easing;
  accessible by default (good default for friendly apps).
- **Art Deco** — symmetric geometric luxury; gold/emerald/navy; ornamental borders;
  staggered elegant reveals.
- **Neo-Memphis** — playful chaos; clashing neons; broken grid; bouncy motion; hard
  bright shadows.
- **Editorial / Magazine** — display serif headlines + clean body; strong column grid;
  full-bleed imagery; scroll reveals; print details.

Match implementation complexity to the vision: a Rams screen is 50 lines of precise CSS;
a Neo-Memphis screen is 300 lines of controlled chaos. Both are correct.

## Implementation guidelines

- **Typography**: prefer a distinctive, characterful pairing (display + body) loaded via
  `<link rel="preload" as="font">` with `font-display: swap`. Avoid defaulting to
  Inter/Roboto/Arial unless the brand demands it. Never reuse the same "safe" font across
  every screen.
- **Color**: a dominant color with sharp accents beats a timid, evenly-spread palette.
  Drive everything from the token variables.
- **Motion**: CSS-first. One well-orchestrated load with staggered `animation-delay`
  reveals beats scattered micro-interactions. Animate only `transform`/`opacity`; never
  `transition: all`; always provide a `prefers-reduced-motion` variant.
- **Spatial composition**: unexpected layouts earn attention — asymmetry, overlap,
  generous negative space OR controlled density. Or strict grids executed precisely.
- **Backgrounds & depth**: create atmosphere (gradient mesh, noise/grain, geometric
  pattern, layered transparency) instead of flat fills — matched to the philosophy.

**NEVER** ship generic AI aesthetics: purple-gradient-on-white, Inter everywhere,
predictable card grids, cookie-cutter layouts. Every screen should feel designed for its
specific context, and successive screens should vary.

## Mobile-first (non-negotiable)

- Build the 375px single-column layout first; add complexity with `min-width` queries.
- Touch targets ≥ 44×44px; body text ≥ 16px (prevents iOS input-zoom).
- Mobile-specific navigation (offcanvas/bottom-tabs/drawer) — never a desktop bar that
  overflows. Keep line length 45–75 characters at every breakpoint.

## Dark mode

- Theme via tokens + `[data-theme="dark"]` **and** `prefers-color-scheme` (system +
  manual toggle). Switching themes = swapping variable values, not rewriting components.
- Include `color-scheme: dark` on `<html>` for native scrollbars/inputs, and keep the
  `<meta name="theme-color">` in sync with the background.

## Angular specifics

- Standalone components, `OnPush`, native control flow (`@if`/`@for`/`@switch`).
- Component styles in the component's `.scss` referencing the global tokens; use `:host`
  for the component root. For shared design-system pieces, `ViewEncapsulation.None` is OK.
- Prefer native CSS animations over the Angular Animations DSL.
- Copy, `alt`, and `aria-label` are **Transloco keys**, never literals.
- After building, run `npx nx build front` and fix any errors.

> When you finish building, hand off to `/web-design-review` for the a11y/SEO/UX audit,
> and to `/angular-pwa-seo` if the screen affects discoverability or installability.
