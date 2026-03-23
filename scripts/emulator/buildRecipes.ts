import fs from 'node:fs';
import path from 'node:path';

import {
  FileGenerator,
  logsToConsole,
  logsToMarkdownSummary,
  type TypeAfterFinishArgs,
  type TypeGenerateResult,
} from '../../src/generator';
import { normalizeLogs } from './normalizeLogs';
import { sandboxRecipeConfigs } from './recipes';
import type { TypeSandboxRecipe, TypeSandboxRecipeConfig } from './types';
import { removeFile, writeFile } from './utils';

function getCodeLang(filePath: string): string {
  return path.extname(filePath).slice(1) || 'text';
}

const recipesDirectoryPath = path.resolve('scripts/emulator/recipes');
const recipesOutputDirectoryPath = path.resolve('vitepress/emulator');
const recipeFileSources = fs.globSync('**/*.ts', { cwd: recipesDirectoryPath }).map((relativePath) => ({
  fileName: path.parse(relativePath).name,
  source: fs.readFileSync(path.resolve(recipesDirectoryPath, relativePath), 'utf8'),
}));

function extractRecipeCode(id: string): string {
  const recipeFileName = id.split('-')[0];
  const recipesFileSource = recipeFileSources.find(({ fileName }) => fileName === recipeFileName)?.source;

  if (!recipesFileSource) {
    throw new Error(`Could not find source file for recipe "${id}".`);
  }

  const stepsPropertyMarker = '    steps: ';
  const recipeStartIndex = recipesFileSource.indexOf(`    id: '${id}',`);
  const recipeSource = recipesFileSource.slice(recipeStartIndex);
  const recipePropertyMatch = recipeSource.match(/ {4}(plugin|checker|afterFinish):\s*.+=>\n/);
  const recipeStartCodeIndex =
    recipePropertyMatch?.index === undefined
      ? -1
      : recipeStartIndex + recipePropertyMatch.index + recipePropertyMatch[0].length;
  const stepsStartIndex = recipesFileSource.indexOf(stepsPropertyMarker, recipeStartCodeIndex);

  if (recipeStartIndex === -1 || recipeStartCodeIndex === -1 || stepsStartIndex === -1) {
    throw new Error(`Could not extract source for recipe "${id}".`);
  }

  const recipeCode = recipesFileSource.slice(recipeStartCodeIndex, stepsStartIndex).trimEnd();

  const bodyIndentation = recipeCode.match(/^[ \t]*/)?.[0] ?? '';
  const code = recipeCode.replace(new RegExp(`^${bodyIndentation}`, 'gm'), '');

  return recipePropertyMatch?.[1] === 'afterFinish'
    ? code.replace(/^async\s*\(([^)]*)\)\s*=>\s*\{/, 'async afterFinish($1) {')
    : code;
}

async function buildRecipe(config: TypeSandboxRecipeConfig): Promise<void> {
  const { id, title, description, steps } = config;

  const rootDir = path.resolve('tmp/vitepress-sandbox', id);
  const outputFilePath = path.resolve(recipesOutputDirectoryPath, `${id}.json`);
  const headerTemplate = '// this file is generated\n\n';

  fs.rmSync(rootDir, { recursive: true, force: true });

  const recipe: TypeSandboxRecipe = {
    id,
    title,
    steps: [],
    pluginCode: { content: extractRecipeCode(id), lang: 'ts' },
    description,
    ...(config.checker && !config.plugin ? { kind: 'checker' as const } : {}),
    ...(config.afterFinish ? { kind: 'afterFinish' as const } : {}),
  };

  const generator = new FileGenerator({
    rootDir,
    headerTemplate,
    plugins: config.plugin ? [config.plugin({ rootDir })] : [],
    checkers: config.checker ? [config.checker({ rootDir })] : [],
  });

  let resolveNextResult: ((result: TypeGenerateResult) => void) | undefined;

  const resultWaiter = () => new Promise<TypeGenerateResult>((r) => (resolveNextResult = r));

  const recipeAfterFinish = config.afterFinish?.({ rootDir });

  const afterFinish = async (result: TypeAfterFinishArgs) => {
    if (recipeAfterFinish) await recipeAfterFinish(result);

    resolveNextResult?.(result);
  };

  const generatedRelativePaths = new Set<string>();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    const resultPromise = resultWaiter();

    if (i !== 0) await generator.startWatch({ aggregationTimeout: 50, afterFinish });

    step.files.forEach((file) => {
      if (file.operation === 'remove') removeFile(rootDir, file.path);
      else writeFile(rootDir, file.path, file.content);
    });

    if (i === 0) await generator.runFullCycle({ afterFinish });

    const result = await resultPromise;
    const logs = normalizeLogs(result.logs);

    if (config.checker) {
      logs.checkers.forEach((log) => {
        if (log.type === 'checker:error' && typeof log.error === 'string') {
          log.error = log.error
            .replaceAll(`${rootDir}${path.sep}`, '')
            .replaceAll(`${process.cwd()}${path.sep}node_modules${path.sep}.bin${path.sep}`, 'node_modules/.bin/');
        }
      });
    }

    result.logs.generator.forEach((log) => {
      if (log.type === 'file:write') generatedRelativePaths.add(log.relativePath);
      if (log.type === 'file:remove') generatedRelativePaths.delete(log.relativePath);
    });

    if (config.afterFinish) {
      generatedRelativePaths.clear();

      for (const relativePath of fs.globSync('**/*', { cwd: rootDir })) {
        if (fs.statSync(path.resolve(rootDir, relativePath)).isFile()) {
          generatedRelativePaths.add(relativePath);
        }
      }
    }

    recipe.steps.push({
      title: step.title,
      inputFiles: step.files.map((file) => ({
        path: file.path,
        code: { content: file.operation === 'remove' ? '' : file.content, lang: getCodeLang(file.path) },
        operation: file.operation,
      })),
      consoleNormal: {
        content: logsToConsole(logs, { verbosity: 'normal', noStdout: true }),
        lang: 'console',
      },
      consoleMinimal: {
        content: logsToConsole(logs, { verbosity: 'minimal', noStdout: true }),
        lang: 'console',
      },
      markdownFeedback: {
        content: logsToMarkdownSummary(logs, {
          version: i,
          timestamp: Date.parse('2026-10-10T12:30:00.000Z'),
        }),
        lang: 'md',
      },
      rawLogs: { content: JSON.stringify(logs, null, 2), lang: 'json' },
      files: [...generatedRelativePaths]
        .sort((a, b) => Number(path.basename(a) === 'package.json') - Number(path.basename(b) === 'package.json'))
        .filter((relativePath) => fs.existsSync(path.resolve(rootDir, relativePath)))
        .map((relativePath) => ({
          path: relativePath,
          code: {
            content: fs.readFileSync(path.resolve(rootDir, relativePath), 'utf8'),
            lang: getCodeLang(relativePath),
          },
        })),
    });

    await generator.stopWatch();
  }

  const content = `${JSON.stringify(recipe)}\n`;

  if (fs.existsSync(outputFilePath) && fs.readFileSync(outputFilePath, 'utf8') === content) return;

  fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });

  fs.writeFileSync(outputFilePath, content, 'utf8');

  console.log(`\x1b[32m[sandbox]\x1b[0m generated ${path.relative(process.cwd(), outputFilePath)}`);
}

export async function buildRecipes(): Promise<void> {
  await Promise.all(sandboxRecipeConfigs.map(buildRecipe));

  const recipeFileNames = new Set(sandboxRecipeConfigs.map(({ id }) => `${id}.json`));

  for (const fileName of fs.globSync('*.json', { cwd: recipesOutputDirectoryPath })) {
    if (!recipeFileNames.has(fileName)) {
      fs.unlinkSync(path.resolve(recipesOutputDirectoryPath, fileName));
    }
  }
}
