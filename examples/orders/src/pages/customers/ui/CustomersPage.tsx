import { useEffect, useMemo, useState } from 'react';

import type { TypeCustomer, TypeCustomerStatus } from 'shared/api/customers';
import { Button } from 'shared/ui/Button';
import { DataTable, type TypeColumn } from 'shared/ui/DataTable';
import { EmptyState } from 'shared/ui/EmptyState';

import { loadCustomers } from '../api';
import { CustomerStatusBadge } from './CustomerStatusBadge';
import styles from './CustomersPage.module.css';

const statuses: Array<TypeCustomerStatus | 'all'> = ['all', 'active', 'blocked', 'archived'];

export function CustomersPage() {
  const [filter, setFilter] = useState<TypeCustomerStatus | 'all'>('all');
  const [customers, setCustomers] = useState<Array<TypeCustomer>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);

    loadCustomers(filter === 'all' ? undefined : filter).then((result) => {
      if (cancelled) return;

      setCustomers(result.customers);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [filter]);

  const columns = useMemo<Array<TypeColumn<TypeCustomer>>>(
    () => [
      { key: 'name', title: 'Customer', render: (customer) => customer.name },
      { key: 'email', title: 'Email', render: (customer) => customer.email },
      {
        key: 'status',
        title: 'Status',
        render: (customer) => <CustomerStatusBadge status={customer.status} />,
      },
    ],
    []
  );

  return (
    <section className={styles.page}>
      <div className={styles.toolbar}>
        <div>
          <h2>Customers</h2>
          <p>Review customer account state before processing orders.</p>
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
        <div className={styles.loading}>Loading customers...</div>
      ) : customers.length ? (
        <DataTable columns={columns} getRowKey={(customer) => customer.id} rows={customers} />
      ) : (
        <EmptyState title="No customers found" description="Try another status filter." />
      )}
    </section>
  );
}
