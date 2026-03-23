import type { TypeCustomerStatus } from 'shared/api/customers';

import styles from './CustomerStatusBadge.module.css';
import { messages } from './messages';

type PropsCustomerStatusBadge = {
  status: TypeCustomerStatus;
};

export function CustomerStatusBadge({ status }: PropsCustomerStatusBadge) {
  return (
    <span className={`${styles.badge} ${styles[status]}`}>{messages[status].defaultValue}</span>
  );
}
