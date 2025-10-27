# Etapa 1: Construcción de la aplicación Back (Node.js)
FROM node:18-bullseye AS build

# Directorio de trabajo para la compilación
WORKDIR /app

# Copiar archivos de configuración y dependencias
COPY package*.json ./
COPY tsconfig*.json ./
COPY nx.json ./

# Actualizar npm a la última versión estable
RUN npm install -g npm@10.9.0

# Instalar las dependencias necesarias, ignorando post-install scripts
RUN npm install --ignore-scripts --verbose

# Copiar el código fuente para construir la aplicación Backend
COPY . .

# Construir la aplicación (los archivos compilados estarán en dist/apps/app-back)
RUN npm run build:back --verbose

# Etapa 2: Imagen final para producción
FROM node:18-alpine

ENV APP_DIR /home/app-back/

# Crear el grupo y usuario de la aplicación
RUN getent group app-back || addgroup --system app-back && \
    id -u app-back &>/dev/null || adduser --system -G app-back app-back

# Instalar dependencias necesarias incluyendo Python y herramientas de compilación
RUN apk update && apk add --no-cache \
    graphicsmagick \
    ghostscript \
    python3 \
    make \
    g++ \
    libc6-compat \
    ca-certificates

# Copiar los archivos compilados de la etapa de construcción
COPY --from=build /app/dist/apps/app-back ${APP_DIR}

WORKDIR ${APP_DIR}

# Instalar solo dependencias de producción con configuración para bcrypt
ENV PYTHON=/usr/bin/python3
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
RUN npm config set strict-ssl false && \
    npm install --omit=dev

# Crear directorio de uploads si es necesario
RUN mkdir -p ${APP_DIR}uploads

# Cambiar la propiedad de los archivos
RUN chown -R app-back:app-back .

# Cambiar a un usuario no root
USER app-back

# Exponer el puerto (ajusta si es diferente)
EXPOSE 3200

# Ejecutar la aplicación apuntando correctamente a main.js
CMD [ "node", "main.js" ]
