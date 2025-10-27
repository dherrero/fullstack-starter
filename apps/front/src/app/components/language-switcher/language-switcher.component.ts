import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { LanguageService } from '@front/app/services/language.service';
import { TranslocoModule, TranslocoService } from '@ngneat/transloco';
import {
  AVAILABLE_LANGUAGES,
  Language,
} from '../../constants/languages.constant';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  templateUrl: './language-switcher.component.html',
  styleUrls: ['./language-switcher.component.scss'],
})
export class LanguageSwitcherComponent {
  private translocoService = inject(TranslocoService);
  private languageService = inject(LanguageService);

  readonly availableLanguages: Language[] = AVAILABLE_LANGUAGES;

  get currentLang(): string {
    return this.languageService.getCurrentLanguage();
  }

  switchLanguage(lang: string): void {
    this.languageService.setLanguage(lang);
  }
}
