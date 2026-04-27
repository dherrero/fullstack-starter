import { TemplateRef, ViewContainerRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { IfLoggedInDirective } from './if-logged-in.directive';

describe('IfLoggedInDirective', () => {
  let mockAuthService: {
    token: ReturnType<typeof signal<string>>;
    isLoggedIn$: BehaviorSubject<boolean>;
  };
  let directive: IfLoggedInDirective;
  let mockTemplateRef: TemplateRef<unknown>;
  let mockViewContainer: ViewContainerRef;

  beforeEach(() => {
    mockAuthService = {
      token: signal(''),
      isLoggedIn$: new BehaviorSubject<boolean>(false),
    };

    mockTemplateRef = {} as TemplateRef<unknown>;
    mockViewContainer = {
      createEmbeddedView: vi.fn(),
      clear: vi.fn(),
    } as unknown as ViewContainerRef;

    TestBed.configureTestingModule({
      providers: [
        IfLoggedInDirective,
        { provide: AuthService, useValue: mockAuthService },
        { provide: TemplateRef, useValue: mockTemplateRef },
        { provide: ViewContainerRef, useValue: mockViewContainer },
      ],
    });

    directive = TestBed.inject(IfLoggedInDirective);
  });

  it('should create directive', () => {
    expect(directive).toBeTruthy();
  });

  describe('when condition is true (default)', () => {
    it('should show content when user is logged in', () => {
      mockAuthService.token.set('valid-token');

      directive.ngOnInit();
      directive.appIfLoggedIn = true;

      expect(mockViewContainer.createEmbeddedView).toHaveBeenCalledWith(
        mockTemplateRef,
      );
    });

    it('should hide content when user is not logged in', () => {
      mockAuthService.token.set('');

      directive.ngOnInit();
      directive.appIfLoggedIn = true;

      expect(mockViewContainer.createEmbeddedView).not.toHaveBeenCalled();
    });
  });

  describe('when condition is false', () => {
    it('should show content when user is NOT logged in', () => {
      mockAuthService.token.set('');

      directive.appIfLoggedIn = false;

      expect(mockViewContainer.createEmbeddedView).toHaveBeenCalledWith(
        mockTemplateRef,
      );
    });

    it('should hide content when user IS logged in', () => {
      mockAuthService.token.set('valid-token');

      directive.appIfLoggedIn = false;

      expect(mockViewContainer.createEmbeddedView).not.toHaveBeenCalled();
    });
  });

  describe('reactive behavior', () => {
    it('should show content when user logs in (reactive)', () => {
      mockAuthService.token.set('');
      directive.ngOnInit();
      directive.appIfLoggedIn = true;

      // Simulate user login
      mockAuthService.token.set('valid-token');
      mockAuthService.isLoggedIn$.next(true);

      expect(mockViewContainer.createEmbeddedView).toHaveBeenCalled();
    });

    it('should hide content when user logs out (reactive)', () => {
      mockAuthService.token.set('valid-token');
      directive.ngOnInit();
      directive.appIfLoggedIn = true;

      // Simulate user logout
      mockAuthService.token.set('');
      mockAuthService.isLoggedIn$.next(false);

      expect(mockViewContainer.clear).toHaveBeenCalled();
    });
  });

  describe('condition changes', () => {
    it('should update view when condition input changes from true to false', () => {
      mockAuthService.token.set('valid-token');

      directive.appIfLoggedIn = true;

      directive.appIfLoggedIn = false;

      expect(mockViewContainer.clear).toHaveBeenCalled();
    });

    it('should update view when condition input changes from false to true', () => {
      mockAuthService.token.set('');

      directive.appIfLoggedIn = false;

      directive.appIfLoggedIn = true;

      expect(mockViewContainer.clear).toHaveBeenCalled();
    });
  });

  it('should unsubscribe from isLoggedIn$ on destroy', () => {
    directive.ngOnInit();

    const subscription = (
      directive as unknown as { subscription?: Subscription }
    ).subscription as Subscription;
    const spy = vi.spyOn(subscription, 'unsubscribe');

    directive.ngOnDestroy();

    expect(spy).toHaveBeenCalled();
  });
});
