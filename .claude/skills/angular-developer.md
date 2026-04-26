---
name: angular-developer
description: Angular Developer Guidelines. Generates Angular code and provides architectural guidance. Trigger when creating projects, components, or services, or for best practices on reactivity (signals, linkedSignal, resource), forms, dependency injection, routing, SSR, accessibility (ARIA), animations, styling (component styles, Tailwind CSS), testing, or CLI tooling.
argument-hint: '[topic or task]'
---

# Angular Developer Guidelines

> Source: https://github.com/angular/skills/tree/main/angular-developer (Copyright 2026 Google LLC, MIT License)

1. Always analyze the project's Angular version before providing guidance, as best practices and available features can vary significantly between versions. If creating a new project with Angular CLI, do not specify a version unless prompted by the user.

2. When generating code, follow Angular's style guide and best practices for maintainability and performance. Use the Angular CLI for scaffolding components, services, directives, pipes, and routes to ensure consistency.

3. Once you finish generating code, run `ng build` to ensure there are no build errors. If there are errors, analyze the error messages and fix them before proceeding. Do not skip this step.

## Creating New Projects

Default rules when no guidelines are provided:

1. Use the latest stable version of Angular unless the user specifies otherwise.
2. Use **Signal Forms** for form management in new projects (available in Angular v21+).

**`ng new` execution rules — follow in order:**

1. If the user requests a specific version: `npx @angular/cli@<version> new <project-name>`
2. If no version requested, check `ng version` — if installed: `ng new <project-name>`
3. If `ng version` fails (not installed): `npx @angular/cli@latest new <project-name>`

## Components

- **Fundamentals** (anatomy, metadata, control flow `@if`/`@for`/`@switch`): https://angular.dev/guide/components
- **Signal inputs** (`input()`, transforms, `model()`): use signal-based inputs by default
- **Outputs** (`output()`): use signal-based outputs
- **Host elements**: use `host` property in `@Component` metadata, not `@HostBinding`/`@HostListener`

## Reactivity and Data Management

Use **Angular Signals** for all state management:

- `signal()` + `computed()` — core reactive primitives
- `linkedSignal()` — writable state derived from a source signal
- `resource()` — async data fetching directly into signal state
- `effect()` — side effects only (logging, 3rd-party DOM libs); **never** use effects to propagate state
- `afterRenderEffect()` — DOM manipulation after render

## Forms

| Scenario                         | Strategy                                    |
| -------------------------------- | ------------------------------------------- |
| Angular v21+, new form           | **Signal Forms** (preferred)                |
| Existing app with reactive forms | Reactive Forms (`FormGroup`, `FormControl`) |
| Simple, low-interactivity        | Template-driven forms                       |

## Dependency Injection

- Always use `inject()` function — never constructor injection
- Services: `providedIn: 'root'` by default
- Use `InjectionToken` for non-class dependencies
- Prefer `runInInjectionContext` over workarounds when outside injection context

## Routing

- Lazy-load all feature routes with `loadComponent()` or `loadChildren()`
- Use `ResolveFn` to pre-fetch data before route activation
- Implement guards with `CanActivateFn` / `CanMatchFn` (functional style)
- For SSR: configure rendering strategies (CSR / SSG / SSR with hydration) per route

## Accessibility (ARIA)

For custom interactive components (Accordion, Listbox, Combobox, Menu, Tabs, Toolbar, Tree, Grid):

- Use Angular CDK ARIA primitives (headless, accessible)
- Style via ARIA attribute selectors (`[aria-selected="true"]`) instead of class-based state

## Styling and Animations

- Prefer **native CSS** animations over Angular Animations DSL
- Use Angular Animations DSL only for dynamic, data-driven animations
- Apply Tailwind CSS via `@import "tailwindcss"` in `styles.css` (Angular CLI handles PostCSS)
- Component styles use `:host` selector; prefer `ViewEncapsulation.None` for design-system components

## Testing

| Layer                 | Tool                            |
| --------------------- | ------------------------------- |
| Unit tests            | **Vitest** + `TestBed`          |
| Component interaction | Angular CDK Component Harnesses |
| Router navigation     | `RouterTestingHarness`          |
| End-to-end            | **Cypress**                     |

Best practices:

- Test behavior, not implementation details
- Use `fakeAsync`/`tick` for async operations in unit tests
- Prefer harnesses over direct DOM querying for Angular Material components

## Angular CLI

Key commands:

```bash
ng generate component <name> --standalone    # Standalone component
ng generate service <name>                   # Injectable service
ng generate guard <name> --functional        # Functional guard
ng generate pipe <name> --standalone         # Standalone pipe
ng build --configuration=production          # Production build
ng test                                      # Run unit tests
```
