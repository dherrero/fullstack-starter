import { Component } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';

interface Kpi {
  label: string;
  value: string;
  delta: string;
  positive: boolean;
  icon: string;
}

interface ActivityItem {
  initials: string;
  user: string;
  action: string;
  time: string;
}

interface Transaction {
  id: string;
  customer: string;
  plan: string;
  amount: string;
  status: 'Paid' | 'Pending' | 'Failed';
  date: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgClass, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export default class DashboardComponent {
  kpis: Kpi[] = [
    {
      label: 'Total Users',
      value: '12,847',
      delta: '+8.2%',
      positive: true,
      icon: '👥',
    },
    {
      label: 'Monthly Revenue',
      value: '€48,320',
      delta: '+12.5%',
      positive: true,
      icon: '💰',
    },
    {
      label: 'Active Sessions',
      value: '1,429',
      delta: '-3.1%',
      positive: false,
      icon: '📊',
    },
    {
      label: 'Conversion Rate',
      value: '4.7%',
      delta: '+0.4%',
      positive: true,
      icon: '🎯',
    },
  ];

  activity: ActivityItem[] = [
    {
      initials: 'AG',
      user: 'Ana García',
      action: 'Updated subscription to Pro',
      time: '2 min ago',
    },
    {
      initials: 'MP',
      user: 'Marc Puig',
      action: 'Created project "Shopify clone"',
      time: '15 min ago',
    },
    {
      initials: 'LT',
      user: 'Luis Torres',
      action: 'Invited 3 team members',
      time: '1h ago',
    },
    {
      initials: 'SV',
      user: 'Sara Vidal',
      action: 'Exported monthly report',
      time: '2h ago',
    },
    {
      initials: 'JM',
      user: 'Joan Mas',
      action: 'Upgraded to Enterprise',
      time: '3h ago',
    },
  ];

  transactions: Transaction[] = [
    {
      id: '#00120',
      customer: 'Ana García',
      plan: 'Pro',
      amount: '€29.00',
      status: 'Paid',
      date: '2025-04-27',
    },
    {
      id: '#00119',
      customer: 'Marc Puig',
      plan: 'Free',
      amount: '€0.00',
      status: 'Paid',
      date: '2025-04-26',
    },
    {
      id: '#00118',
      customer: 'Joan Mas',
      plan: 'Enterprise',
      amount: '€499.00',
      status: 'Paid',
      date: '2025-04-25',
    },
    {
      id: '#00117',
      customer: 'Sara Vidal',
      plan: 'Pro',
      amount: '€29.00',
      status: 'Failed',
      date: '2025-04-24',
    },
    {
      id: '#00116',
      customer: 'Luis Torres',
      plan: 'Pro',
      amount: '€29.00',
      status: 'Pending',
      date: '2025-04-23',
    },
  ];

  statusClass(status: Transaction['status']): string {
    return {
      Paid: 'bg-success',
      Pending: 'bg-warning text-dark',
      Failed: 'bg-danger',
    }[status];
  }
}
