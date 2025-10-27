import { Injectable, inject } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Observable, Subject } from 'rxjs';
import { ConfirmComponent } from './confirm.component';
import { ConfirmConfig } from './confirm.constants';

@Injectable()
export class ConfirmService {
  #modalService = inject(NgbModal);
  confirmResponseSubject!: Subject<boolean>;
  confirmResponse$!: Observable<boolean>;

  open(config: ConfirmConfig) {
    this.confirmResponseSubject = new Subject<boolean>();
    this.confirmResponse$ = this.confirmResponseSubject.asObservable();

    const modalRef = this.#modalService.open(ConfirmComponent);
    modalRef.componentInstance.title = config.title;
    modalRef.componentInstance.message = config.message;
    modalRef.componentInstance.confirmText = config.confirmText;
    modalRef.componentInstance.cancelText = config.cancelText;

    modalRef.dismissed.subscribe(() => {
      this.confirmResponseSubject.complete();
    });

    modalRef.componentInstance.confirm = () => {
      this.confirmResponseSubject.next(true);
      modalRef.close();
      this.confirmResponseSubject.complete();
    };

    modalRef.componentInstance.cancel = () => {
      this.confirmResponseSubject.next(false);
      modalRef.close();
      this.confirmResponseSubject.complete();
    };

    modalRef.componentInstance.dismiss = () => {
      modalRef.close();
      this.confirmResponseSubject.complete();
    };

    return this.confirmResponse$;
  }
}
