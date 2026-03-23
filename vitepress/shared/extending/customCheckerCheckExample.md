```ts
import fs from 'node:fs';
import path from 'node:path';

import { BaseChecker, type TypeCheckerCheckArgs } from '@arfa-tools/generator';

export class CheckerReadme extends BaseChecker {
  name = 'readme';

  check({ rootDir, checkerError }: TypeCheckerCheckArgs): void {
    const readmePath = path.resolve(rootDir, 'README.md');

    if (fs.existsSync(readmePath)) return;

    checkerError({
      message: 'README.md is required',
      error: new Error(`File not found: ${readmePath}`),
    });
  }
}
```
