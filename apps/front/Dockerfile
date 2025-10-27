# Etapa 1: Construcción de la aplicación Frontend (Node.js)
FROM node:18-slim AS build

# Directorio de trabajo para la compilación
WORKDIR /app

# Copiar archivos de configuración y dependencias
COPY package*.json ./
COPY nx.json ./
COPY tsconfig.base.json ./

# Actualizar npm a una versión compatible con Node.js 18
RUN npm install -g npm@10.9.0

# Instalar las dependencias necesarias ignorando scripts post-instalación
RUN npm install --ignore-scripts --verbose

# Copiar el código fuente para construir la aplicación Frontend
COPY . .

# Construir la aplicación (los archivos compilados estarán en dist/apps/app-front)
RUN npm run build:front --verbose

# Etapa 2: Imagen final (Nginx para servir la aplicación)
FROM nginx

# Definir el directorio donde se servirán los archivos
ENV APP_DIR /usr/share/nginx/html/

# Copiar configuraciones de Nginx
COPY ./nginx/mime.types /etc/nginx/conf.d/mime.types
COPY ./nginx/gzip.conf /etc/nginx/conf.d/gzip.conf
COPY ./nginx/default.conf /etc/nginx/conf.d/default.conf
COPY ./nginx/nginx.conf /etc/nginx/nginx.conf

# Crear usuario no root
RUN groupadd app-front && \
    useradd -g 0 -l -m -s /bin/bash -u 109012 app-front && \
    usermod -a -G app-front app-front && \
    mkdir -p ${APP_DIR} && \
    chown -R app-front:app-front ${APP_DIR} && \
    chmod -R 775 ${APP_DIR} && \
    touch /var/run/nginx.pid && \
    mkdir /var/cache/nginx/client_temp /var/cache/nginx/uwsgi_temp /var/cache/nginx/scgi_temp && \
    mkdir /var/cache/nginx/proxy_temp /var/cache/nginx/fastcgi_temp && \
    chown -R app-front:app-front /var/cache/nginx /var/run /var/log/nginx && \
    chmod -R 775 /var/cache/nginx /var/run /var/log/nginx

# Directorio de trabajo para la aplicación Nginx
WORKDIR ${APP_DIR}

# Copiar los archivos compilados de la etapa de construcción
COPY --from=build /app/dist/apps/app-front ${APP_DIR}

# Exponer el puerto 80
EXPOSE 80

# Cambiar al usuario no root
USER app-front

# Iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]
