import type { TypeInvoiceStatus } from 'shared/api/invoices';

import styles from './InvoiceStatusBadge.module.css';
import { messages } from './messages';

type PropsInvoiceStatusBadge = {
  status: TypeInvoiceStatus;
};

export function InvoiceStatusBadge({ status }: PropsInvoiceStatusBadge) {
  return (
    <span className={`${styles.badge} ${styles[status]}`}>{messages[status].defaultValue}</span>
  );
}
