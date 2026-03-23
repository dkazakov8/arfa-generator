import type { TypeCurrency } from 'shared/lib/money';

export type TypeOrderStatus = 'draft' | 'confirmed' | 'packed' | 'shipped' | 'cancelled';

export type TypeOrder = {
  id: string;
  customerId: string;
  total: number;
  currency: TypeCurrency;
  status: TypeOrderStatus;
  createdAt: string;
};
