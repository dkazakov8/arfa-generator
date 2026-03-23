import fs from 'node:fs';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';

import type { DefaultTheme } from 'vitepress';

import { sidebarConfig } from '../vitepress/.vitepress/config.mts';
import dynamicData from '../vitepress/dynamic.data';
import type { TypeSandboxRecipe } from './emulator/types';

const projectRoot = path.resolve(import.meta.dirname, '..');
const docsRoot = path.join(projectRoot, 'vitepress');
const russianDocsRoot = path.join(docsRoot, 'ru');
const outputPath = path.join(projectRoot, 'llms.md');

const includePattern = /^<!-- @include: (.+?) -->$/gm;
const sandboxPattern = /<GeneratorSandbox :recipe="(\w+)" \/>/g;
const recipeImportPattern = /import (\w+) from '@\/emulator\/(.+\.json)';/g;

function codeBlock(content: string, language: string): string {
  const fence = '`'.repeat(Math.max(3, ...Array.from(content.matchAll(/`+/g), ([match]) => match.length + 1)));
  return `${fence}${language}\n${content.trimEnd()}\n${fence}`;
}

function readFileRegion(filePath: string, region?: string): string {
  let content = fs.readFileSync(filePath, 'utf8');

  if (region) {
    const startMarker = `// #region ${region}`;
    const endMarker = `// #endregion ${region}`;
    const start = content.indexOf(startMarker);
    const end = content.indexOf(endMarker, start + startMarker.length);

    if (start < 0 || end < 0) throw new Error(`Missing region ${region} in ${filePath}`);

    content = content.slice(start + startMarker.length, end);
  }

  return content;
}

function replaceMarkdownMarkup(
  content: string,
  replace: (markup: string, codeBlocks: Array<string>) => string
): string {
  const codeBlocks: Array<string> = [];
  const markup = content.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*(?=\n|$)/gm, (block) => {
    codeBlocks.push(block);
    return `\0CODE_BLOCK_${codeBlocks.length - 1}\0`;
  });

  return replace(markup, codeBlocks).replace(/\0CODE_BLOCK_(\d+)\0/g, (_, index: string) => codeBlocks[Number(index)]);
}

function readIncludedMarkdown(filePath: string, region?: string): string {
  return replaceMarkdownMarkup(readFileRegion(filePath, region), (content) =>
    content
      .replace(/^[ \t]*\/\/ #(?:end)?region .+$/gm, '')
      .replace(includePattern, (_, reference: string) => {
        const [relativePath, includedRegion] = reference.split('#');
        const includedPath = relativePath.startsWith('@shared/')
          ? path.join(docsRoot, 'shared', relativePath.slice('@shared/'.length))
          : path.resolve(path.dirname(filePath), relativePath);

        return readIncludedMarkdown(includedPath, includedRegion).trim();
      })
      .replace(/^<<<[ \t]+([^\n]+)$/gm, (_, reference: string) => {
        const [relativePath, includedRegion] = reference.trim().split('#');
        const includedPath = relativePath.startsWith('@/')
          ? path.resolve(docsRoot, relativePath.slice(2))
          : path.resolve(path.dirname(filePath), relativePath);
        const source = readFileRegion(includedPath, includedRegion);
        const lines = source.split('\n');
        const indentation = Math.min(
          ...lines.filter((line) => line.trim()).map((line) => line.match(/^[ \t]*/)?.[0].length ?? 0)
        );
        const code = lines
          .map((line) => line.slice(indentation))
          .join('\n')
          .replace(/^\n/, '');

        return codeBlock(code, path.extname(includedPath).slice(1) || 'text');
      })
  );
}

function cleanVitePressMarkup(content: string, data: ReturnType<typeof dynamicData.load>): string {
  const values: Record<string, string | number> = {
    version: data.version,
    sizeForLabel: data.sizeForLabel,
    builderSize: data.builderSize,
    checkerSize: data.checkerSize,
    'metrics.coverage': data.metrics.coverage ?? '—',
    passedTests: data.passedTests,
  };

  return replaceMarkdownMarkup(content, (markup, codeBlocks) => {
    for (let index = 0; index < codeBlocks.length; index++) {
      const block = codeBlocks[index];
      const opening = block.match(/^(`{3,}|~{3,})(\w*)([^\n]*)\n/);
      if (!opening) continue;

      const [, fence, language, meta] = opening;
      codeBlocks[index] = `${fence}${language}\n${block.slice(opening[0].length)}`;
      const label = meta.match(/\[([^\]]+)\]/)?.[1];
      if (label) {
        markup = markup.replace(`\0CODE_BLOCK_${index}\0`, `**${label}**\n\n\0CODE_BLOCK_${index}\0`);
      }
    }

    return markup
      .replace(/<script setup[^>]*>[\s\S]*?<\/script>/g, '')
      .replace(/<br\s*\/?>(?:\n)?/g, '\n')
      .replace(/<Badge[^>]*>\{\{ data\.version \}\}<\/Badge>/g, `Версия: ${data.version}`)
      .replace(/\{\{\s*data\.([\w.]+)\s*\}\}/g, (match, name: string) => String(values[name] ?? match))
      .replace(/<\/?(?:Badge|span)\b[^>]*>/g, '')
      .replace(/<Accordion\b[^>]*title="([^"]+)"[^>]*>/g, (_, title: string) => `\n\n**${title}**\n\n`)
      .replace(/<Accordion\b[^>]*>|<\/Accordion>/g, '')
      .replace(/<Link\b[^>]*>([\s\S]*?)<\/Link>/g, (_, label: string) => label.trim())
      .replace(/(?<!!)\[([^\]\n]+)\]\((?:[^()\n]|\([^()\n]*\))*\)/g, '$1')
      .replace(/<code>([\s\S]*?)<\/code>/g, (_, code: string) => `\`${code}\``)
      .replace(/::: code-group\n([\s\S]*?)\n:::/g, (_, blocks: string) => blocks)
      .replace(
        /::: (info|tip|warning|danger|details)(?:[ \t]+([^\n]*))?\n([\s\S]*?)\n:::/g,
        (_, kind: string, title: string | undefined, body: string) =>
          `**${kind}${title ? `: ${title}` : ''}**\n\n${body.trim()}`
      )
      .replace(
        /<tr>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g,
        (_, signature: string, description: string) => `${signature.trim()}\n\n${description.trim()}\n\n`
      )
      .replace(/<\/?(?:table|tbody)\b[^>]*>/g, '')
      .replace(/\n{3,}/g, '\n\n');
  });
}

function formatRecipe(recipe: TypeSandboxRecipe): string {
  const parts = [`## ${recipe.title.ru || recipe.id}`];

  if (recipe.description.ru) parts.push(recipe.description.ru);
  parts.push('### Конфигурация', codeBlock(recipe.pluginCode.content, recipe.pluginCode.lang));

  let previousFiles = new Map<string, string>();

  for (const step of recipe.steps) {
    parts.push(`### ${step.title}`);

    for (const file of step.inputFiles) {
      parts.push(`**${file.operation}: ${file.path}**`);
      if (file.operation !== 'remove') parts.push(codeBlock(file.code.content, file.code.lang));
    }

    const currentFiles = new Map(step.files.map((file) => [file.path, file.code.content]));

    for (const file of step.files) {
      if (previousFiles.get(file.path) === file.code.content) continue;
      parts.push(`**Результат: ${file.path}**`, codeBlock(file.code.content, file.code.lang));
    }

    for (const filePath of previousFiles.keys()) {
      if (!currentFiles.has(filePath)) parts.push(`**Удалён результат: ${filePath}**`);
    }

    parts.push('**Вывод генератора**', codeBlock(stripVTControlCharacters(step.consoleNormal.content), 'text'));

    previousFiles = currentFiles;
  }

  return parts.join('\n\n');
}

export function generateLlms(): void {
  const data = dynamicData.load();
  const pages = new Set<string>();
  const collectPages = (items: Array<DefaultTheme.SidebarItem>): void => {
    for (const item of items) {
      if (item.link?.startsWith('/ru/') && !item.link.startsWith('/ru/examples/')) {
        pages.add(`${item.link.slice('/ru/'.length)}.md`);
      }
      if (item.items) collectPages(item.items);
    }
  };

  for (const sidebar of new Set(Object.values(sidebarConfig.ru))) {
    collectPages(Array.isArray(sidebar) ? sidebar : sidebar.items);
  }

  for (const page of Array.from(fs.globSync('examples/**/*.md', { cwd: russianDocsRoot })).sort()) {
    pages.add(page);
  }

  const recipeImports = new Map<string, string>();

  for (const fileName of fs.globSync('**/*.md', { cwd: russianDocsRoot })) {
    const content = fs.readFileSync(path.join(russianDocsRoot, fileName), 'utf8');
    for (const [, name, recipeFile] of content.matchAll(recipeImportPattern)) {
      recipeImports.set(name, recipeFile);
    }
  }

  const sections = Array.from(pages, (page) => {
    const sourcePath = path.join(russianDocsRoot, page);
    const content = readIncludedMarkdown(sourcePath)
      .replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
      .replace(/<CodeView framework="([^"]+)" :tree="examplesTree" \/>/g, (_, framework: string) => {
        const files = ['builder/generatorFirst.ts', 'package.json', 'builder/parallel.ts', 'builder/generator.ts'];

        return files
          .map((file) => {
            const relativePath = `examples/${framework}/${file}`;
            const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

            return `**${relativePath}**\n\n${codeBlock(source, path.extname(file).slice(1))}`;
          })
          .join('\n\n');
      })
      .replace(sandboxPattern, (_, name: string) => {
        const recipeFile = recipeImports.get(name);
        if (!recipeFile) throw new Error(`Missing recipe import: ${name}`);

        const recipe = JSON.parse(
          fs.readFileSync(path.join(docsRoot, 'emulator', recipeFile), 'utf8')
        ) as TypeSandboxRecipe;
        return formatRecipe(recipe);
      });

    return cleanVitePressMarkup(content, data).trim();
  });

  const content = `# ARFA Generator — документация для LLM\n\n${sections.join('\n\n---\n\n')}\n`;

  if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, 'utf8') !== content) {
    fs.writeFileSync(outputPath, content, 'utf8');

    console.log('LLM documentation generated');
  }
}
