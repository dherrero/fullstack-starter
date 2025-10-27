import { TemplateRef, ViewContainerRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Permission } from '@dto';
import { AuthService } from '../services/auth.service';
import { HasAllPermissionsDirective } from './has-all-permissions.directive';

describe('HasAllPermissionsDirective', () => {
  let mockAuthService: {
    hasAllPermissions: ReturnType<typeof vi.fn>;
    token: ReturnType<typeof signal<string>>;
  };
  let directive: HasAllPermissionsDirective;
  let mockTemplateRef: TemplateRef<unknown>;
  let mockViewContainer: ViewContainerRef;

  beforeEach(() => {
    mockAuthService = {
      hasAllPermissions: vi.fn(),
      token: signal(''),
    };

    mockTemplateRef = {} as TemplateRef<unknown>;
    mockViewContainer = {
      createEmbeddedView: vi.fn(),
      clear: vi.fn(),
    } as unknown as ViewContainerRef;

    TestBed.configureTestingModule({
      providers: [
        HasAllPermissionsDirective,
        { provide: AuthService, useValue: mockAuthService },
        { provide: TemplateRef, useValue: mockTemplateRef },
        { provide: ViewContainerRef, useValue: mockViewContainer },
      ],
    });

    directive = TestBed.inject(HasAllPermissionsDirective);
  });

  it('should create directive', () => {
    expect(directive).toBeTruthy();
  });

  it('should show content when user has all required permissions', () => {
    mockAuthService.hasAllPermissions.mockReturnValue(true);

    directive.hasAllPermissions = [
      Permission.ADMIN,
      Permission.WRITE_SOME_ENTITY,
    ];

    expect(mockViewContainer.createEmbeddedView).toHaveBeenCalledWith(
      mockTemplateRef
    );
    expect(mockAuthService.hasAllPermissions).toHaveBeenCalledWith([
      Permission.ADMIN,
      Permission.WRITE_SOME_ENTITY,
    ]);
  });

  it('should hide content when user does not have all required permissions', () => {
    mockAuthService.hasAllPermissions.mockReturnValue(false);

    directive.hasAllPermissions = [
      Permission.ADMIN,
      Permission.WRITE_SOME_ENTITY,
    ];

    expect(mockViewContainer.createEmbeddedView).not.toHaveBeenCalled();
  });

  it('should handle single permission (not array)', () => {
    mockAuthService.hasAllPermissions.mockReturnValue(true);

    directive.hasAllPermissions = Permission.ADMIN;

    expect(mockViewContainer.createEmbeddedView).toHaveBeenCalledWith(
      mockTemplateRef
    );
    expect(mockAuthService.hasAllPermissions).toHaveBeenCalledWith([
      Permission.ADMIN,
    ]);
  });

  it('should hide content when permissions array is empty', () => {
    mockAuthService.hasAllPermissions.mockReturnValue(false);

    directive.hasAllPermissions = [];

    expect(mockViewContainer.createEmbeddedView).not.toHaveBeenCalled();
  });

  it('should update view when permissions change', () => {
    // First show content
    mockAuthService.hasAllPermissions.mockReturnValue(true);
    directive.hasAllPermissions = [Permission.ADMIN];

    expect(mockViewContainer.createEmbeddedView).toHaveBeenCalled();

    // Then hide content
    mockAuthService.hasAllPermissions.mockReturnValue(false);
    directive.hasAllPermissions = [Permission.READ_SOME_ENTITY];

    expect(mockViewContainer.clear).toHaveBeenCalled();
    expect(mockAuthService.hasAllPermissions).toHaveBeenCalledWith([
      Permission.READ_SOME_ENTITY,
    ]);
  });

  it('should work with all permission types', () => {
    mockAuthService.hasAllPermissions.mockReturnValue(true);

    directive.hasAllPermissions = [
      Permission.ADMIN,
      Permission.READ_SOME_ENTITY,
      Permission.WRITE_SOME_ENTITY,
    ];

    expect(mockViewContainer.createEmbeddedView).toHaveBeenCalledWith(
      mockTemplateRef
    );
    expect(mockAuthService.hasAllPermissions).toHaveBeenCalledWith([
      Permission.ADMIN,
      Permission.READ_SOME_ENTITY,
      Permission.WRITE_SOME_ENTITY,
    ]);
  });

  it('should differentiate between hasAny and hasAll behavior', () => {
    mockAuthService.hasAllPermissions.mockReturnValue(false);

    directive.hasAllPermissions = [
      Permission.ADMIN,
      Permission.WRITE_SOME_ENTITY,
    ];

    expect(mockViewContainer.createEmbeddedView).not.toHaveBeenCalled();
    expect(mockAuthService.hasAllPermissions).toHaveBeenCalledWith([
      Permission.ADMIN,
      Permission.WRITE_SOME_ENTITY,
    ]);
  });
});
