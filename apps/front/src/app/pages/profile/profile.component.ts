import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@front/app/libs/auth/services/auth.service';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * Example PROTECTED route. It is guarded by `canActivateFn` in app.routes.ts,
 * so an unauthenticated visit is redirected to /login. The decoded token data
 * shown here is presentation-only — real authorization is always enforced by
 * the backend, never by this guard.
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [TranslocoModule, RouterLink],
  templateUrl: './profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ProfileComponent {
  readonly auth = inject(AuthService);

  get permissions(): string[] {
    return this.auth.tokenDecoded.permissions ?? [];
  }
}
