import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LanguageSwitcherComponent } from '@front/app/components/language-switcher/language-switcher.component';
import { AuthService } from '@front/app/libs/auth/services/auth.service';
import { TranslocoModule } from '@jsverse/transloco';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [TranslocoModule, LanguageSwitcherComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class HomeComponent {
  readonly auth = inject(AuthService);
  readonly #router = inject(Router);

  goToLogin() {
    this.#router.navigate(['login']);
  }

  logout() {
    this.auth.logout();
    this.#router.navigate(['/']);
  }
}
