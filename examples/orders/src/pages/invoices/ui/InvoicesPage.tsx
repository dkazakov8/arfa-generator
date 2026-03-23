import { useEffect, useMemo, useState } from 'react';

import type { TypeInvoice, TypeInvoiceStatus } from 'shared/api/invoices';
import { formatDate } from 'shared/lib/dates';
import { Button } from 'shared/ui/Button';
import { DataTable, type TypeColumn } from 'shared/ui/DataTable';
import { EmptyState } from 'shared/ui/EmptyState';
import { MoneyText } from 'shared/ui/MoneyText';

import { loadInvoices } from '../api';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import styles from './InvoicesPage.module.css';

const statuses: Array<TypeInvoiceStatus | 'all'> = [
  'all',
  'draft',
  'sent',
  'paid',
  'overdue',
  'void',
];

export function InvoicesPage() {
  const [filter, setFilter] = useState<TypeInvoiceStatus | 'all'>('all');
  const [invoices, setInvoices] = useState<Array<TypeInvoice>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);

    loadInvoices(filter === 'all' ? undefined : filter).then((result) => {
      if (cancelled) return;

      setInvoices(result.invoices);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [filter]);

  const columns = useMemo<Array<TypeColumn<TypeInvoice>>>(
    () => [
      { key: 'id', title: 'Invoice', render: (invoice) => invoice.id },
      { key: 'order', title: 'Order', render: (invoice) => invoice.orderId },
      {
        key: 'amount',
        title: 'Amount',
        render: (invoice) => <MoneyText amount={invoice.amount} currency={invoice.currency} />,
      },
      { key: 'due', title: 'Due', render: (invoice) => formatDate(invoice.dueDate) },
      {
        key: 'status',
        title: 'Status',
        render: (invoice) => <InvoiceStatusBadge status={invoice.status} />,
      },
    ],
    []
  );

  return (
    <section className={styles.page}>
      <div className={styles.toolbar}>
        <div>
          <h2>Invoices</h2>
          <p>Watch billing state for orders that need follow-up.</p>
        </div>
        <div className={styles.filters}>
          {statuses.map((status) => (
            <Button
              key={status}
              variant={filter === status ? 'primary' : 'secondary'}
              onClick={() => setFilter(status)}
            >
              {status}
            </Button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className={styles.loading}>Loading invoices...</div>
      ) : invoices.length ? (
        <DataTable columns={columns} getRowKey={(invoice) => invoice.id} rows={invoices} />
      ) : (
        <EmptyState title="No invoices found" description="Try another status filter." />
      )}
    </section>
  );
}
