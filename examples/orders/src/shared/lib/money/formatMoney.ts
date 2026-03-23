import type { TypeCurrency } from './money';

export function formatMoney(amount: number, currency: TypeCurrency): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
