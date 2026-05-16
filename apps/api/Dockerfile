# Etapa 1: Construcción del API service (Node.js)
FROM node:22-slim AS build

# Herramientas necesarias para compilar módulos nativos (bcrypt, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY tsconfig*.json ./
COPY nx.json ./

# HUSKY=0 evita que husky falle al no haber .git en el contexto Docker
ENV HUSKY=0
RUN npm install --verbose

COPY . .

RUN npm run build:api --verbose

# Eliminar devDependencies del workspace para que solo queden las de producción
RUN npm prune --omit=dev

# Etapa 2: Imagen final para producción
FROM node:22-slim

# Dependencias de sistema para GraphicsMagick / Ghostscript (pdf2pic)
RUN apt-get update && apt-get install -y --no-install-recommends \
    graphicsmagick \
    ghostscript \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

ENV APP_DIR=/home/app-api/

RUN groupadd app-api && useradd -g app-api -m app-api

COPY --from=build /app/dist/apps/api ${APP_DIR}
COPY --from=build /app/node_modules ${APP_DIR}node_modules

WORKDIR ${APP_DIR}

RUN mkdir -p uploads && chown -R app-api:app-api .

USER app-api

EXPOSE 3200

CMD ["node", "main.js"]
