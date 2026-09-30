import { TestBed } from '@angular/core/testing';
import { OrdersServiceTs } from './orders.service.ts';

describe('OrdersServiceTs', () => {
  let service: OrdersServiceTs;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OrdersServiceTs);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
