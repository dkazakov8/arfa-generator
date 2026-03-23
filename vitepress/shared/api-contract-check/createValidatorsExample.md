```ts
import path from 'node:path';

import { createValidators } from '@arfa-tools/generator/api-contract-check/builder';

const { result, deps } = createValidators(
  [path.resolve('src/api/getUser.ts')],
  {
    tsconfigPath: 'tsconfig.json',
    requestDeclaration: 'TypeRequest',
    responseDeclaration: 'TypeResponse',
    getDegraded: (names) => console.log(names),
  }
);
```
