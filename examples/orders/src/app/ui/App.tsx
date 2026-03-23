import { useState } from 'react';

import { CustomersPage } from 'pages/customers';
import { InvoicesPage } from 'pages/invoices';
import { OrdersPage } from 'pages/orders';
import { usedTranslations } from 'shared/i18n';

import { AppLayout } from './AppLayout/AppLayout';

console.log(usedTranslations);

type TypeSection = 'orders' | 'customers' | 'invoices';

export function App() {
  const [section, setSection] = useState<TypeSection>('orders');

  return (
    <AppLayout activeSection={section} onSectionChange={setSection}>
      {section === 'orders' && <OrdersPage />}
      {section === 'customers' && <CustomersPage />}
      {section === 'invoices' && <InvoicesPage />}
    </AppLayout>
  );
}
