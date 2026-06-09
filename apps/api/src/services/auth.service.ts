import { User, UserModel } from '@api/models';
import { compare, hash } from 'bcrypt';

/**
 * Internal auth service. Only validates stored credentials and hashes
 * new passwords — JWT issuance and verification live in the gateway.
 */
class AuthService {
  validateCredentials = async (
    email: string,
    password: string,
  ): Promise<UserModel> => {
    const user: UserModel = await User.findOne({
      where: { email, deleted: false },
    });
    if (!user) throw new Error('Email or password incorrect.');
    const validPassword = await this.#comparePassword(password, user.password);
    if (!validPassword) throw new Error('Email or password incorrect.');
    return user;
  };

  // findOne (not findByPk) so the soft-delete filter is actually enforced:
  // a soft-deleted account must never be resolvable for auth purposes.
  getUser = async (id: number): Promise<UserModel> =>
    await User.findOne({ where: { id, deleted: false } });

  hashPassword = async (password: string) => {
    // bcrypt expects a NUMBER of rounds; a string is treated as a pre-generated
    // salt and silently changes behaviour. Parse it and enforce a sane modern
    // minimum cost (12).
    const MIN_ROUNDS = 12;
    const parsed = parseInt(process.env.HASH_SALT_ROUNDS ?? '', 10);
    const rounds =
      Number.isFinite(parsed) && parsed >= MIN_ROUNDS ? parsed : MIN_ROUNDS;
    return await hash(password, rounds);
  };

  #comparePassword = async (password: string, hash: string) => {
    return await compare(password, hash);
  };
}

const authService = new AuthService();

export default authService;
