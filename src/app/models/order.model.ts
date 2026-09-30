export interface OrderItem {
  menuId: string;
  qty: number;
  note: string;
}
export type OrderStatus = 'new' | 'preparing' | 'ready' | 'served';
export type OrderType = 'dine-in' | 'takeaway' | 'delivery';
export interface Order {
  id: string;
  number: number;
  type: OrderType;
  table: number | null;
  phone: string | null;
  status: OrderStatus;
  createdAt: string;
  items: OrderItem[];
}
