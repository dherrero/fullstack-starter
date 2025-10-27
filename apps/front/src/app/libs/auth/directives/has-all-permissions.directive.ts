import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  inject,
} from '@angular/core';
import { Permission } from '@dto';
import { AuthService } from '../services/auth.service';

@Directive({
  selector: '[appHasAllPermissions]',
  standalone: true,
})
export class HasAllPermissionsDirective {
  private templateRef = inject(TemplateRef<unknown>);
  private viewContainer = inject(ViewContainerRef);
  private authService = inject(AuthService);

  private hasView = false;
  private currentPermissions: Permission[] = [];

  @Input() set hasAllPermissions(permissions: Permission[] | Permission) {
    this.currentPermissions = Array.isArray(permissions)
      ? permissions
      : [permissions];
    this.updateView();
  }

  private updateView() {
    if (
      this.currentPermissions.length > 0 &&
      this.authService.hasAllPermissions(this.currentPermissions)
    ) {
      if (!this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      }
    } else {
      if (this.hasView) {
        this.viewContainer.clear();
        this.hasView = false;
      }
    }
  }
}
