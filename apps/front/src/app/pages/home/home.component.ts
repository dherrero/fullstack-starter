import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LanguageSwitcherComponent } from '@front/app/components/language-switcher/language-switcher.component';
import { IfLoggedInDirective } from '@front/app/libs/auth/directives';
import { AuthService } from '@front/app/libs/auth/services/auth.service';
import { TranslocoModule } from '@ngneat/transloco';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    TranslocoModule,
    LanguageSwitcherComponent,
    IfLoggedInDirective,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export default class HomeComponent {
  #router = inject(Router);
  #authService = inject(AuthService);

  goToLogin() {
    this.#router.navigate(['login']);
  }

  logout() {
    this.#authService.logout();
    this.#router.navigate(['/']);
  }
}
