import { User, UserModel } from '@back/models';
import { compare, hash } from 'bcrypt';
import jwt from 'jsonwebtoken';

class AuthService {
  #secret = process.env.JWT_SECRET;

  login = async (email: string, password: string): Promise<UserModel> => {
    const user: UserModel = await User.findOne({ where: { email } });
    if (!user) throw new Error('Email or password incorrect.');
    const validPassword = await this.#comparePassword(password, user.password);
    if (!validPassword) throw new Error('Email or password incorrect.');
    return user;
  };

  getUser = async (id: number): Promise<UserModel> => await User.findByPk(id);

  generateToken = async (payload, expiresIn: string) => {
    return jwt.sign(payload, this.#secret, { expiresIn });
  };

  verifyToken = (token: string) => {
    return jwt.verify(token, this.#secret);
  };

  hashPassword = async (password: string) => {
    return await hash(password, process.env.HASH_SALT_ROUNDS ?? 10);
  };

  #comparePassword = async (password: string, hash: string) => {
    return await compare(password, hash);
  };
}

const authService = new AuthService();

export default authService;
