import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '@front/app/libs/auth/services/auth.service';

/**
 * Landing route after the gateway's SSO callback set the refresh cookie and
 * redirected here. It bootstraps the in-memory access token via
 * `AuthService.initialize()` (which the gateway mints from the refresh cookie)
 * and then navigates home. On failure it returns to the login page with a
 * generic error flag — never surfacing raw IdP/query data.
 */
@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [TranslocoModule],
  templateUrl: './auth-callback.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AuthCallbackComponent implements OnInit {
  readonly #auth = inject(AuthService);
  readonly #router = inject(Router);

  ngOnInit() {
    this.#auth.initialize().subscribe((ok) => {
      this.#router.navigateByUrl(ok ? '/' : '/login?sso_error=1');
    });
  }
}
