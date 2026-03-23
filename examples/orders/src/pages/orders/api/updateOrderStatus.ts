import type { TypeOrderStatus } from 'shared/api/orders';
import { sleep } from 'shared/lib/timing';

import { ordersData } from './loadOrders';

export async function updateOrderStatus(orderId: string, status: TypeOrderStatus) {
  await sleep(220);

  const order = ordersData.find((item) => item.id === orderId);

  if (!order) throw new Error(`Order not found: ${orderId}`);

  order.status = status;

  return { order };
}
