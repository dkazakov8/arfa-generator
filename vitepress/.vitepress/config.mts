import path from 'node:path';

import { type DefaultTheme, defineConfig } from 'vitepress';

import { getSidebarDocumentation } from './getSidebarDocumentation';
import { labelsPlugin } from './theme/labelsPlugin';
import { wrapTransformer } from './theme/wrapTransformer';

export const sidebarConfig = getSidebarDocumentation({
  overview: { ru: 'Обзор и назначение', en: 'Overview and purpose' },
  installation: { ru: 'Установка и настройка', en: 'Installation and setup' },
  fileGeneratorApi: { ru: 'FileGenerator API', en: 'FileGenerator API' },
  llmCliFeedback: { ru: 'LLM / CLI feedback', en: 'LLM / CLI feedback' },

  plugins: { ru: 'Плагины', en: 'Plugins' },
  checkers: { ru: 'Чекеры', en: 'Checkers' },

  pluginReexport: { ru: 'PluginReexport', en: 'PluginReexport' },
  pluginScaffold: { ru: 'PluginScaffold', en: 'PluginScaffold' },
  pluginModular: { ru: 'PluginModular', en: 'PluginModular' },
  pluginValidators: { ru: 'PluginValidators', en: 'PluginValidators' },
  pluginTranslations: { ru: 'PluginTranslations', en: 'PluginTranslations' },

  checkerCli: { ru: 'CheckerCli', en: 'CheckerCli' },
  checkerEnvKeys: { ru: 'CheckerEnvKeys', en: 'CheckerEnvKeys' },
  checkerBoundaries: { ru: 'CheckerBoundaries', en: 'CheckerBoundaries' },

  extending: { ru: 'Расширение', en: 'Extending' },
  customPlugin: { ru: 'Свой плагин', en: 'Custom plugin' },
  customChecker: { ru: 'Свой чекер', en: 'Custom checker' },

  apiContractCheck: { ru: 'api-contract-check', en: 'api-contract-check' },
  schemaGeneration: { ru: 'Генерация схем валидации', en: 'Validation schema generation' },
  payloadValidation: { ru: 'Валидация данных', en: 'Payload validation' },
  incrementalGeneration: { ru: 'Инкрементальная генерация', en: 'Incremental generation' },
});

export default defineConfig({
  outDir: path.resolve(__dirname, '../../docs'),
  vite: {
    resolve: {
      alias: [
        { find: '@', replacement: path.resolve(__dirname, '..') },
        { find: '@shared', replacement: path.resolve(__dirname, '../shared') },
      ],
    },
  },
  title: 'ARFA Generator',
  description: 'The infrastructure core of a development workflow for automating project architecture',
  base: '/arfa-generator/',
  head: [['link', { rel: 'icon', href: '/arfa-generator/file.svg' }]],
  appearance: { initialValue: 'dark' },
  locales: {
    root: {
      label: 'English',
      lang: 'en',
      link: '/en/',
      themeConfig: {
        nav: [
          { component: 'OutputModeSelect' },
          { text: 'Home', link: '/' },
          {
            text: 'Documentation',
            link: sidebarConfig.defaultLink.en,
            activeMatch: `(${Array.from(Object.keys(sidebarConfig.en)).join('|')})`,
          },
          { text: 'Examples', link: '/en/examples/orders', activeMatch: '/en/examples/' },
        ],
        sidebar: {
          ...sidebarConfig.en,
          '/en/examples/': [
            {
              text: 'Order Management',
              items: [{ text: 'Orders', link: '/en/examples/orders' }],
            },
          ],
        },
      },
    },
    ru: {
      label: 'Русский',
      lang: 'ru',
      link: '/ru/',
      themeConfig: {
        outlineTitle: 'На этой странице',
        nav: [
          { component: 'OutputModeSelect' },
          { text: 'Главная', link: '/ru/' },
          {
            text: 'Документация',
            link: sidebarConfig.defaultLink.ru,
            activeMatch: `(${Array.from(Object.keys(sidebarConfig.ru)).join('|')})`,
          },
          { text: 'Примеры', link: '/ru/examples/orders', activeMatch: '/ru/examples/' },
        ],
        sidebar: {
          ...sidebarConfig.ru,
          '/ru/examples/': [
            {
              text: 'Примеры',
              items: [{ text: 'Order Management', link: '/ru/examples/orders' }],
            },
          ],
        },
      },
    },
  },
  markdown: {
    config(md) {
      labelsPlugin(md as any);
    },
    codeTransformers: [wrapTransformer],
    theme: { dark: 'github-dark', light: 'github-light' },
    codeCopyButtonTitle: 'Copy code',
  },
  themeConfig: {
    logo: '/file.svg',
    outline: {
      level: [2, 3],
    },
    search: {
      provider: 'local',
      options: {
        locales: {
          ru: {
            translations: {
              button: {
                buttonText: 'Поиск',
                buttonAriaLabel: 'Поиск',
              },
              modal: {
                displayDetails: 'Отобразить подробный список',
                resetButtonTitle: 'Сбросить поиск',
                backButtonTitle: 'Закрыть поиск',
                noResultsText: 'Нет результатов по запросу',
                footer: {
                  selectText: 'выбрать',
                  selectKeyAriaLabel: 'выбрать',
                  navigateText: 'перейти',
                  navigateUpKeyAriaLabel: 'стрелка вверх',
                  navigateDownKeyAriaLabel: 'стрелка вниз',
                  closeText: 'закрыть',
                  closeKeyAriaLabel: 'esc',
                },
              },
            },
          },
        },
      },
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/dkazakov8/arfa-generator' },
    ] as Array<DefaultTheme.SocialLink>,
    footer: {
      message: 'MIT License',
    },
  },
});
