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

import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  #auth = inject(AuthService);

  intercept(req: HttpRequest<unknown>, next: HttpHandler) {
    const authToken = this.#auth.token();

    // Always include withCredentials to send cookies (RefreshToken)
    const authReq = authToken
      ? req.clone({
          headers: req.headers.set('Authorization', authToken),
          withCredentials: true,
        })
      : req.clone({
          withCredentials: true,
        });

    return next.handle(authReq).pipe(
      tap((event: HttpEvent<unknown>) => {
        if (event instanceof HttpResponse) {
          // Capture new AccessToken from response header
          const token = event.headers.get('Authorization');
          if (token) {
            this.#auth.setToken(token);
          }
        }
      }),
      catchError(this.errorHandle.bind(this)),
    );
  }
  private errorHandle(error: HttpErrorResponse) {
    if (error.status === 401) {
      this.#auth.logout('/login');
    }
    return throwError(() => error);
  }
}
