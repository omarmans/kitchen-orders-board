import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Order, OrderStatus, OrderType } from '../../../models/order.model';
import { OrdersService } from '../../../services/orders.service';
import { MenuItem } from '../../../models/menu-item.model';
import { Column } from '../../../models/column.model';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

@Component({
  imports: [DatePipe, FormsModule],
  selector: 'app-orders-list',
  styleUrl: './orders-list.scss',
  templateUrl: './orders-list.html',
})
export class OrdersList implements OnInit {
  ordersList = signal<Order[]>([]);
  menuItems = signal<MenuItem[]>([]);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private orderServices = inject(OrdersService);
  private toastr = inject(ToastrService);
  now = signal(Date.now());
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  searchTerm = signal('');
  debouncedSearchTerm = signal('');
  selectedType = signal<'all' | OrderType>('all');
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

  // moveToNextStep(order: Order, OrderStatus: OrderStatus) {
  //   if (order.status === 'new') {
  //     this.orderLabelBtn.set('Start Preparing');
  //     this.orderServices.updateOrderStatus(order.id, OrderStatus[preparing]);
  //   } else if (order.status === 'preparing') {
  //     this.orderLabelBtn.set('Ready');
  //     this.orderServices.updateOrderStatus(order.id, OrderStatus.ready);
  //   } else if (order.status === 'ready') {
  //     this.orderLabelBtn.set('served');
  //     this.orderServices.updateOrderStatus(order.id, OrderStatus.served);
  //   }
  // }

  getOrderButtonLabel(status: OrderStatus): string {
    switch (status) {
      case 'new':
        return 'Start Preparing';
      case 'preparing':
        return 'Mark Ready';
      case 'ready':
        return 'Mark Served';
      case 'served':
        return 'Served';
      default:
        return 'Update';
    }
  }
  getNextStatus(status: OrderStatus): OrderStatus | null {
    switch (status) {
      case 'new':
        return 'preparing';
      case 'preparing':
        return 'ready';
      case 'ready':
        return 'served';
      default:
        return null;
    }
  }
  moveToNextStep(order: Order) {
    const previousStatus = order.status;
    const nextStatus = this.getNextStatus(order.status);

    if (!nextStatus) return;

    this.ordersList.update((orders) =>
      orders.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o)),
    );

    this.orderServices.updateOrderStatus(order.id, nextStatus).subscribe({
      next: () => {
        this.toastr.success(`Order #${order.number} moved to ${nextStatus}`);
      },
      error: () => {
        this.ordersList.update((orders) =>
          orders.map((o) => (o.id === order.id ? { ...o, status: previousStatus } : o)),
        );

        this.toastr.error(`Failed to update order #${order.number}. Please try again.`);
      },
    });
  }
  typeOptions = computed(() => {
    const types = this.ordersList().map((order) => order.type);
    return ['all', ...new Set(types)] as Array<'all' | OrderType>;
  });
  filteredOrders = computed(() => {
    const search = this.debouncedSearchTerm().trim().toLowerCase();
    const selectedType = this.selectedType();

    return this.ordersList().filter((order) => {
      const matchesType = selectedType === 'all' ? true : order.type === selectedType;

      const orderNumber = String(order.number).toLowerCase();
      const tableNumber = order.table !== null ? String(order.table).toLowerCase() : '';

      const matchesSearch = !search || orderNumber.includes(search) || tableNumber.includes(search);

      return matchesType && matchesSearch;
    });
  });
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
    this.readQueryParams();
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

    for (const o of this.filteredOrders()) {
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

  readQueryParams() {
    this.route.queryParams.subscribe((params) => {
      const search = params['search'] ?? '';
      const type = params['type'] ?? 'all';

      this.searchTerm.set(search);
      this.debouncedSearchTerm.set(search);

      if (type === 'dine-in' || type === 'takeaway' || type === 'delivery' || type === 'all') {
        this.selectedType.set(type);
      } else {
        this.selectedType.set('all');
      }
    });
  }

  onSearchChange(value: string) {
    this.searchTerm.set(value);

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debouncedSearchTerm.set(value);
      this.updateQueryParams();
    }, 400);
  }

  onTypeChange(value: 'all' | OrderType) {
    this.selectedType.set(value);
    this.updateQueryParams();
  }

  updateQueryParams() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        search: this.debouncedSearchTerm() || null,
        type: this.selectedType() !== 'all' ? this.selectedType() : null,
      },
      queryParamsHandling: 'merge',
    });
  }
  getOrderTotal(order: Order): number {
    return order.items.reduce((total, item) => {
      const menuItem = this.menuItems().find((menu) => menu.id === item.menuId);
      const price = menuItem?.price ?? 0;
      return total + price * item.qty;
    }, 0);
  }

  // getOrderTotal(order: Order): number {
  //   let total = 0;

  //   order.items.forEach((item) => {
  //     const menuItem = this.menuItems().find((menu) => menu.id === item.menuId);
  //     const price = menuItem?.price ?? 0;
  //     total += price * item.qty;
  //   });

  //   return total;
  // }

  // getOrderTotal(order: Order): number {
  //   let total = 0;

  //   for (const item of order.items) {
  //     const menuItem = this.menuItems().find((menu) => menu.id === item.menuId);
  //     const price = menuItem?.price ?? 0;
  //     total += price * item.qty;
  //   }

  //   return total;
  // }
}
