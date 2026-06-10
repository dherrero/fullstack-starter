import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { SsoProviderPublicDTO } from '@dto';
import { Observable } from 'rxjs';
import { AUTH_CONFIGURATION } from '../auth.constants';
import { AuthConfig } from '../auth.interface';

/** Landing route the gateway redirects to after a successful SSO callback. */
export const SSO_CALLBACK_PATH = '/auth/callback';

/**
 * Drives the gateway-mediated OIDC login. The gateway performs the whole
 * handshake; the SPA only (1) lists configured providers to render buttons and
 * (2) starts the flow with a FULL-PAGE navigation (the IdP redirect is
 * cross-site, so it cannot be an XHR). No tokens or secrets are handled here.
 */
@Injectable({ providedIn: 'root' })
export class SsoService {
  #http = inject(HttpClient);
  #config: AuthConfig = inject(AUTH_CONFIGURATION);

  #ssoBase = (): string => `${this.#config.idpServer}/sso`;

  /** Public, secret-free provider metadata for the login buttons. */
  getProviders(): Observable<SsoProviderPublicDTO[]> {
    return this.#http.get<SsoProviderPublicDTO[]>(
      `${this.#ssoBase()}/providers`,
      { withCredentials: true },
    );
  }

  /**
   * Builds the gateway login URL. `returnTo` is a same-site path; the gateway
   * re-validates it against its own allowlist, so this is defence-in-depth.
   */
  buildLoginUrl(
    providerId: string,
    returnTo: string = SSO_CALLBACK_PATH,
  ): string {
    const base = `${this.#ssoBase()}/${encodeURIComponent(providerId)}/login`;
    return `${base}?returnTo=${encodeURIComponent(returnTo)}`;
  }

  /** Starts the flow via a top-level navigation to the gateway. */
  login(providerId: string, returnTo: string = SSO_CALLBACK_PATH): void {
    window.location.assign(this.buildLoginUrl(providerId, returnTo));
  }
}
