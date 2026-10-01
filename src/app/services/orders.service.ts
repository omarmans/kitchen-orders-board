import { HttpClient } from '@angular/common/http';
import { inject, Service, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { MenuItem } from '../models/menu-item.model';
import { Order, OrderStatus } from '../models/order.model';

@Service()
export class OrdersService {
  private http = inject(HttpClient);
  private baseUrl = signal<string>(environment.baseUrl);

  getOrders() {
    return this.http.get<Order[]>(`${this.baseUrl()}/orders`);
  }
  getOrderById(id: string) {
    return this.http.get<Order>(`${this.baseUrl()}/orders/${id}`);
  }

  addNewOrder(newOrder: Order) {
    return this.http.post<Order>(`${this.baseUrl()}/orders`, newOrder);
  }
  updateOrderStatus(id: number | string, status: OrderStatus) {
    return this.http.patch<Order>(`${this.baseUrl()}/orders/${id}`, { status });
  }
  getMenuItmes() {
    return this.http.get<MenuItem[]>(`${this.baseUrl()}/menu`);
  }
}
