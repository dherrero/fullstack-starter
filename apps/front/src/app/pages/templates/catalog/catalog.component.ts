import { Component } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  badge?: string;
  badgeClass?: string;
}

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [NgClass, FormsModule],
  templateUrl: './catalog.component.html',
  styleUrls: ['./catalog.component.scss'],
})
export default class CatalogComponent {
  search = '';
  selectedCategory = 'All';
  page = 1;
  readonly pageSize = 6;

  readonly categories = [
    'All',
    'Electronics',
    'Clothing',
    'Home & Garden',
    'Sports',
  ];

  readonly products: Product[] = [
    {
      id: 1,
      name: 'Wireless Headphones',
      category: 'Electronics',
      price: 79.99,
      badge: 'New',
      badgeClass: 'bg-success',
    },
    { id: 2, name: 'Running Shoes', category: 'Sports', price: 129.0 },
    {
      id: 3,
      name: 'Desk Lamp',
      category: 'Home & Garden',
      price: 34.5,
      badge: 'Sale',
      badgeClass: 'bg-danger',
    },
    {
      id: 4,
      name: 'Mechanical Keyboard',
      category: 'Electronics',
      price: 159.99,
    },
    { id: 5, name: 'Yoga Mat', category: 'Sports', price: 45.0 },
    { id: 6, name: 'Ceramic Vase', category: 'Home & Garden', price: 22.0 },
    { id: 7, name: 'Polo Shirt', category: 'Clothing', price: 39.99 },
    {
      id: 8,
      name: 'Smart Watch',
      category: 'Electronics',
      price: 249.0,
      badge: 'Popular',
      badgeClass: 'bg-primary',
    },
    { id: 9, name: 'Hiking Boots', category: 'Sports', price: 189.0 },
    {
      id: 10,
      name: 'Coffee Maker',
      category: 'Home & Garden',
      price: 89.99,
      badge: 'Sale',
      badgeClass: 'bg-danger',
    },
    { id: 11, name: 'Denim Jacket', category: 'Clothing', price: 75.0 },
    {
      id: 12,
      name: 'Bluetooth Speaker',
      category: 'Electronics',
      price: 59.99,
    },
  ];

  get filtered(): Product[] {
    const q = this.search.toLowerCase();
    return this.products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) &&
        (this.selectedCategory === 'All' ||
          p.category === this.selectedCategory),
    );
  }

  get paged(): Product[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filtered.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filtered.length / this.pageSize);
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  setCategory(cat: string) {
    this.selectedCategory = cat;
    this.page = 1;
  }

  onSearch() {
    this.page = 1;
  }
}
