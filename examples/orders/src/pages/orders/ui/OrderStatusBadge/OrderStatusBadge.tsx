import type { TypeOrderStatus } from 'shared/api/orders';

import { messages } from './messages';
import styles from './OrderStatusBadge.module.css';

type PropsOrderStatusBadge = {
  status: TypeOrderStatus;
};

export function OrderStatusBadge({ status }: PropsOrderStatusBadge) {
  return (
    <span className={`${styles.badge} ${styles[status]}`}>{messages[status].defaultValue}</span>
  );
}
