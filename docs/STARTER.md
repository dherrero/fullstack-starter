# 🚀 Nx Fullstack Starter - Guía de Uso

> **Un starter completo y profesional para monorepos TypeScript con Angular 20 + Express.js + PostgreSQL**

## 🎯 ¿Qué es este Starter?

Este es un proyecto starter completo que te permite comenzar rápidamente con un monorepo TypeScript usando:

- **Frontend**: Angular 20 con standalone components
- **Backend**: Node.js + Express.js + TypeScript
- **Base de datos**: PostgreSQL con Sequelize ORM
- **Monorepo**: Nx workspace para gestión eficiente
- **Containerización**: Docker + Docker Compose
- **UI**: Bootstrap 5 + NgBootstrap
- **i18n**: Transloco (Español/Valenciano)

## 🚀 Inicio Rápido

### 1. Clonar y Configurar

```bash
# Clonar el repositorio
git clone https://github.com/dherrero/nx-fullstack-starter.git mi-proyecto
cd mi-proyecto

# Borra el git de este repositorio
rm -fr .git

# Inicia git con tu repositorio

git init

git remote add origin git@tu_repositorio.git

git add .

git commit -m "first commit"

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus configuraciones
```

### 2. Iniciar Desarrollo

```bash
# Desarrollo completo (recomendado)
npm run dev

# O desarrollo por pasos
npm run dev:db      # Terminal 1 - Base de datos
npm run dev:back    # Terminal 2 - Backend
npm run dev:front   # Terminal 3 - Frontend
```

### 3. Acceder a la Aplicación

- **Frontend**: http://localhost:4200
- **Backend API**: http://localhost:3200
- **Base de datos**: localhost:5432

### 4. Usuario por Defecto

```
Email: admin@example.com
Contraseña: admin123
```

## 🏗️ Personalización

### 1. Cambiar el Branding

#### Textos y Traducciones

```bash
# Editar archivos de traducción
apps/front/src/assets/i18n/en.json
apps/front/src/assets/i18n/es.json
apps/front/src/assets/i18n/ca.json
```

#### Colores y Estilos

```scss
// Editar archivo principal de estilos
apps/front/src/styles.scss
```

#### Logo y Favicon

```bash
# Reemplazar archivos
apps/front/src/favicon.ico
apps/front/src/assets/logo.png
```

### 2. Añadir Nuevas Funcionalidades

#### Frontend - Nuevo Componente

```bash
# Generar componente
ng generate component components/mi-componente

# O usando Nx
nx generate @angular/cli:component components/mi-componente --project=front
```

#### Backend - Nueva Ruta

```typescript
// Crear controlador
export class MiController {
  async getData(req: Request, res: Response) {
    // Lógica aquí
  }
}

// Añadir ruta
app.use('/api/mi-ruta', miController);
```

#### Base de Datos - Nueva Tabla

```typescript
// Crear modelo
export const MiModel = sequelize.define('MiModel', {
  campo1: DataTypes.STRING,
  campo2: DataTypes.INTEGER,
  // ... más campos
});

// Crear migración
npx sequelize-cli migration:generate --name crear-mi-tabla
```

### 3. Configurar Variables de Entorno

#### Backend (.env)

```env
# Database
POSTGRESDB_HOST=localhost
POSTGRESDB_PORT=5432
POSTGRESDB_DATABASE=mi_base_datos
POSTGRESDB_USER=mi_usuario
POSTGRESDB_PASSWORD=mi_contraseña

# JWT
JWT_SECRET=mi_secret_super_seguro
JWT_REFRESH_SECRET=mi_refresh_secret_super_seguro
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=3200
NODE_ENV=development
CORS_ORIGIN=http://localhost:4200
```

#### Frontend (environment.ts)

```typescript
export const environment = {
  production: false,
  api: 'http://localhost:3200/api/',
  appName: 'Mi Aplicación',
};
```

## 🧪 Testing

### Tests Unitarios

```bash
# Frontend
npm run test:front

# Backend
npm run test:back

# Ambos
npm run test
```

### Tests E2E

```bash
npm run e2e:front
```

### Coverage

```bash
npm run test:coverage
```

## 🐳 Docker

### Desarrollo

```bash
# Solo base de datos
docker-compose -f docker-compose.db.yml up

# Aplicación completa
docker-compose up
```

### Producción

```bash
# Construir y desplegar
npm run build
docker-compose -f docker-compose.prod.yml up -d
```

## 📚 Documentación

- [README.md](./README.md) - Documentación principal
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Guía de desarrollo
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Guía de contribución
- [CHANGELOG.md](./CHANGELOG.md) - Historial de cambios

## 🛠️ Comandos Útiles

### Desarrollo

```bash
npm run dev              # Desarrollo completo
npm run start:front      # Solo frontend
npm run start:back       # Solo backend
npm run dev:db           # Solo base de datos
```

### Construcción

```bash
npm run build:front      # Construir frontend
npm run build:back       # Construir backend
npm run build            # Construir ambos
```

### Testing

```bash
npm run test:front       # Tests frontend
npm run test:back        # Tests backend
npm run test             # Todos los tests
npm run e2e:front        # Tests e2e
```

### Utilidades

```bash
npm run lint             # Linting
npm run clean            # Limpiar archivos
npm run format           # Formatear código
```

## 🔧 Configuración del IDE

### VS Code

1. Abre el archivo `nx-fullstack-starter.code-workspace`
2. Instala las extensiones recomendadas
3. Configura el workspace

### Otras IDEs

- **WebStorm**: Importa como proyecto Nx
- **Sublime Text**: Usa el proyecto existente
- **Vim/Neovim**: Configura LSP para TypeScript

## 🚀 Despliegue

### Producción Local

```bash
npm run build
npm run start:back
npm run start:front
```

### Producción con Docker

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Cloud Providers

- **Vercel**: Para frontend
- **Railway**: Para backend
- **Supabase**: Para base de datos
- **AWS**: Para infraestructura completa

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

Ver [CONTRIBUTING.md](./CONTRIBUTING.md) para más detalles.

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver [LICENSE](./LICENSE) para más detalles.

## 🆘 Soporte

- **GitHub Issues**: Para bugs y feature requests
- **GitHub Discussions**: Para preguntas y discusiones
- **Documentación**: Revisa la documentación completa

## 🎯 Próximos Pasos

1. **Personaliza el branding** según tu proyecto
2. **Añade nuevas funcionalidades** siguiendo la estructura existente
3. **Configura la base de datos** con tus tablas
4. **Implementa tests** para tus funcionalidades
5. **Despliega** en tu plataforma preferida

---

**¡Disfruta construyendo tu próxima aplicación! 🚀**
