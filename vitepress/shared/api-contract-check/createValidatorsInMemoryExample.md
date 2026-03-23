```ts
const entryFilePath = '/virtual/api/getUser.ts';

const memory: Record<string, string> = {
  [entryFilePath]: `
    import type { TypeUser } from '../models/TypeUser';

    type TypeRequest = { id: string };
    type TypeResponse = TypeUser;
  `,
  '/virtual/models/TypeUser.ts': 'export type TypeUser = { name: string };',
};

const { result } = createValidators(
  [entryFilePath], 
  { ...options, readFile: (filePath) => memory[filePath] }
);
```
