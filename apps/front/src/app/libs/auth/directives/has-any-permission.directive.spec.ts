import { TemplateRef, ViewContainerRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Permission } from '@dto';
import { AuthService } from '../services/auth.service';
import { HasAnyPermissionDirective } from './has-any-permission.directive';

describe('HasAnyPermissionDirective', () => {
  let mockAuthService: {
    hasAnyPermission: ReturnType<typeof vi.fn>;
    token: ReturnType<typeof signal<string>>;
  };
  let directive: HasAnyPermissionDirective;
  let mockTemplateRef: TemplateRef<unknown>;
  let mockViewContainer: ViewContainerRef;

  beforeEach(() => {
    mockAuthService = {
      hasAnyPermission: vi.fn(),
      token: signal(''),
    };

    mockTemplateRef = {} as TemplateRef<unknown>;
    mockViewContainer = {
      createEmbeddedView: vi.fn(),
      clear: vi.fn(),
    } as unknown as ViewContainerRef;

    TestBed.configureTestingModule({
      providers: [
        HasAnyPermissionDirective,
        { provide: AuthService, useValue: mockAuthService },
        { provide: TemplateRef, useValue: mockTemplateRef },
        { provide: ViewContainerRef, useValue: mockViewContainer },
      ],
    });

    directive = TestBed.inject(HasAnyPermissionDirective);
  });

  it('should create directive', () => {
    expect(directive).toBeTruthy();
  });

  it('should show content when user has any of the required permissions', () => {
    mockAuthService.hasAnyPermission.mockReturnValue(true);

    directive.hasAnyPermission = [
      Permission.ADMIN,
      Permission.WRITE_SOME_ENTITY,
    ];

    expect(mockViewContainer.createEmbeddedView).toHaveBeenCalledWith(
      mockTemplateRef,
    );
    expect(mockAuthService.hasAnyPermission).toHaveBeenCalledWith([
      Permission.ADMIN,
      Permission.WRITE_SOME_ENTITY,
    ]);
  });

  it('should hide content when user does not have any required permission', () => {
    mockAuthService.hasAnyPermission.mockReturnValue(false);

    directive.hasAnyPermission = [
      Permission.ADMIN,
      Permission.WRITE_SOME_ENTITY,
    ];

    expect(mockViewContainer.createEmbeddedView).not.toHaveBeenCalled();
  });

  it('should handle single permission (not array)', () => {
    mockAuthService.hasAnyPermission.mockReturnValue(true);

    directive.hasAnyPermission = Permission.ADMIN;

    expect(mockViewContainer.createEmbeddedView).toHaveBeenCalledWith(
      mockTemplateRef,
    );
    expect(mockAuthService.hasAnyPermission).toHaveBeenCalledWith([
      Permission.ADMIN,
    ]);
  });

  it('should hide content when permissions array is empty', () => {
    mockAuthService.hasAnyPermission.mockReturnValue(false);

    directive.hasAnyPermission = [];

    expect(mockViewContainer.createEmbeddedView).not.toHaveBeenCalled();
  });

  it('should update view when permissions change', () => {
    // First show content
    mockAuthService.hasAnyPermission.mockReturnValue(true);
    directive.hasAnyPermission = [Permission.ADMIN];

    expect(mockViewContainer.createEmbeddedView).toHaveBeenCalled();

    // Then hide content
    mockAuthService.hasAnyPermission.mockReturnValue(false);
    directive.hasAnyPermission = [Permission.READ_SOME_ENTITY];

    expect(mockViewContainer.clear).toHaveBeenCalled();
    expect(mockAuthService.hasAnyPermission).toHaveBeenCalledWith([
      Permission.READ_SOME_ENTITY,
    ]);
  });

  it('should work with all permission types', () => {
    mockAuthService.hasAnyPermission.mockReturnValue(true);

    directive.hasAnyPermission = [
      Permission.ADMIN,
      Permission.READ_SOME_ENTITY,
      Permission.WRITE_SOME_ENTITY,
    ];

    expect(mockViewContainer.createEmbeddedView).toHaveBeenCalledWith(
      mockTemplateRef,
    );
    expect(mockAuthService.hasAnyPermission).toHaveBeenCalledWith([
      Permission.ADMIN,
      Permission.READ_SOME_ENTITY,
      Permission.WRITE_SOME_ENTITY,
    ]);
  });
});
