---
name: web-design-review
description: Audit Angular UI code against web interface guidelines — accessibility (WCAG 2.2 AA), focus, forms, animation, typography, performance, SEO, dark mode, i18n, responsive. Outputs terse file:line findings grouped by severity. Trigger for "review my UI", "check accessibility", "audit design", "a11y pass", "SEO check", or a polish/QA pass after building.
argument-hint: '[file or glob to review]'
---

# Web Design Review (Angular)

Review the given templates/styles for compliance with the rules below. Be **terse and
comprehensive** — sacrifice grammar for signal. Reference exact `file:line`.

If the requested change is genuinely visual (does it _look_ right at each breakpoint),
capture screenshots: use the **Playwright MCP** if available (navigate → `browser_resize`
to 1280 / 768 / 375 → `browser_take_screenshot` fullPage), else ask the user to attach
them. Save under `.design/<feature>/screenshots/`. Don't skip the visual check for
layout/hierarchy findings.

## How to run

1. Resolve files: the `$ARGUMENTS` glob, else the changed templates/styles, else ask.
2. Read each `*.html`, `*.scss`, and the relevant component `*.ts`, plus `index.html`.
3. Apply every rule. 4. Output in the format at the bottom, grouped **Must / Should /
   Could** + a short "What works" note.

## Rules

### Accessibility (WCAG 2.2 AA)

- Icon-only controls need an accessible name (`aria-label` via Transloco key).
- Every form control has an associated `<label for>` (or `aria-label`).
- Actions are `<button>`, navigation is `<a routerLink>` — never `<div (click)>`.
- Decorative icons/images: `aria-hidden="true"` / `alt=""`; meaningful images need `alt`.
- Async updates (toasts, validation, live results) announced via `aria-live="polite"`
  or CDK `LiveAnnouncer`.
- Semantic HTML before ARIA (`<nav> <main> <header> <footer> <button> <table>`).
- Headings hierarchical, one `<h1>` per view; provide a skip-to-main link.
- Custom widgets use Angular CDK a11y (FocusTrap, roving tabindex) — not hand-rolled.

### Focus

- All interactive elements have a visible `:focus-visible` ring; never `outline:none`
  without a replacement. Prefer `:focus-visible` over `:focus`.
- Trap focus in modals/offcanvas (ng-bootstrap does this — verify), restore on close.
- Manage focus on route change (move focus to `<h1>`/main for SPA navigation).

### Forms

- Correct `type`/`inputmode` (`email`, `tel`, `url`, `number`), meaningful `name`,
  `autocomplete`. Disable spellcheck on emails/codes/usernames.
- Never block paste. Inline errors next to fields; focus the first error on submit.
- Submit stays enabled until the request starts; show a spinner during it.
- Placeholders show an example and end with `…`; warn on navigation with unsaved changes.

### Animation

- Honor `prefers-reduced-motion` (reduced variant or disabled).
- Animate `transform`/`opacity` only; never `transition: all` (list properties).
- Set correct `transform-origin`; animations interruptible by user input.

### Typography

- `…` not `...`; curly quotes `" "` not straight. Loading/saving copy ends with `…`.
- `font-variant-numeric: tabular-nums` for number columns. Non-breaking spaces in
  `10&nbsp;MB`, `⌘&nbsp;K`. `text-wrap: balance` on headings to avoid widows.

### Content handling

- Long text handled: `text-truncate` / line-clamp / `word-break`. Flex children that
  must truncate need `min-width: 0`. Render real empty states (no broken UI on `[]`/'').

### Images & media

- `<img>` has explicit `width`/`height` (prevents CLS). Below-fold `loading="lazy"`;
  above-fold LCP image `fetchpriority="high"`.

### Performance / Core Web Vitals

- Long lists (>50) virtualized (CDK `cdk-virtual-scroll-viewport` / `content-visibility`).
- No layout reads in render paths; batch DOM reads/writes.
- `preconnect` to asset/CDN/font domains; preload critical fonts with `font-display: swap`.
- `@for` uses `track`; components are `OnPush`; avoid heavy work per keystroke.

### SEO

- Per-route `<title>` + meta description set via `Title`/`Meta` (or a SEO service) —
  not just static `index.html`.
- Open Graph + Twitter card + canonical + `robots` where the page is public.
- One `<h1>`; semantic landmarks; descriptive link text (no "click here").
- `lang` correct; JSON-LD structured data where it helps; `robots.txt` + sitemap exist.
- Client-only meta is invisible to many crawlers — if discoverability matters, flag the
  need for SSR/prerender (`@angular/ssr`).

### Navigation & state

- Shareable state (filters, tabs, pagination) reflected in the URL / query params.
- Links are real `<a routerLink>` (support Cmd/middle-click). Destructive actions need
  confirmation or an undo window — never silent-immediate.

### Touch & layout

- `touch-action: manipulation`; `overscroll-behavior: contain` in modals/drawers.
- Full-bleed layouts respect `env(safe-area-inset-*)`. No accidental `overflow-x`.
- Targets ≥ 44×44px; body text ≥ 16px on mobile.

### Dark mode & theming

- `color-scheme: dark` on `<html>` for dark themes; `<meta name="theme-color">` matches
  the background. No hardcoded hex that won't switch — use the token variables.
- Dark palette intentional (not inverted); shadows darker/more transparent; accents keep
  contrast against dark backgrounds.

### i18n (Transloco)

- No hardcoded user-facing copy (including `alt`, `aria-label`, `title`, meta) — keys
  only. Dates/numbers via `Intl.*` / Angular pipes, not hand-formatted. Brand/code
  tokens marked `translate="no"`.

### Contrast & responsive

- Text contrast ≥ 4.5:1, large text & UI components ≥ 3:1.
- Layout works at 375 / 768 / 1280 and _reorganizes_ (not just shrinks); built
  mobile-first (`min-width`), no horizontal scroll at 375px.

## Anti-patterns (always flag)

`user-scalable=no` / `maximum-scale=1` · paste blocking · `transition: all` ·
`outline:none` without focus-visible · `<div (click)>` for actions · images without
dimensions · big lists without virtualization · inputs without labels · icon buttons
without labels · hardcoded copy/date/number formats · `autofocus` on mobile.

## Output format

```text
## apps/front/src/app/pages/login/login.component.html

login.component.html:14 - input lacks <label> / aria-label
login.component.html:22 - icon button missing aria-label (use Transloco key)
login.component.scss:8  - outline:none without :focus-visible replacement

## apps/front/src/app/pages/home/home.component.html
✓ pass
```

Then a short prioritized summary:

```markdown
### Must fix

1. <issue> — file:line — _fix: <concrete suggestion>_

### Should fix

1. ...

### Could improve

1. ...

### What works

- <strongest aspects to keep>
```

State the issue + location; skip explanation unless the fix is non-obvious. No preamble.
Apply the fixes you own (styles, markup semantics, meta); hand logic fixes to
`frontend-developer` as specs.
