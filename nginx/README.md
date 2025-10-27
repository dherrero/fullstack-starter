# Configuración de Nginx para Producción

Este directorio contiene la configuración de nginx para servir la aplicación frontend en producción.

## Configuración

### Configuración del Proxy al Backend

El archivo `default.conf` incluye una configuración de proxy que reenvía las peticiones API del frontend al servidor backend. Esto garantiza:

1. **Cumplimiento de la política same-origin**: Frontend y backend aparecen en el mismo dominio
2. **Funcionalidad de cookies**: Las cookies HttpOnly funcionan correctamente sin problemas de CORS
3. **Seguridad**: La cookie RefreshToken permanece segura e inaccesible desde JavaScript

### Instrucciones de Configuración

1. **Reemplaza el marcador de posición** en `default.conf`:

   ```nginx
   location /api/ {
       proxy_pass YOUR_BACK_DOMAIN_HERE;
       ...
   }
   ```

2. **Configura tu dominio del backend**:

   Reemplaza `YOUR_BACK_DOMAIN_HERE` con la URL real de tu backend:

   **Ejemplos:**

   ```nginx
   # Si el backend está en el mismo servidor, puerto diferente:
   proxy_pass http://localhost:3200;

   # Si el backend está en un subdominio:
   proxy_pass https://api-starter.tu-dominio.es;

   # Si el backend está en un servidor diferente:
   proxy_pass http://backend-server.example.com:3200;
   ```

   **Importante**: Incluye el protocolo (`http://` o `https://`) y omite las barras finales.

### Cómo Funciona

```
Usuario → https://starter.tu-dominio.es/login
          ↓
Frontend (Nginx) → Sirve la aplicación Angular

Usuario → https://starter.tu-dominio.es/api/v1/auth/login
          ↓
Nginx → Proxy a YOUR_BACK_DOMAIN_HERE/api/v1/auth/login
          ↓
Backend → Procesa la petición
          ← Establece cookie HttpOnly: refreshToken
          ← Devuelve: Header Authorization (AccessToken)
          ↓
Nginx → Reenvía la respuesta (incluyendo header Set-Cookie)
          ↓
Usuario ← Recibe respuesta con cookie segura
```

### Directivas Clave de Nginx

- **`proxy_pass`**: Reenvía peticiones al backend
- **`proxy_set_header Host`**: Preserva el header host original
- **`proxy_set_header Cookie`**: Reenvía cookies al backend
- **`proxy_pass_request_headers on`**: Reenvía todos los headers incluyendo Set-Cookie
- **`proxy_buffering off`**: Desactiva el buffering para respuestas en tiempo real

### Configuración de Cookies

El backend configura las cookies con:

- **Desarrollo**: `sameSite: 'lax'`, `secure: false`
- **Producción**: `sameSite: 'strict'`, `secure: true`

Como nginx hace de proxy, el frontend y backend comparten el mismo origen, permitiendo que las cookies funcionen correctamente.

### Pruebas

1. Construye y sirve el frontend con nginx
2. Accede a la URL de tu frontend
3. Abre DevTools → Application → Cookies
4. Haz login y verifica que aparece la cookie `refreshToken`
5. Recarga la página (F5) - la sesión debe persistir

### Resolución de Problemas

**Las cookies no persisten:**

- Verifica que `YOUR_BACK_DOMAIN_HERE` está configurado correctamente
- Comprueba que el backend es accesible desde el servidor nginx
- Asegúrate de que el backend tiene `NODE_ENV=production` configurado
- Verifica que CORS está configurado para permitir tu dominio frontend

**502 Bad Gateway:**

- El servidor backend no está ejecutándose
- La URL del backend en `proxy_pass` es incorrecta
- Problema de conectividad de red entre nginx y el backend

**Errores de CORS:**

- NO deberían ocurrir con la configuración de proxy
- Si ves errores de CORS, el proxy no está funcionando correctamente
- Verifica que las peticiones van a través de la ruta `/api/*`
