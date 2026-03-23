```ts
import { check, type TypeRootSchema } from '@arfa-tools/generator/api-contract-check/checker';

const socket = new WebSocket('wss://example.com/api');
const pending = new Map<string, (value: unknown) => void>();

socket.addEventListener('message', (event: MessageEvent<string>) => {
  const { id, payload } = JSON.parse(event.data);
  
  pending.get(id)?.(payload);
  
  pending.delete(id);
});

async function request<TRequest, TResponse>({ method, validator, payload }: {
  method: string;
  payload: TRequest;
  validator: TypeRootSchema;
}): Promise<TResponse> {
  const requestErrors = check({
    schema: validator,
    type: 'request',
    value: payload,
    getExtraneous: console.warn,
  });

  if (requestErrors) {
    throw new Error(`Request validation failed:\n${requestErrors.join('\n')}`);
  }

  const response = await new Promise<unknown>((resolve) => {
    const id = crypto.randomUUID();
    
    pending.set(id, resolve);
    
    socket.send(JSON.stringify({ id, method, payload }));
  });

  const responseErrors = check({
    schema: validator,
    type: 'response',
    value: response,
    getExtraneous: console.warn,
  });

  if (responseErrors) {
    throw new Error(`Response validation failed:\n${responseErrors.join('\n')}`);
  }

  return response as TResponse;
}

import type { TypeRequest, TypeResponse } from './api/getUser';
import { getUser } from './validators/api/getUser';

const user = await request<TypeRequest, TypeResponse>({
  method: 'getUser',
  payload: { id: 'user-1' },
  validator: getUser,
});
```
