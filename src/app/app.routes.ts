import { Routes } from '@angular/router';
import { OrdersList } from './pages/orders-components/orders-list/orders-list';

export const routes: Routes = [
  { path: '', redirectTo: 'order-list', pathMatch: 'full' },
  { path: 'order-list', component: OrdersList },
  {
    path: 'order-details/:id',
    loadComponent: () =>
      import('./pages/orders-components/order-details/order-details').then((m) => m.OrderDetails),
  },
];
