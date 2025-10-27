# 🚀 Nx Fullstack Starter

> **Un starter completo y profesional para monorepos TypeScript con Angular 20 + Express.js + PostgreSQL**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-22.12.0-green.svg)](https://nodejs.org/)
[![Angular](https://img.shields.io/badge/Angular-20.3.7-red.svg)](https://angular.io/)
[![Nx](https://img.shields.io/badge/Nx-22.0.1-blue.svg)](https://nx.dev/)
[![Express](https://img.shields.io/badge/Express-5.1.0-green.svg)](https://expressjs.com/)

Un proyecto starter completo con monorepo Nx que incluye autenticación JWT, gestión de usuarios, sistema de permisos, internacionalización y Docker. Perfecto para comenzar nuevos proyectos fullstack con Angular y Node.js.

## ✨ Características Principales

### 🎯 **Stack Tecnológico**

- **Frontend**: Angular 20 con standalone components
- **Backend**: Node.js + Express.js + TypeScript
- **Base de datos**: PostgreSQL con Sequelize ORM
- **Monorepo**: Nx workspace para gestión eficiente
- **Build System**: Vite + esbuild (build ultra-rápido)
- **Containerización**: Docker + Docker Compose
- **UI**: Bootstrap 5 + NgBootstrap
- **i18n**: Transloco (Español/Valenciano)

### 🔐 **Autenticación & Seguridad**

- JWT con access y refresh tokens
- Sistema de permisos basado en roles
- Guards para protección de rutas
- Interceptores HTTP automáticos
- Hashing seguro de contraseñas con bcrypt

### 🌍 **Internacionalización**

- Soporte completo para múltiples idiomas
- Cambio dinámico de idioma
- Persistencia de preferencias
- Traducciones completas de la UI

### 🏗️ **Arquitectura**

- Patrón Controller-Service-Repository
- DTOs compartidos entre frontend y backend
- Middleware de autenticación centralizado
- Manejo de errores unificado
- Validación de datos robusta

## 🚀 Inicio Rápido

### Prerrequisitos

```bash
# Verificar versiones
node --version  # >= 22.12.0
npm --version   # >= 10.9.0
docker --version
docker-compose --version
```

### Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/dherrero/nx-fullstack-starter.git
cd nx-fullstack-starter

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus configuraciones

# 4. Iniciar desarrollo
npm run dev
```

### Acceso a la Aplicación

- **Frontend**: http://localhost:4200
- **Backend API**: http://localhost:3200
- **Base de datos**: localhost:5432

### Usuario por Defecto

```
Email: test@local.com
Contraseña: 123456
```

## 🛠️ Comandos de Desarrollo

### Desarrollo Local

```bash
# Desarrollo completo (recomendado)
npm run dev              # Base de datos + Backend + Frontend

# Desarrollo por pasos
npm run dev:db           # Solo base de datos
npm run dev:back         # Solo backend (espera DB)
npm run dev:front        # Solo frontend (espera Backend)

# Comandos individuales
npm run start:front      # Iniciar frontend
npm run start:back       # Iniciar backend
npm run start:both       # Iniciar ambos
```

### Gestión de Base de Datos

```bash
npm run dev:db:down      # Detener base de datos
npm run dev:db:clean     # Limpiar volúmenes de DB
```

### Construcción y Despliegue

```bash
# Construcción
npm run build:front      # Construir frontend
npm run build:back       # Construir backend
npm run build            # Construir ambos

# Docker
npm run docker:up        # Iniciar con Docker
```

## 📁 Estructura del Proyecto

```
nx-fullstack-starter/
├── apps/
│   ├── front/                    # Aplicación Angular
│   │   ├── src/app/
│   │   │   ├── components/       # Componentes reutilizables
│   │   │   ├── pages/           # Páginas principales
│   │   │   ├── libs/            # Módulos de funcionalidad
│   │   │   └── services/        # Servicios de negocio
│   │   └── src/assets/i18n/     # Archivos de traducción
│   └── back/                    # API Node.js
│       ├── src/
│       │   ├── controllers/     # Controladores de rutas
│       │   ├── services/        # Lógica de negocio
│       │   ├── models/          # Modelos de Sequelize
│       │   ├── routes/          # Definición de rutas
│       │   └── adapters/        # Adaptadores externos
│       └── .env                 # Variables de entorno
├── libs/
│   └── rest-dto/                # DTOs compartidos
├── db/                          # Scripts de base de datos
├── nginx/                       # Configuración Nginx
└── compose.yaml                 # Docker Compose
```

## 🎯 Tips de Trabajo

### 🔄 **Flujo de Desarrollo Recomendado**

1. **Configuración inicial**

   ```bash
   # Clonar y configurar
   git clone <repo-url>
   cd nx-fullstack-starter
   npm install
   cp .env.example .env
   ```

2. **Desarrollo diario**

   ```bash
   # Terminal 1: Base de datos
   npm run dev:db

   # Terminal 2: Backend
   npm run dev:back

   # Terminal 3: Frontend
   npm run dev:front
   ```

3. **Antes de commit**
   ```bash
   npm run lint
   npm run test
   npm run build
   ```

### 🏗️ **Arquitectura y Patrones**

#### **Frontend (Angular)**

- **Standalone Components**: Usa componentes independientes
- **Services**: Lógica de negocio en servicios inyectables
- **Guards**: Protección de rutas con guards
- **Interceptors**: Manejo automático de autenticación
- **Reactive Forms**: Formularios reactivos con validación

#### **Backend (Express)**

- **Controller-Service-Repository**: Separación clara de responsabilidades
- **Middleware**: Autenticación y validación centralizada
- **DTOs**: Transferencia de datos tipada
- **Error Handling**: Manejo centralizado de errores

### 🔧 **Mejores Prácticas**

#### **Git Workflow**

```bash
# Crear feature branch
git checkout -b feature/nueva-funcionalidad

# Desarrollo con commits frecuentes
git add .
git commit -m "feat: añadir nueva funcionalidad"

# Push y PR
git push origin feature/nueva-funcionalidad
```

#### **Estructura de Commits**

```
feat: nueva funcionalidad
fix: corrección de bug
docs: actualización de documentación
style: cambios de formato
refactor: refactorización de código
test: añadir o modificar tests
chore: tareas de mantenimiento
```

#### **Naming Conventions**

- **Archivos**: kebab-case (`user-service.ts`)
- **Clases**: PascalCase (`UserService`)
- **Variables**: camelCase (`userName`)
- **Constantes**: UPPER_SNAKE_CASE (`API_BASE_URL`)

### 🧪 **Testing**

```bash
# Tests unitarios
npm run test:front
npm run test:back

# Tests e2e
npm run e2e:front

# Coverage
npm run test:coverage
```

### 🐳 **Docker**

#### **Desarrollo**

```bash
# Solo base de datos
docker-compose -f docker-compose.db.yml up

# Aplicación completa
docker-compose up
```

#### **Producción**

```bash
# Construir y desplegar
npm run build
docker-compose -f docker-compose.prod.yml up -d
```

### 🌍 **Internacionalización**

#### **Añadir nuevo idioma**

1. Crear archivo en `apps/front/src/assets/i18n/nuevo-idioma.json`
2. Actualizar `transloco-loader.service.ts`
3. Añadir opción en `language-switcher.component.ts`

#### **Añadir nuevas traducciones**

```typescript
// En el componente
this.translocoService.translate('clave.traduccion');

// En el template
{
  {
    'clave.traduccion' | transloco;
  }
}
```

### 🔐 **Seguridad**

#### **Variables de Entorno**

```bash
# Nunca commitees archivos .env
echo ".env" >> .gitignore

# Usa .env.example como plantilla
cp .env.example .env
```

#### **JWT Configuration**

```typescript
// Backend: Configurar secrets seguros
JWT_SECRET=tu-secret-super-seguro
JWT_REFRESH_SECRET=tu-refresh-secret-super-seguro
```

### 📊 **Monitoreo y Debugging**

#### **Logs del Backend**

```typescript
// Usar diferentes niveles de log
console.log('Info:', data);
console.warn('Warning:', warning);
console.error('Error:', error);
```

#### **DevTools del Frontend**

- Usar Angular DevTools
- Redux DevTools para estado
- Network tab para requests

### 🚀 **Performance**

#### **Frontend**

- Lazy loading de módulos
- OnPush change detection
- TrackBy en \*ngFor
- Preload strategies

#### **Backend**

- Connection pooling
- Query optimization
- Caching strategies
- Compression middleware

## 🗄️ Base de Datos

### Esquema de Usuarios

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  lastName VARCHAR(255) NOT NULL,
  permission VARCHAR(50) NOT NULL,
  password VARCHAR(255) NOT NULL,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

### Permisos Disponibles

- `ADMIN`: Acceso completo al sistema
- `WRITE_SOME_ENTITY`: Ejemplo permiso escritura de una entidad
- `READ_SOME_ENTITY`: Ejemplo permiso para lectura de una entidad

## 🔧 Configuración Avanzada

### Variables de Entorno

#### Backend (.env)

```env
# Database
POSTGRESDB_HOST=localhost
POSTGRESDB_PORT=5432
POSTGRESDB_DATABASE=your_db_name
POSTGRESDB_USER=postgres
POSTGRESDB_PASSWORD=password

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here
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
  appName: 'Nx Fullstack Starter',
};
```

## 📦 Despliegue

### Producción con Docker

```bash
# 1. Construir para producción
npm run build

# 2. Crear imágenes Docker
docker-compose -f docker-compose.prod.yml build

# 3. Desplegar
docker-compose -f docker-compose.prod.yml up -d
```

### Variables de Entorno de Producción

```env
NODE_ENV=production
POSTGRESDB_HOST=postgresdb
POSTGRESDB_DATABASE=production_db
JWT_SECRET=production-secret-key
CORS_ORIGIN=https://your-domain.com
```

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

### Guía de Contribución

- Sigue las convenciones de código existentes
- Añade tests para nuevas funcionalidades
- Actualiza la documentación si es necesario
- Usa commits descriptivos

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🆘 Soporte

### Documentación

- [Angular Docs](https://angular.io/docs)
- [Express.js Docs](https://expressjs.com/)
- [Nx Docs](https://nx.dev/)
- [Sequelize Docs](https://sequelize.org/)

### Comunidad

- [GitHub Issues](https://github.com/tu-usuario/nx-fullstack-starter/issues)
- [Discussions](https://github.com/tu-usuario/nx-fullstack-starter/discussions)

### Problemas Comunes

#### Error de conexión a la base de datos

```bash
# Verificar que Docker esté corriendo
docker ps

# Reiniciar la base de datos
npm run dev:db:down
npm run dev:db
```

#### Error de puerto en uso

```bash
# Matar proceso en puerto 3200
lsof -ti:3200 | xargs kill

# Matar proceso en puerto 4200
lsof -ti:4200 | xargs kill
```

## 🎯 Próximos Pasos

### Personalización del Starter

1. **Cambiar el branding**

   - Actualiza textos en `apps/front/src/assets/i18n/`
   - Modifica colores en `apps/front/src/styles.scss`
   - Cambia el favicon y logo

2. **Añadir nuevas funcionalidades**

   - Crea nuevos módulos siguiendo la estructura existente
   - Añade nuevos endpoints en el backend
   - Implementa nuevos componentes en el frontend

3. **Configurar la base de datos**

   - Añade nuevas tablas en `db/`
   - Crea nuevos modelos en `apps/back/src/models/`
   - Actualiza DTOs en `libs/rest-dto/`

4. **Implementar tests**
   - Añade tests unitarios para servicios
   - Implementa tests e2e para flujos críticos
   - Configura coverage reports

### Roadmap

- [ ] Añadir más ejemplos de componentes
- [ ] Implementar sistema de notificaciones
- [ ] Añadir tests e2e completos
- [ ] Crear documentación de API
- [ ] Añadir CI/CD pipeline
- [ ] Implementar logging avanzado
- [ ] Añadir métricas y monitoreo

---

## 🌟 ¿Te gusta este proyecto?

¡Dale una ⭐ en GitHub y compártelo con la comunidad!

**¡Disfruta construyendo tu próxima aplicación! 🚀**

---

<div align="center">
  <p>Hecho con ❤️ por la comunidad</p>
  <p>
    <a href="https://angular.io/">Angular</a> •
    <a href="https://expressjs.com/">Express</a> •
    <a href="https://nx.dev/">Nx</a> •
    <a href="https://www.postgresql.org/">PostgreSQL</a>
  </p>
</div>
