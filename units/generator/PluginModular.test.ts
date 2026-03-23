import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import { PluginModular } from '../../src/generator';
import { createChangedFile, getPath, rootDir, saveMemory } from './helpers';

describe('PluginModular', () => {
  const targetFile = path.resolve(rootDir, 'modularFile.ts');
  const emptyGeneratedFiles = [{ plugin: 'modular', filePath: targetFile, rawContent: '' }];
  const memory = {
    'pageOne/someFolder/someFile.ts': 'export default "page-one";',
    'pageTwo/someFile.ts': 'export default "page-two";',
  };
  const targetContext = { rootDir, targetFile, targetFolder: path.dirname(targetFile) };
  const someFolderModule = {
    moduleName: 'pageOne',
    entryName: 'someFolder',
    entryFileName: 'someFolder',
    entryPath: getPath('pageOne/someFolder'),
    relativePath: 'pageOne/someFolder',
    rootRelativePath: 'pageOne/someFolder',
    files: [
      {
        fileName: 'someFile.ts',
        name: 'someFile',
        ext: '.ts',
        entryPath: getPath('pageOne/someFolder/someFile.ts'),
        relativePath: 'pageOne/someFolder/someFile',
        rootRelativePath: 'pageOne/someFolder/someFile.ts',
      },
    ],
  };
  const someFileModule = {
    moduleName: 'pageTwo',
    entryName: 'someFile',
    entryFileName: 'someFile.ts',
    entryPath: getPath('pageTwo/someFile.ts'),
    relativePath: 'pageTwo/someFile',
    rootRelativePath: 'pageTwo/someFile.ts',
    files: [],
  };

  async function generate(
    configs: ConstructorParameters<typeof PluginModular>[0],
    args: Partial<Parameters<PluginModular['generate']>[0]> = {}
  ) {
    const pluginLog = mock();
    const pluginError = mock();
    const result = await new PluginModular(configs).generate({ rootDir, pluginLog, pluginError, ...args });

    expect(pluginLog).not.toHaveBeenCalled();

    return { result };
  }

  beforeEach(() => {
    fs.mkdirSync(rootDir, { recursive: true });
    saveMemory(memory);
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('creates reexport with relevant imports for dir entries', async () => {
    const template = mock(() => '');
    const { result } = await generate([{ entries: ['*/someFolder'], entryKind: 'dir', targetFile, template }]);

    expect(result).toEqual(emptyGeneratedFiles);
    expect(template).toHaveBeenCalledTimes(1);
    expect(template).toHaveBeenCalledWith({ modules: [someFolderModule], ...targetContext });
  });

  it('creates reexport with relevant imports for file entries', async () => {
    const template = mock(() => '');
    const { result } = await generate([{ entries: ['*/someFile.ts'], entryKind: 'file', targetFile, template }]);

    expect(result).toEqual(emptyGeneratedFiles);
    expect(template).toHaveBeenCalledTimes(1);
    expect(template).toHaveBeenCalledWith({ modules: [someFileModule], ...targetContext });
  });

  it('passes direct children sorted case-insensitively for dir entries', async () => {
    saveMemory({
      'pageThree/someFolder/zeta.ts': 'export default "zeta";',
      'pageThree/someFolder/Alpha.ts': 'export default "alpha";',
    });

    const template = mock(() => '');
    const { result } = await generate([{ entries: ['pageThree/someFolder'], entryKind: 'dir', targetFile, template }]);

    expect(result).toEqual(emptyGeneratedFiles);
    expect(template).toHaveBeenCalledTimes(1);
    expect(template).toHaveBeenCalledWith({
      modules: [
        {
          moduleName: 'pageThree',
          entryName: 'someFolder',
          entryFileName: 'someFolder',
          entryPath: getPath('pageThree/someFolder'),
          relativePath: 'pageThree/someFolder',
          rootRelativePath: 'pageThree/someFolder',
          files: [
            {
              fileName: 'Alpha.ts',
              name: 'Alpha',
              ext: '.ts',
              entryPath: getPath('pageThree/someFolder/Alpha.ts'),
              relativePath: 'pageThree/someFolder/Alpha',
              rootRelativePath: 'pageThree/someFolder/Alpha.ts',
            },
            {
              fileName: 'zeta.ts',
              name: 'zeta',
              ext: '.ts',
              entryPath: getPath('pageThree/someFolder/zeta.ts'),
              relativePath: 'pageThree/someFolder/zeta',
              rootRelativePath: 'pageThree/someFolder/zeta.ts',
            },
          ],
        },
      ],
      ...targetContext,
    });
  });

  it('reexports when changed file is inside matched directory entry', async () => {
    const { result } = await generate(
      [{ entries: ['*/someFolder'], entryKind: 'dir', targetFile, template: () => '' }],
      { changedFiles: [createChangedFile({ filePath: getPath('pageOne/someFolder/someFile.ts'), event: 'add' })] }
    );

    expect(result).toEqual(emptyGeneratedFiles);
  });

  it('reexports when changed file path equals matched directory entry', async () => {
    const { result } = await generate(
      [{ entries: ['*/someFolder'], entryKind: 'dir', targetFile, template: () => '' }],
      { changedFiles: [createChangedFile({ filePath: getPath('pageOne/someFolder'), event: 'add' })] }
    );

    expect(result).toEqual(emptyGeneratedFiles);
  });

  it('reexports file entries on structural file change', async () => {
    const { result } = await generate(
      [{ entries: ['*/someFile.ts'], entryKind: 'file', targetFile, template: () => '' }],
      { changedFiles: [createChangedFile({ filePath: getPath('pageTwo/someFile.ts'), event: 'add' })] }
    );

    expect(result).toEqual(emptyGeneratedFiles);
  });

  it('does not reexport file entries on structural change outside matched files', async () => {
    const { result } = await generate(
      [{ entries: ['*/someFile.ts'], entryKind: 'file', targetFile, template: () => '' }],
      { changedFiles: [createChangedFile({ filePath: getPath('pageOne/someFolder/someFile.ts'), event: 'add' })] }
    );

    expect(result).toEqual([]);
  });

  it('passes all modules when structural change is inside one entry', async () => {
    const template = mock(() => '');
    const { result } = await generate([{ entries: ['*'], entryKind: 'dir', targetFile, template }], {
      changedFiles: [createChangedFile({ filePath: getPath('pageOne/someFolder/someFile.ts'), event: 'add' })],
    });

    expect(result).toEqual(emptyGeneratedFiles);
    expect(template).toHaveBeenCalledTimes(1);

    expect(template).toHaveBeenCalledWith({
      modules: [
        {
          moduleName: 'tmp',
          entryName: 'pageOne',
          entryFileName: 'pageOne',
          entryPath: getPath('pageOne'),
          relativePath: 'pageOne',
          rootRelativePath: 'pageOne',
          files: [
            {
              fileName: 'someFolder',
              name: 'someFolder',
              ext: '',
              entryPath: getPath('pageOne/someFolder'),
              relativePath: 'pageOne/someFolder',
              rootRelativePath: 'pageOne/someFolder',
            },
          ],
        },
        {
          moduleName: 'tmp',
          entryName: 'pageTwo',
          entryFileName: 'pageTwo',
          entryPath: getPath('pageTwo'),
          relativePath: 'pageTwo',
          rootRelativePath: 'pageTwo',
          files: [
            {
              fileName: 'someFile.ts',
              name: 'someFile',
              ext: '.ts',
              entryPath: getPath('pageTwo/someFile.ts'),
              relativePath: 'pageTwo/someFile',
              rootRelativePath: 'pageTwo/someFile.ts',
            },
          ],
        },
      ],
      ...targetContext,
    });
  });

  it('ignores non-structural changed files', async () => {
    const { result } = await generate(
      [{ entries: ['*/someFolder'], entryKind: 'dir', targetFile, template: () => '' }],
      {
        changedFiles: [createChangedFile({ filePath: getPath('pageOne/someFolder/someFile.ts'), event: 'change' })],
      }
    );

    expect(result).toEqual([]);
  });

  it('does not emit when changedFiles is empty', async () => {
    const { result } = await generate(
      [{ entries: ['*/someFolder'], entryKind: 'dir', targetFile, template: () => '' }],
      { changedFiles: [] }
    );

    expect(result).toEqual([]);
  });

  it('emits files for multiple configs in one run', async () => {
    const targetFile2 = path.resolve(rootDir, 'modularFile2.ts');
    const { result } = await generate([
      { entries: ['*/someFolder'], entryKind: 'dir', targetFile, template: () => 'dir' },
      { entries: ['*/someFile.ts'], entryKind: 'file', targetFile: targetFile2, template: () => 'file' },
    ]);

    expect(result).toEqual([
      { plugin: 'modular', filePath: targetFile, rawContent: 'dir' },
      { plugin: 'modular', filePath: targetFile2, rawContent: 'file' },
    ]);
  });

  it('emits empty modules result when entries do not match on full rebuild', async () => {
    const template = mock(() => '');
    const { result } = await generate([{ entries: ['not-existing/*'], entryKind: 'dir', targetFile, template }]);

    expect(result).toEqual(emptyGeneratedFiles);
    expect(template).toHaveBeenCalledTimes(1);
    expect(template).toHaveBeenCalledWith({ modules: [], ...targetContext });
  });
});
