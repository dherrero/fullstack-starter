import { Permission } from '@dto';
import {
  INTERNAL_AUTH_HEADER,
  INTERNAL_REQUEST_ID_HEADER,
  InternalScope,
  signSystemContext,
} from '@internal-auth';

interface ValidateCredentialsResponse {
  id: number;
  email: string;
  permissions: Permission[];
}

interface RotateRefreshResponse {
  status: 'rotated';
  userId: number;
  familyId: string;
  parentJti: string;
}

const baseUrl = () =>
  process.env.API_BASE_URL?.replace(/\/$/, '') ?? 'http://api:3200';

const internalPrivateKey = () => process.env.INTERNAL_JWT_PRIVATE_KEY ?? '';

const callApi = async <T>(
  path: string,
  body: unknown,
  scope: InternalScope,
  requestId: string,
  fallbackError: string,
): Promise<T> => {
  const token = await signSystemContext(
    { scope, requestId },
    { privateKey: internalPrivateKey() },
  );

  const response = await fetch(`${baseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [INTERNAL_AUTH_HEADER]: token,
      [INTERNAL_REQUEST_ID_HEADER]: requestId,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = fallbackError;
    try {
      const data = (await response.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      /* ignore body parse error */
    }
    const error = new Error(message) as Error & { statusCode?: number };
    error.statusCode = response.status;
    throw error;
  }

  return (await response.json()) as T;
};

/**
 * Single point of contact between the gateway and the api service. The
 * gateway signs a short-lived internal JWT with the right scope on each
 * call so the api can authenticate the request without sharing the
 * public client secret.
 */
export class ApiClient {
  static validateCredentials = (
    email: string,
    password: string,
    requestId: string,
  ): Promise<ValidateCredentialsResponse> =>
    callApi(
      '/internal/auth/validate',
      { email, password },
      InternalScope.AUTH_VALIDATE,
      requestId,
      'Email or password incorrect.',
    );

  static recordRefresh = (
    body: { userId: number; familyId: string; jti: string; parentJti?: string },
    requestId: string,
  ): Promise<{ recorded: true }> =>
    callApi(
      '/internal/refresh/record',
      body,
      InternalScope.REFRESH_LIFECYCLE,
      requestId,
      'Failed to record refresh token',
    );

  static rotateRefresh = (
    jti: string,
    requestId: string,
  ): Promise<RotateRefreshResponse> =>
    callApi(
      '/internal/refresh/rotate',
      { jti },
      InternalScope.REFRESH_LIFECYCLE,
      requestId,
      'Refresh chain invalid',
    );

  static revokeRefresh = (
    payload: { jti?: string; familyId?: string },
    requestId: string,
  ): Promise<unknown> =>
    callApi(
      '/internal/refresh/revoke',
      payload,
      InternalScope.REFRESH_LIFECYCLE,
      requestId,
      'Failed to revoke refresh token',
    );
}
