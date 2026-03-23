import path from 'node:path';

import { PluginScaffold } from '../../../src/generator';
import type { TypeSandboxRecipeConfig } from '../types';

export const pluginScaffoldRecipeConfigs: Array<TypeSandboxRecipeConfig> = [
  {
    id: 'PluginScaffold-feature-slice',
    title: {
      ru: 'новая feature',
      en: '',
    },
    description: {
      ru: 'Marker создает UI и публичный API feature-slice. После удаления marker компонент можно менять вручную: плагин больше его не переписывает',
      en: '',
    },
    plugin: () =>
      new PluginScaffold([
        {
          entries: ['features/*/.feature'],
          createFiles({ folderName, folderPath }) {
            function upperFirst(value: string) {
              return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
            }

            const componentName = upperFirst(folderName);

            return [
              {
                filePath: path.resolve(folderPath, `ui/${componentName}.tsx`),
                content: `export function ${componentName}() {
  return <button type="button">${componentName}</button>;
}`,
              },
              {
                filePath: path.resolve(folderPath, 'index.ts'),
                content: `export { ${componentName} } from './ui/${componentName}';`,
              },
            ];
          },
        },
      ]),
    steps: [
      {
        title: 'Create feature',
        files: [{ path: 'features/addToCart/.feature', content: '', operation: 'add' }],
      },
      {
        title: 'Edit component',
        files: [
          {
            path: 'features/addToCart/ui/AddToCart.tsx',
            content: `export function AddToCart() {
  return <button type="button">Add to cart</button>;
}`,
            operation: 'change',
          },
        ],
      },
      {
        title: 'Create another feature',
        files: [{ path: 'features/removeFromCart/.feature', content: '', operation: 'add' }],
      },
    ],
  },
  {
    id: 'PluginScaffold-next-page',
    title: {
      ru: 'маршрут Next.js App Router',
      en: '',
    },
    description: {
      ru: 'Marker в папке маршрута создает page.tsx и loading.tsx. Если повторно добавить marker при существующем page.tsx, плагин сохранит оба файла и сообщит о конфликте',
      en: '',
    },
    plugin: () =>
      new PluginScaffold([
        {
          entries: ['app/**/.page'],
          createFiles({ folderName, folderPath }) {
            return [
              {
                filePath: path.resolve(folderPath, 'page.tsx'),
                content: `export default function Page() {
  return <main><h1>${folderName}</h1></main>;
}`,
              },
              {
                filePath: path.resolve(folderPath, 'loading.tsx'),
                content: `export default function Loading() {
  return <p>Loading...</p>;
}`,
              },
            ];
          },
        },
      ]),
    steps: [
      {
        title: 'Create route',
        files: [{ path: 'app/orders/.page', content: '', operation: 'add' }],
      },
      {
        title: 'Add marker again',
        files: [{ path: 'app/orders/.page', content: '', operation: 'add' }],
      },
    ],
  },
  {
    id: 'PluginScaffold-component-story',
    title: {
      ru: 'компонент с CSS и Storybook',
      en: '',
    },
    description: {
      ru: 'Один marker создает React-компонент, CSS module и Storybook story рядом с ним',
      en: '',
    },
    plugin: () =>
      new PluginScaffold([
        {
          entries: ['shared/ui/*/.component'],
          createFiles({ folderName, folderPath }) {
            return [
              {
                filePath: path.resolve(folderPath, `${folderName}.tsx`),
                content: `import styles from './${folderName}.module.css';

type Props${folderName} = { label: string };

export function ${folderName}({ label }: Props${folderName}) {
  return <button className={styles.root} type="button">{label}</button>;
}`,
              },
              {
                filePath: path.resolve(folderPath, `${folderName}.module.css`),
                content: `.root {
  padding: 0.5rem 1rem;
}`,
              },
              {
                filePath: path.resolve(folderPath, `${folderName}.stories.tsx`),
                content: `import type { Meta, StoryObj } from '@storybook/react';

import { ${folderName} } from './${folderName}';

const meta = { component: ${folderName} } satisfies Meta<typeof ${folderName}>;

export default meta;

type TypeStory = StoryObj<typeof meta>;

export const Primary: TypeStory = { args: { label: '${folderName}' } };`,
              },
            ];
          },
        },
      ]),
    steps: [
      {
        title: 'Create component',
        files: [{ path: 'shared/ui/Button/.component', content: '', operation: 'add' }],
      },
      {
        title: 'Edit CSS',
        files: [
          {
            path: 'shared/ui/Button/Button.module.css',
            content: `.root {
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
}`,
            operation: 'change',
          },
        ],
      },
      {
        title: 'Create another component',
        files: [{ path: 'shared/ui/Badge/.component', content: '', operation: 'add' }],
      },
    ],
  },
];
