import { Permission } from '@dto';
import { randomUUID } from 'crypto';
import jwt, { JwtPayload } from 'jsonwebtoken';

export type ClientTokenType = 'access' | 'refresh';

export interface AccessTokenPayload extends JwtPayload {
  id: number;
  email: string;
  permissions: Permission[];
  typ: 'access';
  jti: string;
}

export interface RefreshTokenPayload extends JwtPayload {
  id: number;
  email: string;
  permissions: Permission[];
  remember?: boolean;
  typ: 'refresh';
  jti: string;
}

export interface AccessTokenInput {
  id: number;
  email: string;
  permissions: Permission[];
  jti?: string;
}

export interface RefreshTokenInput {
  id: number;
  email: string;
  permissions: Permission[];
  remember?: boolean;
  jti?: string;
}

/**
 * Public-facing token service.
 *
 * Access and refresh tokens are signed with separate secrets so the
 * compromise of one does not let an attacker forge the other. Each
 * token also carries:
 *   - `typ`: explicit token type, enforced on verification to prevent
 *     using a refresh token as an access token (or vice versa).
 *   - `jti`: unique identifier so the refresh family service can detect
 *     reuse of a rotated refresh token (see fix #2).
 */
class TokenService {
  #accessSecret = () => process.env.JWT_ACCESS_SECRET ?? '';
  #refreshSecret = () => process.env.JWT_REFRESH_SECRET ?? '';

  generateAccessToken = async (input: AccessTokenInput): Promise<string> => {
    if (!this.#accessSecret()) {
      throw new Error('JWT_ACCESS_SECRET is not configured');
    }
    const payload: Omit<AccessTokenPayload, 'iat' | 'exp'> = {
      id: input.id,
      email: input.email,
      permissions: input.permissions,
      typ: 'access',
      jti: input.jti ?? randomUUID(),
    };
    return jwt.sign(payload, this.#accessSecret(), {
      algorithm: 'HS256',
      expiresIn:
        (process.env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']) ?? '4h',
    });
  };

  generateRefreshToken = async (input: RefreshTokenInput): Promise<string> => {
    if (!this.#refreshSecret()) {
      throw new Error('JWT_REFRESH_SECRET is not configured');
    }
    const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
      id: input.id,
      email: input.email,
      permissions: input.permissions,
      remember: input.remember,
      typ: 'refresh',
      jti: input.jti ?? randomUUID(),
    };
    const expiresIn = (
      input.remember ? '365d' : (process.env.JWT_REFRESH_EXPIRES_IN ?? '8h')
    ) as jwt.SignOptions['expiresIn'];
    return jwt.sign(payload, this.#refreshSecret(), {
      algorithm: 'HS256',
      expiresIn,
    });
  };

  verifyAccessToken = (token: string): AccessTokenPayload => {
    const decoded = jwt.verify(token, this.#accessSecret(), {
      algorithms: ['HS256'],
    }) as AccessTokenPayload;
    if (decoded.typ !== 'access') {
      throw new Error(`Expected access token, got ${decoded.typ ?? 'unknown'}`);
    }
    return decoded;
  };

  verifyRefreshToken = (token: string): RefreshTokenPayload => {
    const decoded = jwt.verify(token, this.#refreshSecret(), {
      algorithms: ['HS256'],
    }) as RefreshTokenPayload;
    if (decoded.typ !== 'refresh') {
      throw new Error(
        `Expected refresh token, got ${decoded.typ ?? 'unknown'}`,
      );
    }
    return decoded;
  };
}

const tokenService = new TokenService();
export default tokenService;
