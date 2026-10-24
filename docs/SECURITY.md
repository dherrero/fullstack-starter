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

## Federación OIDC (SSO: Okta · Azure AD · Auth0)

El gateway actúa como **Relying Party (RP) OIDC**. Hace todo el handshake y
termina convirtiendo la identidad federada en **la misma sesión local** de
siempre (access JWT + cookie refresh con familia/rotación). El API nunca habla
con el IdP y sigue confiando **solo** en el JWT interno EdDSA. Sin proveedores
configurados, el SSO está desactivado y el sistema se comporta igual que hoy.

### Flujo

```
browser ──/auth/sso/:p/login──▶ gateway  (state+nonce+PKCE → cookie tx firmada)
   │                                │ 302
   ▼                                ▼
  IdP  ◀── authorization_endpoint ──┘
   │ login del usuario
   ▼ 302 con code+state
browser ──/auth/sso/:p/callback──▶ gateway
                                    │ valida state (cookie) + provider (mix-up)
                                    │ canjea code con PKCE; openid-client valida
                                    │ el ID token (firma/JWKS, iss, aud, exp, nonce)
                                    │ mapea grupos→permisos (sugerencia)
                                    │ ApiClient.resolveFederatedUser (scope
                                    │   federated.identity) → usuario local
                                    │ respondWithTokens (sesión local estándar)
                                    ▼ 302 a returnTo (allowlist same-site)
```

### Decisiones de seguridad

- **Authorization Code + PKCE (S256)** — nunca implicit flow.
- **state** anti-CSRF y **nonce** anti-replay viven en una **cookie de
  transacción JWT firmada, HttpOnly, SameSite=Lax** (Lax es obligatorio para
  sobrevivir el redirect cross-site del IdP), TTL 5 min, single-use.
- **Validación del ID token** delegada a `openid-client` (firma vía JWKS, `iss`,
  `aud`, `exp`, `nonce`); algoritmos seguros, `alg:none` rechazado.
- **Mix-up multi-IdP**: el callback se ata al proveedor que inició el flujo.
- **Account takeover**: solo se vincula/aprovisiona con `email_verified === true`.
  Usuarios existentes conservan sus permisos almacenados (los claims de grupos
  son _sugerencia_, nunca autoritativos sobre una cuenta viva).
- **Escalada de privilegios**: el aprovisionamiento JIT **nunca** concede ADMIN
  y aplica mínimo privilegio por defecto. Los permisos son autoritativos en el
  API, no en el cliente.
- **Usuarios federados sin contraseña local** (`password = NULL`,
  `auth_source = 'federated'`); `validateCredentials` rechaza el login local de
  cuentas con password NULL o `auth_source != 'local'` (cierra el bypass).
- **SSRF** en discovery/JWKS: solo issuers `https`, con bloqueo de
  loopback/link-local/metadata (169.254.169.254)/RFC1918. Escape hatch
  `SSO_ALLOW_INSECURE_ISSUERS` solo dev.
- **Open redirect**: `returnTo` y `post_logout_redirect_uri` restringidos a
  rutas same-site (se rechazan absolutas, `//`, `\\`, `javascript:`, control).
- **Sin fuga de secretos/errores**: `client_secret` solo en el gateway, nunca
  logueado; los `error_description` del IdP nunca se reflejan (redirect genérico
  `/login?sso_error=1`).
- **Logout federado** (RP-initiated `end_session`): siempre revoca la familia de
  refresh local primero (IdP caído nunca mantiene viva la sesión), luego redirige
  al `end_session_endpoint` con `id_token_hint` (en cookie firmada HttpOnly).
  **Back-channel logout** queda fuera de alcance del starter (requiere endpoint
  receptor de logout_token con validación de firma/`events`); el RP-initiated
  cubre el caso principal sin estado de servidor adicional.

### Alta de un proveedor

1. Registrá la app en el IdP. El **callback URL** debe ser **exacto** (sin
   comodines): `https://<tu-dominio>/api/v1/auth/sso/<name>/callback`.
2. Definí en el entorno del **gateway** (ver `.env.example`):
   `SSO_<NAME>_ISSUER`, `_CLIENT_ID`, `_CLIENT_SECRET`, `_REDIRECT_URI` y,
   opcionalmente, `_SCOPES`, `_GROUPS_CLAIM`, `_PERMISSION_MAP`,
   `_POST_LOGOUT_REDIRECT_URI`, `_DISPLAY_NAME`, `_ICON_KEY`.
3. Configurá `SSO_STATE_SECRET` (secreto dedicado en producción).
4. `<NAME>` (en minúsculas) es el id del proveedor. El front pinta un botón por
   proveedor desde `GET /api/v1/auth/sso/providers` (solo metadatos públicos).

## Federación SAML 2.0 (tenants legacy)

Para IdPs corporativos que no hablan OIDC (ADFS, Shibboleth, Okta-SAML,
Azure AD SAML), el gateway actúa como **Service Provider (SP) SAML 2.0**,
**solo SP-initiated**. Termina en **la misma sesión local** que OIDC/local
(access JWT + cookie refresh con familia/rotación); el API sigue confiando
**solo** en el JWT interno EdDSA y nunca habla con el IdP. Sin proveedores
`SAML_*` configurados, SAML está desactivado y nada cambia. Núcleo
criptográfico: `@node-saml/node-saml` (con `xml-crypto`), endurecido en
`apps/gateway/src/sso/saml-client.ts`.

### Flujo (SP-initiated)

```
browser ──/auth/sso/:p/login──▶ gateway  (AuthnRequest id CSPRNG + returnTo
   │                                │      → cookie tx firmada; RelayState vacío)
   ▼                                │ 302 (HTTP-Redirect, SAMLRequest deflate+b64)
  IdP  ◀── entryPoint (SSO URL) ────┘
   │ login del usuario
   ▼ 302 / auto-POST con SAMLResponse
browser ──POST /auth/sso/:p/callback──▶ gateway (ACS, HTTP-POST binding)
                                    │ tx cookie single-use atada al provider
                                    │ node-saml: firma de Response Y Assertion
                                    │   contra cert(s) PINNED del registry,
                                    │   Status, Conditions/skew, AudienceRestriction
                                    │ controller: Issuer==idpIssuer (mix-up),
                                    │   InResponseTo==tx.requestId, NameID estable,
                                    │   email plausible ∈ allowedDomains
                                    │ grupos→permisos (sugerencia)
                                    │ ApiClient.resolveFederatedUser → usuario local
                                    │ respondWithTokens (sesión local estándar)
                                    ▼ 302 a returnTo (de la cookie, allowlist same-site)
```

Metadata del SP para el onboarding del IdP:
`GET /api/v1/auth/sso/:p/metadata` (`application/samlmetadata+xml`, público,
sin material privado).

### Modelo de amenazas y decisiones

- **Solo SP-initiated**: el ACS **exige** la cookie de transacción firmada y
  que `InResponseTo` case con el `AuthnRequest` id que la inició. Una Response
  sin transacción (IdP-initiated) se rechaza por diseño — cierra CSRF en una
  ruta que es necesariamente exenta de CSRF por cookie, y bloquea respuestas no
  solicitadas.
- **Firma exigida en Response Y Assertion** (`wantAuthnResponseSigned` +
  `wantAssertionsSigned`, ambos literal `true`, no relajables por env), validada
  **solo** contra los certificados pinned del registry — **nunca** contra certs
  embebidos en la propia respuesta (trust bypass).
- **Anti-XSW (XML Signature Wrapping)**: node-saml valida el nodo firmado
  correcto; el e2e inyecta una aserción forjada junto a la firmada y exige
  rechazo.
- **Anti-XXE**: el parser de `@xmldom/xmldom` no resuelve entidades externas.
- **NameID persistente** (o `emailAddress`); **`transient` se rechaza** — el par
  `(provider, subject)` debe ser estable para keyear la cuenta. `unspecified`
  también se rechaza (allowlist fail-closed).
- **Comment injection en NameID** (clase CVE-2017-11427): mitigado por la
  versión de `xml-crypto`/node-saml; el e2e prueba que `a@corp.com<!--x-->.evil`
  no resuelve a una identidad distinta de la firmada.
- **Replay**: cookie de transacción single-use (leída y borrada en todo camino)
  - `validateInResponseTo: always` con caché acotada + re-chequeo de
    `NotOnOrAfter` con skew ≤30s.
- **Mix-up multi-IdP**: el `Issuer` de la Response debe ser exactamente el
  `idpIssuer` configurado del proveedor (chequeo explícito en el controller:
  node-saml solo aplica `idpIssuer` a mensajes de logout, no a la Response de
  login). Cada proveedor tiene su propio cert pinned.
- **AudienceRestriction** == entityID del SP (una aserción dirigida a otro SP se
  rechaza).
- **Account takeover / cross-tenant**: SAML no transporta una señal
  `email_verified` por aserción, así que el ACS sella `emailVerified: true` (el
  IdP del tenant es autoritativo para su dominio y lo configura el operador). Por
  eso **`SAML_<NAME>_ALLOWED_DOMAINS` es OBLIGATORIO** (fail-fast al arranque si
  falta): es el **único cerco** que impide que una aserción firmada asevere un
  email arbitrario y se auto-vincule a una cuenta local/de otro tenant
  preexistente. El email asertado debe estar dentro del allowlist o se rechaza.
- **Escalada por atributo de grupos**: `mapGroupsToPermissions` es solo
  _sugerencia_; el API aplica suelo de privilegio, **nunca** concede ADMIN por
  federación y no muta los permisos de una cuenta viva.
- **RelayState nunca se usa para el redirect final**: el `returnTo` viaja solo
  en la cookie firmada y se re-valida con `safeReturnTo` (same-site; se rechazan
  absolutas, `//`, `\\`, control). El e2e prueba que un `RelayState` externo no
  se sigue.
- **SSRF** en `entryPoint`/`logoutUrl`: solo `https`, con bloqueo de
  loopback/link-local/metadata (169.254.169.254)/RFC1918 (mismo guard que OIDC);
  el bloqueo de metadata/`0.0.0.0` es incondicional incluso con
  `SSO_ALLOW_INSECURE_ISSUERS` (escape hatch solo-dev para loopback/RFC1918).
- **Certificados**: el registry rechaza al arranque certs caducados, RSA <2048
  bits y `sha1`; avisa si expiran en <30 días. Rotación sin downtime con
  multi-cert (separador `;`). Las claves/certs y `_DECRYPTION_PVK` nunca aparecen
  en logs, errores, metadata ni respuestas públicas.
- **Sin fuga de errores/IdP**: el ACS jamás refleja `StatusMessage`/XML del IdP;
  redirect genérico `/login?sso_error=1`; log interno con `requestId`, control
  chars eliminados y truncado.
- **SLO best-effort**: el logout **siempre** revoca la familia de refresh local
  y limpia cookies **antes** de cualquier ida al IdP (un IdP caído nunca mantiene
  viva la sesión). Si el proveedor tiene `_LOGOUT_URL` se emite un
  `LogoutRequest` (HTTP-Redirect) con el `NameID`+`SessionIndex` del hint firmado
  (cookie HttpOnly). El `LogoutResponse` se valida best-effort y cualquier fallo
  se ignora: para cuando el IdP nos devuelve, la sesión local ya está revocada,
  así que un `LogoutResponse` falsificado no produce cambio de estado.
- **SLO IdP-initiated FUERA DE ALCANCE** en esta iteración (espejo del
  back-channel logout de OIDC). Riesgo residual: si el logout se origina en el
  IdP, la sesión local sigue viva hasta que expire/rote el refresh. El
  `LogoutRequest` SP→IdP es **sin firmar** (el starter no gestiona clave privada
  del SP); documentado y aceptado.

### Alta de un IdP SAML legacy

1. **Onboarding del IdP**: pasale la metadata del SP
   (`GET /api/v1/auth/sso/<name>/metadata`) o, a mano: entityID = SP issuer,
   **ACS exacto** (sin comodines)
   `https://<tu-dominio>/api/v1/auth/sso/<name>/callback`, NameIDFormat
   `persistent`.
2. **Configurá en el entorno del gateway** (ver `.env.example`, bloque
   `SAML_<NAME>_*`): `_ENTRY_POINT` (SSO URL del IdP), `_IDP_ISSUER` (entityID
   del IdP), `_IDP_CERT` (PEM x509 público del IdP; multi-cert con `;` para
   rotación), `_CALLBACK_URL` (ACS exacto) y **`_ALLOWED_DOMAINS` (obligatorio)**.
   Opcionales: `_SP_ISSUER`, `_EMAIL_ATTRIBUTE`, `_GROUPS_ATTRIBUTE`,
   `_PERMISSION_MAP`, `_LOGOUT_URL`, `_SIGNATURE_ALGORITHM` (sha256|sha512),
   `_DECRYPTION_PVK`, `_FORCE_AUTHN`, `_DISABLE_REQUESTED_AUTHN_CONTEXT`,
   `_DISPLAY_NAME`, `_ICON_KEY`.
3. **Rotación de certificados**: durante el solape, poné ambos PEM en `_IDP_CERT`
   separados por `;`; la validación acepta cualquiera de la lista. Quitá el viejo
   tras la rotación.
4. `<NAME>` (en minúsculas) es el id del proveedor (clave en
   `federated_identity.provider`; no puede colisionar con un id OIDC). El front
   pinta un botón por proveedor desde `GET /api/v1/auth/sso/providers`.
