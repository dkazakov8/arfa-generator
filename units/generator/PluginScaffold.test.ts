import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import { FileGenerator, PluginScaffold, type TypeGenerateResult } from '../../src/generator';
import { constructMemory, getPath, rootDir, saveMemory } from './helpers';

describe('PluginScaffold', () => {
  beforeEach(() => {
    fs.mkdirSync(rootDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('creates the full set, removes the marker, and leaves later edits alone', async () => {
    saveMemory({ 'feature/.component': '' });

    const createFiles = mock(({ folderName, folderPath }: { folderName: string; folderPath: string }) => [
      { filePath: path.resolve(folderPath, `${folderName}.ts`), content: 'export const value = 1;' },
      { filePath: path.resolve(folderPath, 'styles.css'), content: '.root {}' },
    ]);
    const generator = new FileGenerator({
      rootDir,
      headerTemplate: '// generated\n',
      plugins: [new PluginScaffold([{ entries: ['**/.component'], createFiles }])],
    });

    await generator.runFullCycle();

    expect(createFiles).toHaveBeenCalledTimes(1);
    expect(createFiles).toHaveBeenCalledWith({ folderName: 'feature', folderPath: getPath('feature') });
    expect(constructMemory()).toEqual({
      'feature/feature.ts': 'export const value = 1;',
      'feature/styles.css': '.root {}',
    });

    fs.writeFileSync(getPath('feature/feature.ts'), 'user edit', 'utf-8');

    await generator.runFullCycle();

    expect(createFiles).toHaveBeenCalledTimes(1);

    expect(fs.readFileSync(getPath('feature/feature.ts'), 'utf-8')).toBe('user edit');
  });

  it('keeps the marker and writes none of its targets when one target exists', async () => {
    saveMemory({ 'feature/.component': '', 'feature/first.ts': 'user content' });

    const generator = new FileGenerator({
      rootDir,
      plugins: [
        new PluginScaffold([
          {
            entries: ['**/.component'],
            createFiles: ({ folderPath }) => [
              { filePath: path.resolve(folderPath, 'first.ts'), content: 'generated first' },
              { filePath: path.resolve(folderPath, 'second.ts'), content: 'generated second' },
            ],
          },
        ]),
      ],
    });

    const results: Array<TypeGenerateResult> = [];

    await generator.runFullCycle({
      afterFinish: (result) => {
        results.push(result);
      },
    });

    expect(constructMemory()).toEqual({ 'feature/.component': '', 'feature/first.ts': 'user content' });

    expect(results[0]?.logs.plugins).toEqual([
      expect.objectContaining({
        type: 'plugin:error',
        plugin: 'scaffold',
        message: 'Scaffold failed',
        error: expect.objectContaining({ message: expect.stringContaining('target already exists: feature/first.ts') }),
      }),
    ]);
  });

  it('discards an entire config with a relative target and continues with the next config', async () => {
    saveMemory({ 'first/.component': '', 'second/.component': '', 'page/.page': '' });

    const generator = new FileGenerator({
      rootDir,
      plugins: [
        new PluginScaffold([
          {
            entries: ['**/.component'],
            createFiles: ({ folderName, folderPath }) => [
              {
                filePath: folderName === 'second' ? 'relative.ts' : path.resolve(folderPath, 'first.ts'),
                content: 'component content',
              },
            ],
          },
          {
            entries: ['**/.page'],
            createFiles: ({ folderPath }) => [
              { filePath: path.resolve(folderPath, 'page.ts'), content: 'page content' },
            ],
          },
        ]),
      ],
    });

    const results: Array<TypeGenerateResult> = [];

    await generator.runFullCycle({
      afterFinish: (value) => {
        results.push(value);
      },
    });

    expect(constructMemory()).toEqual({
      'first/.component': '',
      'second/.component': '',
      'page/page.ts': 'page content',
    });

    const expectedError = expect.objectContaining({
      type: 'plugin:error',
      plugin: 'scaffold',
      message: 'createFiles should return absolute file paths',
    });

    expect(results[0]?.logs.plugins).toEqual([expectedError, expectedError]);
  });

  it('does not remove an unprocessed marker through removeGeneratedFiles()', async () => {
    saveMemory({ 'feature/.component': '' });

    const generator = new FileGenerator({
      rootDir,
      plugins: [
        new PluginScaffold([
          {
            entries: ['**/.component'],
            createFiles: ({ folderPath }) => [
              { filePath: path.resolve(folderPath, 'feature.ts'), content: 'generated content' },
            ],
          },
        ]),
      ],
    });

    await generator.removeGeneratedFiles();

    expect(constructMemory()).toEqual({ 'feature/.component': '' });
  });
});
