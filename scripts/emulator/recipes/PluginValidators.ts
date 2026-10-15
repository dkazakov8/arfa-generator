import path from 'node:path';

import { PluginValidators } from '../../../src/generator';
import type { TypeSandboxRecipeConfig } from '../types';

export const pluginValidatorsRecipeConfigs: Array<TypeSandboxRecipeConfig> = [
  {
    id: 'PluginValidators-central-api',
    title: {
      ru: 'API-контракты в общей папке',
      en: 'API contracts in a shared folder',
    },
    description: {
      ru: 'Для файлов в папке api генерируются схемы валидации в validators/api. Изменение общего типа обновляет зависящие от него схемы валидации',
      en: 'Validation schemas are generated in validators/api for files in the api folder. Changing a shared type updates the validation schemas that depend on it',
    },
    plugin: ({ rootDir }) =>
      new PluginValidators([
        {
          entries: ['api'],
          exclude: /(^_|\.test\.ts$|package\.json$)/,
          targetFolder: path.resolve(rootDir, 'validators'),
          tsconfigPath: path.resolve(rootDir, 'tsconfig.json'),
          requestDeclaration: 'TypeRequest',
          responseDeclaration: 'TypeResponse',
          formatContent({ schema, targetPath }) {
            return `export const ${path.parse(targetPath).name} = ${JSON.stringify(schema, null, 2)} as const;\n`;
          },
        },
      ]),
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
    "strict": true
  }
}`,
            operation: 'add',
          },
          {
            path: 'models/order.ts',
            content: `export type TypeOrder = {
  id: string;
  status: 'draft' | 'confirmed';
};`,
            operation: 'add',
          },
          {
            path: 'api/orders.ts',
            content: `import type { TypeOrder } from '../models/order';

export type TypeRequest = { status?: TypeOrder['status'] };
export type TypeResponse = { orders: Array<TypeOrder> };`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Change shared model',
        files: [
          {
            path: 'models/order.ts',
            content: `export type TypeOrder = {
  id: string;
  status: 'draft' | 'confirmed' | 'shipped';
};`,
            operation: 'change',
          },
        ],
      },
      {
        title: 'Add an API contract',
        files: [
          {
            path: 'api/getOrder.ts',
            content: `import type { TypeOrder } from '../models/order';

export type TypeRequest = { orderId: string };
export type TypeResponse = { order: TypeOrder };`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Remove an API contract',
        files: [{ path: 'api/getOrder.ts', operation: 'remove' }],
      },
    ],
  },
  {
    id: 'PluginValidators-feature-api',
    title: {
      ru: 'API-контракты внутри feature-модулей',
      en: 'API contracts within feature modules',
    },
    description: {
      ru: 'Плагин находит папки features/*/api и сохраняет структуру модулей в validators/features',
      en: 'The plugin finds features/*/api folders and preserves the module structure in validators/features',
    },
    plugin: ({ rootDir }) =>
      new PluginValidators([
        {
          entries: ['features/*/api'],
          exclude: /(^_|\.test\.ts$|package\.json$)/,
          targetFolder: path.resolve(rootDir, 'validators'),
          tsconfigPath: path.resolve(rootDir, 'tsconfig.json'),
          requestDeclaration: 'TypeRequest',
          responseDeclaration: 'TypeResponse',
          formatContent({ schema, targetPath }) {
            return `export const ${path.parse(targetPath).name} = ${JSON.stringify(schema, null, 2)} as const;\n`;
          },
        },
      ]),
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
    "strict": true
  }
}`,
            operation: 'add',
          },
          {
            path: 'features/orders/api/listOrders.ts',
            content: `export type TypeRequest = { status?: 'draft' | 'confirmed' };
export type TypeResponse = { orders: Array<{ id: string; status: string }> };`,
            operation: 'add',
          },
          {
            path: 'features/profile/api/getProfile.ts',
            content: `export type TypeRequest = { profileId: string };
export type TypeResponse = { name: string };`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Add a feature contract',
        files: [
          {
            path: 'features/orders/api/getOrder.ts',
            content: `export type TypeRequest = { orderId: string };
export type TypeResponse = { id: string; status: 'draft' | 'confirmed' };`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Change a feature contract',
        files: [
          {
            path: 'features/profile/api/getProfile.ts',
            content: `export type TypeRequest = { profileId: string };
export type TypeResponse = { name: string; email: string };`,
            operation: 'change',
          },
        ],
      },
      {
        title: 'Remove a feature contract',
        files: [{ path: 'features/orders/api/getOrder.ts', operation: 'remove' }],
      },
    ],
  },
];
