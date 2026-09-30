import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { OrdersList } from './pages/orders-components/orders-list/orders-list';

@Component({
  imports: [RouterOutlet, OrdersList],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('kitchen-orders-board');
}
