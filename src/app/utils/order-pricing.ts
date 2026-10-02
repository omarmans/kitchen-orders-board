import { MenuItem } from '../models/menu-item.model';
import { OrderType } from '../models/order.model';

const SERVICE_RATE = 0.12;
const VAT_RATE = 0.14;

export interface OrderTotals {
  subtotal: number;
  service: number;
  vat: number;
  total: number;
}

export function calculateSubtotal(
  items: { menuId: string; qty: number }[],
  menuItems: MenuItem[],
): number {
  return items.reduce((sum, item) => {
    const price = menuItems.find((m) => m.id === item.menuId)?.price ?? 0;
    return sum + price * item.qty;
  }, 0);
}

export function calculateTotals(subtotal: number, type: OrderType): OrderTotals {
  const service = type === 'dine-in' ? subtotal * SERVICE_RATE : 0;
  const vat = (subtotal + service) * VAT_RATE;

  return { subtotal, service, vat, total: subtotal + service + vat };
}
