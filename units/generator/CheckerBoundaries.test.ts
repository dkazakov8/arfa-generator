import fs from 'node:fs';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { CheckerBoundaries, type CheckerBoundariesConfig } from '../../src/generator';
import { getPath, rootDir, saveMemory } from './helpers';

describe('CheckerBoundaries', () => {
  const tsconfigPath = getPath('tsconfig.json');

  const memory = {
    'env.ts': ``,
    'src/assets/icon.svg': ``,
    'src/assets/logo.svg': ``,
    'src/assets/theme.css': ``,
    'src/actions/messages.ts': `import { userStore } from '../stores/userStore';
`,
    'src/actions/save.ts': `import { User } from '@models/User';
import '../assets/logo.svg';
import { transform } from '../comp/transformers';
import { env } from '../../env';
import { userStore } from '../stores/userStore';
`,
    'src/actions/importSyntax.ts': `import type { User as ImportedUser } from '../models/User';
export { userStore } from '../stores/userStore';

type StoreModule = import('../stores/userStore');

import('../stores/userStore');
`,
    'src/actions/legacy.js': `import { userStore } from '../stores/userStore';
`,
    'src/api/getUser.ts': `import http from 'node:http';
import { User } from '../models/User';
import { request } from '../utils/http';
`,
    'src/assets-case/assetAlias.ts': `import '@assets/icon.svg';
import '@fallback/icon.svg';
import 'theme-file';
import 'virtual:module';
import './missing.css';
`,
    'src/components/AppLayout/AppLayout.ts': `import { Button } from 'src/components/AppLayout/Button';
`,
    'src/components/AppLayout/Button.ts': ``,
    'src/features/customers/page.ts': ``,
    'src/features/orders/page.ts': `import { customersPage } from '../customers/page';
`,
    'src/comp/transformers.ts': ``,
    'src/models/User.ts': `import { formatDate } from '../utils/date';
`,
    'src/pages/user/actions/load.ts': `import { User } from '../../../models/User';
import { pageStore } from '../store';
`,
    'src/pages/user/store.ts': `import { save } from '../../actions/save';
`,
    'src/stores/internal.ts': ``,
    'src/stores/userStore.ts': `import path from 'node:path';
import { t } from '../translations/user';
import { internalStore } from './internal';
`,
    'src/translations/user.ts': ``,
    'src/utils/date.ts': ``,
    'src/utils/http.ts': ``,
  };

  const rules: CheckerBoundariesConfig['rules'] = [
    {
      entries: ['src/actions/**', 'src/pages/*/actions/**'],
      exclude: /(^_|^messages\.ts$)/,
      allow: {
        imports: ['src/models/**', 'src/comp/transformers.ts', 'env.ts'],
        importsInsideScope: 'all',
        external: true,
        node: true,
      },
    },
    {
      entries: ['src/stores/**', 'src/pages/*/store.ts'],
      exclude: /(^_|^messages\.ts$)/,
      allow: {
        imports: ['src/translations/**'],
        importsInsideScope: 'none',
        external: true,
        node: true,
      },
    },
    {
      entries: ['src/models/**'],
      exclude: /(^_|^messages\.ts$)/,
      allow: {
        imports: [],
        importsInsideScope: 'all',
        external: true,
        node: true,
      },
    },
  ];

  beforeEach(() => {
    fs.mkdirSync(rootDir, { recursive: true });
    fs.writeFileSync(
      tsconfigPath,
      JSON.stringify(
        {
          include: ['**/*.ts', '**/*.ts', '**/*.js', '**/*.jsx'],
          compilerOptions: {
            allowJs: true,
            jsx: 'preserve',
            module: 'ES2022',
            moduleResolution: 'bundler',
            paths: {
              '@assets/*': ['src/assets/*'],
              '@fallback/*': ['src/missing-assets/*', 'src/assets/*'],
              '@models/*': ['src/models/*'],
              'theme-file': ['src/assets/theme.css'],
            },
            rootDir: '.',
            target: 'ES2022',
          },
        },
        null,
        2
      ),
      'utf-8'
    );
    saveMemory(memory);
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('reports illegal imports for configured boundary patterns', () => {
    const checker = new CheckerBoundaries({ tsconfigPath, extensions: ['.ts', '.js', '.jsx'], rules });

    expect(checker.getViolationGroups({ rootDir })).toEqual([
      {
        filePath: getPath('src/actions/importSyntax.ts'),
        imports: [{ source: '../stores/userStore', path: 'src/stores/userStore.ts' }],
      },
      {
        filePath: getPath('src/actions/legacy.js'),
        imports: [{ source: '../stores/userStore', path: 'src/stores/userStore.ts' }],
      },
      {
        filePath: getPath('src/actions/save.ts'),
        imports: [
          { source: '../assets/logo.svg', path: 'src/assets/logo.svg' },
          { source: '../stores/userStore', path: 'src/stores/userStore.ts' },
        ],
      },
      {
        filePath: getPath('src/models/User.ts'),
        imports: [{ source: '../utils/date', path: 'src/utils/date.ts' }],
      },
      {
        filePath: getPath('src/pages/user/actions/load.ts'),
        imports: [{ source: '../store', path: 'src/pages/user/store.ts' }],
      },
      {
        filePath: getPath('src/pages/user/store.ts'),
        imports: [{ source: '../../actions/save', path: 'src/actions/save.ts' }],
      },
      {
        filePath: getPath('src/stores/userStore.ts'),
        imports: [{ source: './internal', path: 'src/stores/internal.ts' }],
      },
    ]);
  });

  it('ignores files outside configured extensions', () => {
    const checker = new CheckerBoundaries({ tsconfigPath, extensions: ['.ts'], rules });

    expect(checker.getViolationGroups({ rootDir }).map(({ filePath }) => filePath)).not.toContain(
      getPath('src/actions/legacy.js')
    );
  });

  it('uses checker rootDir for boundary paths independently from tsconfig rootDir', () => {
    fs.writeFileSync(
      tsconfigPath,
      JSON.stringify(
        Object.assign(JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8')), {
          include: ['src/**/*.ts', 'src/**/*.js'],
          compilerOptions: {
            ...JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8')).compilerOptions,
            rootDir: 'src',
          },
        }),
        null,
        2
      ),
      'utf-8'
    );

    const checker = new CheckerBoundaries({
      tsconfigPath,
      extensions: ['.ts'],
      rules: [
        {
          entries: ['src/api/**'],
          allow: { imports: ['src/models/**'], importsInsideScope: 'none' },
        },
      ],
    });

    expect(checker.getViolationGroups({ rootDir })).toEqual([
      {
        filePath: getPath('src/api/getUser.ts'),
        imports: [
          { source: 'node:http', path: 'node:http' },
          { source: '../utils/http', path: 'src/utils/http.ts' },
        ],
      },
    ]);
  });

  it('can forbid imports across top-level folders inside the same boundary', () => {
    const checker = new CheckerBoundaries({
      tsconfigPath,
      extensions: ['.ts'],
      rules: [
        {
          entries: ['src/features/**'],
          allow: { imports: ['src/features/**'], importsInsideScope: 'sameTopLevel' },
        },
      ],
    });

    expect(checker.getViolationGroups({ rootDir })).toEqual([
      {
        filePath: getPath('src/features/orders/page.ts'),
        imports: [{ source: '../customers/page', path: 'src/features/customers/page.ts' }],
      },
    ]);
  });

  it('allows inner imports resolved through non-relative sources', () => {
    const checker = new CheckerBoundaries({
      tsconfigPath,
      extensions: ['.ts'],
      rules: [
        {
          entries: ['src/components/**'],
          allow: { imports: [], importsInsideScope: 'sameTopLevel' },
        },
      ],
    });

    expect(checker.getViolationGroups({ rootDir })).toEqual([]);
  });

  it('reports violations through checker errors', async () => {
    const errors: Array<{ message: string; error: unknown }> = [];
    const checker = new CheckerBoundaries({
      tsconfigPath,
      extensions: ['.ts'],
      rules: [
        {
          entries: ['src/api/**'],
          allow: { imports: ['src/models/**'], importsInsideScope: 'none' },
        },
      ],
    });

    await checker.check({
      rootDir,
      changedFiles: [],
      deletedFiles: [],
      isFullGeneration: true,
      checkerLog: () => undefined,
      checkerError: (error) => errors.push(error),
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('Boundary violation found');
    expect(errors[0].error).toBeInstanceOf(Error);
    expect((errors[0].error as Error).message).toBe(
      `${getPath('src/api/getUser.ts')} has illegal imports: node:http, ../utils/http -> src/utils/http.ts`
    );
  });

  it('resolves asset imports through path aliases and reports unresolved imports as sources', () => {
    const checker = new CheckerBoundaries({
      tsconfigPath,
      extensions: ['.ts'],
      rules: [
        {
          entries: ['src/assets-case/assetAlias.ts'],
          allow: { imports: [], importsInsideScope: 'none' },
        },
      ],
    });

    expect(checker.getViolationGroups({ rootDir })).toEqual([
      {
        filePath: getPath('src/assets-case/assetAlias.ts'),
        imports: [
          { source: '@assets/icon.svg', path: 'src/assets/icon.svg' },
          { source: '@fallback/icon.svg', path: 'src/assets/icon.svg' },
          { source: 'theme-file', path: 'src/assets/theme.css' },
          { source: 'virtual:module', path: 'virtual:module' },
          { source: './missing.css', path: './missing.css' },
        ],
      },
    ]);
  });

  it('allows imports when top-level cross imports are disabled but roots do not conflict', () => {
    const checker = new CheckerBoundaries({
      tsconfigPath,
      extensions: ['.ts'],
      rules: [
        {
          entries: ['src/components/**', 'src'],
          allow: {
            imports: ['src/components/AppLayout/Button'],
            importsInsideScope: 'sameTopLevel',
          },
        },
      ],
    });

    expect(checker.getViolationGroups({ rootDir })).toEqual([]);
  });
});
