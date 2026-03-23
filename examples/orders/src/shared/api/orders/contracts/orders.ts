import type { TypeApiContract } from '../../apiContract';
import type { TypeOrder, TypeOrderStatus } from '../dto';

export type TypeRequest = {
  status?: TypeOrderStatus;
};

export type TypeResponse = {
  orders: Array<TypeOrder>;
};

export const orders: TypeApiContract<TypeRequest, TypeResponse> = {
  method: 'GET',
  path: '/orders',
};
