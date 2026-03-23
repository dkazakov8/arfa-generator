import type { TypeOrder, TypeOrderStatus } from 'shared/api/orders';
import { sleep } from 'shared/lib/timing';

export const ordersData: Array<TypeOrder> = [
  {
    id: 'ord-24001',
    customerId: 'cus-1001',
    total: 18400,
    currency: 'USD',
    status: 'confirmed',
    createdAt: '2026-05-11T08:30:00.000Z',
  },
  {
    id: 'ord-24002',
    customerId: 'cus-1002',
    total: 9200,
    currency: 'USD',
    status: 'packed',
    createdAt: '2026-05-12T12:15:00.000Z',
  },
  {
    id: 'ord-24003',
    customerId: 'cus-1003',
    total: 31800,
    currency: 'EUR',
    status: 'draft',
    createdAt: '2026-05-13T10:05:00.000Z',
  },
  {
    id: 'ord-24004',
    customerId: 'cus-1001',
    total: 7400,
    currency: 'USD',
    status: 'shipped',
    createdAt: '2026-05-14T14:45:00.000Z',
  },
];

export async function loadOrders(status?: TypeOrderStatus) {
  await sleep(300);

  const orders = status ? ordersData.filter((item) => item.status === status) : ordersData;

  return { orders };
}
