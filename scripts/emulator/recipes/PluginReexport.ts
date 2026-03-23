import { PluginReexport } from '../../../src/generator';
import type { TypeSandboxRecipeConfig } from '../types';

export const pluginReexportRecipeConfigs: Array<TypeSandboxRecipeConfig> = [
  {
    id: 'PluginReexport-basic',
    title: {
      ru: 'валидация содержимого файлов',
      en: '',
    },
    description: {
      ru: 'В файл реэкспорта попадают только файлы, экспортирующие функцию с именем файла, что позволяет проверять нейминг и валидировать содержимое',
      en: '',
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
      en: '',
    },
    description: {
      ru: 'В папках компонентов часто удобнее держать один package.json вместо index.ts. Валидация через validateContent для главного файла при этом недоступна',
      en: '',
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
      en: '',
    },
    description: {
      ru: 'При этой настройке генерируется только index.ts; включена дополнительная фильтрация',
      en: '',
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
      en: '',
    },
    description: {
      ru: 'В utils и всех вложенных папках создаются _reexport.ts и package.json. Это позволяет получать вложенные экспорты через единый импорт из utils',
      en: '',
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
      en: '',
    },
    description: {
      ru: 'Как правило svg, png и т.п. файлы считаются бандлерами как экспортирующие default. В данном случае реэкспортный файл назван по имени папки',
      en: '',
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
      en: '',
    },
    description: {
      ru: 'Файлы с суффиксом .types.ts реэкспортируются через export type *, а остальные остаются runtime-экспортами',
      en: '',
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
      en: '',
    },
    description: {
      ru: 'Для каждого feature-модуля создается публичный entrypoint, в который не попадают тесты, stories, стили и приватные файлы',
      en: '',
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
      en: '',
    },
    description: {
      ru: 'Entry-файл создает React.lazy-компонент для каждой страницы и обновляется при добавлении или удалении файлов',
      en: '',
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
      en: '',
    },
    description: {
      ru: 'В ряде случаев не обязательно поддерживать строгое именование переменных внутри файлов (в данном случае везде Store), так как семантичные имена выводятся из имен файлов',
      en: '',
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
      en: '',
    },
    description: {
      ru: 'Тот же паттерн агрегации можно использовать для сборки Redux reducers: имя каждого поля выводится из имени файла',
      en: '',
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
