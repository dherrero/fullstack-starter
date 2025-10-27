import {
  Directive,
  inject,
  Input,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Directive({
  selector: '[appIfLoggedIn]',
  standalone: true,
})
export class IfLoggedInDirective implements OnInit, OnDestroy {
  private templateRef = inject(TemplateRef<unknown>);
  private viewContainer = inject(ViewContainerRef);
  private authService = inject(AuthService);

  private hasView = false;
  private currentCondition = true;
  private subscription?: Subscription;

  @Input() set appIfLoggedIn(condition: boolean) {
    this.currentCondition = condition !== false; // Default to true if not specified
    this.updateView();
  }

  ngOnInit() {
    // Subscribe to login status changes
    this.subscription = this.authService.isLoggedIn$.subscribe(() => {
      this.updateView();
    });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  private updateView() {
    const userIsLoggedIn = this.authService.token() !== '';

    // Show element if:
    // - condition is true AND user is logged in, OR
    // - condition is false AND user is NOT logged in
    const shouldShow =
      (this.currentCondition && userIsLoggedIn) ||
      (!this.currentCondition && !userIsLoggedIn);

    if (shouldShow) {
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
