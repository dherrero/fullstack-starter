import { ClaimPermissionMapping } from '@dto';

/**
 * Full, secret-bearing configuration of one SAML 2.0 provider.
 * Lives ONLY in the gateway — never serialised to the client.
 * Use {@link SsoProviderPublicDTO} (from `@dto`) for anything the browser may see.
 *
 * Mirrors the shape of {@link SsoProviderConfig} (OIDC) in `provider-registry.ts`
 * so the two registries remain structurally consistent.
 *
 * Security notes:
 * - `idpCertPems` and `decryptionPvk` are cryptographic material; treat them as
 *   secrets and keep them out of logs, responses, and error messages.
 * - `wantAssertionsSigned` is typed as the literal `true` so the compiler prevents
 *   any code path from weakening assertion-signing requirements.
 * - `sha1` is not an accepted `signatureAlgorithm` value by design (broken algorithm).
 */
export interface SamlProviderConfig {
  /** Lowercased provider key, used in `/auth/sso/:id/login`. */
  id: string;
  displayName: string;
  iconKey?: string;
  /** SSO URL of the IdP (HTTP-Redirect binding). */
  entryPoint: string;
  /** SP entityID — our service's identifier sent to the IdP. */
  issuer: string;
  /**
   * EntityID of the IdP.
   * Validated against the `Issuer` element in the SAML response to prevent
   * mix-up attacks where a response from a different IdP is accepted.
   */
  idpIssuer: string;
  /**
   * One or more X.509 certificate(s) PEM-encoded from the IdP, used to verify
   * response signatures. Multiple entries support certificate rotation without
   * downtime — validation succeeds if any cert in the list matches.
   * Must contain at least one entry.
   */
  idpCertPems: string[];
  /** Assertion Consumer Service URL — must exactly match what is registered at the IdP. */
  callbackUrl: string;
  /**
   * XML digital-signature algorithm for the AuthnRequest.
   * `sha1` is intentionally excluded (cryptographically broken).
   */
  signatureAlgorithm: 'sha256' | 'sha512';
  /**
   * Require the IdP to sign individual assertions (not only the outer Response).
   * Typed as the literal `true` — this requirement must never be relaxed.
   */
  wantAssertionsSigned: true;
  /**
   * Optional allowlist of email domains accepted from this IdP.
   * When present, users whose email domain is not in the list are rejected
   * after assertion validation, before local account resolution.
   */
  allowedDomains?: string[];
  /** Name of the SAML attribute carrying the user's group/role memberships. */
  groupsAttribute: string;
  /** Name of the SAML attribute carrying the user's email address. */
  emailAttribute: string;
  /**
   * Mapping from IdP group/role claim values to local permissions.
   * Treated as a SUGGESTION by the API — the API may floor it to a minimum.
   */
  permissionMap: ClaimPermissionMapping[];
  /** Optional SLO (Single Logout) endpoint of the IdP. */
  logoutUrl?: string;
  /**
   * Private key (PEM) for decrypting encrypted SAML assertions.
   * Secret — must never appear in logs, serialised responses, or error output.
   */
  decryptionPvk?: string;
}
