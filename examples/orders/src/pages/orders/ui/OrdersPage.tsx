import { useEffect, useMemo, useState } from 'react';

import type { TypeOrder, TypeOrderStatus } from 'shared/api/orders';
import { formatDate } from 'shared/lib/dates';
import { Button } from 'shared/ui/Button';
import { DataTable, type TypeColumn } from 'shared/ui/DataTable';
import { EmptyState } from 'shared/ui/EmptyState';
import { MoneyText } from 'shared/ui/MoneyText';

import { loadOrders, updateOrderStatus } from '../api';
import { OrderStatusBadge } from './OrderStatusBadge';
import styles from './OrdersPage.module.css';

const statuses: Array<TypeOrderStatus | 'all'> = [
  'all',
  'draft',
  'confirmed',
  'packed',
  'shipped',
  'cancelled',
];

export function OrdersPage() {
  const [filter, setFilter] = useState<TypeOrderStatus | 'all'>('all');
  const [orders, setOrders] = useState<Array<TypeOrder>>([]);
  const [loading, setLoading] = useState(true);
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);

    loadOrders(filter === 'all' ? undefined : filter).then((result) => {
      if (cancelled) return;

      setOrders(result.orders);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [filter]);

  const columns = useMemo<Array<TypeColumn<TypeOrder>>>(
    () => [
      { key: 'id', title: 'Order', render: (order) => order.id },
      { key: 'date', title: 'Created', render: (order) => formatDate(order.createdAt) },
      {
        key: 'total',
        title: 'Total',
        render: (order) => <MoneyText amount={order.total} currency={order.currency} />,
      },
      {
        key: 'status',
        title: 'Status',
        render: (order) => <OrderStatusBadge status={order.status} />,
      },
      {
        key: 'action',
        title: 'Action',
        render: (order) => (
          <Button
            disabled={savingOrderId === order.id || order.status === 'shipped'}
            onClick={() => {
              setSavingOrderId(order.id);
              updateOrderStatus(order.id, 'shipped').then(({ order: updatedOrder }) => {
                setOrders((current) =>
                  current.map((item) => (item.id === updatedOrder.id ? updatedOrder : item))
                );
                setSavingOrderId(null);
              });
            }}
          >
            Mark shipped
          </Button>
        ),
      },
    ],
    [savingOrderId]
  );

  return (
    <section className={styles.page}>
      <div className={styles.toolbar}>
        <div>
          <h2>Orders</h2>
          <p>Track fulfillment status and move confirmed orders forward.</p>
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
        <div className={styles.loading}>Loading orders...</div>
      ) : orders.length ? (
        <DataTable columns={columns} getRowKey={(order) => order.id} rows={orders} />
      ) : (
        <EmptyState title="No orders found" description="Try another status filter." />
      )}
    </section>
  );
}
