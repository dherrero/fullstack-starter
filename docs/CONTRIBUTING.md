# 🤝 Guía de Contribución

¡Gracias por tu interés en contribuir al Nx Fullstack Starter! Este documento te guiará a través del proceso de contribución.

## 📋 Tabla de Contenidos

- [Código de Conducta](#-código-de-conducta)
- [¿Cómo Contribuir?](#-cómo-contribuir)
- [Configuración del Entorno](#-configuración-del-entorno)
- [Proceso de Desarrollo](#-proceso-de-desarrollo)
- [Estándares de Código](#-estándares-de-código)
- [Testing](#-testing)
- [Pull Requests](#-pull-requests)
- [Reportar Issues](#-reportar-issues)

## 📜 Código de Conducta

Este proyecto sigue el [Código de Conducta de Contributor Covenant](https://www.contributor-covenant.org/). Al participar, se espera que mantengas este código.

## 🚀 ¿Cómo Contribuir?

### Tipos de Contribuciones

- 🐛 **Bug fixes**: Corrección de errores
- ✨ **Nuevas funcionalidades**: Añadir características
- 📚 **Documentación**: Mejorar la documentación
- 🧪 **Tests**: Añadir o mejorar tests
- 🎨 **UI/UX**: Mejoras en la interfaz
- ⚡ **Performance**: Optimizaciones
- 🔧 **Herramientas**: Mejoras en el tooling

### Antes de Empezar

1. **Revisa los issues existentes** para ver si alguien ya está trabajando en algo similar
2. **Crea un issue** para discutir cambios grandes antes de implementarlos
3. **Fork el repositorio** y clónalo localmente

## 🔧 Configuración del Entorno

### 1. Fork y Clone

```bash
# Fork el repositorio en GitHub, luego:
git clone https://github.com/tu-usuario/nx-fullstack-starter.git
cd nx-fullstack-starter

# Añadir upstream
git remote add upstream https://github.com/original-repo/nx-fullstack-starter.git
```

### 2. Instalación

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env

# Verificar que todo funciona
npm run dev
```

### 3. Configuración del IDE

Instala las extensiones recomendadas en VS Code:

```json
{
  "recommendations": ["angular.ng-template", "ms-vscode.vscode-typescript-next", "esbenp.prettier-vscode", "ms-vscode.vscode-eslint", "nrwl.angular-console"]
}
```

## 🛠️ Proceso de Desarrollo

### 1. Crear una Rama

```bash
# Actualizar main
git checkout main
git pull upstream main

# Crear feature branch
git checkout -b feature/nueva-funcionalidad
# o
git checkout -b fix/correccion-bug
# o
git checkout -b docs/mejora-documentacion
```

### 2. Desarrollo

```bash
# Desarrollo diario
npm run dev

# O desarrollo por pasos
npm run dev:db      # Terminal 1
npm run dev:back    # Terminal 2
npm run dev:front   # Terminal 3
```

### 3. Testing

```bash
# Tests unitarios
npm run test:front
npm run test:back

# Tests e2e
npm run e2e:front

# Linting
npm run lint

# Build
npm run build
```

### 4. Commit

```bash
# Añadir cambios
git add .

# Commit con mensaje descriptivo
git commit -m "feat: añadir nueva funcionalidad de usuarios"

# Push a tu fork
git push origin feature/nueva-funcionalidad
```

## 📝 Estándares de Código

### Convenciones de Commits

Usa [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: nueva funcionalidad
fix: corrección de bug
docs: actualización de documentación
style: cambios de formato
refactor: refactorización de código
test: añadir o modificar tests
chore: tareas de mantenimiento
```

### Naming Conventions

- **Archivos**: kebab-case (`user-service.ts`)
- **Clases**: PascalCase (`UserService`)
- **Variables**: camelCase (`userName`)
- **Constantes**: UPPER_SNAKE_CASE (`API_BASE_URL`)
- **Interfaces**: PascalCase con prefijo I (`IUser`)

### Estructura de Archivos

#### Frontend

```typescript
// Componente Angular
@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-form.component.html',
  styleUrls: ['./user-form.component.scss'],
})
export class UserFormComponent implements OnInit {
  // Propiedades públicas primero
  form: FormGroup;

  // Propiedades privadas después
  private destroy$ = new Subject<void>();

  // Constructor
  constructor(private fb: FormBuilder) {}

  // Lifecycle hooks
  ngOnInit(): void {}

  // Métodos públicos
  onSubmit(): void {}

  // Métodos privados
  private buildForm(): void {}
}
```

#### Backend

```typescript
// Servicio Express
export class UserService {
  // Propiedades privadas
  private readonly userModel: UserModel;

  // Constructor
  constructor(userModel: UserModel) {
    this.userModel = userModel;
  }

  // Métodos públicos
  async getUsers(): Promise<User[]> {
    return await this.userModel.findAll();
  }

  // Métodos privados
  private validateUser(user: User): boolean {
    // Validación
  }
}
```

### Comentarios y Documentación

```typescript
/**
 * Servicio para gestión de usuarios
 * Proporciona operaciones CRUD y validaciones
 */
export class UserService {
  /**
   * Obtiene todos los usuarios
   * @returns Promise con array de usuarios
   */
  async getUsers(): Promise<User[]> {
    return await this.userModel.findAll();
  }
}
```

## 🧪 Testing

### Tests Unitarios

#### Frontend (Jest + Angular Testing Utilities)

```typescript
describe('UserFormComponent', () => {
  let component: UserFormComponent;
  let fixture: ComponentFixture<UserFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(UserFormComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should validate email', () => {
    component.form.patchValue({ email: 'invalid-email' });
    expect(component.form.get('email')?.invalid).toBeTruthy();
  });
});
```

#### Backend (Jest)

```typescript
describe('UserService', () => {
  let userService: UserService;
  let mockUserModel: jest.Mocked<UserModel>;

  beforeEach(() => {
    mockUserModel = {
      findAll: jest.fn(),
      create: jest.fn(),
    } as any;

    userService = new UserService(mockUserModel);
  });

  it('should get all users', async () => {
    const mockUsers = [{ id: 1, name: 'Test User' }];
    mockUserModel.findAll.mockResolvedValue(mockUsers);

    const result = await userService.getUsers();

    expect(result).toEqual(mockUsers);
    expect(mockUserModel.findAll).toHaveBeenCalled();
  });
});
```

### Tests E2E

```typescript
describe('User Management', () => {
  it('should create a new user', () => {
    cy.visit('/users');
    cy.get('[data-cy="add-user-btn"]').click();
    cy.get('[data-cy="user-name"]').type('John Doe');
    cy.get('[data-cy="user-email"]').type('john@example.com');
    cy.get('[data-cy="save-user-btn"]').click();
    cy.get('[data-cy="user-list"]').should('contain', 'John Doe');
  });
});
```

### Cobertura de Tests

Aim for:

- **Frontend**: > 80% coverage
- **Backend**: > 80% coverage
- **E2E**: Cover critical user flows

## 📤 Pull Requests

### Antes de Crear un PR

1. **Asegúrate de que todos los tests pasen**

   ```bash
   npm run test
   npm run lint
   npm run build
   ```

2. **Actualiza la documentación** si es necesario

3. **Añade tests** para nuevas funcionalidades

4. **Actualiza el CHANGELOG** si es necesario

### Crear el PR

1. **Ve a GitHub** y crea un Pull Request desde tu fork
2. **Usa un título descriptivo** que explique el cambio
3. **Añade una descripción detallada**:
   - ¿Qué cambia?
   - ¿Por qué es necesario?
   - ¿Cómo se puede probar?
   - Screenshots si aplica

### Template de PR

```markdown
## 📝 Descripción

Breve descripción de los cambios realizados.

## 🔗 Tipo de Cambio

- [ ] Bug fix
- [ ] Nueva funcionalidad
- [ ] Breaking change
- [ ] Documentación
- [ ] Tests

## 🧪 Testing

- [ ] Tests unitarios añadidos/actualizados
- [ ] Tests e2e añadidos/actualizados
- [ ] Probado manualmente

## 📸 Screenshots

Si aplica, añade screenshots de los cambios.

## ✅ Checklist

- [ ] Código sigue las convenciones del proyecto
- [ ] Tests pasan
- [ ] Documentación actualizada
- [ ] No hay conflictos de merge
```

### Review Process

1. **Automated checks** deben pasar
2. **Code review** por al menos un maintainer
3. **Testing** en diferentes entornos
4. **Approval** antes de merge

## 🐛 Reportar Issues

### Antes de Crear un Issue

1. **Busca en issues existentes** para ver si ya está reportado
2. **Verifica que es un bug** y no un comportamiento esperado
3. **Recopila información** relevante

### Crear un Issue

Usa el template de issue y proporciona:

- **Descripción clara** del problema
- **Pasos para reproducir**
- **Comportamiento esperado vs actual**
- **Screenshots** si aplica
- **Información del entorno**:
  - OS
  - Node.js version
  - Browser (si aplica)

### Template de Issue

```markdown
## 🐛 Bug Report

### Descripción

Descripción clara y concisa del bug.

### Pasos para Reproducir

1. Ve a '...'
2. Haz click en '...'
3. Scroll hasta '...'
4. Ve el error

### Comportamiento Esperado

Descripción de lo que esperabas que pasara.

### Screenshots

Si aplica, añade screenshots.

### Información del Entorno

- OS: [e.g. macOS, Windows, Linux]
- Node.js: [e.g. 20.12.2]
- Browser: [e.g. Chrome, Safari]
- Versión: [e.g. 1.0.0]

### Información Adicional

Cualquier otra información relevante.
```

## 🎯 Roadmap

### Funcionalidades Pendientes

- [ ] Sistema de notificaciones
- [ ] Tests e2e completos
- [ ] Documentación de API
- [ ] CI/CD pipeline
- [ ] Logging avanzado
- [ ] Métricas y monitoreo

### Mejoras de Performance

- [ ] Lazy loading de módulos
- [ ] Optimización de queries
- [ ] Caching strategies
- [ ] Bundle optimization

## 📚 Recursos

### Documentación

- [Angular Docs](https://angular.io/docs)
- [Express.js Docs](https://expressjs.com/)
- [Nx Docs](https://nx.dev/)
- [Sequelize Docs](https://sequelize.org/)

### Herramientas

- [Prettier](https://prettier.io/)
- [ESLint](https://eslint.org/)
- [Jest](https://jestjs.io/)
- [Cypress](https://www.cypress.io/)

### Comunidad

- [Angular Discord](https://discord.gg/angular)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/angular)
- [GitHub Discussions](https://github.com/tu-usuario/nx-fullstack-starter/discussions)

## 🆘 ¿Necesitas Ayuda?

- **GitHub Issues**: Para bugs y feature requests
- **GitHub Discussions**: Para preguntas y discusiones
- **Discord**: Para chat en tiempo real
- **Email**: Para contactos privados

---

**¡Gracias por contribuir! 🚀**

Tu contribución hace que este proyecto sea mejor para toda la comunidad.
