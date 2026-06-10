import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { SsoProviderPublicDTO } from '@dto';

import { Login } from '@front/app/libs/auth/auth.interface';
import { sanitizeRedirect } from '@front/app/libs/auth/safe-redirect';
import { AuthService } from '@front/app/libs/auth/services/auth.service';
import { SsoService } from '@front/app/libs/auth/services/sso.service';
import { catchError, of, tap } from 'rxjs';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, TranslocoModule],
})
export default class LoginComponent implements OnInit {
  private redirectUrl = '';
  private translocoService = inject(TranslocoService);

  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private sso = inject(SsoService);

  error: string[] = [];
  loading = false;
  readonly providers = signal<SsoProviderPublicDTO[]>([]);

  login = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    remember: [false],
  });

  ngOnInit() {
    const navigation = this.router.currentNavigation();
    const state = navigation?.extras.state as { currentRoute: string };
    // Only honour safe same-origin paths — never an attacker-controlled URL.
    this.redirectUrl = sanitizeRedirect(state?.currentRoute);

    // Generic SSO failure flag set by the gateway (never raw IdP detail).
    if (this.route.snapshot.queryParamMap.has('sso_error')) {
      this.error = [this.translocoService.translate('login.sso.error')];
    }

    // Configuration-driven: render a button per configured provider, or none.
    this.sso.getProviders().subscribe({
      next: (providers) => this.providers.set(providers),
      error: () => this.providers.set([]),
    });
  }

  loginWithSso(providerId: string) {
    this.sso.login(providerId);
  }

  doLogin() {
    if (this.login.invalid) {
      this.login.markAllAsTouched();
      return;
    }

    if (this.login.value.email && this.login.value.password) {
      this.loading = true;
      this.error = [];

      this.auth
        .login(this.login.value as Login)
        .pipe(
          tap(() => {
            this.loading = false;
            if (this.redirectUrl) {
              this.router.navigateByUrl(this.redirectUrl, {});
            } else {
              this.router.navigateByUrl('');
            }
          }),
          catchError((error) => {
            this.loading = false;
            const errorMessage = error.error?.error || 'login.errors.invalid';
            this.error = [this.translocoService.translate(errorMessage)];
            return of(null);
          }),
        )
        .subscribe();
    }
  }
}
