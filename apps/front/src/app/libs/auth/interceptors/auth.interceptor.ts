import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';

import { AUTH_CONFIGURATION } from '../auth.constants';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  #auth = inject(AuthService);
  #config = inject(AUTH_CONFIGURATION, { optional: true });

  /**
   * Only same-origin requests (or the explicitly-configured API origin) may
   * carry the in-memory access token and cookies. Without this guard, the day
   * the app calls a third-party absolute URL (CDN, analytics, avatar service)
   * the Authorization header would leak the token to that third party.
   */
  #isTrustedOrigin(url: string): boolean {
    try {
      const appOrigin = window.location.origin;
      const targetOrigin = new URL(url, appOrigin).origin;
      if (targetOrigin === appOrigin) return true;
      const idp = this.#config?.idpServer;
      if (idp && /^https?:\/\//i.test(idp)) {
        return targetOrigin === new URL(idp).origin;
      }
      return false;
    } catch {
      return false;
    }
  }

  intercept(req: HttpRequest<unknown>, next: HttpHandler) {
    const attach = this.#isTrustedOrigin(req.url);

    let authReq = req;
    if (attach) {
      const authToken = this.#auth.token();
      authReq = authToken
        ? req.clone({
            headers: req.headers.set('Authorization', authToken),
            withCredentials: true,
          })
        : req.clone({ withCredentials: true });
    }

    return next.handle(authReq).pipe(
      tap((event: HttpEvent<unknown>) => {
        // Never read an Authorization response header from an untrusted origin
        // as our session token.
        if (attach && event instanceof HttpResponse) {
          const token = event.headers.get('Authorization');
          if (token) {
            this.#auth.setToken(token);
          }
        }
      }),
      catchError((error: HttpErrorResponse) =>
        this.#errorHandle(error, attach),
      ),
    );
  }

  #errorHandle(error: HttpErrorResponse, attach: boolean) {
    // Only our own 401s should end the session; a third-party 401 must not.
    if (attach && error.status === 401) {
      this.#auth.logout('/login');
    }
    return throwError(() => error);
  }
}
