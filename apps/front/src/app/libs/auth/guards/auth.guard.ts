import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  createUrlTreeFromSnapshot,
} from '@angular/router';
import { map, switchMap, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const canActivateFn: CanActivateFn = (next: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);

  // Try to initialize from RefreshToken cookie if not logged in
  return authService.initialize().pipe(
    switchMap(() => authService.isLoggedIn$.pipe(take(1))),
    map((isLoggedIn: boolean) =>
      isLoggedIn ? true : createUrlTreeFromSnapshot(next, ['/', 'login']),
    ),
  );
};
