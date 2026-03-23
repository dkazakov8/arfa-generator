import type { TypeInvoice, TypeInvoiceStatus } from 'shared/api/invoices';
import { sleep } from 'shared/lib/timing';

const invoicesData: Array<TypeInvoice> = [
  {
    id: 'inv-9001',
    orderId: 'ord-24001',
    amount: 18400,
    currency: 'USD',
    status: 'sent',
    dueDate: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'inv-9002',
    orderId: 'ord-24002',
    amount: 9200,
    currency: 'USD',
    status: 'paid',
    dueDate: '2026-05-27T00:00:00.000Z',
  },
  {
    id: 'inv-9003',
    orderId: 'ord-24003',
    amount: 31800,
    currency: 'EUR',
    status: 'draft',
    dueDate: '2026-06-04T00:00:00.000Z',
  },
  {
    id: 'inv-9004',
    orderId: 'ord-24004',
    amount: 7400,
    currency: 'USD',
    status: 'overdue',
    dueDate: '2026-05-10T00:00:00.000Z',
  },
];

export async function loadInvoices(status?: TypeInvoiceStatus) {
  await sleep(260);

  const invoices = status ? invoicesData.filter((item) => item.status === status) : invoicesData;

  return { invoices };
}
