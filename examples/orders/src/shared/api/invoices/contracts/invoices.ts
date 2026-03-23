import type { TypeApiContract } from '../../apiContract';
import type { TypeInvoice, TypeInvoiceStatus } from '../dto';

export type TypeRequest = {
  status?: TypeInvoiceStatus;
};

export type TypeResponse = {
  invoices: Array<TypeInvoice>;
};

export const invoices: TypeApiContract<TypeRequest, TypeResponse> = {
  method: 'GET',
  path: '/invoices',
};
