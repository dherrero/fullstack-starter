# Guía de seguridad — fullstack-starter

Esta guía describe el modelo de seguridad de los microservicios y los
pasos manuales obligatorios antes de desplegar.

## Modelo de confianza

```
┌──────────┐    cookie+Authorization     ┌──────────┐    X-Internal-Auth (EdDSA)   ┌─────┐
│  Cliente │ ───────────────────────────▶│ Gateway  │ ───────────────────────────▶ │ API │
└──────────┘                              └──────────┘                              └─────┘
                                             (privada)                              (pública)
```

- **Gateway** es el único servicio expuesto a Internet. Posee:
  - `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` (HS256) para los tokens
    del cliente.
  - `INTERNAL_JWT_PRIVATE_KEY` (Ed25519) para firmar las llamadas que
    envía al API.
- **API** vive en una red privada (`internal-network`). Sólo conoce:
  - `INTERNAL_JWT_PUBLIC_KEY` (Ed25519) para **verificar** las
    llamadas del gateway. No puede firmar tokens internos.
  - La conexión a Postgres.

Si el API queda comprometido, el atacante no puede firmar tokens válidos
para otros microservicios futuros — sólo el gateway puede hacerlo.

## Tokens del cliente

Cada login emite dos JWT distintos:

| Token   | Secreto              | TTL                                             | Reside en              |
| ------- | -------------------- | ----------------------------------------------- | ---------------------- |
| Access  | `JWT_ACCESS_SECRET`  | `JWT_EXPIRES_IN` (4h)                           | Header `Authorization` |
| Refresh | `JWT_REFRESH_SECRET` | `JWT_REFRESH_EXPIRES_IN` (8h, 365d si remember) | Cookie HttpOnly Secure |

Cada token lleva:

- `typ`: `'access'` o `'refresh'`. El verificador rechaza usar uno como
  el otro (mitiga _token confusion_).
- `jti`: UUID v4 único, usado por el API para rastrear la familia de
  refresh y detectar reuso (ver siguiente sección).

## Rotación y detección de reuso

La tabla `public.refresh_token_family` registra cada refresh JWT emitido:

- En cada **rotación** (cuando el cliente cambia un refresh válido por
  uno nuevo), el API marca el `jti` antiguo como usado y crea uno nuevo
  en la misma familia.
- Si el mismo `jti` se presenta **dos veces** (alguien interceptó la
  cookie y la usó después de la rotación), el API revoca la **familia
  completa** y devuelve 401. El gateway limpia la cookie del cliente.
- En `logout`, el gateway revoca la familia activa para invalidar todo
  el linaje.

## Pasos manuales antes de levantar

### 1. Generar los secretos del cliente

```bash
# Cada uno debe ser fuerte y distinto al otro
JWT_ACCESS_SECRET=$(openssl rand -base64 64 | tr -d '\n')
JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')
```

### 2. Generar el par Ed25519 para `INTERNAL_JWT_*`

```bash
openssl genpkey -algorithm ed25519 -out internal_private.pem
openssl pkey -in internal_private.pem -pubout -out internal_public.pem
```

Convertir cada PEM a una sola línea con `\n` literales para `.env`:

```bash
INTERNAL_JWT_PRIVATE_KEY=$(awk 'NF {printf "%s\\n", $0}' internal_private.pem)
INTERNAL_JWT_PUBLIC_KEY=$(awk 'NF {printf "%s\\n", $0}' internal_public.pem)
```

### 3. Volcar al `.env`

```env
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
INTERNAL_JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
INTERNAL_JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n
```

Compose inyecta `INTERNAL_JWT_PRIVATE_KEY` sólo al servicio `gateway` y
`INTERNAL_JWT_PUBLIC_KEY` sólo al servicio `api`. **Nunca** repliques la
clave privada en otros servicios.

### 4. Rotación de claves

- Cambia `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` invalida toda
  sesión activa al reiniciar el gateway. Acepta esto como expected
  behaviour.
- Cambiar el par Ed25519 invalida todos los tokens internos en vuelo;
  rotar simultáneamente la pública en el API y la privada en el gateway.
- En entornos con alta disponibilidad podés soportar rotación gradual
  cargando dos pares y verificando con ambas claves públicas. No está
  implementado en el starter — extender `requireInternalAuth` aceptando
  un array.

## Observaciones operacionales

- El API ejecuta `db/20.refresh_token_family.sql` en el primer arranque
  (vía `docker-entrypoint-initdb.d`). Para entornos existentes, correr
  la migración manualmente.
- El gateway hace `fetch` síncrono al API en cada login/refresh/logout.
  Si el API está caído, el login responde 503; los access tokens válidos
  siguen funcionando hasta que expiren.
- Los logs incluyen `requestId` (cabecera `X-Request-Id`) para correlar
  trazas entre gateway y API.
