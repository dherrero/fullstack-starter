import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UniqueConstraintError } from 'sequelize';
import { Permission } from '@dto';
import { FederatedIdentity, User } from '@api/models';
import federatedIdentityService from './federated-identity.service';

vi.mock('@api/adapters/db/pg.connector', () => ({
  db: {
    // Run the callback with a dummy transaction; propagate throws like the real one.
    transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb({})),
  },
}));

vi.mock('@api/models', () => ({
  FederatedIdentity: { findOne: vi.fn(), create: vi.fn() },
  User: { findOne: vi.fn(), create: vi.fn() },
}));

const baseInput = {
  provider: 'okta',
  subject: 'okta|123',
  email: 'alice@corp.com',
  emailVerified: true,
  suggestedPermissions: [] as Permission[],
};

describe('FederatedIdentityService.resolveOrProvision', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves an existing identity to its stored user and ignores suggested permissions', async () => {
    vi.mocked(FederatedIdentity.findOne).mockResolvedValue({
      userId: 5,
    } as never);
    vi.mocked(User.findOne).mockResolvedValue({
      id: 5,
      email: 'alice@corp.com',
      permissions: [Permission.READ_SOME_ENTITY],
    } as never);

    const result = await federatedIdentityService.resolveOrProvision({
      ...baseInput,
      suggestedPermissions: [Permission.ADMIN],
    });

    expect(result).toEqual({
      id: 5,
      email: 'alice@corp.com',
      permissions: [Permission.READ_SOME_ENTITY],
    });
    // No write happened — existing identity is read-only here.
    expect(User.create).not.toHaveBeenCalled();
    expect(FederatedIdentity.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown identity when the email is not verified', async () => {
    vi.mocked(FederatedIdentity.findOne).mockResolvedValue(null);

    await expect(
      federatedIdentityService.resolveOrProvision({
        ...baseInput,
        emailVerified: false,
      }),
    ).rejects.toThrow('Federated identity could not be resolved.');
    expect(User.create).not.toHaveBeenCalled();
  });

  it('links a new identity to an existing local user without changing its permissions', async () => {
    vi.mocked(FederatedIdentity.findOne).mockResolvedValue(null);
    vi.mocked(User.findOne).mockResolvedValue({
      id: 7,
      email: 'alice@corp.com',
      permissions: [Permission.WRITE_SOME_ENTITY],
    } as never);
    vi.mocked(FederatedIdentity.create).mockResolvedValue({} as never);

    const result = await federatedIdentityService.resolveOrProvision({
      ...baseInput,
      suggestedPermissions: [Permission.ADMIN],
    });

    expect(result.id).toBe(7);
    expect(result.permissions).toEqual([Permission.WRITE_SOME_ENTITY]);
    expect(User.create).not.toHaveBeenCalled();
    expect(FederatedIdentity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        provider: 'okta',
        subject: 'okta|123',
      }),
      expect.anything(),
    );
  });

  it('provisions a new federated user with no password and strips ADMIN', async () => {
    vi.mocked(FederatedIdentity.findOne).mockResolvedValue(null);
    vi.mocked(User.findOne).mockResolvedValue(null);
    vi.mocked(User.create).mockResolvedValue({
      id: 10,
      email: 'alice@corp.com',
      permissions: [Permission.WRITE_SOME_ENTITY],
    } as never);
    vi.mocked(FederatedIdentity.create).mockResolvedValue({} as never);

    const result = await federatedIdentityService.resolveOrProvision({
      ...baseInput,
      suggestedPermissions: [Permission.ADMIN, Permission.WRITE_SOME_ENTITY],
    });

    expect(result.id).toBe(10);
    const createArgs = vi.mocked(User.create).mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(createArgs.password).toBeNull();
    expect(createArgs.authSource).toBe('federated');
    expect(createArgs.permissions).toEqual([Permission.WRITE_SOME_ENTITY]);
    expect(createArgs.permissions).not.toContain(Permission.ADMIN);
  });

  it('defaults to least privilege when no valid permission is suggested', async () => {
    vi.mocked(FederatedIdentity.findOne).mockResolvedValue(null);
    vi.mocked(User.findOne).mockResolvedValue(null);
    vi.mocked(User.create).mockResolvedValue({
      id: 11,
      email: 'alice@corp.com',
      permissions: [Permission.READ_SOME_ENTITY],
    } as never);
    vi.mocked(FederatedIdentity.create).mockResolvedValue({} as never);

    await federatedIdentityService.resolveOrProvision({
      ...baseInput,
      suggestedPermissions: [Permission.ADMIN],
    });

    const createArgs = vi.mocked(User.create).mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(createArgs.permissions).toEqual([Permission.READ_SOME_ENTITY]);
  });

  it('is idempotent under a concurrent create race (unique violation → re-query)', async () => {
    vi.mocked(FederatedIdentity.findOne)
      .mockResolvedValueOnce(null) // initial lookup: not found
      .mockResolvedValueOnce({ userId: 9 } as never); // re-query after the race
    vi.mocked(User.findOne)
      .mockResolvedValueOnce(null) // no local user by email
      .mockResolvedValueOnce({
        id: 9,
        email: 'alice@corp.com',
        permissions: [Permission.READ_SOME_ENTITY],
      } as never); // re-query resolves the winner
    vi.mocked(User.create).mockResolvedValue({ id: 9 } as never);
    vi.mocked(FederatedIdentity.create).mockRejectedValue(
      new UniqueConstraintError({}),
    );

    const result = await federatedIdentityService.resolveOrProvision(baseInput);

    expect(result.id).toBe(9);
  });
});
