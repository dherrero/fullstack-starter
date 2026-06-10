import { CreationOptional, Permission } from './rest-dto';

/**
 * Mirrors the `federated_identity` table.
 * `subject` is the IdP-issued opaque identifier — it is internal and must not
 * be forwarded to the frontend.
 */
export interface FederatedIdentityDTO {
  id: CreationOptional<number>;
  userId: number;
  provider: string;
  subject: string;
  emailAtLink?: string;
  deleted: boolean;
  createdAt: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

/**
 * Public metadata the frontend needs to render login buttons.
 * MUST NOT contain `clientSecret`, `issuer` internals, raw IdP claims,
 * `subject`, or any other secret/internal field.
 * `id` is the provider key used in the login URL `/auth/sso/:id/login`.
 */
export interface SsoProviderPublicDTO {
  id: string;
  displayName: string;
  iconKey?: string;
}

/**
 * Input the gateway sends to the API's internal federated resolve/provision
 * endpoint after it has cryptographically validated the IdP ID token.
 * The gateway only forwards claims it has fully verified; it never forwards
 * raw tokens or unverified assertions.
 * `suggestedPermissions` is derived from the provider's group→permission map
 * and is a SUGGESTION — the API may floor it to a minimum and must not treat
 * it as authoritative.
 */
export interface ResolveFederatedUserRequestDTO {
  provider: string;
  subject: string;
  email: string;
  emailVerified: boolean;
  suggestedPermissions: Permission[];
}

/**
 * Output of the federated resolve/provision endpoint.
 * Never returns `subject` or any secret to layers that do not need them.
 * `permissions` are server-side derived by the API and are authoritative.
 */
export interface ResolveFederatedUserResponseDTO {
  id: number;
  email: string;
  permissions: Permission[];
}

/**
 * Shape for mapping an IdP group/role claim value to local permissions.
 * Used by the gateway provider registry configuration.
 */
export type ClaimPermissionMapping = {
  claim: string;
  permissions: Permission[];
};
