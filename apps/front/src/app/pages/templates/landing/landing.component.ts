import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export default class LandingComponent {
  features = [
    {
      icon: '⚡',
      title: 'Lightning Fast',
      description:
        'Optimised build pipeline and lazy loading keep your app snappy from day one.',
    },
    {
      icon: '🔒',
      title: 'Secure by Default',
      description:
        'JWT auth, route guards, and permission directives are wired up out of the box.',
    },
    {
      icon: '🌐',
      title: 'Multi-language',
      description:
        'Built-in Transloco integration supports as many locales as your audience needs.',
    },
  ];

  plans = [
    {
      name: 'Free',
      price: '€0',
      period: '/mo',
      features: ['1 project', '2 team members', 'Community support'],
      cta: 'Get started',
      highlight: false,
    },
    {
      name: 'Pro',
      price: '€29',
      period: '/mo',
      features: [
        '10 projects',
        '20 team members',
        'Priority support',
        'Advanced analytics',
      ],
      cta: 'Start free trial',
      highlight: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      features: [
        'Unlimited projects',
        'Unlimited members',
        'Dedicated support',
        'SLA guarantee',
      ],
      cta: 'Contact us',
      highlight: false,
    },
  ];
}
