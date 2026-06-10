---
name: angular-pwa-seo
description: Set up or audit PWA and SEO for an Angular 21 app — web app manifest, @angular/service-worker (ngsw-config) with caching & update UX, per-route Title/Meta + Open Graph/Twitter/canonical, JSON-LD structured data, robots/sitemap, theme-color, and Core Web Vitals. Notes SSR/prerender trade-offs. Trigger for PWA, installability, offline, service worker, manifest, SEO, meta tags, sitemap, structured data, or Lighthouse work.
argument-hint: '[pwa | seo | both]'
---

# Angular PWA & SEO

Add or audit installability, offline support, and discoverability for this Angular 21
app (Bootstrap 5 + ng-bootstrap, i18n via Transloco). **Detect before you add** — don't
duplicate existing config.

## Detect first

- `apps/front/src/index.html` — existing `<meta>`, `theme-color`, manifest link.
- `apps/front/src/manifest.webmanifest` / `ngsw-config.json` — present? (currently no).
- `package.json` — `@angular/service-worker`, `@angular/ssr`, `@angular/platform-server`.
- `app.config.ts` — `provideServiceWorker`, any existing SEO/meta wiring.
- `app.routes.ts` — route `data`/resolvers where per-route meta can hook in.
- `project.json` (front) — `assets`/`serviceWorker`/`ngswConfigPath` build options.

State which pieces exist and only fill the gaps. Anything requiring TS (services,
providers, resolvers, install-prompt component) is a **spec you hand to
`frontend-developer`** — you own the static config (manifest, ngsw-config, index.html,
robots/sitemap) and the contracts.

---

## SEO

### Per-route Title & Meta (the core gap for SPAs)

Provide a small **SeoService** contract for the developer to implement, called from route
resolvers or in each routed component:

```ts
// CONTRACT (frontend-developer implements; designer owns the copy keys & required tags)
@Injectable({ providedIn: 'root' })
export class SeoService {
  private title = inject(Title);
  private meta = inject(Meta);
  private transloco = inject(TranslocoService);
  set(opts: { titleKey: string; descKey: string; image?: string; canonical?: string; robots?: string }): void {
    const t = this.transloco.translate(opts.titleKey);
    const d = this.transloco.translate(opts.descKey);
    this.title.setTitle(t);
    this.meta.updateTag({ name: 'description', content: d });
    this.meta.updateTag({ property: 'og:title', content: t });
    this.meta.updateTag({ property: 'og:description', content: d });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    if (opts.image) this.meta.updateTag({ property: 'og:image', content: opts.image });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    if (opts.canonical) this.meta.updateTag({ rel: 'canonical', href: opts.canonical } as any);
    this.meta.updateTag({ name: 'robots', content: opts.robots ?? 'index,follow' });
  }
}
```

Required per public route: unique title + description, OG (title/description/image/type),
Twitter card, canonical, `robots`. Titles/descriptions are **Transloco keys**.

### Static SEO files

- `robots.txt` (in `src/` and added to build `assets`) — allow crawl, point to sitemap.
- `sitemap.xml` for public routes (generate or hand-maintain for a small app).
- `index.html`: correct `<html lang>`, a default `<title>`/description, `<meta name="viewport">`
  (keep zoom enabled — never `user-scalable=no`).

### Structured data (JSON-LD)

Add a `<script type="application/ld+json">` block (Organization / WebSite / BreadcrumbList
/ entity-appropriate) — injected in `index.html` for stable data, or via the SeoService
for per-page data.

### Core Web Vitals

- **CLS**: explicit `width`/`height` on images & embeds; `font-display: swap`; reserve
  space for async content (skeletons), don't shift layout.
- **LCP**: `preconnect` to asset/font origins; `preload` the hero image/font;
  `fetchpriority="high"` on the LCP image.
- **INP**: `OnPush`, `track` in `@for`, virtualize long lists, keep handlers cheap.

### SSR / prerender (decide & flag)

Client-rendered meta/JSON-LD is invisible to many crawlers and social unfurlers. If the
page must rank or unfurl, recommend **`@angular/ssr`** (SSR or prerender) and hand the
setup (`provideServerRendering`, server entry, build target) to `frontend-developer`.
For a logged-in app behind auth, client-side meta is usually fine — say so.

---

## PWA

### 1. Install the Angular PWA pieces

`ng add @angular/pwa` scaffolds the manifest, icons, `ngsw-config.json`, the manifest
link + `theme-color` in `index.html`, and wires `provideServiceWorker`. If adding
manually, create the files below and register the worker.

### 2. `manifest.webmanifest`

```json
{
  "name": "<App Name>",
  "short_name": "<App>",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#fcfcf9",
  "theme_color": "#405123",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Link it and match the theme color in `index.html`:

```html
<link rel="manifest" href="manifest.webmanifest" /> <meta name="theme-color" content="#405123" />
```

Keep `theme_color`/`<meta theme-color>` in sync with the design tokens (and provide a
dark variant via `media`).

### 3. Service worker — `ngsw-config.json`

```json
{
  "$schema": "./node_modules/@angular/service-worker/config/schema.json",
  "index": "/index.html",
  "assetGroups": [
    { "name": "app", "installMode": "prefetch", "resources": { "files": ["/favicon.ico", "/index.html", "/manifest.webmanifest", "/*.css", "/*.js"] } },
    { "name": "assets", "installMode": "lazy", "updateMode": "prefetch", "resources": { "files": ["/assets/**", "/*.(svg|png|webp|woff2)"] } }
  ],
  "dataGroups": [{ "name": "api-freshness", "urls": ["/api/**"], "cacheConfig": { "strategy": "freshness", "maxSize": 100, "maxAge": "1h", "timeout": "5s" } }]
}
```

Register only in production (`provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:30000' })`) and set `serviceWorker`/`ngswConfigPath` in the front `project.json` build target.

> **Auth caution**: never cache authenticated API responses or token endpoints. Keep
> `/api/**` on `freshness` (or exclude sensitive routes) so the gateway's refresh/JWT
> flow is never served stale or to the wrong user.

### 4. Update & install UX (spec for the developer)

- **Update**: subscribe to `SwUpdate.versionUpdates`; on `VERSION_READY` show an
  ng-bootstrap toast ("New version available — Reload") that calls
  `activateUpdate().then(() => location.reload())`. Copy = Transloco keys.
- **Install**: capture `beforeinstallprompt`, stash the event, expose an "Install app"
  button that calls `prompt()`. Designer supplies the button/markup & copy keys.

### 5. Mobile/PWA polish

- `env(safe-area-inset-*)` padding on full-bleed/sticky bars for notched devices.
- `display: standalone`; verify offline app-shell loads; test "Add to Home Screen".

---

## Verify

- `npx nx build front` then serve the production build (service worker only runs on a
  built app, over http(s), not `ng serve`).
- Run Lighthouse (PWA + SEO + Performance) and address regressions.
- Confirm: installable, offline shell loads, per-route titles/meta correct in page source
  (or note the SSR caveat), `theme-color` matches, no console SW errors.

Update `apps/front/AGENTS.md` when you introduce the manifest, service worker, or SEO
service so the docs reflect reality.
