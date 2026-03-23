import path from 'node:path';

import { CheckerBoundaries } from '../../../src/generator';
import type { TypeSandboxRecipeConfig } from '../types';

const tsconfigContent = `{
  "include": ["**/*.ts"],
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true
  }
}`;

export const checkerBoundariesRecipeConfigs: Array<TypeSandboxRecipeConfig> = [
  {
    id: 'CheckerBoundaries-api-layers',
    title: {
      ru: 'импорты между слоями API и models',
      en: '',
    },
    description: {
      ru: 'API-файлы могут импортировать модели, но не соседние API-файлы. Модели могут импортировать только друг друга; тестовые файлы исключены из проверки',
      en: '',
    },
    checker: ({ rootDir }) =>
      new CheckerBoundaries({
        tsconfigPath: path.resolve(rootDir, 'tsconfig.json'),
        extensions: ['.ts'],
        rules: [
          {
            entries: ['api/**'],
            exclude: /\.test\.ts$/,
            allow: {
              imports: ['models/**'],
              importsInsideScope: 'none',
            },
          },
          {
            entries: ['models/**'],
            allow: {
              imports: [],
              importsInsideScope: 'all',
            },
          },
        ],
      }),
    steps: [
      {
        title: 'First run',
        files: [
          { path: 'tsconfig.json', content: tsconfigContent, operation: 'add' },
          {
            path: 'models/status.ts',
            content: `export type TypeStatus = 'draft' | 'confirmed';`,
            operation: 'add',
          },
          {
            path: 'models/order.ts',
            content: `import type { TypeStatus } from './status';

export type TypeOrder = { id: string; status: TypeStatus };`,
            operation: 'add',
          },
          {
            path: 'api/orders.ts',
            content: `import type { TypeOrder } from '../models/order';

export type TypeResponse = { orders: Array<TypeOrder> };`,
            operation: 'add',
          },
          {
            path: 'api/orders.test.ts',
            content: `import type { TypeResponse } from './orders';

export type TypeTestResponse = TypeResponse;`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Import another API file',
        files: [
          {
            path: 'api/getOrder.ts',
            content: `import type { TypeResponse } from './orders';

export type TypeOrderList = TypeResponse;`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Fix the import',
        files: [
          {
            path: 'api/getOrder.ts',
            content: `import type { TypeOrder } from '../models/order';

export type TypeOrderResult = { order: TypeOrder };`,
            operation: 'change',
          },
        ],
      },
      {
        title: 'Import API from a model',
        files: [
          {
            path: 'models/orderSummary.ts',
            content: `import type { TypeResponse } from '../api/orders';

export type TypeOrderSummary = TypeResponse;`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Keep the model independent',
        files: [
          {
            path: 'models/orderSummary.ts',
            content: `import type { TypeOrder } from './order';

export type TypeOrderSummary = Pick<TypeOrder, 'id'>;`,
            operation: 'change',
          },
        ],
      },
    ],
  },
  {
    id: 'CheckerBoundaries-feature-isolation',
    title: {
      ru: 'изоляция feature-модулей',
      en: '',
    },
    description: {
      ru: 'sameTopLevel разрешает импорты внутри одного feature-модуля и из shared, но останавливает прямой импорт соседнего модуля даже через алиас и при широком allow.imports',
      en: '',
    },
    checker: ({ rootDir }) =>
      new CheckerBoundaries({
        tsconfigPath: path.resolve(rootDir, 'tsconfig.json'),
        extensions: ['.ts'],
        rules: [
          {
            entries: ['features/**'],
            allow: {
              imports: ['shared/**', 'features/**'],
              importsInsideScope: 'sameTopLevel',
            },
          },
        ],
      }),
    steps: [
      {
        title: 'First run',
        files: [
          {
            path: 'tsconfig.json',
            content: `{
  "include": ["**/*.ts"],
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "paths": {
      "features/*": ["./features/*"],
      "shared/*": ["./shared/*"]
    }
  }
}`,
            operation: 'add',
          },
          {
            path: 'shared/formatId.ts',
            content: `export const formatId = (id: string) => id.toUpperCase();`,
            operation: 'add',
          },
          {
            path: 'features/orders/model.ts',
            content: `export type TypeOrder = { id: string };`,
            operation: 'add',
          },
          {
            path: 'features/customers/model.ts',
            content: `export type TypeCustomer = { id: string };`,
            operation: 'add',
          },
          {
            path: 'features/orders/view.ts',
            content: `import type { TypeOrder } from 'features/orders/model';
import { formatId } from 'shared/formatId';

export const orderLabel = (order: TypeOrder) => formatId(order.id);`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Import a neighboring feature',
        files: [
          {
            path: 'features/orders/view.ts',
            content: `import type { TypeOrder } from 'features/orders/model';
import type { TypeCustomer } from 'features/customers/model';

export type TypeOrderView = { order: TypeOrder; customer: TypeCustomer };`,
            operation: 'change',
          },
        ],
      },
      {
        title: 'Remove the cross-feature import',
        files: [
          {
            path: 'features/orders/view.ts',
            content: `import type { TypeOrder } from 'features/orders/model';
import { formatId } from 'shared/formatId';

export const orderLabel = (order: TypeOrder) => formatId(order.id);`,
            operation: 'change',
          },
        ],
      },
    ],
  },
  {
    id: 'CheckerBoundaries-runtime-imports',
    title: {
      ru: 'внешние пакеты и Node.js',
      en: '',
    },
    description: {
      ru: 'Серверным файлам разрешены node:* импорты, а клиентским — внешние пакеты. Каждое разрешение действует отдельно',
      en: '',
    },
    checker: ({ rootDir }) =>
      new CheckerBoundaries({
        tsconfigPath: path.resolve(rootDir, 'tsconfig.json'),
        extensions: ['.ts'],
        rules: [
          {
            entries: ['server/**'],
            allow: {
              imports: [],
              importsInsideScope: 'none',
              node: true,
            },
          },
          {
            entries: ['client/**'],
            allow: {
              imports: [],
              importsInsideScope: 'none',
              external: true,
            },
          },
        ],
      }),
    steps: [
      {
        title: 'First run',
        files: [
          { path: 'tsconfig.json', content: tsconfigContent, operation: 'add' },
          {
            path: 'server/report.ts',
            content: `import path from 'node:path';

export const reportPath = path.join('reports', 'today');`,
            operation: 'add',
          },
          {
            path: 'client/value.ts',
            content: `import type { Ref } from 'vue';

export type TypeValue = Ref<string>;`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Import a package on the server',
        files: [
          {
            path: 'server/value.ts',
            content: `import type { Ref } from 'vue';

export type TypeServerValue = Ref<string>;`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Remove the package import',
        files: [{ path: 'server/value.ts', operation: 'remove' }],
      },
      {
        title: 'Import Node.js on the client',
        files: [
          {
            path: 'client/path.ts',
            content: `import path from 'node:path';

export const clientPath = path.join('client', 'value');`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Remove the Node.js import',
        files: [{ path: 'client/path.ts', operation: 'remove' }],
      },
    ],
  },
];
