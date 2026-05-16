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
    const user: UserModel = await User.findOne({ where: { email } });
    if (!user) throw new Error('Email or password incorrect.');
    const validPassword = await this.#comparePassword(password, user.password);
    if (!validPassword) throw new Error('Email or password incorrect.');
    return user;
  };

  getUser = async (id: number): Promise<UserModel> => await User.findByPk(id);

  hashPassword = async (password: string) => {
    return await hash(password, process.env.HASH_SALT_ROUNDS ?? 10);
  };

  #comparePassword = async (password: string, hash: string) => {
    return await compare(password, hash);
  };
}

const authService = new AuthService();

export default authService;
