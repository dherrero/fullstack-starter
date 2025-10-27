import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { take } from 'rxjs';
import { AuthService } from './libs/auth/services/auth.service';

@Component({
  standalone: true,
  imports: [RouterModule],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'app-front';
  #auth = inject(AuthService);

  ngOnInit(): void {
    // Initialize auth from cookie on app start
    this.#auth.initialize().pipe(take(1)).subscribe();
  }
}
