import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

import { CheckerEnvKeys } from '../../../src/generator';
import type { TypeSandboxRecipeConfig } from '../types';

export const checkerEnvKeysRecipeConfigs: Array<TypeSandboxRecipeConfig> = [
  {
    id: 'CheckerEnvKeys-env-files',
    title: {
      ru: 'синхронизация env-файлов',
      en: 'Keeping env files in sync',
    },
    description: {
      ru: 'Чекер сравнивает ключи в .env и .example.env и сообщает о расхождении',
      en: 'The checker compares keys in .env and .example.env and reports mismatches',
    },
    checker: ({ rootDir }) =>
      new CheckerEnvKeys({
        get envKeys() {
          function readEnvKeys(fileName: string) {
            return {
              name: fileName,
              keys: Object.keys(parseEnv(fs.readFileSync(path.resolve(rootDir, fileName), 'utf8'))),
            };
          }

          return [readEnvKeys('.env'), readEnvKeys('.example.env')];
        },
      }),
    steps: [
      {
        title: 'First run',
        files: [
          {
            path: '.env',
            content: `NODE_ENV=development
EXPRESS_PORT=3000`,
            operation: 'add',
          },
          {
            path: '.example.env',
            content: `NODE_ENV=development
EXPRESS_PORT=3000`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Add a key to one file',
        files: [
          {
            path: '.env',
            content: `NODE_ENV=development
EXPRESS_PORT=3000
HOT_RELOAD=true`,
            operation: 'change',
          },
        ],
      },
      {
        title: 'Sync the example file',
        files: [
          {
            path: '.example.env',
            content: `NODE_ENV=development
EXPRESS_PORT=3000
HOT_RELOAD=false`,
            operation: 'change',
          },
        ],
      },
    ],
  },
  {
    id: 'CheckerEnvKeys-parsed-env',
    title: {
      ru: 'env-файлы и типизированный env-объект',
      en: 'Env files and a typed env object',
    },
    description: {
      ru: 'Ключи файлов сравниваются с ключами готового env-объекта. Так чекер находит переменные, объявленные в коде, но забытые в env-файлах',
      en: 'Keys from the files are compared with keys from an existing env object. This lets the checker find variables declared in code but missing from the env files',
    },
    checker: ({ rootDir }) =>
      new CheckerEnvKeys({
        get envKeys() {
          function readEnvKeys(fileName: string) {
            return {
              name: fileName,
              keys: Object.keys(parseEnv(fs.readFileSync(path.resolve(rootDir, fileName), 'utf8'))),
            };
          }

          class Env {
            NODE_ENV: 'development' | 'production' = 'development';
            EXPRESS_PORT = 0;
            HOT_RELOAD = false;

            constructor(source: Record<string, string | undefined>) {
              this.NODE_ENV = source.NODE_ENV === 'production' ? 'production' : 'development';
              this.EXPRESS_PORT = Number(source.EXPRESS_PORT ?? 0);
              this.HOT_RELOAD = source.HOT_RELOAD === 'true';
            }
          }

          const env = new Env(process.env);

          return [
            readEnvKeys('.env'),
            readEnvKeys('example.dev.env'),
            readEnvKeys('example.prod.env'),
            { name: 'parsed', keys: Object.keys(env) },
          ];
        },
      }),
    steps: [
      {
        title: 'First run',
        files: [
          {
            path: '.env',
            content: `NODE_ENV=development
EXPRESS_PORT=3000`,
            operation: 'add',
          },
          {
            path: 'example.dev.env',
            content: `NODE_ENV=development
EXPRESS_PORT=3000`,
            operation: 'add',
          },
          {
            path: 'example.prod.env',
            content: `NODE_ENV=production
EXPRESS_PORT=8080`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Add the missing key',
        files: [
          {
            path: '.env',
            content: `NODE_ENV=development
EXPRESS_PORT=3000
HOT_RELOAD=true`,
            operation: 'change',
          },
          {
            path: 'example.dev.env',
            content: `NODE_ENV=development
EXPRESS_PORT=3000
HOT_RELOAD=true`,
            operation: 'change',
          },
          {
            path: 'example.prod.env',
            content: `NODE_ENV=production
EXPRESS_PORT=8080
HOT_RELOAD=false`,
            operation: 'change',
          },
        ],
      },
    ],
  },
  {
    id: 'CheckerEnvKeys-duplicate-keys',
    title: {
      ru: 'дубли ключей в env-файле',
      en: 'Duplicate keys in an env file',
    },
    description: {
      ru: 'Для демонстрации дублей в данном случае используется построчное чтение',
      en: 'This example reads the file line by line to demonstrate duplicate detection',
    },
    checker: ({ rootDir }) =>
      new CheckerEnvKeys({
        get envKeys() {
          const content = fs.readFileSync(path.resolve(rootDir, '.env'), 'utf8');

          return [
            {
              name: '.env',
              keys: content.split(/\r?\n/).flatMap((line) => Object.keys(parseEnv(line))),
            },
          ];
        },
      }),
    steps: [
      {
        title: 'First run',
        files: [
          {
            path: '.env',
            content: `NODE_ENV=development
EXPRESS_PORT=3000`,
            operation: 'add',
          },
        ],
      },
      {
        title: 'Add duplicate keys',
        files: [
          {
            path: '.env',
            content: `NODE_ENV=development
EXPRESS_PORT=3000
NODE_ENV=production
EXPRESS_PORT=8080`,
            operation: 'change',
          },
        ],
      },
      {
        title: 'Remove duplicate keys',
        files: [
          {
            path: '.env',
            content: `NODE_ENV=development
EXPRESS_PORT=3000`,
            operation: 'change',
          },
        ],
      },
    ],
  },
];
