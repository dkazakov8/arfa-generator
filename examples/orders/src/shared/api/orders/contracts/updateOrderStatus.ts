import type { TypeApiContract } from '../../apiContract';
import type { TypeOrder, TypeOrderStatus } from '../dto';

export type TypeRequest = {
  orderId: string;
  status: TypeOrderStatus;
};

export type TypeResponse = {
  order: TypeOrder;
};

export const updateOrderStatus: TypeApiContract<TypeRequest, TypeResponse> = {
  method: 'PATCH',
  path: '/orders/:orderId/status',
};
