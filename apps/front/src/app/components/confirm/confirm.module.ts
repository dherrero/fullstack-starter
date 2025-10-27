import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { ConfirmComponent } from './confirm.component';
import { ConfirmService } from './confirm.service';

@NgModule({
  declarations: [ConfirmComponent],
  imports: [CommonModule, NgbModalModule],
  exports: [],
  providers: [ConfirmService],
})
export class ConfirmModule {}
