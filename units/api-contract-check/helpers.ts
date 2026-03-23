import fs from 'node:fs';
import path from 'node:path';

import type { TypeOptions } from '../../src/api-contract-check/builder';

export const cases = [['memory'], ['disk']] as const;

export function getTestTmpDir(dirname: string): string {
  const testWorkerId = process.env.VITEST_POOL_ID ?? process.pid.toString();

  return path.resolve(dirname, 'tmp', testWorkerId, 'tmp');
}

export function prepare(mode: 'memory' | 'disk', memory: Record<string, string>, tsconfigPath: string): TypeOptions {
  if (mode === 'disk') {
    for (const [filePath, content] of Object.entries(memory)) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content);
    }
  }

  return {
    requestDeclaration: 'TypeRequest',
    responseDeclaration: 'TypeResponse',
    tsconfigPath,
    readFile: mode === 'disk' ? undefined : (p: string) => memory[p],
  };
}
