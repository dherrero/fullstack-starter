---
name: angular-developer
description: Angular Developer Guidelines. Generates Angular code and provides architectural guidance. Trigger when creating projects, components, or services, or for best practices on reactivity (signals, linkedSignal, resource), forms, dependency injection, routing, SSR, accessibility (ARIA), animations, styling (component styles, Tailwind CSS), testing, or CLI tooling.
argument-hint: '[topic or task]'
---

# Angular Developer Guidelines

> Source: https://github.com/angular/skills/tree/main/angular-developer (Copyright 2026 Google LLC, MIT License)

1. Always analyze the project's Angular version before providing guidance, as best practices and available features can vary significantly between versions.

2. When generating code, follow Angular's style guide and best practices for maintainability and performance. Use the Angular CLI for scaffolding components, services, directives, pipes, and routes to ensure consistency.

3. Once you finish generating code, run `ng build` to ensure there are no build errors. If there are errors, fix them before proceeding.

## Components

When working with Angular components, consult the following references based on the task:

- **Fundamentals** (anatomy, metadata, control flow `@if`/`@for`/`@switch`): Read [components.md](references/components.md)
- **Signal inputs** (`input()`, transforms, `model()`): Read [inputs.md](references/inputs.md)
- **Outputs** (`output()`): Read [outputs.md](references/outputs.md)
- **Host elements** (use `host` property in `@Component`, not `@HostBinding`/`@HostListener`): Read [host-elements.md](references/host-elements.md)

## Reactivity and Data Management

Use **Angular Signals** for all state management. Consult:

- **Signals Overview** (`signal`, `computed`, `untracked`, reactive contexts): Read [signals-overview.md](references/signals-overview.md)
- **Dependent State (`linkedSignal`)** — writable state derived from a source signal: Read [linked-signal.md](references/linked-signal.md)
- **Async Reactivity (`resource`)** — fetch async data into signal state: Read [resource.md](references/resource.md)
- **Side Effects (`effect`, `afterRenderEffect`)** — when to use and when NOT to: Read [effects.md](references/effects.md)

## Forms

| Scenario                         | Strategy                                    |
| -------------------------------- | ------------------------------------------- |
| Angular v21+, new form           | **Signal Forms** (preferred)                |
| Existing app with reactive forms | Reactive Forms (`FormGroup`, `FormControl`) |
| Simple, low-interactivity        | Template-driven forms                       |

- **Signal Forms** (v21+): Read [signal-forms.md](references/signal-forms.md) — **CRITICAL**: contains gotchas, forbidden patterns, and build-error fixes
- **Reactive Forms**: Read [reactive-forms.md](references/reactive-forms.md)
- **Template-driven Forms**: Read [template-driven-forms.md](references/template-driven-forms.md)

## Dependency Injection

Always use `inject()` function — never constructor injection. Consult:

- **Fundamentals** (services, `inject()` function): Read [di-fundamentals.md](references/di-fundamentals.md)
- **Creating Services** (`providedIn: 'root'`, injection into components): Read [creating-services.md](references/creating-services.md)
- **Defining Providers** (`InjectionToken`, `useClass`, `useValue`, `useFactory`): Read [defining-providers.md](references/defining-providers.md)
- **Injection Context** (`runInInjectionContext`, `assertInInjectionContext`): Read [injection-context.md](references/injection-context.md)
- **Hierarchical Injectors** (`EnvironmentInjector` vs `ElementInjector`, resolution rules): Read [hierarchical-injectors.md](references/hierarchical-injectors.md)

## Routing

- Lazy-load all feature routes with `loadComponent()` or `loadChildren()`
- Implement guards with `CanActivateFn` / `CanMatchFn` (functional style)
- Use `ResolveFn` to pre-fetch data before route activation

Consult:

- **Define Routes** (URL paths, wildcards, redirects): Read [define-routes.md](references/define-routes.md)
- **Loading Strategies** (eager vs lazy): Read [loading-strategies.md](references/loading-strategies.md)
- **Router Outlets** (nested/named outlets): Read [show-routes-with-outlets.md](references/show-routes-with-outlets.md)
- **Navigation** (`RouterLink`, `Router`): Read [navigate-to-routes.md](references/navigate-to-routes.md)
- **Route Guards** (`CanActivate`, `CanMatch`): Read [route-guards.md](references/route-guards.md)
- **Data Resolvers** (`ResolveFn`): Read [data-resolvers.md](references/data-resolvers.md)
- **Rendering Strategies** (CSR, SSG, SSR): Read [rendering-strategies.md](references/rendering-strategies.md)
- **Route Animations** (View Transitions API): Read [route-animations.md](references/route-animations.md)

## Accessibility (ARIA)

For custom interactive components (Accordion, Listbox, Combobox, Menu, Tabs, Toolbar, Tree, Grid):

- Use Angular CDK ARIA primitives (headless, accessible)
- Style via ARIA attribute selectors (`[aria-selected="true"]`) instead of class-based state

Read [angular-aria.md](references/angular-aria.md)

## Styling and Animations

- Prefer **native CSS** animations over Angular Animations DSL
- Apply Tailwind CSS via `@import "tailwindcss"` in `styles.css`
- Component styles use `:host` selector; prefer `ViewEncapsulation.None` for design-system components

Consult:

- **Tailwind CSS**: Read [tailwind-css.md](references/tailwind-css.md)
- **Angular Animations** (native CSS vs DSL): Read [angular-animations.md](references/angular-animations.md)
- **Component Styling** (encapsulation, `:host`): Read [component-styling.md](references/component-styling.md)

## Testing

| Layer                 | Tool                            |
| --------------------- | ------------------------------- |
| Unit tests            | **Vitest** + `TestBed`          |
| Component interaction | Angular CDK Component Harnesses |
| Router navigation     | `RouterTestingHarness`          |
| End-to-end            | **Cypress**                     |

Consult:

- **Fundamentals** (zoneless testing, `fixture.whenStable()`, Act-Wait-Assert): Read [testing-fundamentals.md](references/testing-fundamentals.md)
- **Component Harnesses**: Read [component-harnesses.md](references/component-harnesses.md)
- **Router Testing**: Read [router-testing.md](references/router-testing.md)
- **End-to-End (Cypress)**: Read [e2e-testing.md](references/e2e-testing.md)

## Angular CLI

Key commands for this Nx monorepo (prefer `nx` wrappers over bare `ng`):

```bash
ng generate component <name> --standalone    # Standalone component
ng generate service <name>                   # Injectable service
ng generate guard <name> --functional        # Functional guard
ng generate pipe <name> --standalone         # Standalone pipe
ng build --configuration=production          # Production build
ng test                                      # Run unit tests
```

For CLI tooling reference: Read [cli.md](references/cli.md)
