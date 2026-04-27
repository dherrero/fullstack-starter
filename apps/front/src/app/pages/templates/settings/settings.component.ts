import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

type Tab = 'profile' | 'security' | 'notifications';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export default class SettingsComponent {
  activeTab: Tab = 'profile';

  profile = {
    firstName: 'Ana',
    lastName: 'García',
    email: 'ana@example.com',
    bio: 'Full-stack developer at Acme Corp.',
    language: 'es',
  };

  security = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  };

  notifications = {
    emailUpdates: true,
    productNews: false,
    securityAlerts: true,
    weeklyDigest: false,
  };

  setTab(tab: Tab) {
    this.activeTab = tab;
  }

  save() {
    // Replace with actual save logic
    alert('Saved!');
  }
}
