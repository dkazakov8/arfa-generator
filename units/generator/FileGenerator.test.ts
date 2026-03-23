import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it, mock, spyOn } from 'bun:test';

import {
  logsToConsole,
  type TypeAfterCheckersArgs,
  type TypeAfterFinishArgs,
  type TypeCheckerCheckArgs,
  type TypePluginGenerateArgs,
} from '../../src/generator';
import {
  constructMemory,
  createChangedFile,
  createDeferred,
  createGenerator,
  feedbackPath,
  generatedFile,
  getPath,
  readFeedbackHistory,
  rootDir,
  SilentPlugin,
  saveMemory,
  setupFileGeneratorTests,
  TestChecker,
  ThrowingChecker,
  ThrowingCleanupPlugin,
  ThrowingPlugin,
} from './helpers';

const headerTemplate = '// some-comment\n\n';

setupFileGeneratorTests();

describe('FileGenerator.runFullCycle()', () => {
  it('writes generated files and includes headerTemplate', async () => {
    await createGenerator({
      run: 'runFullCycle',
      headerTemplate,
      plugins: [
        new SilentPlugin({
          generatedFiles: [
            generatedFile('package.json', `{ "main": "index.ts", "types": "index.ts" }`),
            generatedFile('index.ts', 'export const value = 1;'),
            generatedFile('without-header.ts', 'export const value = 2;', { skipHeader: true }),
          ],
        }),
      ],
    });

    expect(constructMemory()).toEqual({
      'index.ts': `${headerTemplate}export const value = 1;`,
      'package.json': `${headerTemplate}{ "main": "index.ts", "types": "index.ts" }`,
      'without-header.ts': 'export const value = 2;',
    });
  });

  it('formats final batch content before writing', async () => {
    await createGenerator({
      run: 'runFullCycle',
      headerTemplate,
      format: (files) =>
        files.map(({ content, filePath, plugin }) => ({
          filePath,
          plugin,
          content: `${content}// formatted`,
        })),
      plugins: [
        new SilentPlugin({
          generatedFiles: [
            generatedFile('package.json', `{ "main": "index.ts", "types": "index.ts" }`),
            generatedFile('index.ts', 'export const value = 1;'),
          ],
        }),
      ],
    });

    expect(constructMemory()).toEqual({
      'index.ts': '// some-comment\n\nexport const value = 1;// formatted',
      'package.json': `// some-comment\n\n{ "main": "index.ts", "types": "index.ts" }// formatted`,
    });
  });

  it('waits for async formatting before writing', async () => {
    const formatStarted = createDeferred();
    const finishFormatting = createDeferred();

    const generation = createGenerator({
      run: 'runFullCycle',
      format: async (files) => {
        formatStarted.resolve();
        await finishFormatting.promise;

        return files.map((file) => ({ ...file, content: `${file.content}// formatted` }));
      },
      plugins: [
        new SilentPlugin({
          generatedFiles: [generatedFile('index.ts', 'export const value = 1;')],
        }),
      ],
    });

    await formatStarted.promise;
    expect(constructMemory()).toEqual({});

    finishFormatting.resolve();
    await generation;

    expect(constructMemory()).toEqual({ 'index.ts': 'export const value = 1;// formatted' });
  });

  it('reports rewritten files as change events', async () => {
    saveMemory({ 'index.ts': 'export const value = 1;' });

    const { result } = await createGenerator({
      run: 'runFullCycle',
      plugins: [
        new SilentPlugin({
          generatedFiles: [generatedFile('index.ts', 'export const value = 2;')],
        }),
      ],
    });

    expect(constructMemory()).toEqual({ 'index.ts': 'export const value = 2;' });

    expect(result?.logs.generator).toContainEqual({
      type: 'file:write',
      plugin: 'test-generator',
      relativePath: 'index.ts',
    });

    expect(result?.logs.generator).toContainEqual({
      type: 'iteration:start',
      changedFiles: [
        createChangedFile({
          filePath: getPath('index.ts'),
          event: 'change',
          origin: 'cascade',
          eventTimeMs: fs.statSync(getPath('index.ts')).mtimeMs,
        }),
      ],
    });
  });

  it('rejects generated files outside rootDir', async () => {
    const outsideFilePath = path.resolve(rootDir, '..', 'outside.ts');

    expect(
      createGenerator({
        run: 'runFullCycle',
        plugins: [
          new SilentPlugin({
            generatedFiles: [
              { plugin: 'test-generator', filePath: outsideFilePath, rawContent: 'export const outside = true;' },
            ],
          }),
        ],
      })
    ).rejects.toThrow(`Cannot write file outside rootDir: ${outsideFilePath}`);

    expect(fs.existsSync(outsideFilePath)).toBe(false);
  });

  it('rejects writes and removals through symlinks outside rootDir', async () => {
    const outsideDirPath = path.resolve(rootDir, '..', 'outside-symlink-target');
    const linkedDirPath = getPath('linked');
    const writtenFilePath = path.resolve(linkedDirPath, 'written.ts');
    const removedFilePath = path.resolve(linkedDirPath, 'removed.ts');

    fs.mkdirSync(outsideDirPath, { recursive: true });

    try {
      fs.writeFileSync(path.resolve(outsideDirPath, 'removed.ts'), 'keep me', 'utf8');
      fs.symlinkSync(outsideDirPath, linkedDirPath, process.platform === 'win32' ? 'junction' : 'dir');

      expect(
        createGenerator({
          run: 'runFullCycle',
          plugins: [
            new SilentPlugin({
              generatedFiles: [
                { plugin: 'test-generator', filePath: writtenFilePath, rawContent: 'export const value = 1;' },
              ],
            }),
          ],
        })
      ).rejects.toThrow(`Cannot write file outside rootDir: ${writtenFilePath}`);

      expect(
        createGenerator({
          run: 'removeGeneratedFiles',
          plugins: [
            new SilentPlugin({
              generatedFiles: [{ plugin: 'test-generator', filePath: removedFilePath, rawContent: '' }],
            }),
          ],
        })
      ).rejects.toThrow(`Cannot remove file outside rootDir: ${removedFilePath}`);

      expect(fs.existsSync(path.resolve(outsideDirPath, 'written.ts'))).toBe(false);
      expect(fs.readFileSync(path.resolve(outsideDirPath, 'removed.ts'), 'utf8')).toBe('keep me');
    } finally {
      fs.rmSync(outsideDirPath, { recursive: true, force: true });
    }
  });

  it('resolves relative generated file paths from rootDir', async () => {
    await createGenerator({
      run: 'runFullCycle',
      plugins: [
        new SilentPlugin({
          generatedFiles: [
            { plugin: 'test-generator', filePath: 'relative.ts', rawContent: 'export const relative = true;' },
          ],
        }),
      ],
    });

    expect(constructMemory()).toEqual({ 'relative.ts': 'export const relative = true;' });
  });

  it('logs format errors and writes unformatted files', async () => {
    const error = new Error('format boom');

    const { result } = await createGenerator({
      run: 'runFullCycle',
      headerTemplate,
      format: () => {
        throw error;
      },
      plugins: [
        new SilentPlugin({
          generatedFiles: [
            generatedFile('package.json', `{ "main": "index.ts", "types": "index.ts" }`),
            generatedFile('index.ts', 'export const value = 1;'),
          ],
        }),
      ],
    });

    expect(constructMemory()).toEqual({
      'index.ts': `${headerTemplate}export const value = 1;`,
      'package.json': `${headerTemplate}{ "main": "index.ts", "types": "index.ts" }`,
    });

    expect(result?.logs.generator).toContainEqual({
      type: 'phase:error',
      phase: 'write',
      message: 'Format failed, writing unformatted generated files',
      recoverable: true,
      error,
    });
  });

  it('logs async format errors and writes unformatted files', async () => {
    const error = new Error('async format boom');

    const { result } = await createGenerator({
      run: 'runFullCycle',
      format: async () => {
        await Promise.resolve();
        throw error;
      },
      plugins: [
        new SilentPlugin({
          generatedFiles: [generatedFile('index.ts', 'export const value = 1;')],
        }),
      ],
    });

    expect(constructMemory()).toEqual({ 'index.ts': 'export const value = 1;' });
    expect(result?.logs.generator).toContainEqual({
      type: 'phase:error',
      phase: 'write',
      message: 'Format failed, writing unformatted generated files',
      recoverable: true,
      error,
    });
  });

  it('removes stale generated files on full rebuild', async () => {
    const freshFile = generatedFile('generated/fresh.ts', 'export const fresh = true;');
    const staleFile = generatedFile('generated/stale.ts', 'export const stale = true;');

    await createGenerator({
      run: 'runFullCycle',
      plugins: [new SilentPlugin({ generatedFiles: [freshFile, staleFile] })],
    });

    await createGenerator({
      run: 'runFullCycle',
      plugins: [
        new SilentPlugin({
          generatedFiles: [freshFile],
          cleanupFiles: [{ plugin: staleFile.plugin, filePath: staleFile.filePath }],
        }),
      ],
    });

    expect(constructMemory()).toEqual({ 'generated/fresh.ts': 'export const fresh = true;' });
  });

  it('preserves artifacts after generate fails and resumes cleanup after recovery', async () => {
    const error = new Error('plugin generation failed');
    const files = Array.from({ length: 20 }, (_, index) =>
      generatedFile(`failed/file${index}.ts`, `export const value = ${index};`)
    );
    const freshFile = generatedFile('successful/fresh.ts', 'export const fresh = true;', { plugin: 'successful' });
    const staleFile = generatedFile('successful/stale.ts', 'export const stale = true;', { plugin: 'successful' });
    const failedPlugin = new SilentPlugin({ generatedFiles: files });
    const successfulPlugin = new SilentPlugin({ name: 'successful', generatedFiles: [freshFile, staleFile] });
    const context = await createGenerator({
      run: 'runFullCycle',
      plugins: [failedPlugin, successfulPlugin],
      historyPath: feedbackPath,
    });
    const failedCleanup = spyOn(failedPlugin, 'cleanup');
    const successfulCleanup = spyOn(successfulPlugin, 'cleanup');

    failedPlugin.generatedFiles = [];
    failedPlugin.cleanupFiles = files.map(({ plugin, filePath }) => ({ plugin, filePath }));
    failedPlugin.onGenerate = () => {
      throw error;
    };
    successfulPlugin.generatedFiles = [freshFile];
    successfulPlugin.cleanupFiles = [{ plugin: staleFile.plugin, filePath: staleFile.filePath }];

    await context.generator.runFullCycle({ afterFinish: context.afterFinish });

    expect(failedCleanup).not.toHaveBeenCalled();
    expect(successfulCleanup).toHaveBeenCalled();
    for (const { filePath, rawContent } of files) {
      expect(fs.readFileSync(filePath, 'utf8')).toBe(rawContent);
    }
    expect(fs.readFileSync(freshFile.filePath, 'utf8')).toBe(freshFile.rawContent);
    expect(fs.existsSync(staleFile.filePath)).toBe(false);
    expect(context.result?.logs.plugins).toContainEqual({
      type: 'plugin:error',
      plugin: failedPlugin.name,
      message: 'Plugin failed',
      error,
    });
    expect(context.result?.logs.generator).not.toContainEqual(
      expect.objectContaining({ type: 'file:remove', plugin: failedPlugin.name })
    );
    expect(readFeedbackHistory().at(-1)?.result?.logs.plugins).toContainEqual({
      type: 'plugin:error',
      plugin: failedPlugin.name,
      message: 'Plugin failed',
      error: expect.objectContaining({ name: 'Error', message: error.message }),
    });

    const keptFile = files[0]!;

    failedPlugin.onGenerate = undefined;
    failedPlugin.generatedFiles = [keptFile];
    failedPlugin.cleanupFiles = files.slice(1).map(({ plugin, filePath }) => ({ plugin, filePath }));

    await context.generator.runFullCycle({ afterFinish: context.afterFinish });

    expect(failedCleanup).toHaveBeenCalled();
    expect(fs.readFileSync(keptFile.filePath, 'utf8')).toBe(keptFile.rawContent);
    for (const { filePath } of files.slice(1)) {
      expect(fs.existsSync(filePath)).toBe(false);
    }
    expect(context.result?.logs.plugins).toContainEqual({
      type: 'plugin:log',
      plugin: failedPlugin.name,
      message: 'Plugin recovered',
    });
  });

  it('ignores missing cleanup files', async () => {
    const freshFile = generatedFile('generated/fresh.ts', 'export const fresh = true;');
    const missingFile = { plugin: 'test-generator', filePath: getPath('generated/missing.ts') };

    await createGenerator({
      run: 'runFullCycle',
      plugins: [new SilentPlugin({ generatedFiles: [freshFile], cleanupFiles: [missingFile] })],
    });

    expect(constructMemory()).toEqual({ 'generated/fresh.ts': 'export const fresh = true;' });
  });

  it('rejects cleanup files outside rootDir', async () => {
    const outsideFilePath = path.resolve(rootDir, '..', 'outside.ts');

    fs.writeFileSync(outsideFilePath, 'export const outside = true;', 'utf8');

    try {
      expect(
        createGenerator({
          run: 'runFullCycle',
          plugins: [
            new SilentPlugin({
              cleanupFiles: [{ plugin: 'test-generator', filePath: outsideFilePath }],
            }),
          ],
        })
      ).rejects.toThrow(`Cannot remove file outside rootDir: ${outsideFilePath}`);

      expect(fs.readFileSync(outsideFilePath, 'utf8')).toBe('export const outside = true;');
    } finally {
      fs.rmSync(outsideFilePath, { force: true });
    }
  });

  it('retries a failed plugin with a full scan after another plugin creates its dependency', async () => {
    const error = new Error('Dependency is missing');
    const dependentFile = generatedFile('dependent.ts', 'export const value = 1;');
    const dependencyFile = generatedFile('dependency.ts', 'export const dependency = 1;');
    const onGenerate = mock((args: TypePluginGenerateArgs) => {
      if (args.changedFiles && !args.changedFiles.some(({ filePath }) => filePath === dependentFile.filePath)) {
        dependentPlugin.generatedFiles = [];
        return;
      }

      if (!fs.existsSync(dependencyFile.filePath)) throw error;

      dependentPlugin.generatedFiles = [dependentFile];
    });
    const dependentPlugin = new SilentPlugin({ onGenerate });
    const onDependencyGenerate = mock((_args: TypePluginGenerateArgs) => undefined);
    const { generator, result } = await createGenerator({
      run: 'runFullCycle',
      plugins: [
        dependentPlugin,
        new SilentPlugin({ generatedFiles: [dependencyFile], onGenerate: onDependencyGenerate }),
      ],
    });

    expect(constructMemory()).toEqual({
      'dependency.ts': 'export const dependency = 1;',
      'dependent.ts': 'export const value = 1;',
    });
    expect(onGenerate).toHaveBeenCalledTimes(3);
    expect(onGenerate.mock.calls[1]?.[0].changedFiles).toBeUndefined();
    expect(onGenerate.mock.calls[2]?.[0].changedFiles).toEqual([
      expect.objectContaining({ filePath: dependentFile.filePath }),
    ]);
    expect(onDependencyGenerate.mock.calls[1]?.[0].changedFiles).toEqual([
      expect.objectContaining({ filePath: dependencyFile.filePath }),
    ]);
    expect(result?.logs.plugins).toContainEqual({
      type: 'plugin:error',
      plugin: dependentPlugin.name,
      message: 'Plugin failed',
      error,
    });
    expect(result?.logs.plugins.filter((log) => log.type === 'plugin:log')).toEqual([
      { type: 'plugin:log', plugin: dependentPlugin.name, message: 'Plugin recovered' },
    ]);

    await generator.runFullCycle({
      afterFinish: ({ logs }) => {
        expect(logs.generator.filter((log) => log.type === 'file:write')).toEqual([]);
        expect(logs.plugins).toEqual([]);
      },
    });
  });

  it('logs plugin errors, continues with next plugins and does not retry when no files change', async () => {
    const error = new Error('Plugin cannot recover');
    const plugin = new ThrowingPlugin(error);
    const onGenerate = spyOn(plugin, 'generate');
    const onNextGenerate = mock(() => undefined);
    const { result } = await createGenerator({
      run: 'runFullCycle',
      plugins: [
        plugin,
        new SilentPlugin({
          onGenerate: onNextGenerate,
          logs: [{ plugin: 'test-generator', message: 'plugin note' }],
        }),
      ],
    });

    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onNextGenerate).toHaveBeenCalledTimes(1);
    expect(constructMemory()).toEqual({});
    expect(result?.logs.generator).toContainEqual(expect.objectContaining({ type: 'generation:end', iterations: 1 }));
    expect(result?.logs.generator).toContainEqual({
      type: 'plugin:emit',
      plugin: 'test-generator',
      emittedCount: 0,
    });
    expect(result?.logs.plugins).toEqual([
      { type: 'plugin:error', plugin: plugin.name, message: 'Plugin failed', error },
      { type: 'plugin:log', plugin: 'test-generator', message: 'plugin note' },
    ]);
  });

  it('fails when cascade generation exceeds max iterations', async () => {
    let generatedVersion = 0;

    const plugin = new SilentPlugin({
      onGenerate: () => {
        generatedVersion++;
        plugin.generatedFiles = [generatedFile('loop.ts', `export const value = ${generatedVersion};`)];
      },
    });

    expect(createGenerator({ run: 'runFullCycle', plugins: [plugin] })).rejects.toThrow(
      'Cascade generation exceeded 10 iterations'
    );
  });
});

describe('FileGenerator.removeGeneratedFiles()', () => {
  it('lists and removes controlled files while preserving source files', async () => {
    const firstFile = generatedFile('generated/first.ts', 'export const first = true;');
    const secondFile = generatedFile('generated/second.ts', 'export const second = true;');
    const staleFile = { plugin: 'test-generator', filePath: getPath('generated/stale.ts') };

    const initialMemory = {
      'generated/first.ts': 'export const first = true;',
      'generated/second.ts': 'export const second = true;',
      'generated/stale.ts': 'export const stale = true;',
      'source.ts': 'export const source = true;',
    };

    saveMemory(initialMemory);

    const { generator } = await createGenerator({
      plugins: [
        new SilentPlugin({
          generatedFiles: [firstFile, secondFile, generatedFile('generated/missing.ts', '')],
          cleanupFiles: [staleFile, { plugin: firstFile.plugin, filePath: 'generated/first.ts' }],
        }),
      ],
    });

    const controlledFiles = await generator.getControlledFiles();

    expect(controlledFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath))).toEqual([
      { relativePath: 'generated/first.ts', absolutePath: firstFile.filePath },
      { relativePath: 'generated/second.ts', absolutePath: secondFile.filePath },
      { relativePath: 'generated/stale.ts', absolutePath: staleFile.filePath },
    ]);
    expect(constructMemory()).toEqual(initialMemory);

    await generator.removeGeneratedFiles();

    expect(constructMemory()).toEqual({ 'source.ts': 'export const source = true;' });
    expect(await generator.getControlledFiles()).toEqual([]);
  });

  it('rejects generated files outside rootDir through removeGeneratedFiles()', async () => {
    const outsideFilePath = path.resolve(rootDir, '..', 'outside.ts');

    fs.writeFileSync(outsideFilePath, 'export const outside = true;', 'utf8');

    try {
      expect(
        createGenerator({
          run: 'removeGeneratedFiles',
          plugins: [
            new SilentPlugin({
              generatedFiles: [{ plugin: 'test-generator', filePath: outsideFilePath, rawContent: '' }],
            }),
          ],
        })
      ).rejects.toThrow(`Cannot remove file outside rootDir: ${outsideFilePath}`);

      expect(fs.readFileSync(outsideFilePath, 'utf8')).toBe('export const outside = true;');
    } finally {
      fs.rmSync(outsideFilePath, { force: true });
    }
  });
});

describe('FileGenerator callbacks', () => {
  it('runs runFullCycle() onStart once before all cascade iterations and finish callbacks', async () => {
    const lifecycle: Array<string> = [];
    const { generator } = await createGenerator({
      plugins: [
        new SilentPlugin({
          generatedFiles: [generatedFile('generated.ts', 'generated')],
          onGenerate: () => lifecycle.push('generate'),
        }),
      ],
      checkers: [new TestChecker({ onCheck: () => lifecycle.push('check') })],
    });

    await generator.runFullCycle({
      onStart: () => lifecycle.push('start'),
      afterCheckers: () => {
        lifecycle.push('afterCheckers');
      },
      afterFinish: () => {
        lifecycle.push('afterFinish');
      },
    });

    expect(lifecycle).toEqual(['start', 'generate', 'generate', 'check', 'afterCheckers', 'afterFinish']);
  });

  it('passes cascade changes without logs to afterCheckers and awaits it before afterFinish', async () => {
    saveMemory({ 'unchanged.ts': 'unchanged' });

    const unchangedFile = generatedFile('unchanged.ts', 'unchanged');
    const finalFile = generatedFile('generated.ts', 'final');
    let iteration = 0;
    const plugin = new SilentPlugin({
      onGenerate: () => {
        iteration++;
        plugin.generatedFiles =
          iteration === 1
            ? [generatedFile('generated.ts', 'first'), generatedFile('temporary.ts', 'temporary'), unchangedFile]
            : [finalFile];
        plugin.cleanupFiles = iteration === 1 ? [] : [{ plugin: plugin.name, filePath: getPath('temporary.ts') }];
      },
    });
    const { generator } = await createGenerator({ plugins: [plugin] });
    const started = createDeferred();
    const completed = createDeferred();
    const afterFinish = mock((_args: TypeAfterFinishArgs) => undefined);
    let files: TypeAfterCheckersArgs | undefined;

    const generation = generator.runFullCycle({
      afterCheckers: async (args) => {
        files = args;
        started.resolve();
        await completed.promise;
      },
      afterFinish,
    });

    await started.promise;

    const expectedFiles: TypeAfterCheckersArgs = {
      changedFiles: [{ relativePath: 'generated.ts', absolutePath: getPath('generated.ts') }],
      deletedFiles: [{ relativePath: 'temporary.ts', absolutePath: getPath('temporary.ts') }],
      isFullGeneration: true,
    };

    expect(files).toEqual(expectedFiles);
    expect(afterFinish).not.toHaveBeenCalled();

    completed.resolve();
    await generation;

    expect(afterFinish).toHaveBeenCalledTimes(1);
    expect(afterFinish.mock.calls[0]?.[0]).toEqual({ ...expectedFiles, logs: expect.any(Object) });
  });

  it('passes afterCheckers errors to afterFinish and preserves them if afterFinish also fails', async () => {
    const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Error('bundler failed');
    const finishError = new Error('afterFinish failed');
    const { generator } = await createGenerator({ historyPath: feedbackPath });
    const afterFinish = mock((args: TypeAfterFinishArgs) => {
      expect(args.logs.generator).toContainEqual({ type: 'finish:error', message: 'Finish callback failed', error });
      expect(args.logs.generator.slice(-2)).toEqual([
        { type: 'afterCheckers:end', duration: expect.any(String) },
        { type: 'generation:end', duration: expect.any(String), iterations: 1 },
      ]);
      expect(logsToConsole(args.logs, { verbosity: 'normal', noStdout: true })).toContain('[afterCheckers]');
      throw finishError;
    });

    await expect(
      generator.runFullCycle({
        afterCheckers: () => {
          throw error;
        },
        afterFinish,
      })
    ).rejects.toBe(error);

    expect(consoleErrorSpy.mock.calls).toEqual([['After finish callback failed', finishError]]);
    expect(afterFinish).toHaveBeenCalledTimes(1);
    expect(readFeedbackHistory().at(-1)?.result?.logs.generator).toContainEqual({
      type: 'finish:error',
      message: 'After finish callback failed',
      error: expect.objectContaining({ message: finishError.message }),
    });
  });

  it('includes awaited afterCheckers time in generation duration and excludes afterFinish time', async () => {
    let currentTime = 0;
    spyOn(performance, 'now').mockImplementation(() => currentTime);

    const { result } = await createGenerator({
      run: 'runFullCycle',
      checkers: [
        new TestChecker({
          onCheck: () => {
            currentTime = 10;
          },
        }),
      ],
      afterCheckers: async () => {
        await Promise.resolve();
        currentTime = 40;
      },
      afterFinish: () => {
        currentTime = 100;
      },
    });

    expect(result?.logs.generator.slice(-2)).toEqual([
      { type: 'afterCheckers:end', duration: '30ms' },
      { type: 'generation:end', duration: '40ms', iterations: 1 },
    ]);

    const normalOutput = logsToConsole(result!.logs, { verbosity: 'normal', noStdout: true }).replace(
      /\x1b\[\d+m/g,
      ''
    );
    const minimalOutput = logsToConsole(result!.logs, { verbosity: 'minimal', noStdout: true }).replace(
      /\x1b\[\d+m/g,
      ''
    );

    expect(normalOutput).toContain('[ARFA-GEN] [afterCheckers] finished in 30ms');
    expect(normalOutput).toContain('[ARFA-GEN] finished 1 iteration in 40ms');
    expect(minimalOutput).toBe('[ARFA-GEN] finished in 40ms');
  });

  it('runs afterFinish with phase errors, skips afterCheckers and writes feedback before rethrowing', async () => {
    const error = new Error('cleanup failed');
    const { generator } = await createGenerator({
      plugins: [new ThrowingCleanupPlugin(error)],
      historyPath: feedbackPath,
    });
    const afterCheckers = mock(() => undefined);
    const afterFinish = mock((_args: TypeAfterFinishArgs) => undefined);

    await expect(generator.runFullCycle({ afterCheckers, afterFinish })).rejects.toBe(error);

    expect(afterCheckers).not.toHaveBeenCalled();
    expect(afterFinish).toHaveBeenCalledTimes(1);

    const logs = afterFinish.mock.calls[0]![0].logs;

    expect(logs.generator.some((log) => log.type === 'afterCheckers:end')).toBe(false);
    expect(logsToConsole(logs, { verbosity: 'normal', noStdout: true })).not.toContain('[afterCheckers]');
    expect(afterFinish.mock.calls[0]?.[0].logs.generator).toContainEqual(
      expect.objectContaining({ type: 'phase:error', phase: 'cleanup', error })
    );
    expect(readFeedbackHistory().at(-1)?.result?.logs.generator).toContainEqual(
      expect.objectContaining({ type: 'phase:error', phase: 'cleanup', message: 'Phase cleanup failed' })
    );
  });

  it('passes raw logs to runFullCycle() afterFinish', async () => {
    const { result } = await createGenerator({
      run: 'runFullCycle',
      plugins: [new SilentPlugin({ logs: [{ plugin: 'test-generator', message: 'plugin note' }] })],
    });

    expect(result).toEqual({
      logs: {
        checkers: [],
        generator: [
          { type: 'iteration:start', changedFiles: undefined },
          { type: 'plugin:emit', plugin: 'test-generator', emittedCount: 0 },
          { type: 'phase:end', phase: 'emit', duration: '0ms' },
          { type: 'phase:end', phase: 'cleanup', duration: '0ms' },
          { type: 'phase:end', phase: 'check', duration: '0ms' },
          { type: 'generation:end', duration: '0ms', iterations: 1 },
        ],
        plugins: [{ type: 'plugin:log', plugin: 'test-generator', message: 'plugin note' }],
      },
    });
    expect(logsToConsole(result!.logs, { verbosity: 'normal', noStdout: true })).not.toContain('[afterCheckers]');
  });
});

describe('FileGenerator plugin and checker logs', () => {
  it('marks repeated runFullCycle() calls without writes as full generation', async () => {
    const onCheck = mock((_args: TypeCheckerCheckArgs) => undefined);
    const { generator } = await createGenerator({ checkers: [new TestChecker({ onCheck })] });

    await generator.runFullCycle();
    await generator.runFullCycle();

    expect(onCheck).toHaveBeenCalledTimes(2);
    for (const [args] of onCheck.mock.calls) {
      expect(args).toEqual(expect.objectContaining({ changedFiles: [], deletedFiles: [], isFullGeneration: true }));
    }
  });

  it('passes only written files with relative and absolute paths to checkers', async () => {
    saveMemory({ 'unchanged.ts': 'unchanged', 'stale.ts': 'stale' });

    const onCheck = mock((_args: TypeCheckerCheckArgs) => undefined);
    let iteration = 0;
    const plugin = new SilentPlugin({ cleanupFiles: [{ plugin: 'test-generator', filePath: getPath('stale.ts') }] });

    plugin.onGenerate = () => {
      plugin.generatedFiles = [
        generatedFile('first.ts', iteration++ === 0 ? 'first' : 'final'),
        generatedFile('unchanged.ts', 'unchanged'),
      ];
    };

    await createGenerator({
      run: 'runFullCycle',
      plugins: [plugin],
      checkers: [new TestChecker({ onCheck })],
    });

    expect(onCheck).toHaveBeenCalledTimes(1);
    expect(onCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        changedFiles: [{ relativePath: 'first.ts', absolutePath: getPath('first.ts') }],
        deletedFiles: [{ relativePath: 'stale.ts', absolutePath: getPath('stale.ts') }],
        isFullGeneration: true,
      })
    );
  });

  it.each([0, 1])('excludes written files deleted in cascade iteration %s from checkers', async (cleanupIteration) => {
    const removedFile = generatedFile('removed.ts', 'removed');
    const keptFile = generatedFile('kept.ts', 'kept');
    const onCheck = mock((_args: TypeCheckerCheckArgs) => undefined);
    const plugin = new SilentPlugin();
    let iteration = 0;

    plugin.onGenerate = () => {
      const currentIteration = iteration++;

      plugin.generatedFiles = currentIteration === 0 ? [removedFile, keptFile] : [keptFile];
      plugin.cleanupFiles =
        currentIteration === cleanupIteration ? [{ plugin: removedFile.plugin, filePath: removedFile.filePath }] : [];
    };

    const { result } = await createGenerator({
      run: 'runFullCycle',
      plugins: [plugin],
      checkers: [new TestChecker({ onCheck })],
    });

    expect(constructMemory()).toEqual({ 'kept.ts': 'kept' });
    expect(result?.logs.generator).toContainEqual({
      type: 'file:write',
      plugin: removedFile.plugin,
      relativePath: 'removed.ts',
    });
    expect(result?.logs.generator).toContainEqual({
      type: 'file:remove',
      plugin: removedFile.plugin,
      relativePath: 'removed.ts',
    });
    expect(onCheck).toHaveBeenCalledTimes(1);
    expect(onCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        changedFiles: [{ relativePath: 'kept.ts', absolutePath: getPath('kept.ts') }],
        deletedFiles: [{ relativePath: 'removed.ts', absolutePath: getPath('removed.ts') }],
        isFullGeneration: true,
      })
    );
  });

  it('passes files recreated after cleanup to checkers', async () => {
    const file = generatedFile('recreated.ts', 'recreated');
    const onCheck = mock((_args: TypeCheckerCheckArgs) => undefined);
    const plugin = new SilentPlugin({ generatedFiles: [file] });
    let iteration = 0;

    plugin.onGenerate = () => {
      plugin.cleanupFiles = iteration++ === 0 ? [{ plugin: file.plugin, filePath: file.filePath }] : [];
    };

    const { result } = await createGenerator({
      run: 'runFullCycle',
      plugins: [plugin],
      checkers: [new TestChecker({ onCheck })],
    });

    expect(constructMemory()).toEqual({ 'recreated.ts': 'recreated' });
    expect(result?.logs.generator).toContainEqual({
      type: 'file:remove',
      plugin: file.plugin,
      relativePath: 'recreated.ts',
    });
    expect(onCheck).toHaveBeenCalledTimes(1);
    expect(onCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        changedFiles: [{ relativePath: 'recreated.ts', absolutePath: file.filePath }],
        deletedFiles: [],
        isFullGeneration: true,
      })
    );
  });

  it('collects plugin-reported errors without failing generation', async () => {
    const { result } = await createGenerator({
      run: 'runFullCycle',
      plugins: [
        new SilentPlugin({
          onGenerate: ({ pluginError }) => {
            pluginError({ plugin: 'test-generator', message: 'plugin warning', error: new Error('plugin warning') });
          },
        }),
      ],
    });

    expect(result?.logs.plugins).toEqual([
      { type: 'plugin:error', plugin: 'test-generator', message: 'plugin warning', error: new Error('plugin warning') },
    ]);
  });

  it('logs checker errors and continues with next checkers', async () => {
    const error = new Error('checker boom');
    const nextCheckerCheck = mock();

    const { result } = await createGenerator({
      run: 'runFullCycle',
      plugins: [new SilentPlugin()],
      checkers: [new ThrowingChecker(error), new TestChecker({ onCheck: nextCheckerCheck })],
    });

    expect(nextCheckerCheck).toHaveBeenCalledTimes(1);
    expect(result?.logs.checkers).toEqual([
      { type: 'checker:error', checker: 'throwing-checker', message: 'Checker failed', error },
    ]);
  });

  it('collects checker-reported errors without failing generation', async () => {
    const { result } = await createGenerator({
      run: 'runFullCycle',
      plugins: [new SilentPlugin()],
      checkers: [
        new TestChecker({
          onCheck: ({ checkerError }) => {
            checkerError({ message: 'checker warning', error: new Error('checker warning') });
          },
        }),
      ],
    });

    expect(result?.logs.checkers).toEqual([
      {
        type: 'checker:error',
        checker: 'test-checker',
        message: 'checker warning',
        error: new Error('checker warning'),
      },
    ]);
  });
});
