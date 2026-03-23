export type TypeCustomerStatus = 'active' | 'blocked' | 'archived';

export type TypeCustomer = {
  id: string;
  name: string;
  email: string;
  status: TypeCustomerStatus;
};
