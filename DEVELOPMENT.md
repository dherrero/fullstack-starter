# 🛠️ Guía de Desarrollo

Esta guía te ayudará a trabajar eficientemente con el Nx Fullstack Starter y entender las mejores prácticas para el desarrollo.

## 📋 Tabla de Contenidos

- [Configuración del Entorno](#-configuración-del-entorno)
- [Flujo de Desarrollo](#-flujo-de-desarrollo)
- [Arquitectura del Proyecto](#-arquitectura-del-proyecto)
- [Convenciones de Código](#-convenciones-de-código)
- [Testing](#-testing)
- [Debugging](#-debugging)
- [Troubleshooting](#-troubleshooting)

## 🔧 Configuración del Entorno

### Prerrequisitos

```bash
# Verificar versiones
node --version  # >= 22.12.0
npm --version   # >= 10.9.0
docker --version
docker-compose --version
```

### Configuración Inicial

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/nx-fullstack-starter.git
cd nx-fullstack-starter

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus configuraciones

# 4. Verificar que todo funciona
npm run dev
```

### Configuración del IDE

#### VS Code (Recomendado)

Instala las siguientes extensiones:

```json
{
  "recommendations": ["angular.ng-template", "ms-vscode.vscode-typescript-next", "bradlc.vscode-tailwindcss", "esbenp.prettier-vscode", "ms-vscode.vscode-eslint", "nrwl.angular-console"]
}
```

#### Configuración de Prettier

El proyecto incluye configuración de Prettier. Asegúrate de que tu IDE esté configurado para formatear al guardar.

## 🚀 Flujo de Desarrollo

### Desarrollo Diario

#### Opción 1: Desarrollo Completo (Recomendado)

```bash
# Un solo comando para todo
npm run dev
```

#### Opción 2: Desarrollo por Pasos

```bash
# Terminal 1: Base de datos
npm run dev:db

# Terminal 2: Backend (espera a que la DB esté lista)
npm run dev:back

# Terminal 3: Frontend (espera a que el backend esté listo)
npm run dev:front
```

### Workflow de Git

```bash
# 1. Crear feature branch
git checkout -b feature/nueva-funcionalidad

# 2. Desarrollo con commits frecuentes
git add .
git commit -m "feat: añadir nueva funcionalidad"

# 3. Push y crear PR
git push origin feature/nueva-funcionalidad
```

### Convenciones de Commits

```
feat: nueva funcionalidad
fix: corrección de bug
docs: actualización de documentación
style: cambios de formato
refactor: refactorización de código
test: añadir o modificar tests
chore: tareas de mantenimiento
```

## 🏗️ Arquitectura del Proyecto

### Frontend (Angular)

#### Estructura de Componentes

```
apps/front/src/app/
├── components/           # Componentes reutilizables
│   ├── user-form/       # Formulario de usuario
│   ├── confirm/         # Modal de confirmación
│   └── language-switcher/ # Selector de idioma
├── pages/               # Páginas principales
│   ├── home/           # Página de bienvenida
│   └── login/          # Página de login
├── libs/               # Módulos de funcionalidad
│   └── auth/           # Módulo de autenticación
└── services/           # Servicios de negocio
    ├── user.service.ts
    └── language.service.ts
```

#### Patrones de Angular

**Standalone Components**

```typescript
@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-form.component.html',
})
export class UserFormComponent {
  // Componente independiente
}
```

**Services con Inyección de Dependencias**

```typescript
@Injectable({
  providedIn: 'root',
})
export class UserService {
  constructor(private http: HttpClient) {}

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>('/api/users');
  }
}
```

**Guards para Protección de Rutas**

```typescript
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(): boolean {
    return this.authService.isAuthenticated();
  }
}
```

### Backend (Express)

#### Estructura de Capas

```
apps/back/src/
├── controllers/         # Controladores de rutas
│   ├── auth.controller.ts
│   └── user-crud.controller.ts
├── services/           # Lógica de negocio
│   ├── auth.service.ts
│   └── user-crud.service.ts
├── models/             # Modelos de Sequelize
│   └── user.model.ts
├── routes/             # Definición de rutas
│   ├── auth.routes.ts
│   └── user-crud.routes.ts
└── adapters/           # Adaptadores externos
    ├── db/
    └── http/
```

#### Patrón Controller-Service-Repository

**Controller**

```typescript
export class UserController {
  constructor(private userService: UserService) {}

  async getUsers(req: Request, res: Response) {
    try {
      const users = await this.userService.getUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}
```

**Service**

```typescript
export class UserService {
  constructor(private userModel: UserModel) {}

  async getUsers(): Promise<User[]> {
    return await this.userModel.findAll();
  }
}
```

**Model (Sequelize)**

```typescript
export const User = sequelize.define('User', {
  email: DataTypes.STRING,
  name: DataTypes.STRING,
  // ... más campos
});
```

## 📝 Convenciones de Código

### Naming Conventions

- **Archivos**: kebab-case (`user-service.ts`)
- **Clases**: PascalCase (`UserService`)
- **Variables**: camelCase (`userName`)
- **Constantes**: UPPER_SNAKE_CASE (`API_BASE_URL`)
- **Interfaces**: PascalCase con prefijo I (`IUser`)

### Estructura de Archivos

#### Frontend

```typescript
// user-form.component.ts
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
// user.service.ts
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

### Comandos de Testing

```bash
# Tests unitarios
npm run test:front
npm run test:back

# Tests e2e
npm run e2e:front

# Coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## 🐛 Debugging

### Frontend

#### Angular DevTools

1. Instala la extensión Angular DevTools
2. Abre las DevTools del navegador
3. Ve a la pestaña "Angular"

#### Console Logging

```typescript
// Usar diferentes niveles
console.log('Info:', data);
console.warn('Warning:', warning);
console.error('Error:', error);

// Debug específico
console.log('User data:', JSON.stringify(user, null, 2));
```

#### Breakpoints

```typescript
// En el código
debugger; // Pausa la ejecución

// En el navegador
// Usa las DevTools para poner breakpoints
```

### Backend

#### Debug Mode

```bash
# Iniciar con debug
npm run start:back:debug

# Conectarse con debugger
# En VS Code: F5 o "Attach to Node Process"
```

#### Logging

```typescript
// Usar diferentes niveles
console.log('Info:', data);
console.warn('Warning:', warning);
console.error('Error:', error);

// Logging estructurado
console.log(
  JSON.stringify(
    {
      level: 'info',
      message: 'User created',
      userId: user.id,
      timestamp: new Date().toISOString(),
    },
    null,
    2
  )
);
```

#### Database Debugging

```typescript
// Habilitar logging de Sequelize
const sequelize = new Sequelize({
  // ... configuración
  logging: console.log, // Ver queries SQL
});
```

## 🔧 Troubleshooting

### Problemas Comunes

#### Error de conexión a la base de datos

```bash
# Verificar que Docker esté corriendo
docker ps

# Verificar logs de la base de datos
docker-compose -f docker-compose.db.yml logs

# Reiniciar la base de datos
npm run dev:db:down
npm run dev:db
```

#### Error de puerto en uso

```bash
# Verificar qué proceso usa el puerto
lsof -i :3200
lsof -i :4200

# Matar proceso específico
kill <PID>

# Matar todos los procesos de Node
pkill -f node
```

#### Error de dependencias

```bash
# Limpiar node_modules
rm -rf node_modules package-lock.json
npm install

# Limpiar cache de Nx
npm run clean
```

#### Error de TypeScript

```bash
# Verificar configuración
npx tsc --noEmit

# Limpiar cache de TypeScript
rm -rf dist tmp
npm run build
```

### Performance Issues

#### Frontend

- Usar OnPush change detection
- Implementar lazy loading
- Optimizar imágenes
- Usar trackBy en \*ngFor

#### Backend

- Optimizar queries de base de datos
- Implementar caching
- Usar connection pooling
- Monitorear memoria

### Memory Leaks

#### Frontend

```typescript
// Siempre unsubscribe
ngOnDestroy(): void {
  this.destroy$.next();
  this.destroy$.complete();
}

// Usar takeUntil
this.dataService.getData()
  .pipe(takeUntil(this.destroy$))
  .subscribe(data => {
    // manejar data
  });
```

#### Backend

```typescript
// Cerrar conexiones
process.on('SIGINT', async () => {
  await sequelize.close();
  process.exit(0);
});
```

## 📚 Recursos Adicionales

### Documentación Oficial

- [Angular Docs](https://angular.io/docs)
- [Express.js Docs](https://expressjs.com/)
- [Nx Docs](https://nx.dev/)
- [Sequelize Docs](https://sequelize.org/)

### Herramientas Útiles

- [Angular DevTools](https://angular.io/guide/devtools)
- [Postman](https://www.postman.com/) - Para testing de API
- [pgAdmin](https://www.pgadmin.org/) - Para gestión de PostgreSQL
- [Docker Desktop](https://www.docker.com/products/docker-desktop)

### Comunidad

- [Angular Discord](https://discord.gg/angular)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/angular)
- [GitHub Issues](https://github.com/tu-usuario/nx-fullstack-starter/issues)

---

**¡Disfruta desarrollando! 🚀**
