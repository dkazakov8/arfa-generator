import { PluginReexport } from '../../../src/generator';
import type { TypeSandboxRecipeConfig } from '../types';

export const pluginReexportRecipeConfigs: Array<TypeSandboxRecipeConfig> = [
  {
    id: 'PluginReexport-basic',
    title: {
      ru: 'валидация содержимого файлов',
      en: 'File content validation',
    },
    description: {
      ru: 'В файл реэкспорта попадают только файлы, экспортирующие функцию с именем файла, что позволяет проверять нейминг и валидировать содержимое',
      en: 'Only files that export a function with the same name as the file are included in the re-export file, allowing naming checks and content validation',
    },
    plugin: () =>
      new PluginReexport([
        {
          entries: ['actions'],
          template({ files }) {
            return files.map(({ name }) => `export * from './${name}';`).join('\n');
          },
          validateContent({ content, name }) {
            return content.includes(`export async function ${name}(`);
          },
        },
      ]),
    steps: [
      {
        title: 'First run',
        files: [
          {
            path: 'actions/getOrders.ts',
            content: `export async function getOrders() {}`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Add broken file',
        files: [
          {
            path: 'actions/deleteOrder.ts',
            content: `export const deleteOrder = true;`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Fix broken file',
        files: [
          {
            path: 'actions/deleteOrder.ts',
            content: `export async function deleteOrder() {}`,
            operation: 'change',
          },
        ],
      },
      {
        title: 'Add valid file',
        files: [
          {
            path: 'actions/createOrder.ts',
            content: `export async function createOrder() {}`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Remove file',
        files: [{ path: 'actions/createOrder.ts', operation: 'remove' }],
      },
    ],
  },
  {
    id: 'PluginReexport-component',
    title: {
      ru: 'package.json указывает на определенный файл',
      en: 'package.json points to a specific file',
    },
    description: {
      ru: 'В папках компонентов часто удобнее держать один package.json вместо index.ts. Валидация через validateContent для главного файла при этом недоступна',
      en: 'In component folders, keeping a single package.json instead of index.ts is often more convenient. In this setup, validateContent cannot be used to validate the main file',
    },
    plugin: () =>
      new PluginReexport([
        {
          entries: ['components/*'],
          onlyPackage: true,
          fileNameTemplate({ folderName }) {
            return `${folderName}.tsx`;
          },
          template() {
            return '';
          },
        },
      ]),
    steps: [
      {
        title: 'First run',
        files: [
          {
            path: 'components/Button/Button.tsx',
            content: `export function Button() {}`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Add a component',
        files: [
          {
            path: 'components/List/List.tsx',
            content: `export function List() {}`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Remove a component',
        files: [{ path: 'components/List', operation: 'remove' }],
      },
    ],
  },
  {
    id: 'PluginReexport-component-index',
    title: {
      ru: 'index.ts вместо _reexport.ts и package.json',
      en: 'index.ts instead of _reexport.ts and package.json',
    },
    description: {
      ru: 'При этой настройке генерируется только index.ts; включена дополнительная фильтрация',
      en: 'This configuration generates only index.ts, with additional filtering enabled',
    },
    plugin: () =>
      new PluginReexport([
        {
          entries: ['utils'],
          exclude: /\.css$/,
          noPackage: true,
          fileNameTemplate() {
            return `index.ts`;
          },
          template({ files }) {
            return files.map(({ name }) => `export * from './${name}';`).join('\n');
          },
        },
      ]),
    steps: [
      {
        title: 'First run',
        files: [
          {
            path: 'utils/getTime.ts',
            content: `export function getTime() {}`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Add a css file (ignored)',
        files: [
          {
            path: 'utils/style.css',
            content: `.wrapper {}`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Add a valid file',
        files: [
          {
            path: 'utils/scroll.ts',
            content: `export function scroll() {}`,
            operation: 'add',
          },
        ],
      },
    ],
  },
  {
    id: 'PluginReexport-deep',
    title: {
      ru: 'глубокая генерация реэкспортов',
      en: 'Nested re-export generation',
    },
    description: {
      ru: 'В utils и всех вложенных папках создаются _reexport.ts и package.json. Это позволяет получать вложенные экспорты через единый импорт из utils',
      en: 'Creates _reexport.ts and package.json in utils and all nested folders. This makes nested exports available through a single import from utils',
    },
    plugin: () =>
      new PluginReexport([
        {
          entries: ['utils/**'],
          template({ files }) {
            return files.map(({ name }) => `export * from './${name}';`).join('\n');
          },
        },
      ]),
    steps: [
      {
        title: 'First run',
        files: [
          {
            path: 'utils/scroll.ts',
            content: `export function scroll() {}`,
            operation: 'add',
          },
          {
            path: 'utils/date/getTime.ts',
            content: `export function getTime() {}`,
            operation: 'add',
          },
          {
            path: 'utils/date/format/formatDate.ts',
            content: `export function formatDate() {}`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Add a nested module',
        files: [
          {
            path: 'utils/date/format/formatTime.ts',
            content: `export function formatTime() {}`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Add a deeper folder',
        files: [
          {
            path: 'utils/date/format/relative/formatRelativeTime.ts',
            content: `export function formatRelativeTime() {}`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Remove a nested module',
        files: [{ path: 'utils/date/format/formatTime.ts', operation: 'remove' }],
      },
    ],
  },
  {
    id: 'PluginReexport-icons',
    title: {
      ru: 'реэкспорт ассетов с tree-shaking',
      en: 'Asset re-exports with tree-shaking',
    },
    description: {
      ru: 'Как правило svg, png и т.п. файлы считаются бандлерами как экспортирующие default. В данном случае реэкспортный файл назван по имени папки',
      en: 'Bundlers generally treat svg, png, and similar files as having a default export. In this example, the re-export file is named after the folder',
    },
    plugin: () =>
      new PluginReexport([
        {
          entries: ['assets/icons'],
          fileNameTemplate({ folderName }) {
            return `${folderName}.ts`;
          },
          template({ files }) {
            return files.map(({ name, fileName }) => `export { default as ${name} } from './${fileName}';`).join('\n');
          },
        },
      ]),
    steps: [
      {
        title: 'First run',
        files: [
          {
            path: 'assets/icons/logo.svg',
            content: `<svg />`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Add a file',
        files: [
          {
            path: 'assets/icons/settings.svg',
            content: `<svg />`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Remove a file',
        files: [
          {
            path: 'assets/icons/settings.svg',
            operation: 'remove',
          },
        ],
      },
    ],
  },
  {
    id: 'PluginReexport-type-only',
    title: {
      ru: 'раздельный реэкспорт типов и значений',
      en: 'Separate re-exports for types and values',
    },
    description: {
      ru: 'Файлы с суффиксом .types.ts реэкспортируются через export type *, а остальные остаются runtime-экспортами',
      en: 'Files with the .types.ts suffix are re-exported through export type *, while the others remain runtime exports',
    },
    plugin: () =>
      new PluginReexport([
        {
          entries: ['models'],
          template({ files }) {
            return files
              .map(({ name, fileName }) => {
                const exportType = fileName.endsWith('.types.ts') ? ' type' : '';

                return `export${exportType} * from './${name}';`;
              })
              .join('\n');
          },
        },
      ]),
    steps: [
      {
        title: 'First run',
        files: [
          {
            path: 'models/order.types.ts',
            content: `export type TypeOrder = { id: string };`,
            operation: 'add',
          },
          {
            path: 'models/formatOrder.ts',
            content: `export function formatOrder() {}`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Add a type module',
        files: [
          {
            path: 'models/customer.types.ts',
            content: `export type TypeCustomer = { id: string };`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Add a runtime module',
        files: [
          {
            path: 'models/createOrder.ts',
            content: `export function createOrder() {}`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Remove a type module',
        files: [{ path: 'models/customer.types.ts', operation: 'remove' }],
      },
    ],
  },
  {
    id: 'PluginReexport-feature-public-api',
    title: {
      ru: 'публичный API feature-модулей',
      en: 'Public API for feature modules',
    },
    description: {
      ru: 'Для каждого feature-модуля создается публичный entrypoint, в который не попадают тесты, stories, стили и приватные файлы',
      en: 'Creates a public entry point for each feature module, excluding tests, stories, styles, and private files',
    },
    plugin: () =>
      new PluginReexport([
        {
          entries: ['features/*'],
          exclude: /(^_|\.test\.|\.stories\.|\.css$)/,
          template({ files }) {
            return files.map(({ name }) => `export * from './${name}';`).join('\n');
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
            path: 'features/orders/ui.tsx',
            content: `export function Orders() {}`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Add a public module',
        files: [
          {
            path: 'features/orders/model.ts',
            content: `export const orders = [];`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Add ignored files',
        files: [
          {
            path: 'features/orders/model.test.ts',
            content: `export const testOrders = [];`,
            operation: 'add',
          },
          {
            path: 'features/orders/Orders.stories.tsx',
            content: `export default {};`,
            operation: 'add',
          },
          {
            path: 'features/orders/styles.css',
            content: `.orders {}`,
            operation: 'add',
          },
          {
            path: 'features/orders/_internal.ts',
            content: `export const internal = true;`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Remove a public module',
        files: [{ path: 'features/orders/api.ts', operation: 'remove' }],
      },
    ],
  },
  {
    id: 'PluginReexport-lazy-pages',
    title: {
      ru: 'lazy-загрузка React-страниц',
      en: 'Lazy loading React pages',
    },
    description: {
      ru: 'Entry-файл создает React.lazy-компонент для каждой страницы и обновляется при добавлении или удалении файлов',
      en: 'The entry file creates a React.lazy component for each page and updates when files are added or deleted',
    },
    plugin: () =>
      new PluginReexport([
        {
          entries: ['pages'],
          exclude: /(\.test\.tsx$|\.stories\.tsx$|\.css$)/,
          template({ files }) {
            const pages = files.filter(({ ext }) => ext === '.tsx');
            const exports = pages
              .map(({ name }) => `export const ${name} = lazy(() => import('./${name}'));`)
              .join('\n');

            return `import { lazy } from 'react';\n\n${exports}`;
          },
        },
      ]),
    steps: [
      {
        title: 'First run',
        files: [
          {
            path: 'pages/HomePage.tsx',
            content: `export default function HomePage() {}`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Add a page',
        files: [
          {
            path: 'pages/ProfilePage.tsx',
            content: `export default function ProfilePage() {}`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Add ignored files',
        files: [
          {
            path: 'pages/HomePage.test.tsx',
            content: `export const testHomePage = true;`,
            operation: 'add',
          },
          {
            path: 'pages/pages.css',
            content: `.page {}`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Remove a page',
        files: [{ path: 'pages/ProfilePage.tsx', operation: 'remove' }],
      },
    ],
  },
  {
    id: 'PluginReexport-root-store',
    title: {
      ru: 'реэкспорт одним объектом или классом',
      en: 'Re-exports as a single object or class',
    },
    description: {
      ru: 'В ряде случаев не обязательно поддерживать строгое именование переменных внутри файлов (в данном случае везде Store), так как семантичные имена выводятся из имен файлов',
      en: 'In some cases, strict variable naming within files is unnecessary (here, every file uses Store), because meaningful names are derived from the file names',
    },
    plugin: () =>
      new PluginReexport([
        {
          entries: ['stores'],
          fileNameTemplate() {
            return `RootStore.ts`;
          },
          template({ files }) {
            function upperFirst(value: string) {
              return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
            }

            const imports = files
              .map(({ name, fileName }) => `import { default as ${upperFirst(name)} } from './${fileName}';`)
              .join('\n');

            const fields = files.map(({ name }) => `  ${name} = new ${upperFirst(name)}();`).join('\n');

            return `${imports}\n\nexport class RootStore {\n${fields}\n}`;
          },
        },
      ]),
    steps: [
      {
        title: 'First run',
        files: [
          {
            path: 'stores/user.ts',
            content: `export default class Store {}`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Add a file',
        files: [
          {
            path: 'stores/ui.ts',
            content: `export default class Store {}`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Remove a file',
        files: [
          {
            path: 'stores/ui.ts',
            operation: 'remove',
          },
        ],
      },
    ],
  },
  {
    id: 'PluginReexport-reducers',
    title: {
      ru: 'сборка reducer map',
      en: 'Building a reducer map',
    },
    description: {
      ru: 'Тот же паттерн агрегации можно использовать для сборки Redux reducers: имя каждого поля выводится из имени файла',
      en: 'The same aggregation pattern can be used to assemble Redux reducers: each field name is derived from the file name',
    },
    plugin: () =>
      new PluginReexport([
        {
          entries: ['store/reducers'],
          fileNameTemplate() {
            return `reducers.ts`;
          },
          template({ files }) {
            const imports = files.map(({ name }) => `import ${name} from './${name}';`).join('\n');
            const fields = files.map(({ name }) => `  ${name},`).join('\n');

            return `${imports}\n\nexport const reducers = {\n${fields}\n};`;
          },
        },
      ]),
    steps: [
      {
        title: 'First run',
        files: [
          {
            path: 'store/reducers/orders.ts',
            content: `export default function orders() {}`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Add a reducer',
        files: [
          {
            path: 'store/reducers/profile.ts',
            content: `export default function profile() {}`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Remove a reducer',
        files: [{ path: 'store/reducers/profile.ts', operation: 'remove' }],
      },
    ],
  },
];
