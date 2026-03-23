export type TypeApiContract<TRequest, TResponse> = {
  method: 'GET' | 'PATCH';
  path: string;
  request?: TRequest;
  response?: TResponse;
};
