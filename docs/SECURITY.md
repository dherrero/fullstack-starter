# Guía de seguridad — fullstack-starter

Esta guía describe el modelo de seguridad de los microservicios y los
pasos manuales obligatorios antes de desplegar.

## Modelo de confianza

```mermaid
flowchart LR
    Client(["🌐 Cliente"])

    subgraph priv ["🔒 internal-network · internal: true"]
        direction LR
        Nginx["Nginx · <b>front</b><br/>SPA + proxy /api/*"]
        Gateway["<b>Gateway</b><br/>JWT_ACCESS_SECRET / JWT_REFRESH_SECRET (HS256)<br/>INTERNAL_JWT_PRIVATE_KEY (Ed25519, firma)"]
        API["<b>API</b><br/>INTERNAL_JWT_PUBLIC_KEY (Ed25519, sólo verifica)"]
        DB[("PostgreSQL")]

        Nginx -->|"proxy_pass /api/"| Gateway
        Gateway -->|"X-Internal-Auth · EdDSA"| API
        API --> DB
    end

    Client ==>|"cookie + Authorization<br/>única puerta pública"| Nginx

    classDef public fill:#1f6feb,stroke:#0b3d91,color:#fff;
    class Nginx public;
```

- **Nginx** (contenedor `front`) es la puerta pública: sirve la SPA y hace
  reverse-proxy de `/api/*` al gateway (mismo origen, para que las cookies
  viajen sin CORS). El cliente nunca contacta al gateway directamente.
- **Gateway** vive en `internal-network` (privado, sin entrada desde Internet) —
  es el servicio que firma los tokens de cara al cliente y proxia hacia el api
  privado. Posee:
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

| Token   | Secreto              | TTL                                                                                     | Reside en              |
| ------- | -------------------- | --------------------------------------------------------------------------------------- | ---------------------- |
| Access  | `JWT_ACCESS_SECRET`  | `JWT_EXPIRES_IN` (4h)                                                                   | Header `Authorization` |
| Refresh | `JWT_REFRESH_SECRET` | `JWT_REFRESH_EXPIRES_IN` (8h; `JWT_REFRESH_REMEMBER_DAYS`, 30 por defecto, si remember) | Cookie HttpOnly Secure |

Los tokens del cliente además llevan `iss`/`aud` (`gateway`/`web`) que el
gateway verifica, de modo que un token emitido para otro contexto no se puede
reutilizar aquí. En cada **rotación** el gateway re-lee los permisos del usuario
desde el API (fuente autoritativa) en lugar de copiarlos del refresh viejo, así
que una cuenta degradada/revocada o borrada pierde acceso en la siguiente
rotación, no al cabo de toda la vida del refresh.

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
- En `logout`, el gateway revoca la **familia completa** (no sólo el `jti`
  presentado): el `familyId` viaja dentro del refresh JWT, de modo que cerrar
  sesión termina el linaje entero.

## Token interno: suposición de red y replay

El token interno (`X-Internal-Auth`, EdDSA) que el gateway firma para llamar al
API es **de un solo request y de vida muy corta** (TTL 60s, ver
`internal-auth.constants.ts`). Lleva un `requestId` de correlación, pero el
verificador **no** impone unicidad (no hay store de `jti`/nonce). En
consecuencia:

> **Suposición de seguridad explícita.** Dentro de su ventana de TTL (60s, más
> una tolerancia de reloj de 5s), un `X-Internal-Auth` capturado podría
> **reusarse** contra el API. Esto está mitigado por el diseño de red: el token
> **nunca sale de `internal-network`** (red `internal: true`, sin entrada desde
> Internet) y el gateway es la única puerta pública. Explotarlo requiere estar
> ya **dentro** de la red interna, o un SSRF/leak separado.

El `requestId` lo **genera siempre el gateway en servidor** (`randomUUID()`); el
API deriva el `requestId` del token verificado, nunca de una cabecera entrante
del cliente. El gateway, además, hace _strip_ de cualquier `x-internal-auth` /
`x-request-id` entrante antes de proxiar.

**Si el borde interno llegara a ser cruzado por servicios menos confiables**
(p. ej. una malla de servicios multirust), endurecer añadiendo una caché de
`jti` de corta vida en `verifyInternalAuth` para rechazar replays: incluir un
`jti` único en el token interno y registrar los vistos durante su TTL.

## Pasos manuales antes de levantar

### 1. Generar los secretos del cliente

```bash
# Cada uno debe ser fuerte y distinto al otro
JWT_ACCESS_SECRET=$(openssl rand -base64 64 | tr -d '\n')
JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')
```

### 2. Generar el par Ed25519 para `INTERNAL_JWT_*`

**Recomendado** — usá el script, que emite las dos líneas listas para pegar
en `.env` con el formato correcto (una línea, entre comillas, con `\n`):

```bash
bash scripts/gen-internal-keys.sh
```

Salida (copiar tal cual en el `.env`):

```env
INTERNAL_JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
INTERNAL_JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

El script detecta un openssl con soporte Ed25519 (en macOS el LibreSSL del
sistema **no** lo soporta) y, si no lo encuentra, genera con Node. No escribe
ningún archivo a disco.

> **Formato — el origen de los fallos de arranque más comunes.** La clave
> **debe** ir en una sola línea entre comillas dobles con `\n` literales:
>
> - PEM multilínea **sin comillas** → dotenv lo trunca en el primer salto y
>   jose falla con `Invalid keyData / Failed to read private key`.
> - `\n` escapado de más (`\\n`) → `jose` lanza `InvalidCharacterError` en
>   `atob`. El normalizador (`normalisePem`) sólo consume un backslash.
>
> El script ya produce el formato seguro; evitá el escapado manual.

<details>
<summary>Alternativa manual (sin el script)</summary>

```bash
openssl genpkey -algorithm ed25519 -out internal_private.pem
openssl pkey -in internal_private.pem -pubout -out internal_public.pem

# Convertir cada PEM a una sola línea con `\n` literales y entre comillas:
echo "INTERNAL_JWT_PRIVATE_KEY=\"$(awk 'NF {printf "%s\\n", $0}' internal_private.pem | sed 's/\\n$//')\""
echo "INTERNAL_JWT_PUBLIC_KEY=\"$(awk 'NF {printf "%s\\n", $0}' internal_public.pem | sed 's/\\n$//')\""
```

</details>

### 3. Volcar al `.env`

```env
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
INTERNAL_JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
INTERNAL_JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
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
