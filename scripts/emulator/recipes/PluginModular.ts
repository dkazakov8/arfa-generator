import path from 'node:path';

import { PluginModular } from '../../../src/generator';
import type { TypeSandboxRecipeConfig } from '../types';

export const pluginModularRecipeConfigs: Array<TypeSandboxRecipeConfig> = [
  {
    id: 'PluginModular-feature-entrypoints',
    title: {
      ru: 'центральные entrypoint feature-модулей',
      en: 'Central entry points for feature modules',
    },
    description: {
      ru: 'Плагин собирает index.ts из разных feature-модулей в один файл с namespace-экспортами. Имя экспорта берется из родительской папки',
      en: 'The plugin collects index.ts files from different feature modules into a single file with namespace exports. Each export name comes from the parent folder',
    },
    plugin: ({ rootDir }) =>
      new PluginModular([
        {
          entries: ['features/*/index.ts'],
          entryKind: 'file',
          targetFile: path.resolve(rootDir, 'features.generated.ts'),
          template({ modules }) {
            return modules
              .map(({ moduleName, relativePath }) => `export * as ${moduleName} from './${relativePath}';`)
              .join('\n');
          },
        },
      ]),
    steps: [
      {
        title: 'First run',
        files: [
          {
            path: 'features/orders/index.ts',
            content: `export const featureName = 'orders';`,
            operation: 'add',
          },
          {
            path: 'features/profile/index.ts',
            content: `export const featureName = 'profile';`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Add a feature',
        files: [
          {
            path: 'features/customers/index.ts',
            content: `export const featureName = 'customers';`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Remove a feature',
        files: [{ path: 'features/profile/index.ts', operation: 'remove' }],
      },
    ],
  },
  {
    id: 'PluginModular-page-types',
    title: {
      ru: 'типы страниц',
      en: 'Page types',
    },
    description: {
      ru: 'Плагин создает типы либо реалтаймовые объекты, описывающие store и actions каждой страницы при их наличии',
      en: 'The plugin creates types or runtime objects describing each page’s store and actions, where present',
    },
    plugin: ({ rootDir }) =>
      new PluginModular([
        {
          entries: ['pages/*'],
          entryKind: 'dir',
          targetFile: path.resolve(rootDir, 'modularPages.ts'),
          template({ modules }) {
            return modules
              .map(({ entryName: pageName, files }) => ({
                pageName,
                storePath: files.find(({ fileName }) => fileName === 'store.ts')?.relativePath,
                actionsPath: files.find(({ fileName }) => fileName === 'actions')?.relativePath,
              }))
              .map(
                ({ pageName, actionsPath, storePath }) => `export declare const ${pageName}: {
  store: ${storePath ? `typeof import('./${storePath}').PageStore` : 'never'};
  actions: ${actionsPath ? `typeof import('./${actionsPath}')` : 'never'};
};`
              )
              .join('\n\n');
          },
        },
      ]),
    steps: [
      {
        title: 'First run',
        files: [
          {
            path: 'pages/orders/index.ts',
            content: `export const pageName = 'orders';`,
            operation: 'add',
          },
          {
            path: 'pages/orders/store.ts',
            content: `export class PageStore {}`,
            operation: 'add',
          },
          {
            path: 'pages/orders/actions/index.ts',
            content: `export async function createOrder() {}`,
            operation: 'add',
          },
          {
            path: 'pages/profile/index.ts',
            content: `export const pageName = 'profile';`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Add page store',
        files: [
          {
            path: 'pages/profile/store.ts',
            content: `export class PageStore {}`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Add page actions',
        files: [
          {
            path: 'pages/profile/actions/index.ts',
            content: `export async function updateProfile() {}`,
            operation: 'add',
          },
        ],
      },
    ],
  },
  {
    id: 'PluginModular-feature-routes',
    title: {
      ru: 'маршруты feature-модулей',
      en: 'Feature module routes',
    },
    description: {
      ru: 'Плагин находит feature-модули с файлом routes.ts и объединяет их маршруты. Добавление routes.ts подключает модуль автоматически',
      en: 'The plugin finds feature modules with a routes.ts file and combines their routes. Adding routes.ts includes the module automatically',
    },
    plugin: ({ rootDir }) =>
      new PluginModular([
        {
          entries: ['features/*'],
          entryKind: 'dir',
          targetFile: path.resolve(rootDir, 'routes.generated.ts'),
          template({ modules }) {
            const routeModules = modules.flatMap(({ entryName, files }) =>
              files
                .filter(({ fileName }) => fileName === 'routes.ts')
                .map(({ relativePath }) => ({ name: `${entryName}Routes`, relativePath }))
            );
            const imports = routeModules
              .map(({ name, relativePath }) => `import { routes as ${name} } from './${relativePath}';`)
              .join('\n');
            const routes = routeModules.map(({ name }) => `  ...${name},`).join('\n');

            return `${imports}\n\nexport const routes = [\n${routes}\n];`;
          },
        },
      ]),
    steps: [
      {
        title: 'First run',
        files: [
          {
            path: 'features/orders/model.ts',
            content: `export const orders = [];`,
            operation: 'add',
          },
          {
            path: 'features/orders/routes.ts',
            content: `export const routes = [{ path: '/orders' }];`,
            operation: 'add',
          },
          {
            path: 'features/profile/model.ts',
            content: `export const profile = {};`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Add feature routes',
        files: [
          {
            path: 'features/profile/routes.ts',
            content: `export const routes = [{ path: '/profile' }];`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Remove feature routes',
        files: [{ path: 'features/orders/routes.ts', operation: 'remove' }],
      },
    ],
  },
  {
    id: 'PluginModular-feature-manifest',
    title: {
      ru: 'манифест feature-модулей',
      en: 'Feature module manifest',
    },
    description: {
      ru: 'По набору файлов в каждой директории генерируется типизированное описание возможностей feature-модулей',
      en: 'Generates a typed description of each feature module’s capabilities based on the files in its directory',
    },
    plugin: ({ rootDir }) =>
      new PluginModular([
        {
          entries: ['features/*'],
          entryKind: 'dir',
          targetFile: path.resolve(rootDir, 'featureManifest.generated.ts'),
          template({ modules }) {
            const manifest: Record<string, { hasApi: boolean; hasRoutes: boolean; hasMessages: boolean }> = {};

            for (const { entryName, files } of modules) {
              const fileNames = new Set(files.map(({ fileName }) => fileName));

              manifest[entryName] = {
                hasApi: fileNames.has('api.ts'),
                hasRoutes: fileNames.has('routes.ts'),
                hasMessages: fileNames.has('messages.ts'),
              };
            }

            return `export const featureManifest = ${JSON.stringify(manifest, null, 2)} as const;`;
          },
        },
      ]),
    steps: [
      {
        title: 'First run',
        files: [
          {
            path: 'features/orders/api.ts',
            content: `export async function getOrders() {}`,
            operation: 'add',
          },
          {
            path: 'features/orders/routes.ts',
            content: `export const routes = [{ path: '/orders' }];`,
            operation: 'add',
          },
          {
            path: 'features/orders/messages.ts',
            content: `export const messages = {};`,
            operation: 'add',
          },
          {
            path: 'features/profile/routes.ts',
            content: `export const routes = [{ path: '/profile' }];`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Add a feature capability',
        files: [
          {
            path: 'features/profile/api.ts',
            content: `export async function getProfile() {}`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Remove a feature capability',
        files: [{ path: 'features/orders/messages.ts', operation: 'remove' }],
      },
    ],
  },
];
