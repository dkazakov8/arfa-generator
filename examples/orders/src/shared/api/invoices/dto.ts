import type { TypeCurrency } from 'shared/lib/money';

export type TypeInvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void';

export type TypeInvoice = {
  id: string;
  orderId: string;
  amount: number;
  currency: TypeCurrency;
  status: TypeInvoiceStatus;
  dueDate: string;
};
