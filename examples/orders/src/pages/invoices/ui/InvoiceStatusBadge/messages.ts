import { createMessages } from 'shared/i18n';

export const messages = createMessages('pages/invoices/InvoiceStatusBadge', {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
  void: 'Void',
});
