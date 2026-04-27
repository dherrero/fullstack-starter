import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Router, RouterModule } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

import { Login } from '@front/app/libs/auth/auth.interface';
import { AuthService } from '@front/app/libs/auth/services/auth.service';
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

  error: string[] = [];
  loading = false;

  login = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    remember: [false],
  });

  ngOnInit() {
    const navigation = this.router.currentNavigation();
    const state = navigation?.extras.state as { currentRoute: string };
    this.redirectUrl = state?.currentRoute ?? '';
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
