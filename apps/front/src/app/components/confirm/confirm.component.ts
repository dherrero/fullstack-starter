import { Component } from '@angular/core';

@Component({
  selector: 'app-confirm',
  templateUrl: './confirm.component.html',
  styleUrls: ['./confirm.component.scss'],
})
export class ConfirmComponent {
  title!: string;
  message!: string;
  confirmText!: string;
  cancelText!: string;
  confirm!: () => void;
  cancel!: () => void;
  dismiss!: () => void;
}
