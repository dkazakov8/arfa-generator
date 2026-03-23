import { createMessages } from 'shared/i18n';

export const messages = createMessages('pages/orders/OrderStatusBadge', {
  draft: 'Draft',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  cancelled: 'Cancelled',
});
