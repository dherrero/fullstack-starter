import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Permission } from '@dto';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { AUTH_CONFIGURATION } from '../auth.constants';
import { AuthConfig, Login, UserTokenData } from '../auth.interface';

@Injectable()
export class AuthService {
  // Tokens only in memory - no localStorage
  token = signal<string>('');
  isLoggedIn$!: Observable<boolean>;
  private isInitialized = signal<boolean>(false);

  get tokenDecoded(): UserTokenData {
    return this.token
      ? JSON.parse(window.atob(this.token().split('.')[1]))
      : ({} as UserTokenData);
  }

  #apiBase = '/login';
  #authConfig: AuthConfig = inject(AUTH_CONFIGURATION);
  #http: HttpClient = inject(HttpClient);
  #router: Router = inject(Router);

  constructor() {
    const isLoggedIn = computed(() => {
      return this.token() !== '';
    });
    this.isLoggedIn$ = toObservable(isLoggedIn);
  }

  login(loginData: Login) {
    return this.#http
      .post(this.#authConfig.idpServer + this.#apiBase, loginData, {
        observe: 'response',
        withCredentials: true, // Important: send cookies
      })
      .pipe(
        tap((response) => {
          // Only store AccessToken in memory, RefreshToken is in cookie
          this.setToken(response.headers.get('Authorization') ?? '');
          this.isInitialized.set(true);
        }),
      );
  }

  logout(redirect?: string) {
    // Call backend to clear cookie
    this.#http
      .post(
        this.#authConfig.idpServer + '/logout',
        {},
        { withCredentials: true },
      )
      .pipe(
        tap(() => {
          this.cleanTokens();
          if (redirect) {
            this.#router.navigateByUrl(redirect);
          }
        }),
        catchError(() => {
          // Even if logout fails, clean local tokens
          this.cleanTokens();
          if (redirect) {
            this.#router.navigateByUrl(redirect);
          }
          return of(null);
        }),
      )
      .subscribe();
  }

  setToken(token: string) {
    // Only store in memory, no localStorage
    this.token.set(token);
  }

  /**
   * Initialize auth by calling /health/secure to get a new AccessToken
   * If RefreshToken cookie is valid, backend will return a new AccessToken
   * If not, returns 401 and user needs to login
   */
  initialize(): Observable<boolean> {
    if (this.isInitialized()) {
      return of(true);
    }

    if (!this.#authConfig.pingUrl) {
      return of(false);
    }

    return this.#http
      .get<null>(this.#authConfig.pingUrl, {
        observe: 'response',
        withCredentials: true,
      })
      .pipe(
        map((response: HttpResponse<null>) => {
          // Capture new AccessToken from response
          const token = response.headers.get('Authorization');
          if (token) {
            this.setToken(token);
            this.isInitialized.set(true);
            return true;
          }
          return false;
        }),
        catchError(() => {
          this.isInitialized.set(false);
          return of(false);
        }),
      );
  }

  doPing() {
    return this.#authConfig.pingUrl
      ? this.#http
          .get<null>(this.#authConfig.pingUrl, {
            observe: 'response',
            withCredentials: true,
          })
          .pipe(
            tap((response) => {
              // Capture new AccessToken from response
              const token = response.headers.get('Authorization');
              if (token) {
                this.setToken(token);
              }
            }),
          )
      : of(null);
  }

  private cleanTokens() {
    // Only clear memory, cookies are HttpOnly and managed by backend
    this.token.set('');
    this.isInitialized.set(false);
  }

  hasPermission(requiredPermission: Permission): boolean {
    const userPermissions = this.tokenDecoded.permissions || [];
    return userPermissions.includes(requiredPermission);
  }

  hasAnyPermission(permissions: Permission[]): boolean {
    const userPermissions = this.tokenDecoded.permissions || [];
    return permissions.some((permission) =>
      userPermissions.includes(permission),
    );
  }

  hasAllPermissions(permissions: Permission[]): boolean {
    const userPermissions = this.tokenDecoded.permissions || [];
    return permissions.every((permission) =>
      userPermissions.includes(permission),
    );
  }

  isAdmin(): boolean {
    return this.hasPermission(Permission.ADMIN);
  }
}
