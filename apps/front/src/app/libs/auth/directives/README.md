# Permission rendering — control flow nativo de Angular 21

> Las cuatro directivas estructurales que vivían aquí
> (`*appHasPermission`, `*appHasAnyPermission`, `*appHasAllPermissions`,
> `*appIfLoggedIn`) **se han eliminado**. El barrel `index.ts` ya no
> existe. Migra a `@if` siguiendo la tabla de `USAGE.md`.

Angular 17+ trae `@if`, `@for` y `@switch` integrados en el lenguaje de
plantillas. Son type-safe, no requieren `import`, no necesitan
`TemplateRef + ViewContainerRef` y eliminan de raíz la familia de bugs
por nombre-de-input ≠ selector estructural (caso real: un `@Input()`
llamado `hasPermission` no recibía el valor que el azúcar
`*appHasPermission="X"` desugaring intentaba pasar via
`[appHasPermission]="X"`).

Consumí los helpers que ya expone `AuthService`:

```html
@if (auth.hasPermission(Permission.ADMIN)) {
<admin-panel />
} @if (auth.hasAnyPermission([Permission.WRITE_SOME_ENTITY, Permission.ADMIN])) {
<button>Editar</button>
} @if (auth.hasAllPermissions([Permission.READ_SOME_ENTITY, Permission.WRITE_SOME_ENTITY])) {
<fancy-editor />
} @if (auth.isLoggedIn()) {
<user-menu />
} @else {
<login-button />
}
```

`auth.isLoggedIn()`, `auth.hasPermission()`, `auth.hasAnyPermission()` y
`auth.hasAllPermissions()` son métodos públicos de `AuthService`. En tu
componente standalone:

```ts
@Component({
  selector: 'app-foo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
  templateUrl: './foo.component.html',
})
export class FooComponent {
  readonly auth = inject(AuthService);
  readonly Permission = Permission; // exponer enum para usar en template
}
```

Ver `USAGE.md` para la tabla antes → después de cada directiva.
