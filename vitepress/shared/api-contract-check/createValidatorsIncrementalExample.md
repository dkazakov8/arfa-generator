```ts
import path from 'node:path';

import { createValidators } from '@arfa-tools/generator/api-contract-check/builder';

const getUser = path.resolve('src/api/getUser.ts');
const getTeam = path.resolve('src/api/getTeam.ts');
const getTask = path.resolve('src/api/getTask.ts');
const userModel = path.resolve('src/models/TypeUser.ts');

const options = {
  tsconfigPath: 'tsconfig.json',
  requestDeclaration: 'TypeRequest',
  responseDeclaration: 'TypeResponse',
};

const { deps } = createValidators([getUser, getTeam, getTask], options);

// Only getUser.ts and getTeam.ts import TypeUser.ts.
console.log(deps[userModel]); // [getTeam, getUser]

const affectedEntries = deps[userModel] ?? [];

if (affectedEntries.length) {
  const next = createValidators(affectedEntries, options);

  // getTask.ts is not rebuilt
  console.log(next.result.map(({ filePath }) => filePath)); // [getTeam, getUser]
}
```
