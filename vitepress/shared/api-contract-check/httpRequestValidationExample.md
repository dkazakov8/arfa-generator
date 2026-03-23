```ts
import { check, type TypeRootSchema } from '@arfa-tools/generator/api-contract-check/checker';

async function request<TRequest, TResponse>({ url, validator, request }: {
  url: string;
  request: TRequest;
  validator: TypeRootSchema;
}): Promise<TResponse> {
  const requestErrors = check({ 
    schema: validator, 
    type: 'request', 
    value: request,
    getExtraneous: console.warn 
  });
  
  if (requestErrors) {
    throw new Error(`Request validation failed:\n${requestErrors.join('\n')}`);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);

  const value: unknown = await response.json();
  
  const responseErrors = check({ 
    schema: validator, 
    type: 'response', 
    value, 
    getExtraneous: console.warn 
  });
  
  if (responseErrors) {
    throw new Error(`Response validation failed:\n${responseErrors.join('\n')}`);
  }

  return value as TResponse;
}

import type { TypeRequest, TypeResponse } from './api/getUser';
import { getUser } from './validators/api/getUser';

const user = await request<TypeRequest, TypeResponse>({
  url: '/api/getUser',
  request: { id: 'user-1' },
  validator: getUser,
});
```
