```ts
import { check } from '@arfa-tools/generator/api-contract-check/checker';

const schema = { request: { id: 'string' }, response: 'any' } as const;
const value = { id: 'user-1', debug: true };

const errors = check({
  schema,
  value,
  type: 'request',
  getExtraneous: (paths) => console.log(paths), // ['request.debug']
});

console.log(errors); // null
console.log(value); // { id: 'user-1' }
```
