import { TemplateRef, ViewContainerRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Permission } from '@dto';
import { AuthService } from '../services/auth.service';
import { HasPermissionDirective } from './has-permission.directive';

describe('HasPermissionDirective', () => {
  let mockAuthService: {
    hasPermission: ReturnType<typeof vi.fn>;
    token: ReturnType<typeof signal<string>>;
  };
  let directive: HasPermissionDirective;
  let mockTemplateRef: TemplateRef<unknown>;
  let mockViewContainer: ViewContainerRef;

  beforeEach(() => {
    mockAuthService = {
      hasPermission: vi.fn(),
      token: signal(''),
    };

    mockTemplateRef = {} as TemplateRef<unknown>;
    mockViewContainer = {
      createEmbeddedView: vi.fn(),
      clear: vi.fn(),
    } as unknown as ViewContainerRef;

    TestBed.configureTestingModule({
      providers: [
        HasPermissionDirective,
        { provide: AuthService, useValue: mockAuthService },
        { provide: TemplateRef, useValue: mockTemplateRef },
        { provide: ViewContainerRef, useValue: mockViewContainer },
      ],
    });

    directive = TestBed.inject(HasPermissionDirective);
  });

  it('should create directive', () => {
    expect(directive).toBeTruthy();
  });

  it('should show content when user has the required permission', () => {
    mockAuthService.hasPermission.mockReturnValue(true);

    directive.hasPermission = Permission.ADMIN;

    expect(mockViewContainer.createEmbeddedView).toHaveBeenCalledWith(
      mockTemplateRef
    );
    expect(mockAuthService.hasPermission).toHaveBeenCalledWith(
      Permission.ADMIN
    );
  });

  it('should hide content when user does not have the required permission', () => {
    mockAuthService.hasPermission.mockReturnValue(false);

    directive.hasPermission = Permission.ADMIN;

    expect(mockViewContainer.createEmbeddedView).not.toHaveBeenCalled();
    expect(mockAuthService.hasPermission).toHaveBeenCalledWith(
      Permission.ADMIN
    );
  });

  it('should hide content when permission is null', () => {
    mockAuthService.hasPermission.mockReturnValue(false);

    directive.hasPermission = null;

    expect(mockViewContainer.createEmbeddedView).not.toHaveBeenCalled();
  });

  it('should update view when permission changes', () => {
    // First show content
    mockAuthService.hasPermission.mockReturnValue(true);
    directive.hasPermission = Permission.ADMIN;

    expect(mockViewContainer.createEmbeddedView).toHaveBeenCalledWith(
      mockTemplateRef
    );

    // Then hide content by changing permission
    mockAuthService.hasPermission.mockReturnValue(false);
    directive.hasPermission = Permission.READ_SOME_ENTITY;

    expect(mockViewContainer.clear).toHaveBeenCalled();
    expect(mockAuthService.hasPermission).toHaveBeenCalledWith(
      Permission.READ_SOME_ENTITY
    );
  });

  it('should work with different permission types', () => {
    mockAuthService.hasPermission.mockReturnValue(true);

    directive.hasPermission = Permission.WRITE_SOME_ENTITY;

    expect(mockViewContainer.createEmbeddedView).toHaveBeenCalledWith(
      mockTemplateRef
    );
    expect(mockAuthService.hasPermission).toHaveBeenCalledWith(
      Permission.WRITE_SOME_ENTITY
    );
  });
});
