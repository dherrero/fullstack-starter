import { db } from '@api/adapters/db/pg.connector';
import {
  FederatedIdentity,
  FederatedIdentityModel,
  User,
  UserModel,
} from '@api/models';
import {
  Permission,
  ResolveFederatedUserRequestDTO,
  ResolveFederatedUserResponseDTO,
} from '@dto';
import { InferCreationAttributes, UniqueConstraintError } from 'sequelize';

/**
 * Resolves or just-in-time provisions a local user from a federated identity
 * the gateway has ALREADY validated (ID token signature, iss, aud, exp, nonce).
 *
 * Security model:
 * - An existing federated identity always resolves to its stored user, whose
 *   permissions are authoritative — the gateway's `suggestedPermissions` are
 *   never applied to an existing account, so a manipulated group claim cannot
 *   escalate privileges on a live user.
 * - A new identity is only accepted when the IdP asserts `emailVerified === true`
 *   (account-takeover defense against unverified / spoofable email claims).
 * - Provisioned accounts never receive ADMIN automatically and carry no local
 *   password (`auth_source = 'federated'`), so they cannot log in via /login.
 */
class FederatedIdentityService {
  resolveOrProvision = async (
    input: ResolveFederatedUserRequestDTO,
  ): Promise<ResolveFederatedUserResponseDTO> => {
    const { provider, subject, emailVerified, suggestedPermissions } = input;
    // Normalise like local users are stored (lowercased + trimmed) so linking
    // matches by email reliably and never provisions a case-variant duplicate.
    const email = input.email.trim().toLowerCase();

    // 1. Known identity → authoritative stored user (ignore suggested perms).
    const existing = await this.#findUserByIdentity(provider, subject);
    if (existing) return this.#toResponse(existing);

    // 2. Unknown identity. Never link/provision on an unverified email.
    if (emailVerified !== true) {
      throw new Error('Federated identity could not be resolved.');
    }

    try {
      return await db.transaction(async (transaction) => {
        // 2a. Link to an existing local user sharing the verified email.
        const localUser = await User.findOne({
          where: { email, deleted: false },
          transaction,
        });
        if (localUser) {
          await FederatedIdentity.create(
            this.#identityAttrs(localUser.id, provider, subject, email),
            { transaction },
          );
          // Permissions stay exactly as stored — no claim-driven change.
          return this.#toResponse(localUser);
        }

        // 2b. Provision a brand-new federated user (no local credential).
        const created = await User.create(
          {
            email,
            name: email.split('@')[0] || email,
            lastName: '',
            password: null,
            authSource: 'federated',
            permissions: this.#sanitizePermissions(suggestedPermissions),
            deleted: false,
          } as InferCreationAttributes<UserModel>,
          { transaction },
        );
        await FederatedIdentity.create(
          this.#identityAttrs(created.id, provider, subject, email),
          { transaction },
        );
        return this.#toResponse(created);
      });
    } catch (err) {
      // Concurrent request won the race and created the identity first:
      // re-query by the natural key and return the winner (idempotency).
      if (err instanceof UniqueConstraintError) {
        const raced = await this.#findUserByIdentity(provider, subject);
        if (raced) return this.#toResponse(raced);
      }
      throw err;
    }
  };

  #findUserByIdentity = async (
    provider: string,
    subject: string,
  ): Promise<UserModel | null> => {
    const identity = await FederatedIdentity.findOne({
      where: { provider, subject, deleted: false },
    });
    if (!identity) return null;
    return await User.findOne({
      where: { id: identity.userId, deleted: false },
    });
  };

  #identityAttrs = (
    userId: number,
    provider: string,
    subject: string,
    email: string,
  ): InferCreationAttributes<FederatedIdentityModel> =>
    ({
      userId,
      provider,
      subject,
      emailAtLink: email,
      deleted: false,
    }) as InferCreationAttributes<FederatedIdentityModel>;

  #toResponse = (user: UserModel): ResolveFederatedUserResponseDTO => ({
    id: user.id as number,
    email: user.email,
    permissions: user.permissions ?? [],
  });

  /**
   * Never auto-grant ADMIN through federation and drop unknown values; fall
   * back to least privilege when nothing valid remains.
   */
  #sanitizePermissions = (suggested: Permission[]): Permission[] => {
    const allowed = Object.values(Permission);
    const valid = (suggested ?? []).filter(
      (p) => allowed.includes(p) && p !== Permission.ADMIN,
    );
    return valid.length > 0
      ? Array.from(new Set(valid))
      : [Permission.READ_SOME_ENTITY];
  };
}

const federatedIdentityService = new FederatedIdentityService();
export default federatedIdentityService;
