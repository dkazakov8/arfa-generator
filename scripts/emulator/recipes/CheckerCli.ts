import path from 'node:path';

import { CheckerCli } from '../../../src/generator';
import type { TypeSandboxRecipeConfig } from '../types';

export const checkerCliRecipeConfigs: Array<TypeSandboxRecipeConfig> = [
  {
    id: 'CheckerCli-biome-changed-files',
    title: {
      ru: 'Biome проверяет только изменённые файлы',
      en: '',
    },
    description: {
      ru: 'Если измененных файлов не было (например, были только удаленные), проверка пропускается',
      en: '',
    },
    checker: () =>
      new CheckerCli({
        name: 'biome',
        getCommand({ changedFiles }) {
          if (changedFiles.length === 0) return false;

          return [
            path.resolve(process.cwd(), 'node_modules/.bin/biome'),
            'check',
            '--no-errors-on-unmatched',
            ...changedFiles.map(({ relativePath }) => relativePath),
          ];
        },
      }),
    steps: [
      {
        title: 'First run',
        files: [
          {
            path: 'biome.json',
            content: `{
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single"
    }
  }
}`,
            operation: 'add',
          },
          {
            path: 'src/draft.ts',
            content: `export const answer = 42;\n`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Introduce a format error',
        files: [
          {
            path: 'src/draft.ts',
            content: `export const answer=42;\n`,
            operation: 'change',
          },
        ],
      },
      {
        title: 'Fix the format',
        files: [
          {
            path: 'src/draft.ts',
            content: `export const answer = 42;\n`,
            operation: 'change',
          },
        ],
      },
    ],
  },
  {
    id: 'CheckerCli-vitest-related',
    title: {
      ru: 'Vitest запускает связанные тесты',
      en: '',
    },
    description: {
      ru: 'При полной генерации и после удаления файлов запускаются все тесты, а при инкрементальной - только связанные с изменёнными файлами',
      en: '',
    },
    checker: () =>
      new CheckerCli({
        name: 'vitest',
        getCommand({ changedFiles, deletedFiles, isFullGeneration }) {
          const vitest = path.resolve(process.cwd(), 'node_modules/.bin/vitest');

          if (isFullGeneration || deletedFiles.length > 0) return [vitest, 'run'];

          if (changedFiles.length === 0) return false;

          return [vitest, 'related', '--run', ...changedFiles.map(({ relativePath }) => relativePath)];
        },
      }),
    steps: [
      {
        title: 'Run all tests',
        files: [
          {
            path: 'src/sum.ts',
            content: `export const sum = (a: number, b: number) => a + b;\n`,
            operation: 'add',
          },
          {
            path: 'src/double.ts',
            content: `export const double = (value: number) => value * 2;\n`,
            operation: 'add',
          },
          {
            path: 'src/obsolete.ts',
            content: `export const obsolete = true;\n`,
            operation: 'add',
          },
          {
            path: 'tests/sum.test.ts',
            content: `import { expect, it } from 'vitest';
import { sum } from '../src/sum';

it('adds two numbers', () => {
  expect(sum(2, 3)).toBe(5);
});\n`,
            operation: 'add',
          },
          {
            path: 'tests/double.test.ts',
            content: `import { expect, it } from 'vitest';
import { double } from '../src/double';

it('doubles a number', () => {
  expect(double(3)).toBe(6);
});\n`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Run related tests after a change',
        files: [
          {
            path: 'src/sum.ts',
            content: `export const sum = (a: number, b: number) => a - b;\n`,
            operation: 'change',
          },
        ],
      },
      {
        title: 'Run all tests after a deletion',
        files: [{ path: 'src/obsolete.ts', operation: 'remove' }],
      },
      {
        title: 'Fix the source',
        files: [
          {
            path: 'src/sum.ts',
            content: `export const sum = (a: number, b: number) => a + b;\n`,
            operation: 'change',
          },
        ],
      },
    ],
  },
  {
    id: 'CheckerCli-typescript',
    title: {
      ru: 'проверка типов через tsc',
      en: '',
    },
    description: {
      ru: 'В данном случае tsc запускается для всего проекта, даже если были только удаленные файлы',
      en: '',
    },
    checker: () =>
      new CheckerCli({
        name: 'tsc',
        getCommand: () => [path.resolve(process.cwd(), 'node_modules/.bin/tsc')],
      }),
    steps: [
      {
        title: 'First run',
        files: [
          {
            path: 'tsconfig.json',
            content: `{
  "include": ["src"],
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "noEmit": true,
    "strict": true,
    "types": []
  }
}`,
            operation: 'add',
          },
          {
            path: 'src/count.ts',
            content: `export const count: number = 1;\n`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Introduce a type error',
        files: [
          {
            path: 'src/count.ts',
            content: `export const count: number = 'one';\n`,
            operation: 'change',
          },
        ],
      },
      {
        title: 'Fix the type',
        files: [
          {
            path: 'src/count.ts',
            content: `export const count: number = 1;\n`,
            operation: 'change',
          },
        ],
      },
    ],
  },
];
