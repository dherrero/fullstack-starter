# 🤖 AI Agent Context - Nx Fullstack Starter

## 📋 Project Overview

**Nx Fullstack Starter** is a full-stack TypeScript monorepo starter project with authentication, user management, and permission system. The project uses Nx workspace for monorepo management and consists of three main parts:

- **Frontend** (`apps/front/`): Angular 20 application
- **Backend** (`apps/back/`): Node.js + Express API
- **Shared DTOs** (`libs/rest-dto/`): TypeScript interfaces for API communication

## 🏗️ Architecture

### Monorepo Structure

```sh
nx-fullstack-starter/
├── apps/
│   ├── front/              # Angular frontend application
│   └── back/               # Node.js backend API
├── libs/
│   └── rest-dto/           # Shared TypeScript DTOs
├── db/                     # Database initialization scripts
├── nginx/                  # Nginx configuration
├── compose.yaml            # Docker Compose configuration
└── package.json            # Root package.json with workspace scripts
```

### Technology Stack

#### Frontend (Angular 20)

- **Framework**: Angular 20.3.7 with standalone components
- **UI Library**: Bootstrap 5.3.7 + NgBootstrap 19.0.1
- **State Management**: RxJS with custom services
- **Internationalization**: Transloco (English + Spanish + Valencian)
- **Build Tool**: Nx + Angular CLI
- **Styling**: SCSS

#### Backend (Node.js + Express)

- **Runtime**: Node.js 22.12.0
- **Framework**: Express 5.1.0
- **Database**: PostgreSQL with Sequelize ORM
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt
- **Build Tool**: Nx + esbuild

#### Shared

- **Language**: TypeScript 5.9.3
- **Monorepo**: Nx 22.0.1
- **Package Manager**: npm 10.9.0

## 🗄️ Database Schema

### Tables

1. **users** - User management with role-based permissions

### Key Models (Sequelize)

- **User**: id, email, name, lastName, permission, password, timestamps

## 🔐 Authentication & Authorization

### User Permissions

- **ADMIN**: Full access to all features
- **WRITE_SOME_ENTITY**: Can list, edit, and delete magazines
- **READ_SOME_ENTITY**: Can only search and view magazines

### Security Features

- JWT-based authentication with access and refresh tokens
- Password hashing with bcrypt
- Role-based route protection
- CORS configuration
- Input validation and sanitization

## 🌐 Internationalization (i18n)

### Supported Languages

- **English (en)**: Default language
- **Spanish (es)**
- **Valencian (ca)**

## Set language from browser

### Implementation

- **Library**: Transloco 6.0.4
- **Persistence**: localStorage with fallback to default
- **Coverage**: Complete UI translation including:
  - Welcome page
  - Login interface
  - User management
  - Error messages
  - Navigation

## 📁 Key Directories & Files

### Backend (`apps/back/src/`)

```sh
src/
├── controllers/           # API route handlers
│   ├── auth.controller.ts
│   ├── user-crud.controller.ts
│   └── abstract-crud.controller.ts
├── services/             # Business logic
│   ├── auth.service.ts
│   ├── user-crud.service.ts
│   └── abstract-crud.service.ts
├── models/               # Sequelize models
│   └── user.model.ts
├── routes/               # Express routes
│   ├── auth.routes.ts
│   ├── user-crud.routes.ts
│   └── health.routes.ts
├── adapters/             # External integrations
│   ├── db/pg.connector.ts
│   └── http/http.responser.ts
└── main.ts              # Application entry point
```

### Frontend (`apps/front/src/app/`)

```sh
app/
├── components/           # Reusable UI components
│   ├── language-switcher/ # i18n language selector
│   ├── user-form/        # User creation/editing
│   └── confirm/          # Confirmation dialogs
├── pages/               # Page components
│   ├── home/            # Welcome page
│   └── login/           # Authentication
├── libs/                # Feature modules
│   └── auth/            # Authentication module
├── services/            # Business logic services
│   ├── user.service.ts
│   ├── language.service.ts
│   └── transloco-loader.service.ts
└── models/              # TypeScript interfaces
    └── state.model.ts
```

### Shared DTOs (`libs/rest-dto/src/lib/`)

```typescript
// Key interfaces
interface UserDTO {
  id: CreationOptional<number>;
  email: string;
  name: string;
  lastName: string;
  permission: string;
  password: string;
  // ... timestamps
}

interface PaginationDTO<T> {
  count: number;
  rows: T[];
}
```

## 🚀 Development Commands

### Available Scripts

```bash
# Development
npm run start:front      # Start Angular dev server
npm run start:back       # Start Node.js dev server
npm run start:both       # Start both frontend and backend

# Building
npm run build:front      # Build Angular for production
npm run build:back       # Build Node.js for production
npm run build            # Build both applications

# Docker
npm run docker:up        # Build and start with Docker Compose

# Utilities
npm run clean            # Clean build artifacts
```

### Environment Variables

The application uses environment variables for configuration. Key variables include:

- Database connection settings
- JWT secrets and expiration times
- Port configurations

## 🐳 Docker Configuration

### Services

1. **postgresdb**: PostgreSQL database
2. **back**: Node.js API server
3. **front**: Angular application (served via Nginx)

### Networks

- **back-starter-network**: Database and API communication

## 🔧 Key Features

### Welcome Page

- Modern landing page with gradient background
- Responsive design for mobile and desktop
- Language switcher integration
- Call-to-action for login

### Authentication System

- Complete login form with validation
- JWT token management
- Error handling with translated messages
- Remember me functionality

### User Management

- Role-based access control
- User creation, editing, and deletion
- Permission management
- Business logic validation

### Internationalization

- Complete UI translation
- Language persistence across sessions
- Dynamic language switching
- Fallback to default language

## 📝 Recent Changes

### Latest Commit: `feat: refactor monorepo structure and rename to nx-fullstack-starter`

- Removed prefijo `app-` from application names
- Updated all configuration files
- Cleaned up imports to use tsconfig paths
- Updated documentation and project references
- Converted to clean starter project

## 🎯 Current State

The application is fully functional as a starter project with:

- ✅ Complete user authentication and authorization
- ✅ Welcome page with modern design
- ✅ Internationalization (Spanish/Valencian)
- ✅ Docker containerization
- ✅ Role-based access control
- ✅ Responsive UI with Bootstrap
- ✅ Clean monorepo structure

## 🔍 Code Patterns

### Frontend Patterns

- Standalone Angular components
- Reactive forms with validation
- RxJS for state management
- Service-based architecture
- Guard-based route protection

### Backend Patterns

- Controller-Service-Repository pattern
- Abstract CRUD base classes
- Middleware-based authentication
- Sequelize ORM with migrations
- Error handling with try-catch

### Shared Patterns

- TypeScript interfaces for type safety
- Consistent naming conventions
- Monorepo dependency management
- Environment-based configuration

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Docker and Docker Compose

### Quick Start

1. **Clone the repository**

```bash
git clone <repository-url>
cd nx-fullstack-starter
```

2. **Install dependencies**

```bash
npm install
```

3. **Start development**

```bash
npm run start:both
```

4. **Access the application**

- Frontend: http://localhost:4200
- Backend API: http://localhost:3000

### Default User

- **Email**: test@local.com
- **Password**: 123456

## 🎨 Customization

### Branding

1. Update texts in translation files (`apps/front/src/assets/i18n/`)
2. Modify colors in `apps/front/src/styles.scss`
3. Update app name in environment files

### Adding Features

1. Create new components in `apps/front/src/app/components/`
2. Add new pages in `apps/front/src/app/pages/`
3. Create new services in `apps/front/src/app/services/`
4. Add new API endpoints in `apps/back/src/routes/`

### Database Changes

1. Create new models in `apps/back/src/models/`
2. Add migrations in `db/` directory
3. Update DTOs in `libs/rest-dto/src/lib/`

---

_This document provides comprehensive context for AI agents working on the Nx Fullstack Starter project. Last updated: 2025-01-08_
