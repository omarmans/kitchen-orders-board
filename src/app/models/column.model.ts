import { OrderStatus } from './order.model';

export interface Column {
  status: OrderStatus;
  label: string;
  dot: string;
  badge: string;
}
