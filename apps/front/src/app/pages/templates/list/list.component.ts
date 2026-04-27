import { Component } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Row {
  id: number;
  name: string;
  email: string;
  status: 'Active' | 'Inactive' | 'Pending';
  role: string;
  createdAt: string;
}

@Component({
  selector: 'app-list',
  standalone: true,
  imports: [NgClass, FormsModule],
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss'],
})
export default class ListComponent {
  search = '';
  page = 1;
  readonly pageSize = 5;

  rows: Row[] = [
    {
      id: 1,
      name: 'Ana García',
      email: 'ana@example.com',
      status: 'Active',
      role: 'Admin',
      createdAt: '2025-01-10',
    },
    {
      id: 2,
      name: 'Marc Puig',
      email: 'marc@example.com',
      status: 'Active',
      role: 'Editor',
      createdAt: '2025-01-15',
    },
    {
      id: 3,
      name: 'Joan Mas',
      email: 'joan@example.com',
      status: 'Inactive',
      role: 'Viewer',
      createdAt: '2025-02-03',
    },
    {
      id: 4,
      name: 'Sara Vidal',
      email: 'sara@example.com',
      status: 'Pending',
      role: 'Editor',
      createdAt: '2025-02-20',
    },
    {
      id: 5,
      name: 'Luis Torres',
      email: 'luis@example.com',
      status: 'Active',
      role: 'Admin',
      createdAt: '2025-03-01',
    },
    {
      id: 6,
      name: 'Elena Font',
      email: 'elena@example.com',
      status: 'Active',
      role: 'Viewer',
      createdAt: '2025-03-14',
    },
    {
      id: 7,
      name: 'Pau Roca',
      email: 'pau@example.com',
      status: 'Pending',
      role: 'Editor',
      createdAt: '2025-04-02',
    },
    {
      id: 8,
      name: 'Marta Soler',
      email: 'marta@example.com',
      status: 'Inactive',
      role: 'Viewer',
      createdAt: '2025-04-10',
    },
    {
      id: 9,
      name: 'Toni Bosch',
      email: 'toni@example.com',
      status: 'Active',
      role: 'Editor',
      createdAt: '2025-04-18',
    },
    {
      id: 10,
      name: 'Júlia Pons',
      email: 'julia@example.com',
      status: 'Active',
      role: 'Admin',
      createdAt: '2025-04-25',
    },
  ];

  get filtered(): Row[] {
    const q = this.search.toLowerCase();
    return this.rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q),
    );
  }

  get paged(): Row[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filtered.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filtered.length / this.pageSize);
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  onSearch() {
    this.page = 1;
  }

  statusClass(status: Row['status']): Record<string, boolean> {
    return {
      'bg-success': status === 'Active',
      'bg-secondary': status === 'Inactive',
      'bg-warning text-dark': status === 'Pending',
    };
  }

  delete(id: number) {
    this.rows = this.rows.filter((r) => r.id !== id);
  }
}
