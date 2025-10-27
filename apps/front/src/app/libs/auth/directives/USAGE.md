# Directivas de Permisos Angular - Guía de Uso

## Directivas Disponibles

### 1. `*appHasPermission`

Muestra el elemento solo si el usuario tiene el permiso específico.

```html
<!-- Mostrar solo si el usuario es ADMIN -->
<button *appHasPermission="'ADMIN'" class="btn btn-danger">Eliminar Usuario</button>

<!-- Usando el enum Permission -->
<div *appHasPermission="Permission.ADMIN" class="admin-panel">Panel de Administración</div>
```

### 2. `*appHasAnyPermission`

Muestra el elemento si el usuario tiene cualquiera de los permisos especificados.

```html
<!-- Mostrar si el usuario tiene ADMIN o WRITE_SOME_ENTITY -->
<button *appHasAnyPermission="['ADMIN', 'WRITE_SOME_ENTITY']" class="btn btn-primary">Editar</button>

<!-- Con un solo permiso (equivalente a appHasPermission) -->
<div *appHasAnyPermission="Permission.WRITE_SOME_ENTITY" class="editor-panel">Panel de Edición</div>
```

### 3. `*appHasAllPermissions`

Muestra el elemento solo si el usuario tiene todos los permisos especificados.

```html
<!-- Mostrar solo si el usuario tiene READ_SOME_ENTITY Y WRITE_SOME_ENTITY -->
<div *appHasAllPermissions="['READ_SOME_ENTITY', 'WRITE_SOME_ENTITY']" class="advanced-panel">Panel Avanzado</div>

<!-- Con un solo permiso (equivalente a appHasPermission) -->
<span *appHasAllPermissions="Permission.ADMIN" class="admin-badge"> Admin </span>
```

## Uso en Componentes

### Importar las Directivas

```typescript
import { Component } from '@angular/core';
import { Permission } from '@dto';
import { HasPermissionDirective, HasAnyPermissionDirective, HasAllPermissionsDirective } from '@front/app/libs/auth/directives';

@Component({
  selector: 'app-example',
  standalone: true,
  imports: [HasPermissionDirective, HasAnyPermissionDirective, HasAllPermissionsDirective],
  template: `
    <div>
      <!-- Contenido para administradores -->
      <div *appHasPermission="Permission.ADMIN">
        <h2>Panel de Administración</h2>
        <button>Gestionar Usuarios</button>
      </div>

      <!-- Contenido para editores o administradores -->
      <div *appHasAnyPermission="[Permission.ADMIN, Permission.WRITE_SOME_ENTITY]">
        <h3>Herramientas de Edición</h3>
        <button>Crear Nuevo</button>
        <button>Editar Existente</button>
      </div>

      <!-- Contenido solo para usuarios con permisos completos -->
      <div *appHasAllPermissions="[Permission.READ_SOME_ENTITY, Permission.WRITE_SOME_ENTITY]">
        <h4>Funciones Avanzadas</h4>
        <button>Exportar Datos</button>
      </div>
    </div>
  `,
})
export class ExampleComponent {
  Permission = Permission; // Para usar en el template
}
```

## Ejemplos Prácticos

### Barra de Navegación Condicional

```html
<nav class="navbar">
  <div class="nav-item">
    <a routerLink="/home">Inicio</a>
  </div>

  <!-- Solo para usuarios autenticados -->
  <div class="nav-item" *appHasAnyPermission="['READ_SOME_ENTITY', 'WRITE_SOME_ENTITY', 'ADMIN']">
    <a routerLink="/dashboard">Dashboard</a>
  </div>

  <!-- Solo para administradores -->
  <div class="nav-item" *appHasPermission="'ADMIN'">
    <a routerLink="/admin">Administración</a>
  </div>

  <!-- Solo para editores -->
  <div class="nav-item" *appHasPermission="'WRITE_SOME_ENTITY'">
    <a routerLink="/editor">Editor</a>
  </div>
</nav>
```

### Botones de Acción Condicionales

```html
<div class="card">
  <h3>Usuario: {{ user.name }}</h3>

  <!-- Botón de editar para editores o admins -->
  <button *appHasAnyPermission="['ADMIN', 'WRITE_SOME_ENTITY']" class="btn btn-primary" (click)="editUser(user)">Editar</button>

  <!-- Botón de eliminar solo para admins -->
  <button *appHasPermission="'ADMIN'" class="btn btn-danger" (click)="deleteUser(user)">Eliminar</button>

  <!-- Botón de ver detalles para todos los usuarios autenticados -->
  <button *appHasAnyPermission="['ADMIN', 'WRITE_SOME_ENTITY', 'READ_SOME_ENTITY']" class="btn btn-info" (click)="viewDetails(user)">Ver Detalles</button>
</div>
```

### Formularios Condicionales

```html
<form [formGroup]="userForm">
  <div class="form-group">
    <label>Email</label>
    <input formControlName="email" class="form-control" />
  </div>

  <!-- Campo de permisos solo para administradores -->
  <div class="form-group" *appHasPermission="'ADMIN'">
    <label>Permisos</label>
    <select formControlName="permissions" multiple class="form-control">
      <option value="READ_SOME_ENTITY">Leer</option>
      <option value="WRITE_SOME_ENTITY">Escribir</option>
      <option value="ADMIN">Administrador</option>
    </select>
  </div>

  <!-- Botón de guardar con diferentes permisos -->
  <button *appHasAnyPermission="['ADMIN', 'WRITE_SOME_ENTITY']" type="submit" class="btn btn-success">Guardar</button>
</form>
```

## Características Técnicas

### Reactividad

Las directivas son reactivas y se actualizan automáticamente cuando:

- El usuario inicia sesión
- El usuario cierra sesión
- Los permisos del usuario cambian

### Performance

- Las directivas solo se evalúan cuando es necesario
- No hay suscripciones innecesarias a observables
- El DOM se actualiza eficientemente

### Type Safety

- Soporte completo para TypeScript
- IntelliSense en IDEs
- Validación en tiempo de compilación

## Notas Importantes

1. **Autenticación Requerida**: Las directivas asumen que el usuario está autenticado. Para contenido que requiere autenticación, combina con `*ngIf="authService.isLoggedIn$ | async"`.

2. **Permisos Vacíos**: Si se pasa un array vacío a `*appHasAnyPermission` o `*appHasAllPermissions`, el elemento no se mostrará.

3. **Valores Null/Undefined**: Si se pasa `null` o `undefined`, el elemento no se mostrará.

4. **Compatibilidad**: Las directivas son compatibles con Angular 17+ y componentes standalone.

## Troubleshooting

### El elemento no se muestra cuando debería

1. Verifica que el usuario esté autenticado
2. Confirma que el usuario tenga los permisos correctos
3. Revisa la consola para errores de JavaScript

### El elemento se muestra cuando no debería

1. Verifica que los permisos se estén pasando correctamente
2. Confirma que el servicio de autenticación esté funcionando
3. Revisa la lógica de permisos en el backend
