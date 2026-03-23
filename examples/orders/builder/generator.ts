import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CheckerBoundaries,
  CheckerCli,
  FileGenerator,
  PluginReexport,
  PluginTranslations,
  PluginValidators,
  type TypeMessage,
} from '@arfa-tools/generator';

import { createMessages } from '../src/shared/i18n/createMessages.ts';
import { format } from './format.ts';

const filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(filename), '..');
const sourceDir = path.resolve(rootDir, 'src');
const exclude = /(^_|^index\.ts$|^messages\.ts$|\.css$|\.d\.ts$|\.md$|package\.json$)/;
const headerTemplate = `// biome-ignore-all assist/source/organizeImports: This file is auto-generated\n\n`;

function upperFirst(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function parseMessages(filePath: string): Array<TypeMessage> {
  const source = fs.readFileSync(filePath, 'utf-8');
  const content = source.replace(/^[\s\S]*?export\s+const\s+messages\s*=\s*/, 'return ');

  if (content === source) throw new Error(`Messages export not found in: ${filePath}`);

  const messages = new Function('createMessages', content)(createMessages);

  return Object.values(messages);
}

export const generator = new FileGenerator({
  rootDir: sourceDir,
  headerTemplate,
  historyPath: path.resolve(rootDir, '.llm/history.jsonl'),
  format,
  plugins: [
    new PluginTranslations([
      {
        entries: ['**/messages.ts'],
        targetFile: path.resolve(sourceDir, 'shared/i18n/usedTranslations.json'),
        languages: ['en'],
        baseLanguage: 'en',
        getKey({ name }) {
          return name;
        },
        parseMessages,
        async translate() {
          return '';
        },
      },
    ]),
    new PluginValidators([
      {
        entries: ['shared/api/*/contracts'],
        exclude,
        targetFolder: path.resolve(sourceDir, 'shared/api/validators'),
        tsconfigPath: path.resolve(rootDir, 'tsconfig.json'),
        requestDeclaration: 'TypeRequest',
        responseDeclaration: 'TypeResponse',
        formatContent({ schema, targetPath }) {
          return `export const ${path.parse(targetPath).name} = ${JSON.stringify(schema, null, 2)} as const;\n`;
        },
      },
    ]),
    new PluginReexport([
      {
        entries: ['pages/*'],
        exclude,
        noPackage: true,
        fileNameTemplate: () => 'index.ts',
        template({ folderName }) {
          const pageName = `${upperFirst(folderName)}Page`;

          return `export { ${pageName} } from './ui/${pageName}';`;
        },
      },
      {
        entries: ['shared/api/*'],
        exclude: /(^validators$|^index\.ts$)/,
        noPackage: true,
        fileNameTemplate: () => 'index.ts',
        template({ files }) {
          return files
            .filter(({ ext }) => ext === '.ts')
            .map(({ name }) => `export type * from './${name}';`)
            .join('\n');
        },
      },
      {
        entries: ['pages/*/api'],
        exclude,
        noPackage: true,
        fileNameTemplate: () => 'index.ts',
        template({ files }) {
          return files.map(({ name }) => `export { ${name} } from './${name}';`).join('\n');
        },
        validateContent({ name, content }) {
          return content.includes(`export async function ${name}(`);
        },
      },
      {
        entries: ['shared/lib/*', 'shared/i18n'],
        exclude,
        noPackage: true,
        fileNameTemplate: () => 'index.ts',
        template({ files }) {
          return files
            .filter(({ ext }) => ['.ts', '.tsx', '.json'].includes(ext))
            .map(({ name, ext, fileName }) =>
              ext === '.json'
                ? `export { default as ${name} } from './${fileName}';`
                : `export * from './${name}';`
            )
            .join('\n');
        },
      },
      {
        entries: ['pages/*/ui/*'],
        exclude,
        onlyPackage: true,
        fileNameTemplate({ folderName }) {
          return `${upperFirst(folderName)}.tsx`;
        },
        template: () => '',
      },
      {
        entries: ['shared/ui/*'],
        exclude,
        fileNameTemplate: () => 'index.ts',
        template({ files }) {
          return files
            .filter(({ ext }) => ['.ts', '.tsx'].includes(ext))
            .map(({ name }) => `export * from './${name}';`)
            .join('\n');
        },
      },
    ]),
  ],
  checkers: [
    new CheckerBoundaries({
      tsconfigPath: path.resolve(rootDir, 'tsconfig.json'),
      extensions: ['.ts', '.tsx'],
      rules: [
        {
          entries: ['app/**'],
          allow: {
            imports: [
              'pages/*/index.ts',
              'shared/api/*/index.ts',
              'shared/i18n/index.ts',
              'shared/lib/*/index.ts',
              'shared/ui/*/index.ts',
            ],
            importsInsideScope: 'all',
            external: true,
          },
        },
        {
          entries: ['pages/**'],
          allow: {
            imports: [
              'shared/api/*/index.ts',
              'shared/i18n/index.ts',
              'shared/lib/*/index.ts',
              'shared/ui/*/index.ts',
            ],
            importsInsideScope: 'sameTopLevel',
            external: true,
          },
        },
        {
          entries: ['shared/**'],
          allow: {
            imports: [],
            importsInsideScope: 'all',
            external: true,
          },
        },
      ],
    }),
    new CheckerCli({
      name: 'biome',
      getCommand({ changedFiles }) {
        if (changedFiles.length === 0) return false;

        return [
          path.resolve(rootDir, 'node_modules/.bin/biome'),
          'check',
          '--no-errors-on-unmatched',
          ...changedFiles.map(({ relativePath }) => relativePath),
        ];
      },
    }),
    new CheckerCli({
      name: 'tsc',
      getCommand: () => [path.resolve(rootDir, 'node_modules/.bin/tsc')],
    }),
  ],
});
