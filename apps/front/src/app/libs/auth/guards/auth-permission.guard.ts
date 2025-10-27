import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  createUrlTreeFromSnapshot,
} from '@angular/router';
import { Permission } from '@dto';
import { map, switchMap, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const canActivateWithPermission = (
  requiredPermission: Permission
): CanActivateFn => {
  return (next: ActivatedRouteSnapshot) => {
    const authService = inject(AuthService);

    // Try to initialize from RefreshToken cookie if not logged in
    return authService.initialize().pipe(
      switchMap(() => authService.isLoggedIn$.pipe(take(1))),
      map((isLoggedIn: boolean) => {
        if (!isLoggedIn) {
          return createUrlTreeFromSnapshot(next, ['/', 'login']);
        }

        const userPermissions = authService.tokenDecoded.permissions || [];
        if (!userPermissions.includes(requiredPermission)) {
          return createUrlTreeFromSnapshot(next, ['/', 'unauthorized']);
        }

        return true;
      })
    );
  };
};

export const canActivateWithAnyPermission = (
  requiredPermissions: Permission[]
): CanActivateFn => {
  return (next: ActivatedRouteSnapshot) => {
    const authService = inject(AuthService);

    // Try to initialize from RefreshToken cookie if not logged in
    return authService.initialize().pipe(
      switchMap(() => authService.isLoggedIn$.pipe(take(1))),
      map((isLoggedIn: boolean) => {
        if (!isLoggedIn) {
          return createUrlTreeFromSnapshot(next, ['/', 'login']);
        }

        if (!authService.hasAnyPermission(requiredPermissions)) {
          return createUrlTreeFromSnapshot(next, ['/', 'unauthorized']);
        }

        return true;
      })
    );
  };
};

export const canActivateWithAllPermissions = (
  requiredPermissions: Permission[]
): CanActivateFn => {
  return (next: ActivatedRouteSnapshot) => {
    const authService = inject(AuthService);

    // Try to initialize from RefreshToken cookie if not logged in
    return authService.initialize().pipe(
      switchMap(() => authService.isLoggedIn$.pipe(take(1))),
      map((isLoggedIn: boolean) => {
        if (!isLoggedIn) {
          return createUrlTreeFromSnapshot(next, ['/', 'login']);
        }

        if (!authService.hasAllPermissions(requiredPermissions)) {
          return createUrlTreeFromSnapshot(next, ['/', 'unauthorized']);
        }

        return true;
      })
    );
  };
};
