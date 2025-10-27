import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { EnvironmentProviders, Provider } from '@angular/core';
import { AUTH_CONFIGURATION } from './auth.constants';
import { AuthConfig } from './auth.interface';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { AuthService } from './services/auth.service';

/**
 * Provider moderno para el módulo de autenticación
 * Reemplaza el patrón NgModule en favor de los providers estándar de Angular
 *
 * @param config - Configuración de autenticación (URL del servidor IDP y ping)
 * @returns Array de providers para autenticación
 */
export function provideAuth(
  config: AuthConfig
): (Provider | EnvironmentProviders)[] {
  return [
    AuthService,
    {
      provide: AUTH_CONFIGURATION,
      useValue: config,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
  ];
}
