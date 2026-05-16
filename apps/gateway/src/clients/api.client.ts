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

const baseUrl = () =>
  process.env.API_BASE_URL?.replace(/\/$/, '') ?? 'http://api:3200';

const internalSecret = () => process.env.INTERNAL_JWT_SECRET ?? '';

/**
 * Single point of contact between the gateway and the api service. The
 * gateway sends a `auth.validate`-scoped internal JWT so the api can
 * accept the call without a downstream user context.
 */
export class ApiClient {
  static validateCredentials = async (
    email: string,
    password: string,
    requestId: string,
  ): Promise<ValidateCredentialsResponse> => {
    const token = signSystemContext(
      { scope: InternalScope.AUTH_VALIDATE, requestId },
      { secret: internalSecret() },
    );

    const response = await fetch(`${baseUrl()}/internal/auth/validate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [INTERNAL_AUTH_HEADER]: token,
        [INTERNAL_REQUEST_ID_HEADER]: requestId,
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      let message = 'Email or password incorrect.';
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

    return (await response.json()) as ValidateCredentialsResponse;
  };
}
