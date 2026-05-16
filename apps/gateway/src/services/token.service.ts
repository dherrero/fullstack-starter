import { Permission } from '@dto';
import jwt, { JwtPayload } from 'jsonwebtoken';

export interface ClientTokenPayload extends JwtPayload {
  id: number;
  email: string;
  permissions: Permission[];
  remember?: boolean;
}

export interface RefreshTokenPayload {
  id: number;
  email?: string;
  permissions?: Permission[];
  remember?: boolean;
}

class TokenService {
  #secret = () => process.env.JWT_SECRET ?? '';

  generateAccessToken = async (
    payload: Omit<ClientTokenPayload, 'exp' | 'iat'>,
  ) =>
    jwt.sign(payload, this.#secret(), {
      expiresIn:
        (process.env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']) ?? '4h',
    });

  generateRefreshToken = async (payload: RefreshTokenPayload) => {
    const expiresIn = (
      payload.remember ? '365d' : (process.env.JWT_REFRESH_EXPIRES_IN ?? '8h')
    ) as jwt.SignOptions['expiresIn'];
    return jwt.sign(payload, this.#secret(), { expiresIn });
  };

  verifyToken = (token: string): ClientTokenPayload =>
    jwt.verify(token, this.#secret()) as ClientTokenPayload;
}

const tokenService = new TokenService();
export default tokenService;
