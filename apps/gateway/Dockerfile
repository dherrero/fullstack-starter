# Etapa 1: Construcción del Gateway (Node.js)
FROM node:22-slim AS build

WORKDIR /app

COPY package*.json ./
COPY tsconfig*.json ./
COPY nx.json ./

ENV HUSKY=0
RUN npm install --verbose

COPY . .

RUN npm run build:gateway --verbose

# Eliminar devDependencies para producción
RUN npm prune --omit=dev

# Etapa 2: Imagen final para producción
FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

ENV APP_DIR=/home/app-gateway/

RUN groupadd app-gateway && useradd -g app-gateway -m app-gateway

COPY --from=build /app/dist/apps/gateway ${APP_DIR}
COPY --from=build /app/node_modules ${APP_DIR}node_modules

WORKDIR ${APP_DIR}

RUN chown -R app-gateway:app-gateway .

USER app-gateway

EXPOSE 3100

CMD ["node", "main.js"]
