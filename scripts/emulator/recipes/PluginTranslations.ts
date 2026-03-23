import fs from 'node:fs';
import path from 'node:path';

import { PluginTranslations } from '../../../src/generator';
import type { TypeSandboxRecipeConfig } from '../types';

export const pluginTranslationsRecipeConfigs: Array<TypeSandboxRecipeConfig> = [
  {
    id: 'PluginTranslations-component-messages',
    title: {
      ru: 'сообщения рядом с компонентами',
      en: '',
    },
    description: {
      ru: 'Все messages.ts в проекте собираются в единый JSON. При удалении сообщения или целого файла устаревшие ключи удаляются автоматически.<br/>В данной схеме только один язык, поэтому в итоговом JSON только <code>defaultValue</code> — это удобно для передачи во внешнюю систему переводов',
      en: '',
    },
    plugin: ({ rootDir }) =>
      new PluginTranslations([
        {
          entries: ['**/messages.ts'],
          targetFile: path.resolve(rootDir, 'translations/usedTranslations.json'),
          languages: ['en'],
          baseLanguage: 'en',
          getKey({ name }) {
            return name;
          },
          parseMessages(filePath) {
            const source = fs.readFileSync(filePath, 'utf8');
            const content = source.replace(/^[\s\S]*?export\s+const\s+messages\s*=\s*/, 'return ');

            if (content === source) throw new Error(`Messages export not found in: ${filePath}`);

            // imported from the library
            type TypeMessage = { name: string; defaultValue: string };

            function createMessages(scope: string, messages: Record<string, string>) {
              const result: Record<string, TypeMessage> = {};

              for (const key in messages) {
                result[key] = { name: `${scope}/${key}`, defaultValue: messages[key] };
              }

              return result;
            }

            const messages = new Function('createMessages', content)(createMessages) as Record<string, TypeMessage>;

            return Object.values(messages);
          },
          async translate() {
            return '';
          },
        },
      ]),
    steps: [
      {
        title: 'First run',
        files: [
          {
            path: 'features/orders/OrderStatusBadge/messages.ts',
            content: `import { createMessages } from 'translations/createMessages';

export const messages = createMessages('features/orders/OrderStatusBadge', {
  draft: 'Draft',
  paid: 'Paid',
});`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Add component messages',
        files: [
          {
            path: 'features/customers/CustomerStatusBadge/messages.ts',
            content: `import { createMessages } from 'translations/createMessages';

export const messages = createMessages('features/customers/CustomerStatusBadge', {
  active: 'Active',
  blocked: 'Blocked',
});`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Remove one message',
        files: [
          {
            path: 'features/orders/OrderStatusBadge/messages.ts',
            content: `import { createMessages } from 'translations/createMessages';

export const messages = createMessages('features/orders/OrderStatusBadge', {
  draft: 'Draft',
});`,
            operation: 'change',
          },
        ],
      },
      {
        title: 'Remove component messages',
        files: [{ path: 'features/customers/CustomerStatusBadge/messages.ts', operation: 'remove' }],
      },
    ],
  },
  {
    id: 'PluginTranslations-sync',
    title: {
      ru: 'синхронизация и перевод сообщений',
      en: '',
    },
    description: {
      ru: 'В этом примере сообщения читаются из JSON. Плагин заполняет отсутствующие переводы через <code>translate</code>, сохраняет существующие и <b>обновляет</b> <code>defaultValue</code> из исходников.<br/>Пример подходит для нескольких языков без внешней системы переводов, когда переводы делаются в полуручном режиме',
      en: '',
    },
    plugin: ({ rootDir }) =>
      new PluginTranslations([
        {
          entries: ['features/**/messages.json'],
          targetFile: path.resolve(rootDir, 'translations/translations.json'),
          languages: ['en', 'ru'],
          baseLanguage: 'en',
          parseMessages(filePath) {
            const messages: Record<string, string> = JSON.parse(fs.readFileSync(filePath, 'utf8'));

            return Object.entries(messages).map(([name, defaultValue]) => ({
              name: path.resolve(path.dirname(filePath), name),
              defaultValue,
            }));
          },
          async translate({ to, text }) {
            return `[${to}] ${text}`;
          },
        },
      ]),
    steps: [
      {
        title: 'First run',
        files: [
          {
            path: 'features/orders/messages.json',
            content: `{
  "title": "Orders",
  "empty": "No orders"
}`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Change default value',
        files: [
          {
            path: 'features/orders/messages.json',
            content: `{
  "title": "All orders",
  "empty": "No orders"
}`,
            operation: 'change',
          },
        ],
      },
      {
        title: 'Add a message',
        files: [
          {
            path: 'features/orders/messages.json',
            content: `{
  "title": "All orders",
  "empty": "No orders",
  "submit": "Create order"
}`,
            operation: 'change',
          },
        ],
      },
      {
        title: 'Remove one message',
        files: [
          {
            path: 'features/orders/messages.json',
            content: `{
  "title": "All orders",
  "submit": "Create order"
}`,
            operation: 'change',
          },
        ],
      },
    ],
  },
];
