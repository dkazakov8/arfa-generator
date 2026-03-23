import type { TypeCustomer, TypeCustomerStatus } from 'shared/api/customers';
import { sleep } from 'shared/lib/timing';

const customersData: Array<TypeCustomer> = [
  { id: 'cus-1001', name: 'Acme Supplies', email: 'ops@acme.example', status: 'active' },
  { id: 'cus-1002', name: 'Northstar Retail', email: 'orders@northstar.example', status: 'active' },
  { id: 'cus-1003', name: 'Cargo Lane', email: 'billing@cargolane.example', status: 'blocked' },
  { id: 'cus-1004', name: 'Blue Yard', email: 'team@blueyard.example', status: 'archived' },
];

export async function loadCustomers(status?: TypeCustomerStatus) {
  await sleep(240);

  const customers = status ? customersData.filter((item) => item.status === status) : customersData;

  return { customers };
}
