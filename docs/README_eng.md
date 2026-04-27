# 🚀 Nx Fullstack Starter

> **A complete, professional starter for TypeScript monorepos with Angular + Express.js + PostgreSQL**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-22.12.0-green.svg)](https://nodejs.org/)
[![Angular](https://img.shields.io/badge/Angular-20.3.7-red.svg)](https://angular.io/)
[![Nx](https://img.shields.io/badge/Nx-22.0.1-blue.svg)](https://nx.dev/)
[![Express](https://img.shields.io/badge/Express-5.1.0-green.svg)](https://expressjs.com/)

🌐 [Versión en español](../README.md)

A complete Nx monorepo starter including JWT authentication, user management, permissions system, internationalization, and Docker. Perfect for kicking off new fullstack projects with Angular and Node.js.

## ✨ Main Features

### 🎯 **Tech Stack**

- **Frontend**: Angular 20 with standalone components
- **Backend**: Node.js + Express.js + TypeScript
- **Database**: PostgreSQL with Sequelize ORM
- **Monorepo**: Nx workspace for efficient management
- **Build System**: Vite + esbuild (ultra-fast builds)
- **Containerisation**: Docker + Docker Compose
- **UI**: Bootstrap 5 + NgBootstrap
- **i18n**: Transloco (Spanish / Valencian)

### 🔐 **Authentication & Security**

- JWT with access and refresh tokens
- Role-based permissions system
- Route guards
- Automatic HTTP interceptors
- Secure password hashing with bcrypt

### 🌍 **Internationalisation**

- Full multi-language support
- Dynamic language switching
- Preference persistence
- Complete UI translations

### 🏗️ **Architecture**

- Controller-Service-Repository pattern
- DTOs shared between frontend and backend
- Centralised authentication middleware
- Unified error handling
- Robust data validation

## 🚀 Quick Start

### Prerequisites

```bash
node --version  # >= 22.12.0
npm --version   # >= 10.9.0
docker --version
docker-compose --version
```

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/dherrero/nx-fullstack-starter.git
cd nx-fullstack-starter

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your settings

# 4. Start development
npm run dev
```

### Application Access

- **Frontend**: http://localhost:4200
- **Backend API**: http://localhost:3200
- **Database**: localhost:5432

### Default Credentials

```
Email: test@local.com
Password: 123456
```

## 🛠️ Development Commands

### Local Development

```bash
# Full development (recommended)
npm run dev              # Database + Backend + Frontend

# Step by step
npm run dev:db           # Database only
npm run dev:back         # Backend only (waits for DB)
npm run dev:front        # Frontend only (waits for Backend)

# Individual commands
npm run start:front      # Start frontend
npm run start:back       # Start backend
npm run start:both       # Start both
```

### Database Management

```bash
npm run dev:db:down      # Stop database
npm run dev:db:clean     # Clean DB volumes
```

### Build & Deploy

```bash
npm run build:front      # Build frontend
npm run build:back       # Build backend
npm run build            # Build both

npm run docker:up        # Start with Docker
```

## 📁 Project Structure

```
nx-fullstack-starter/
├── apps/
│   ├── front/                    # Angular application
│   │   ├── src/app/
│   │   │   ├── components/       # Reusable components
│   │   │   ├── pages/            # Main pages
│   │   │   ├── libs/             # Feature modules
│   │   │   └── services/         # Business services
│   │   └── src/assets/i18n/      # Translation files
│   └── back/                     # Node.js API
│       ├── src/
│       │   ├── controllers/      # Route controllers
│       │   ├── services/         # Business logic
│       │   ├── models/           # Sequelize models
│       │   ├── routes/           # Route definitions
│       │   └── adapters/         # External adapters
│       └── .env                  # Environment variables
├── libs/
│   └── rest-dto/                 # Shared DTOs
├── db/                           # Database scripts
├── nginx/                        # Nginx configuration
└── compose.yaml                  # Docker Compose
```

## 🤖 Claude Code Friendly — Agent System

This project is configured to work optimally with **Claude Code**, Anthropic's coding agent. It includes a system of specialised subagents that can implement complete end-to-end features autonomously, following all project conventions without needing to be reminded.

### Configuration structure

```
.claude/
├── agents/                      # Specialised subagents
│   ├── database-specialist.md   # Database (PostgreSQL, migrations, indexes)
│   ├── backend-developer.md     # Backend (Express, Sequelize, services, JWT)
│   ├── frontend-developer.md    # Frontend (Angular, components, forms)
│   └── qa-engineer.md           # Quality assurance (tests, linting, coverage)
├── skills/                      # Invokable skills
│   ├── angular-developer.md     # Official Angular guidelines (Google source)
│   └── start-agile.md           # Leantime kanban integration
└── settings.local.json          # Permissions and allowed/denied operations
```

The root `CLAUDE.md` file acts as the **main orchestrator**: it receives the request, breaks it down by layer, and delegates to each subagent in dependency order.

### Orchestration flow

```
User request
      ↓
[CLAUDE.md] Orchestrator
      ↓
┌─────┬──────────┬──────────┐
↓     ↓          ↓          ↓
DB  Backend  Frontend      QA
↓     ↓          ↓          ↓
└─────┴──────────┴──────────┘
      ↓
Layer-by-layer report to user
```

Execution order respects dependencies: database → backend → frontend → QA.

### Subagents

#### 🗄️ Database Specialist

Expert in PostgreSQL and MongoDB schema design, zero-downtime migrations, indexing, and query optimisation.

- Generates numbered SQL files in `db/` (never Sequelize auto-sync)
- Sequelize models with `field` mapping for lowercase DB columns
- Soft deletes (`deleted`, `deletedAt`) on all entities
- Index strategy: FK indexes, composite, partial, and covering indexes
- Performance analysis with `EXPLAIN ANALYZE`

#### 🔧 Backend Developer

Expert in Express + Sequelize following a 4-layer architecture: Routes → Controllers → Services → Models.

- `AbstractCrudService` / `AbstractCrudController` patterns to minimise boilerplate
- All HTTP responses through `HttpResponser` (never bare `res.json()`)
- JWT authentication with httpOnly cookies for the refresh token
- Per-route permissions via `authController.hasPermission(Permission.X)`
- Vitest unit tests with mocks only at boundaries (DB, HTTP)

#### 🎨 Frontend Developer

Expert in Angular following Clean Architecture and the latest official best practices.

- Standalone components with `OnPush` and Signals API (`signal`, `computed`, `linkedSignal`, `resource`)
- `inject()` for dependency injection — never constructor injection
- Lazy-loaded routes with `loadComponent()` / `loadChildren()`
- Signal Forms for new forms (Angular v21+)
- DTOs imported from `libs/rest-dto` (single source of truth, never redefined locally)

#### ✅ QA Engineer

Always runs **last**, after all implementation agents have finished.

1. TypeScript compilation with no errors (`npx nx run-many -t build`)
2. Linting (`npm run lint`)
3. Tests and coverage — minimum threshold of **60%** for new files
4. Test quality review (meaningful assertions, edge cases covered)
5. Code quality review (SRP, DRY, no dead code)
6. Per-layer conventions checklist
7. Final report: `PASS | PASS WITH WARNINGS | FAIL`

### Skills

| Skill               | Invocation           | Description                                                                                                     |
| ------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------- |
| `angular-developer` | `/angular-developer` | Loads the official Angular guidelines before writing code. Invoked automatically by the frontend agent.         |
| `start-agile`       | `/start-agile`       | Activates agile mode: creates Leantime tickets per layer and updates their status as implementation progresses. |

### How to use it

Open Claude Code at the project root and describe in plain language the feature you want to implement. The orchestrator delegates to the correct subagents and delivers a layer-by-layer report:

```
"Add a product management module with full CRUD:
 products table with name, description, price and stock"
```

To activate agile mode with Leantime tracking:

```
/start-agile Add a product management module with full CRUD
```

## 🎯 Development Tips

### 🔄 **Recommended Development Flow**

1. **Initial setup**

   ```bash
   git clone <repo-url>
   cd nx-fullstack-starter
   npm install
   cp .env.example .env
   ```

2. **Daily development**

   ```bash
   # Terminal 1: Database
   npm run dev:db

   # Terminal 2: Backend
   npm run dev:back

   # Terminal 3: Frontend
   npm run dev:front
   ```

3. **Before committing**
   ```bash
   npm run lint
   npm run test
   npm run build
   ```

### 🏗️ **Architecture & Patterns**

#### **Frontend (Angular)**

- **Standalone Components**: Use independent components
- **Services**: Business logic in injectable services
- **Guards**: Route protection with guards
- **Interceptors**: Automatic authentication handling
- **Reactive Forms**: Reactive forms with validation

#### **Backend (Express)**

- **Controller-Service-Repository**: Clear separation of concerns
- **Middleware**: Centralised authentication and validation
- **DTOs**: Typed data transfer
- **Error Handling**: Centralised error management

### 🔧 **Best Practices**

#### **Git Workflow**

```bash
# Create feature branch
git checkout -b feature/new-feature

# Develop with frequent commits
git add .
git commit -m "feat: add new feature"

# Push and PR
git push origin feature/new-feature
```

#### **Commit Structure**

```
feat: new feature
fix: bug fix
docs: documentation update
style: formatting changes
refactor: code refactoring
test: add or modify tests
chore: maintenance tasks
```

#### **Naming Conventions**

- **Files**: kebab-case (`user-service.ts`)
- **Classes**: PascalCase (`UserService`)
- **Variables**: camelCase (`userName`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`)

### 🧪 **Testing**

```bash
# Unit tests
npm run test:front
npm run test:back

# E2E tests
npm run e2e:front

# Coverage
npm run test:coverage
```

### 🐳 **Docker**

#### **Development**

```bash
# Database only
docker-compose -f docker-compose.db.yml up

# Full application
docker-compose up
```

#### **Production**

```bash
npm run build
docker-compose -f docker-compose.prod.yml up -d
```

### 🌍 **Internationalisation**

#### **Adding a new language**

1. Create a file at `apps/front/src/assets/i18n/new-language.json`
2. Update `transloco-loader.service.ts`
3. Add the option in `language-switcher.component.ts`

### 🔐 **Security**

#### **Environment Variables**

```bash
# Never commit .env files
echo ".env" >> .gitignore

# Use .env.example as a template
cp .env.example .env
```

#### **JWT Configuration**

```typescript
JWT_SECRET=your-super-secure-secret
JWT_REFRESH_SECRET=your-refresh-super-secure-secret
```

### 🚀 **Performance**

#### **Frontend**

- Lazy loading of modules
- OnPush change detection
- TrackBy on `*ngFor`
- Preload strategies

#### **Backend**

- Connection pooling
- Query optimisation
- Caching strategies
- Compression middleware

## 🗄️ Database

### Users Schema

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

### Available Permissions

- `ADMIN`: Full system access
- `WRITE_SOME_ENTITY`: Example write permission for an entity
- `READ_SOME_ENTITY`: Example read permission for an entity

## 🔧 Advanced Configuration

### Environment Variables

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

## 📦 Deployment

### Production with Docker

```bash
# 1. Build for production
npm run build

# 2. Create Docker images
docker-compose -f docker-compose.prod.yml build

# 3. Deploy
docker-compose -f docker-compose.prod.yml up -d
```

### Production Environment Variables

```env
NODE_ENV=production
POSTGRESDB_HOST=postgresdb
POSTGRESDB_DATABASE=production_db
JWT_SECRET=production-secret-key
CORS_ORIGIN=https://your-domain.com
```

## 🤝 Contributing

1. Fork the project
2. Create a branch for your feature (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Contribution Guide

- Follow existing code conventions
- Add tests for new functionality
- Update documentation if necessary
- Use descriptive commits

## 📄 Licence

This project is under the MIT Licence. See the `LICENSE` file for details.

## 🆘 Support

### Documentation

- [Angular Docs](https://angular.io/docs)
- [Express.js Docs](https://expressjs.com/)
- [Nx Docs](https://nx.dev/)
- [Sequelize Docs](https://sequelize.org/)

### Common Issues

#### Database connection error

```bash
# Check Docker is running
docker ps

# Restart the database
npm run dev:db:down
npm run dev:db
```

#### Port already in use

```bash
# Kill process on port 3200
lsof -ti:3200 | xargs kill

# Kill process on port 4200
lsof -ti:4200 | xargs kill
```

## 🎯 Next Steps

### Starter Customisation

1. **Change branding** — update `apps/front/src/assets/i18n/`, modify `styles.scss`, replace favicon and logo
2. **Add new features** — create new modules following the existing structure
3. **Configure the database** — add new tables in `db/`, create models, update DTOs in `libs/rest-dto/`
4. **Implement tests** — add unit tests for services, e2e tests for critical flows

### Roadmap

- [ ] Add more component examples
- [ ] Implement notification system
- [ ] Add full e2e tests
- [ ] Create API documentation
- [ ] Add CI/CD pipeline
- [ ] Implement advanced logging
- [ ] Add metrics and monitoring

---

## 🌟 Like this project?

Give it a ⭐ on GitHub and share it with the community!

**Enjoy building your next application! 🚀**

---

<div align="center">
  <p>Made with ❤️ by the community</p>
  <p>
    <a href="https://angular.io/">Angular</a> •
    <a href="https://expressjs.com/">Express</a> •
    <a href="https://nx.dev/">Nx</a> •
    <a href="https://www.postgresql.org/">PostgreSQL</a>
  </p>
</div>
