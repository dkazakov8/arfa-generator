import { formatMoney, type TypeCurrency } from 'shared/lib/money';

import styles from './MoneyText.module.css';

type PropsMoneyText = {
  amount: number;
  currency: TypeCurrency;
};

export function MoneyText({ amount, currency }: PropsMoneyText) {
  return <span className={styles.money}>{formatMoney(amount, currency)}</span>;
}
