import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface TemplateEntry {
  name: string;
  route: string;
  access: 'Public' | 'Private';
  bestFor: string;
  description: string;
}

@Component({
  selector: 'app-templates-index',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './templates-index.component.html',
  styleUrls: ['./templates-index.component.scss'],
})
export default class TemplatesIndexComponent {
  templates: TemplateEntry[] = [
    {
      name: 'Landing Page',
      route: '/templates/landing',
      access: 'Public',
      bestFor: 'Product homepages, SaaS marketing, launch pages',
      description:
        'Hero section with CTAs, feature highlights in 3-column cards, and pricing tiers. No auth required.',
    },
    {
      name: 'Admin Dashboard',
      route: '/templates/dashboard',
      access: 'Private',
      bestFor: 'Back-office, analytics, monitoring, operations',
      description:
        'KPI summary cards, chart placeholder, recent-activity feed, and a transactions table.',
    },
    {
      name: 'Product Catalog',
      route: '/templates/catalog',
      access: 'Private',
      bestFor: 'E-commerce, resource libraries, content portals',
      description:
        'Responsive product grid with live search, category filter, and pagination.',
    },
    {
      name: 'Data List (CRUD)',
      route: '/templates/list',
      access: 'Private',
      bestFor: 'CRM, user management, any CRUD entity',
      description:
        'Searchable table with status badges, pagination, and edit/delete row actions.',
    },
    {
      name: 'Settings',
      route: '/templates/settings',
      access: 'Private',
      bestFor: 'User profile, account preferences, app configuration',
      description:
        'Two-column layout with tabbed sections: profile, security, and notification preferences.',
    },
  ];
}
