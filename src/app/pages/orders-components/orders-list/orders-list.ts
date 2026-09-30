import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Order, OrderStatus } from '../../../models/order.model';
import { OrdersService } from '../../../services/orders.service';
import { MenuItem } from '../../../models/menu-item.model';
import { Column } from '../../../models/column.model';

@Component({
  imports: [DatePipe],
  selector: 'app-orders-list',
  styleUrl: './orders-list.scss',
  templateUrl: './orders-list.html',
})
export class OrdersList implements OnInit {
  ordersList = signal<Order[]>([]);
  menuItems = signal<MenuItem[]>([]);
  private orderServices = inject(OrdersService);
  now = signal(Date.now());
  readonly columns: Column[] = [
    { status: 'new', label: 'New', dot: 'bg-sky-500', badge: 'bg-sky-100 text-sky-700' },
    {
      status: 'preparing',
      label: 'Preparing',
      dot: 'bg-amber-500',
      badge: 'bg-amber-100 text-amber-700',
    },
    {
      status: 'ready',
      label: 'Ready',
      dot: 'bg-emerald-500',
      badge: 'bg-emerald-100 text-emerald-700',
    },
    {
      status: 'served',
      label: 'Served',
      dot: 'bg-slate-400',
      badge: 'bg-slate-200 text-slate-600',
    },
  ];

  isLate(order: Order): boolean {
    if (order.status === 'ready' || order.status === 'served') {
      return false;
    }
    const createdTime = new Date(order.createdAt).getTime();
    const diffInMinutes = (this.now() - createdTime) / (1000 * 60);

    return diffInMinutes > 20;
  }
  ngOnInit(): void {
    this.getOrdersList();
    this.getMenuList();

    setInterval(() => {
      this.now.set(Date.now());
    }, 1000);
  }

  byStatus = computed(() => {
    const groups: Record<OrderStatus, Order[]> = {
      new: [],
      preparing: [],
      ready: [],
      served: [],
    };

    for (const o of this.ordersList()) {
      groups[o.status].push(o);
    }

    return groups;
  });

  getOrdersList() {
    this.orderServices.getOrders().subscribe({
      next: (res) => {
        this.ordersList.set(res);
        console.log('orders:', res);
      },
      error: (err) => {
        console.error('orders error:', err);
      },
    });
  }

  getMenuList() {
    this.orderServices.getMenuItmes().subscribe({
      next: (res) => {
        this.menuItems.set(res);
        console.log('menu:', res);
      },
      error: (err) => {
        console.error('menu error:', err);
      },
    });
  }

  // getOrderTotal(order: Order): number {
  //   return order.items.reduce((total, item) => {
  //     const menuItem = this.menuItems().find((menu) => menu.id === item.menuId);
  //     const price = menuItem?.price ?? 0;
  //     return total + price * item.qty;
  //   }, 0);
  // }

  // getOrderTotal(order: Order): number {
  //   let total = 0;

  //   order.items.forEach((item) => {
  //     const menuItem = this.menuItems().find((menu) => menu.id === item.menuId);
  //     const price = menuItem?.price ?? 0;
  //     total += price * item.qty;
  //   });

  //   return total;
  // }

  getOrderTotal(order: Order): number {
    let total = 0;

    for (const item of order.items) {
      const menuItem = this.menuItems().find((menu) => menu.id === item.menuId);
      const price = menuItem?.price ?? 0;
      total += price * item.qty;
    }

    return total;
  }
}
