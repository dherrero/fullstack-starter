# Guía de migración — directivas → control flow nativo

Esta guía explica cómo migrar consumidores que usaban las antiguas
directivas estructurales `*appHasPermission`, `*appHasAnyPermission`,
`*appHasAllPermissions` y `*appIfLoggedIn` al control flow nativo de
Angular (`@if`).

## Tabla 1-a-1

| Antes (directiva estructural)                                                                    | Después (`@if` nativo)                                                                                     |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `<el *appHasPermission="Permission.ADMIN">…</el>`                                                | `@if (auth.hasPermission(Permission.ADMIN)) { <el>…</el> }`                                                |
| `<el *appHasAnyPermission="[Permission.ADMIN, Permission.WRITE_SOME_ENTITY]">…</el>`             | `@if (auth.hasAnyPermission([Permission.ADMIN, Permission.WRITE_SOME_ENTITY])) { <el>…</el> }`             |
| `<el *appHasAllPermissions="[Permission.READ_SOME_ENTITY, Permission.WRITE_SOME_ENTITY]">…</el>` | `@if (auth.hasAllPermissions([Permission.READ_SOME_ENTITY, Permission.WRITE_SOME_ENTITY])) { <el>…</el> }` |
| `<el *appIfLoggedIn="true">…</el>`                                                               | `@if (auth.isLoggedIn()) { <el>…</el> }`                                                                   |
| `<el *appIfLoggedIn="false">…</el>`                                                              | `@if (!auth.isLoggedIn()) { <el>…</el> }`                                                                  |
| Combinado: positivo + negativo                                                                   | `@if (auth.isLoggedIn()) { … } @else { … }`                                                                |

## Componente standalone

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Permission } from '@dto';
import { AuthService } from '@front/app/libs/auth/services/auth.service';

@Component({
  selector: 'app-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './example.component.html',
})
export class ExampleComponent {
  readonly auth = inject(AuthService);
  readonly Permission = Permission; // exponer para que el template lo lea
}
```

Ya no hace falta importar ninguna directiva — `@if` está en el lenguaje
de plantillas — y `CommonModule` deja de ser necesario si era lo único
que usabas para `*ngIf` / `*ngFor`.

## Ejemplos prácticos migrados

### Navbar condicional

```html
<nav class="navbar">
  <a routerLink="/home">Inicio</a>

  @if (auth.hasAnyPermission([Permission.READ_SOME_ENTITY, Permission.WRITE_SOME_ENTITY, Permission.ADMIN])) {
  <a routerLink="/dashboard">Dashboard</a>
  } @if (auth.hasPermission(Permission.ADMIN)) {
  <a routerLink="/admin">Administración</a>
  } @if (auth.hasPermission(Permission.WRITE_SOME_ENTITY)) {
  <a routerLink="/editor">Editor</a>
  }
</nav>
```

### Botones de acción por permiso

```html
<div class="card">
  <h3>Usuario: {{ user.name }}</h3>

  @if (auth.hasAnyPermission([Permission.ADMIN, Permission.WRITE_SOME_ENTITY])) {
  <button class="btn btn-primary" (click)="editUser(user)">Editar</button>
  } @if (auth.hasPermission(Permission.ADMIN)) {
  <button class="btn btn-danger" (click)="deleteUser(user)">Eliminar</button>
  }
</div>
```

### Cabecera con bloque logueado / no logueado

```html
@if (auth.isLoggedIn()) {
<user-menu />
} @else {
<button (click)="login()">Iniciar sesión</button>
}
```

## Por qué se eliminaron las directivas

El patrón `TemplateRef + ViewContainerRef + @Input()` sufría un bug
recurrente: el azúcar sintáctico del selector estructural

```html
<el *appHasPermission="X"></el>
```

se desugarea internamente en

```html
<ng-template [appHasPermission]="X"></ng-template>
```

es decir, Angular busca un `@Input()` que **coincida exactamente** con
el nombre del selector. Si el campo interno se llama `hasPermission`
(sin prefijo `app`), el valor nunca llega y la directiva ve `undefined`,
con lo que el bloque desaparece silenciosamente. El alias
`@Input('appHasPermission')` es la mitigación correcta, pero el control
flow nativo cierra la categoría entera.

Además, `@if` es:

- **Type-safe**: errores del expression en tiempo de build.
- **Más eficiente**: cero overhead de directiva, sin clases nuevas.
- **Más legible**: la condición vive junto al bloque, no en un atributo.
- **Nativo**: no requiere `import`, no rompe si el componente olvidó
  declarar la directiva en `imports: [...]`.

## Reactividad

`auth.isLoggedIn()`, `auth.hasPermission(...)`, etc. leen los signals
internos del `AuthService` (`token`, `tokenDecoded`). Angular re-evalúa
el `@if` automáticamente cuando el usuario inicia/cierra sesión o el
gateway rota el access token, sin código adicional.
