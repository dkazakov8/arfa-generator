import type { TypeApiContract } from '../../apiContract';
import type { TypeCustomer, TypeCustomerStatus } from '../dto';

export type TypeRequest = {
  status?: TypeCustomerStatus;
};

export type TypeResponse = {
  customers: Array<TypeCustomer>;
};

export const customers: TypeApiContract<TypeRequest, TypeResponse> = {
  method: 'GET',
  path: '/customers',
};
