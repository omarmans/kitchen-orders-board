import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { vi } from 'vitest';
import { MenuItem } from '../../../models/menu-item.model';
import { OrdersService } from '../../../services/orders.service';
import { NewOrder } from './new-order';

describe('NewOrder', () => {
  let component: NewOrder;
  let fixture: ComponentFixture<NewOrder>;
  let ordersService: { getOrders: any; getMenuItmes: any; addNewOrder: any };
  let toastr: { success: any; error: any };
  let router: Router;

  const menu = [
    { id: 'm1', price: 50 },
    { id: 'm2', price: 30 },
  ] as unknown as MenuItem[];

  function setup(orders$: Observable<any[]> = of([])) {
    ordersService = {
      getOrders: vi.fn().mockReturnValue(orders$),
      getMenuItmes: vi.fn().mockReturnValue(of(menu)),
      addNewOrder: vi.fn().mockReturnValue(of({})),
    };
    toastr = { success: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      imports: [NewOrder],
      providers: [
        provideRouter([]),
        { provide: OrdersService, useValue: ordersService },
        { provide: ToastrService, useValue: toastr },
      ],
    });

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(NewOrder);
    component = fixture.componentInstance;
    fixture.detectChanges(); //  ngOnInit
  }

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create and load initial data', () => {
    setup();
    expect(component).toBeTruthy();
    expect(ordersService.getOrders).toHaveBeenCalled();
    expect(ordersService.getMenuItmes).toHaveBeenCalled();
    expect(component.menuItems()).toEqual(menu);
  });

  describe('setNextOrderNumber', () => {
    it('should be max number + 1', () => {
      setup(of([{ number: 3 }, { number: 7 }, { number: 5 }]));
      expect(component.newOrderId()).toBe(8);
      expect(component.form.value.number).toBe(8);
    });

    it('should be 1 when there are no orders', () => {
      setup(of([]));
      expect(component.newOrderId()).toBe(1);
    });

    it('should fall back to 1 on error', () => {
      setup(throwError(() => new Error('fail')));
      expect(component.newOrderId()).toBe(1);
    });
  });

  describe('order type changes', () => {
    beforeEach(() => setup());

    it('delivery shows phone and validates Egyptian numbers', () => {
      component.form.get('type')!.setValue('delivery');
      expect(component.showPhone()).toBe(true);

      const phone = component.form.get('phone')!;
      phone.setValue('123');
      expect(phone.invalid).toBe(true);

      phone.setValue('01012345678');
      expect(phone.valid).toBe(true);
    });

    it('dine-in shows table, other types hide it', () => {
      const type = component.form.get('type')!;
      type.setValue('takeaway');
      expect(component.showTable()).toBe(false);

      type.setValue('dine-in');
      expect(component.showTable()).toBe(true);

      const table = component.form.get('table')!;
      table.setValue(41);
      expect(table.invalid).toBe(true);
    });
  });

  describe('item rows', () => {
    beforeEach(() => setup());

    it('should compute price and total when item and quantity change', () => {
      const row = component.itemsArray.at(0);

      row.get('itemId')!.setValue('m1');
      expect(row.get('price')!.value).toBe(50);
      expect(row.get('total')!.value).toBe(50);

      row.get('quantity')!.setValue(3);
      expect(row.get('total')!.value).toBe(150);
    });

    it('should add and remove rows but keep at least one', () => {
      component.addItemRow();
      expect(component.itemsArray.length).toBe(2);

      component.removeItemRow(0);
      expect(component.itemsArray.length).toBe(1);

      component.removeItemRow(0);
      expect(component.itemsArray.length).toBe(1);
    });

    it('getOrderTotal should sum all rows', () => {
      component.addItemRow();
      const [r1, r2] = component.itemsArray.controls;

      r1.get('itemId')!.setValue('m1');
      r1.get('quantity')!.setValue(2);
      r2.get('itemId')!.setValue('m2');
      r2.get('quantity')!.setValue(1);

      expect(component.getOrderTotal()).toBe(130);
    });
  });

  describe('submit', () => {
    beforeEach(() => setup());

    it('should not call API and should show error when form is invalid', () => {
      component.submit(); // itemId
      expect(ordersService.addNewOrder).not.toHaveBeenCalled();
      expect(toastr.error).toHaveBeenCalledWith(
        'Please fill all required fields correctly',
        'Invalid Form',
      );
    });

    it('should send the correct payload and navigate on success', () => {
      const row = component.itemsArray.at(0);
      row.get('itemId')!.setValue('m1');
      row.get('quantity')!.setValue(2);
      row.get('note')!.setValue('no onions');

      component.submit();

      expect(ordersService.addNewOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '1',
          number: 1,
          type: 'dine-in',
          table: 1,
          phone: null,
          items: [{ menuId: 'm1', qty: 2, note: 'no onions' }],
        }),
      );
      expect(toastr.success).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/order-list']);
      expect(component.loading()).toBe(false);
    });

    it('should show error toast and stop loading on API failure', () => {
      ordersService.addNewOrder.mockReturnValue(throwError(() => new Error('fail')));

      component.itemsArray.at(0).get('itemId')!.setValue('m1');
      component.submit();

      expect(toastr.error).toHaveBeenCalledWith('Failed to create order', 'Error');
      expect(router.navigate).not.toHaveBeenCalled();
      expect(component.loading()).toBe(false);
    });
  });
});
