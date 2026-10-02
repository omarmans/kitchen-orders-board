import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { OrdersService } from '../../../services/orders.service';
import { Router, RouterLink } from '@angular/router';
import { OrderType } from '../../../models/order.model';
import { DatePipe } from '@angular/common';
import { MenuItem } from '../../../models/menu-item.model';
import { ToastrService } from 'ngx-toastr';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { calculateTotals } from '../../../utils/order-pricing';

@Component({
  imports: [ReactiveFormsModule, DatePipe, RouterLink, TranslatePipe],
  selector: 'app-new-order',
  styleUrl: './new-order.scss',
  templateUrl: './new-order.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewOrder implements OnInit {
  private orderServices = inject(OrdersService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private toastr = inject(ToastrService);
  private translate = inject(TranslateService);

  form!: FormGroup;
  createdAt = signal<string>(new Date().toISOString());
  showTable = signal<boolean>(true);
  showPhone = signal<boolean>(false);
  loading = signal<boolean>(false);
  newOrderId = signal<number | string>('');
  orderTypes = signal<OrderType[]>(['dine-in', 'takeaway', 'delivery']);
  menuItems = signal<MenuItem[]>([]);

  ngOnInit() {
    this.buildForm();
    this.setNextOrderNumber();
    this.getMenuList();
  }

  // setNextOrderNumber() {
  //   this.orderServices.getOrders().subscribe({
  //     next: (orders) => {
  //       if (orders && orders.length > 0) {
  //         orders.sort((a, b) => b.number - a.number);
  //         const nextNumber = orders[0].number + 1;
  //         this.newOrderId.set(nextNumber);
  //       } else {
  //         this.newOrderId.set(1);
  //       }

  //       this.buildForm();
  //     },
  //     error: (err) => {
  //       console.error(err);
  //       this.newOrderId.set(1);
  //       this.buildForm();
  //     },
  //   });
  // }

  setNextOrderNumber() {
    this.orderServices.getOrders().subscribe({
      next: (orders) => {
        const nextNumber = orders?.length ? Math.max(...orders.map((o) => o.number)) + 1 : 1;
        this.applyOrderNumber(nextNumber);
      },
      error: (err) => {
        console.error(err);
        this.applyOrderNumber(1);
      },
    });
  }

  private applyOrderNumber(orderNumber: number) {
    this.newOrderId.set(orderNumber);
    this.form.patchValue({ id: orderNumber, number: orderNumber });
  }
  getMenuList() {
    this.orderServices.getMenuItmes().subscribe({
      next: (res) => {
        this.menuItems.set(res);
      },
      error: (err) => {
        console.error('menu error:', err);
      },
    });
  }

  buildForm() {
    this.form = this.fb.group({
      id: [this.newOrderId()],
      number: [this.newOrderId()],
      type: ['dine-in', Validators.required],
      table: [1],
      phone: [''],
      status: ['new'],
      createdAt: [new Date().toISOString()],
      items: this.fb.array([this.createItemRow()], Validators.minLength(1)),
    });

    this.form.get('type')?.valueChanges.subscribe((value) => {
      const phone = this.form.get('phone');
      const table = this.form.get('table');

      if (value === 'delivery') {
        this.showPhone.set(true);
        phone?.setValidators([
          Validators.required,
          Validators.maxLength(11),
          Validators.pattern(/^01[0125]\d{8}$/),
        ]);
      } else {
        phone?.clearValidators();
        phone?.setValue('');
        this.showPhone.set(false);
      }
      phone?.updateValueAndValidity();

      if (value === 'dine-in') {
        this.showTable.set(true);
        table?.setValidators([Validators.required, Validators.min(1), Validators.max(40)]);
      } else {
        table?.clearValidators();
        table?.setValue(null);
        this.showTable.set(false);
      }
      table?.updateValueAndValidity();
    });
  }

  createItemRow(): FormGroup {
    const row = this.fb.group({
      itemId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      note: [''],
      price: [{ value: 0, disabled: true }],
      total: [{ value: 0, disabled: true }],
    });

    row.get('itemId')?.valueChanges.subscribe((itemId) => {
      const selectedItem = this.menuItems().find((item) => item.id === itemId);
      const price = selectedItem?.price || 0;
      row.get('price')?.setValue(price, { emitEvent: false });

      const quantity = Number(row.get('quantity')?.value || 0);
      row.get('total')?.setValue(price * quantity, { emitEvent: false });
    });

    row.get('quantity')?.valueChanges.subscribe((qty) => {
      const quantity = Number(qty || 0);
      const price = Number(row.get('price')?.value || 0);
      row.get('total')?.setValue(price * quantity, { emitEvent: false });
    });

    return row;
  }

  get itemsArray(): FormArray {
    return this.form.get('items') as FormArray;
  }

  addItemRow() {
    this.itemsArray.push(this.createItemRow());
  }

  removeItemRow(index: number) {
    if (this.itemsArray.length > 1) {
      this.itemsArray.removeAt(index);
    }
  }

  // getOrderTotal(): number {
  //   return this.itemsArray.controls.reduce((sum, row) => {
  //     return sum + Number(row.get('total')?.value || 0);
  //   }, 0);
  // }
  getOrderTotal(): number {
    const subtotal = this.itemsArray.controls.reduce(
      (sum, row) => sum + Number(row.get('total')?.value || 0),
      0,
    );
    return calculateTotals(subtotal, this.form.get('type')?.value).total;
  }
  getOrderTypeLabel(type: OrderType): string {
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

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastr.error(
        this.translate.instant('NEW_ORDER.INVALID_FORM_MESSAGE'),
        this.translate.instant('NEW_ORDER.INVALID_FORM_TITLE'),
      );
      return;
    }

    this.loading.set(true);

    const rawValue = this.form.getRawValue();

    const payload = {
      id: String(rawValue.id),
      number: rawValue.number,
      type: rawValue.type,
      table: rawValue.type === 'dine-in' ? rawValue.table : null,
      phone: rawValue.type === 'delivery' ? rawValue.phone : null,
      status: rawValue.status,
      createdAt: rawValue.createdAt,
      items: rawValue.items.map((item: any) => ({
        menuId: item.itemId,
        qty: item.quantity,
        note: item.note || '',
      })),
    };

    this.orderServices.addNewOrder(payload).subscribe({
      next: (res) => {
        // console.log('order created:', res);
        this.loading.set(false);
        this.form.reset();
        this.toastr.success(
          this.translate.instant('NEW_ORDER.SUCCESS_MESSAGE'),
          this.translate.instant('NEW_ORDER.SUCCESS_TITLE'),
        );
        this.router.navigate(['/order-list']);
      },
      error: (err) => {
        console.error('create order error:', err);
        this.loading.set(false);
        this.toastr.error(
          this.translate.instant('NEW_ORDER.ERROR_MESSAGE'),
          this.translate.instant('NEW_ORDER.ERROR_TITLE'),
        );
      },
    });
  }
}
