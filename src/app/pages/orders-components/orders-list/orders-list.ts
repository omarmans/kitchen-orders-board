import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Order, OrderStatus, OrderType } from '../../../models/order.model';
import { OrdersService } from '../../../services/orders.service';
import { MenuItem } from '../../../models/menu-item.model';
import { Column } from '../../../models/column.model';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { exhaustMap, Subject, takeUntil, timer } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { calculateSubtotal, calculateTotals } from '../../../utils/order-pricing';

@Component({
  imports: [DatePipe, FormsModule, TranslatePipe],
  selector: 'app-orders-list',
  styleUrl: './orders-list.scss',
  templateUrl: './orders-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersList implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private orderServices = inject(OrdersService);
  private toastr = inject(ToastrService);
  private translate = inject(TranslateService);

  ordersList = signal<Order[]>([]);
  menuItems = signal<MenuItem[]>([]);
  now = signal(Date.now());
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  searchTerm = signal('');
  debouncedSearchTerm = signal('');
  selectedType = signal<'all' | OrderType>('all');
  private destroy$ = new Subject<void>();
  private nowIntervalId: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.startOrdersPolling();
    this.getOrdersList();
    this.getMenuList();
    this.readQueryParams();

    this.nowIntervalId = setInterval(() => {
      this.now.set(Date.now());
    }, 60000);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    if (this.nowIntervalId) {
      clearInterval(this.nowIntervalId);
    }
  }

  private startOrdersPolling() {
    timer(0, 15000)
      .pipe(
        takeUntil(this.destroy$),
        exhaustMap(() => this.orderServices.getOrders()),
      )
      .subscribe({
        next: (res) => {
          this.ordersList.set(res);
        },
        error: (err) => {
          // console.error('orders error:', err);
        },
      });
  }

  readonly columns: Column[] = [
    {
      status: 'new',
      label: 'ORDERS.STATUS_NEW',
      dot: 'bg-sky-500',
      badge: 'bg-sky-100 text-sky-700',
    },
    {
      status: 'preparing',
      label: 'ORDERS.STATUS_PREPARING',
      dot: 'bg-amber-500',
      badge: 'bg-amber-100 text-amber-700',
    },
    {
      status: 'ready',
      label: 'ORDERS.STATUS_READY',
      dot: 'bg-emerald-500',
      badge: 'bg-emerald-100 text-emerald-700',
    },
    {
      status: 'served',
      label: 'ORDERS.STATUS_SERVED',
      dot: 'bg-slate-400',
      badge: 'bg-slate-200 text-slate-600',
    },
  ];

  showDetails(order: Order) {
    this.router.navigate(['/order-details', order.id]);
  }

  newOrder() {
    this.router.navigate(['/new-order']);
  }

  getOrderButtonLabel(status: OrderStatus): string {
    switch (status) {
      case 'new':
        return this.translate.instant('ORDERS.BTN_START_PREPARING');
      case 'preparing':
        return this.translate.instant('ORDERS.BTN_MARK_READY');
      case 'ready':
        return this.translate.instant('ORDERS.BTN_MARK_SERVED');
      case 'served':
        return this.translate.instant('ORDERS.BTN_SERVED');
      default:
        return this.translate.instant('ORDERS.BTN_UPDATE');
    }
  }

  getStatusLabel(status: OrderStatus): string {
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

  getTypeLabel(type: OrderType): string {
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
        this.toastr.success(
          this.translate.instant('ORDERS.ORDER_MOVED', {
            number: order.number,
            status: this.getStatusLabel(nextStatus),
          }),
        );
      },
      error: () => {
        this.ordersList.update((orders) =>
          orders.map((o) => (o.id === order.id ? { ...o, status: previousStatus } : o)),
        );

        this.toastr.error(
          this.translate.instant('ORDERS.ORDER_UPDATE_FAILED', {
            number: order.number,
          }),
        );
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
      },
      error: (err) => {
        // console.error('orders error:', err);
      },
    });
  }

  getMenuList() {
    this.orderServices.getMenuItmes().subscribe({
      next: (res) => {
        this.menuItems.set(res);
      },
      error: (err) => {
        // console.error('menu error:', err);
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
    const subtotal = calculateSubtotal(order.items, this.menuItems());
    return calculateTotals(subtotal, order.type).total;
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
