import { HttpClient } from '@angular/common/http';
import { inject, Service, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { MenuItem } from '../models/menu-item.model';
import { Order } from '../models/order.model';

@Service()
export class OrdersService {
  private http = inject(HttpClient);
  private baseUrl = signal<string>(environment.baseUrl);

  getOrders() {
    return this.http.get<Order[]>(`${this.baseUrl()}/orders`);
  }
  getMenuItmes() {
    return this.http.get<MenuItem[]>(`${this.baseUrl()}/menu`);
  }
}
