import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import AuthCallbackComponent from './auth-callback.component';
import { AuthService } from '@front/app/libs/auth/services/auth.service';

describe('AuthCallbackComponent', () => {
  const initialize = vi.fn();
  const navigateByUrl = vi.fn();

  const setup = () => {
    TestBed.configureTestingModule({
      imports: [AuthCallbackComponent],
      providers: [
        { provide: AuthService, useValue: { initialize } },
        { provide: Router, useValue: { navigateByUrl } },
        { provide: TranslocoService, useValue: {} },
      ],
    });
    return TestBed.createComponent(AuthCallbackComponent).componentInstance;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
  });

  it('navigates home once the session bootstraps', () => {
    initialize.mockReturnValue(of(true));
    setup().ngOnInit();
    expect(initialize).toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('returns to login with a generic error flag on failure', () => {
    initialize.mockReturnValue(of(false));
    setup().ngOnInit();
    expect(navigateByUrl).toHaveBeenCalledWith('/login?sso_error=1');
  });
});
