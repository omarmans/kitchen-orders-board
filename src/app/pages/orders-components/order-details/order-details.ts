import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Order } from '../../../models/order.model';
import { ActivatedRoute, Router } from '@angular/router';
import { OrdersService } from '../../../services/orders.service';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MenuItem } from '../../../models/menu-item.model';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  imports: [DatePipe, DecimalPipe, TranslatePipe],
  selector: 'app-order-details',
  styleUrl: './order-details.scss',
  templateUrl: './order-details.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetails implements OnInit {
  order = signal<Order | null>(null);
  loading = signal(true);
  notFound = signal(false);

  private activatedRoute = inject(ActivatedRoute);
  private ordersService = inject(OrdersService);
  private router = inject(Router);
  private translate = inject(TranslateService);

  menuItems = signal<MenuItem[]>([]);

  ngOnInit(): void {
    this.getMenuList();

    const id = this.activatedRoute.snapshot.paramMap.get('id');

    if (!id) {
      this.loading.set(false);
      this.notFound.set(true);
      return;
    }

    this.ordersService.getOrderById(id).subscribe({
      next: (res) => {
        if (!res) {
          this.notFound.set(true);
          this.order.set(null);
        } else {
          this.order.set(res);
          this.notFound.set(false);
        }

        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading order details:', err);
        this.order.set(null);
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/order-list']);
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-700';
      case 'preparing':
        return 'bg-amber-100 text-amber-700';
      case 'ready':
        return 'bg-emerald-100 text-emerald-700';
      case 'served':
        return 'bg-slate-200 text-slate-700';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'new':
        return this.translate.instant('ORDERS.STATUS_NEW');
      case 'preparing':
        return this.translate.instant('ORDERS.STATUS_PREPARING');
      case 'ready':
        return this.translate.instant('ORDERS.STATUS_READY');
      case 'served':
        return this.translate.instant('ORDERS.STATUS_SERVED');
      default:
        return status;
    }
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'dine-in':
        return this.translate.instant('ORDERS.TYPE_DINE_IN');
      case 'takeaway':
        return this.translate.instant('ORDERS.TYPE_TAKEAWAY');
      case 'delivery':
        return this.translate.instant('ORDERS.TYPE_DELIVERY');
      default:
        return type;
    }
  }

  getMenuList(): void {
    this.ordersService.getMenuItmes().subscribe({
      next: (res) => {
        this.menuItems.set(res);
      },
      error: (err) => {
        console.error('menu error:', err);
      },
    });
  }

  getMenuItemById(menuId: string): MenuItem | undefined {
    return this.menuItems().find((item) => item.id === menuId);
  }

  getOrderTotal(order: Order): number {
    let total = 0;

    order.items.forEach((item) => {
      const menuItem = this.getMenuItemById(item.menuId);
      const price = menuItem?.price ?? 0;
      total += price * item.qty;
    });

    if (order.type === 'dine-in') {
      const service = total * 0.12;
      const servicePlusTotal = total + service;
      const vat = servicePlusTotal * 0.14;

      return total + service + vat;
    }

    const vat = total * 0.14;
    return total + vat;
  }
}
