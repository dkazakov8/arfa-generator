import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { PluginReexport, type TypeChangedFile } from '../../src/generator';
import { createChangedFile, getPath, rootDir, saveMemory } from './helpers';

const unitsGeneratorDirPath = path.dirname(fileURLToPath(import.meta.url));

describe('PluginReexport', () => {
  const memory = {
    'a.ts': `export const a = 1;`,
    'b.ts': `export const b = 2;`,
    'someFile.txt': `txt`,
    'theme.scss': `.theme {}`,
    'package.json': `{ "name": "test" }`,
  };

  const reexportInputFiles = Object.keys(memory)
    .map((fileName) => ({
      ext: path.extname(fileName),
      fileName,
      name: path.basename(fileName, path.extname(fileName)),
    }))
    .filter(({ fileName }) => fileName !== 'package.json');

  beforeEach(() => {
    fs.mkdirSync(rootDir, { recursive: true });

    saveMemory(memory);
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  const defaultGeneratedFiles = [
    {
      plugin: 'reexport',
      filePath: getPath('package.json'),
      rawContent: `{ "main": "_reexport.ts", "types": "_reexport.ts" }`,
      skipHeader: true,
    },
    { plugin: 'reexport', filePath: getPath('_reexport.ts'), rawContent: '' },
  ];
  it('emits package and reexport file variants', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const template = mock(() => '');

    // Basic with defaults

    expect(
      await new PluginReexport([{ entries: ['**'], template }]).generate({ rootDir, pluginLog, pluginError })
    ).toEqual(defaultGeneratedFiles);

    // With noPackage: true no emit of package.json

    expect(
      await new PluginReexport([{ entries: ['**'], template, noPackage: true }]).generate({
        rootDir,
        pluginLog,
        pluginError,
      })
    ).toEqual(defaultGeneratedFiles.slice(1));

    // With fileNameTemplate emits a reexport file with custom name and puts this name to package.json

    expect(
      await new PluginReexport([
        { entries: ['**'], template, fileNameTemplate: (p) => `_${p.folderName}.ts` },
      ]).generate({ rootDir, pluginLog, pluginError })
    ).toEqual(
      defaultGeneratedFiles.map((file) => {
        if (file.filePath.endsWith('package.json')) {
          return { ...file, rawContent: `{ "main": "_tmp.ts", "types": "_tmp.ts" }` };
        }

        return { ...file, filePath: getPath('_tmp.ts') };
      })
    );

    // With onlyPackage: true emits package.json pointing to target file and skips reexport file
    // template function is not called in this case

    expect(
      await new PluginReexport([
        { entries: ['**'], template, onlyPackage: true, fileNameTemplate: (p) => `${p.folderName}.tsx` },
      ]).generate({ rootDir, pluginLog, pluginError })
    ).toEqual([
      {
        plugin: 'reexport',
        filePath: getPath('package.json'),
        rawContent: `{ "main": "tmp.tsx", "types": "tmp.tsx" }`,
        skipHeader: true,
      },
    ]);

    expect(template).toHaveBeenCalledTimes(3);
    expect(pluginLog).not.toHaveBeenCalled();
  });

  it('passes expected files to template with and without exclude', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const template = mock(() => '');

    // Without filtering

    await new PluginReexport([{ entries: ['**'], template }]).generate({ rootDir, pluginLog, pluginError });

    expect(template).toHaveBeenLastCalledWith({ folderName: 'tmp', files: reexportInputFiles });

    // With filtering

    await new PluginReexport([{ entries: ['**'], template, exclude: /(^someFile\.txt$|^theme\.scss$)/ }]).generate({
      rootDir,
      pluginLog,
      pluginError,
    });

    expect(template).toHaveBeenLastCalledWith({ folderName: 'tmp', files: reexportInputFiles.slice(0, 2) });

    expect(template).toHaveBeenCalledTimes(2);
    expect(pluginLog).not.toHaveBeenCalled();
  });

  it('passes folderName and file metadata to validateContent', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const template = mock(() => '');
    const validateContent = mock((p) => p.folderName === 'tmp');

    const plugin = new PluginReexport([{ entries: ['**'], validateContent, template }]);

    await plugin.generate({ rootDir, pluginLog, pluginError });

    expect(validateContent.mock.calls.map(([args]) => args)).toEqual(
      reexportInputFiles.map(({ ext, fileName, name }) => ({
        ext,
        fileName,
        name,
        content: memory[fileName as keyof typeof memory],
        folderName: 'tmp',
      }))
    );
    expect(validateContent).toHaveBeenCalledTimes(4);
    expect(template).toHaveBeenCalledTimes(1);
    expect(pluginLog).not.toHaveBeenCalled();
  });

  it('returns empty result when entries do not match folders on full rebuild', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const template = mock(() => '');

    expect(
      await new PluginReexport([{ entries: ['not-existing-folder'], template }]).generate({
        rootDir,
        pluginLog,
        pluginError,
      })
    ).toEqual([]);
    expect(template).not.toHaveBeenCalled();
    expect(pluginLog).not.toHaveBeenCalled();
  });

  it('rejects entries outside rootDir', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const template = mock(() => '');

    expect(
      new PluginReexport([{ entries: ['../**'], template }]).generate({ rootDir, pluginLog, pluginError })
    ).rejects.toThrow('Entry must stay inside rootDir: ../**');

    expect(
      new PluginReexport([{ entries: [path.resolve(rootDir, '**')], template }]).generate({
        rootDir,
        pluginLog,
        pluginError,
      })
    ).rejects.toThrow(`Entry must stay inside rootDir: ${path.resolve(rootDir, '**')}`);

    expect(
      new PluginReexport([{ entries: ['C:\\tmp\\**'], template }]).generate({ rootDir, pluginLog, pluginError })
    ).rejects.toThrow('Entry must stay inside rootDir: C:\\tmp\\**');

    expect(
      new PluginReexport([{ entries: ['..\\**'], template }]).generate({ rootDir, pluginLog, pluginError })
    ).rejects.toThrow('Entry must stay inside rootDir: ..\\**');
  });

  it('rejects matched paths outside rootDir', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const template = mock(() => '');
    const outsidePath = path.resolve(rootDir, '..', 'outside');
    const globSync = spyOn(fs, 'globSync').mockReturnValue([
      { isDirectory: () => true, name: 'folder', parentPath: outsidePath },
    ] as ReturnType<typeof fs.globSync>);

    try {
      expect(
        new PluginReexport([{ entries: ['**'], template }]).generate({
          rootDir,
          pluginLog,
          pluginError,
        })
      ).rejects.toThrow(`Matched path must stay inside rootDir: ${path.resolve(outsidePath, 'folder')}`);
    } finally {
      globSync.mockRestore();
    }
  });

  it('does not pass excluded files to validateContent', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const template = mock(() => '');
    const validateContent = mock(() => true);

    await new PluginReexport([
      { entries: ['**'], template, exclude: /(^someFile\.txt$|^theme\.scss$)/, validateContent },
    ]).generate({ rootDir, pluginLog, pluginError });

    expect(validateContent.mock.calls.map(([args]: any) => args.fileName)).toEqual(['a.ts', 'b.ts']);
    expect(pluginLog).not.toHaveBeenCalled();
  });

  const changedFilesCases: Array<TypeChangedFile> = [
    createChangedFile({ filePath: getPath('a.ts'), event: 'change' }),
    createChangedFile({ filePath: getPath('b.ts'), event: 'add' }),
    createChangedFile({ filePath: getPath('someFile.txt'), event: 'unlink' }),
  ];

  const outOfScopeChangedFile = createChangedFile({
    filePath: path.resolve(unitsGeneratorDirPath, 'outside.ts'),
  });
  const matchedFolderChangedFile = createChangedFile({ filePath: rootDir });
  const nestedPathChangedFile = createChangedFile({ filePath: getPath('nested/inner.ts') });
  const unmatchedFolderChangedFile = createChangedFile({
    filePath: path.resolve(unitsGeneratorDirPath, 'unmatched/a.ts'),
  });

  type TypeChangedScenario = {
    createPlugin: (template: () => string) => PluginReexport;
    expectEarlyReturn: boolean;
    generateArgsList: Array<{ changedFiles: Array<TypeChangedFile> | undefined }>;
    expectedTemplateArgs?: { folderName: string; files: typeof reexportInputFiles } | null;
    expectedPluginError?: { plugin: 'reexport'; message: string; error: Error } | null;
  };

  const changedScenarios: Array<[string, TypeChangedScenario]> = [
    [
      'rebuilds on watch changes',
      {
        createPlugin: (template: () => string) => new PluginReexport([{ entries: ['**'], template }]),
        expectedTemplateArgs: { folderName: 'tmp', files: reexportInputFiles },
        expectedPluginError: null,
        expectEarlyReturn: false,
        generateArgsList: changedFilesCases.map((changedFile) => ({
          changedFiles: [changedFile],
        })),
      },
    ],
    [
      'rebuilds when changed file path equals matched folder',
      {
        createPlugin: (template: () => string) => new PluginReexport([{ entries: ['**'], template }]),
        expectedTemplateArgs: { folderName: 'tmp', files: reexportInputFiles },
        expectedPluginError: null,
        expectEarlyReturn: false,
        generateArgsList: [{ changedFiles: [matchedFolderChangedFile] }],
      },
    ],
    [
      'rebuilds when changed file path is nested inside matched folder',
      {
        createPlugin: (template: () => string) => new PluginReexport([{ entries: ['**'], template }]),
        expectedTemplateArgs: { folderName: 'tmp', files: reexportInputFiles },
        expectedPluginError: null,
        expectEarlyReturn: false,
        generateArgsList: [{ changedFiles: [nestedPathChangedFile] }],
      },
    ],
    [
      'skips invalid validated files in watch mode',
      {
        createPlugin: (template: () => string) =>
          new PluginReexport([{ entries: ['**'], template, validateContent: (p) => p.fileName !== 'a.ts' }]),
        expectedTemplateArgs: { folderName: 'tmp', files: reexportInputFiles.slice(1) },
        expectedPluginError: {
          plugin: 'reexport',
          message: 'Reexport validation failed',
          error: new Error('file content has not passed validation, not added to reexport: a.ts'),
        },
        expectEarlyReturn: false,
        generateArgsList: changedFilesCases.map((changedFile) => ({
          changedFiles: [changedFile],
        })),
      },
    ],
    [
      'skips invalid validated files on full rebuild',
      {
        createPlugin: (template: () => string) =>
          new PluginReexport([{ entries: ['**'], template, validateContent: (p) => p.fileName !== 'a.ts' }]),
        expectedTemplateArgs: { folderName: 'tmp', files: reexportInputFiles.slice(1) },
        expectedPluginError: {
          plugin: 'reexport',
          message: 'Reexport validation failed',
          error: new Error('file content has not passed validation, not added to reexport: a.ts'),
        },
        expectEarlyReturn: false,
        generateArgsList: [{ changedFiles: undefined }],
      },
    ],
    [
      'rebuilds when changed file is excluded',
      {
        createPlugin: (template: () => string) =>
          new PluginReexport([{ entries: ['**'], template, exclude: /(^someFile\.txt$|^theme\.scss$)/ }]),
        expectEarlyReturn: true,
        generateArgsList: [
          {
            changedFiles: [changedFilesCases.find(({ relativePath }) => relativePath === 'someFile.txt')!],
          },
        ],
      },
    ],
    [
      'returns empty result for empty changedFiles',
      {
        createPlugin: (template: () => string) => new PluginReexport([{ entries: ['**'], template }]),
        expectEarlyReturn: true,
        generateArgsList: [{ changedFiles: [] }],
      },
    ],
    [
      'returns empty result when changed file is outside entries',
      {
        createPlugin: (template: () => string) => new PluginReexport([{ entries: ['**'], template }]),
        expectEarlyReturn: true,
        generateArgsList: [{ changedFiles: [outOfScopeChangedFile] }],
      },
    ],
    [
      'returns empty result when changed file is in unmatched folder',
      {
        createPlugin: (template: () => string) => new PluginReexport([{ entries: ['**'], template }]),
        expectEarlyReturn: true,
        generateArgsList: [{ changedFiles: [unmatchedFolderChangedFile] }],
      },
    ],
  ];

  it.each(changedScenarios)(
    '%s',
    async (_caseName, {
      createPlugin,
      expectEarlyReturn,
      expectedPluginError,
      expectedTemplateArgs,
      generateArgsList,
    }) => {
      const pluginLog = mock();
      const pluginError = mock();
      const template = mock(() => '');
      const plugin = createPlugin(template);

      for (const { changedFiles } of generateArgsList) {
        const result = await plugin.generate({ rootDir, pluginLog, pluginError, changedFiles });

        if (expectEarlyReturn) {
          expect(result).toEqual([]);
          continue;
        }

        expect(result).toEqual(defaultGeneratedFiles);
        expect(template).toHaveBeenLastCalledWith(expectedTemplateArgs);

        if (expectedPluginError) {
          expect(pluginError).toHaveBeenLastCalledWith(expectedPluginError);
        }
      }

      if (expectEarlyReturn) {
        expect(template).not.toHaveBeenCalled();
        expect(pluginLog).not.toHaveBeenCalled();
        expect(pluginError).not.toHaveBeenCalled();

        return;
      }

      expect(template).toHaveBeenCalledTimes(generateArgsList.length);

      if (expectedPluginError) {
        expect(pluginError).toHaveBeenCalledTimes(generateArgsList.length);
        expect(pluginLog).not.toHaveBeenCalled();
      } else {
        expect(pluginLog).not.toHaveBeenCalled();
        expect(pluginError).not.toHaveBeenCalled();
      }
    }
  );
});
