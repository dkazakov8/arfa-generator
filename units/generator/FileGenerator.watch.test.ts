import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it, mock, spyOn, vi } from 'bun:test';

import {
  logsToConsole,
  type TypeAfterCheckersArgs,
  type TypeChangedFile,
  type TypeCheckerCheckArgs,
  type TypeGenerateResult,
  type TypePluginGenerateArgs,
} from '../../src/generator';
import {
  chokidarMock,
  constructMemory,
  createChangedFile,
  createDeferred,
  createGenerator,
  createWatchGenerator,
  emitWatchedChange,
  feedbackPath,
  flushMicrotasks,
  generatedFile,
  getPath,
  readFeedbackHistory,
  rootDir,
  SilentPlugin,
  saveMemory,
  setupFileGeneratorTests,
  TestChecker,
} from './helpers';

setupFileGeneratorTests();

describe('FileGenerator.startWatch()', () => {
  it('passes watched files and bundler errors to afterFinish and processes its mutations in the next cycle', async () => {
    saveMemory({ 'source.ts': 'source', 'removed.ts': 'removed' });

    const error = new Error('bundler failed');
    let builds = 0;
    const afterCheckers = mock((_args: TypeAfterCheckersArgs) => {
      builds++;
      if (builds === 1) throw error;
    });
    const context = await createWatchGenerator({
      plugins: [new SilentPlugin({ generatedFiles: [generatedFile('generated.ts', 'generated')] })],
      afterCheckers,
      afterFinish: (args) => {
        if (context.results.length !== 1) return;

        expect(args.changedFiles).toEqual([
          { relativePath: 'source.ts', absolutePath: getPath('source.ts') },
          { relativePath: 'generated.ts', absolutePath: getPath('generated.ts') },
        ]);
        expect(args.deletedFiles).toEqual([{ relativePath: 'removed.ts', absolutePath: getPath('removed.ts') }]);
        expect(args.isFullGeneration).toBe(false);
        expect(args.logs.generator).toContainEqual({ type: 'finish:error', message: 'Finish callback failed', error });

        fs.writeFileSync(getPath('source.ts'), 'fixed', 'utf8');
        context.watcher.emit('change', getPath('source.ts'));
      },
    });
    fs.unlinkSync(getPath('removed.ts'));
    context.watcher.emit('unlink', getPath('removed.ts'));
    await emitWatchedChange({ filePath: getPath('source.ts') });
    await context.waitForResult(2);
    await flushMicrotasks();

    expect(afterCheckers).toHaveBeenCalledTimes(2);
    expect(afterCheckers.mock.calls[1]?.[0].changedFiles).toEqual([
      { relativePath: 'source.ts', absolutePath: getPath('source.ts') },
    ]);
    expect(chokidarMock.watch).toHaveBeenCalledTimes(1);
  });

  it('collects unique watch and cleanup deletions after runFullCycle() and resets the context for the next cycle', async () => {
    saveMemory({ 'source.ts': 'source', 'stale.ts': 'stale' });

    const onCheck = mock((_args: TypeCheckerCheckArgs) => undefined);
    const context = await createWatchGenerator({
      run: 'runFullCycle',
      plugins: [new SilentPlugin({ cleanupFiles: [{ plugin: 'test-generator', filePath: getPath('stale.ts') }] })],
      checkers: [new TestChecker({ onCheck })],
    });

    expect(onCheck).toHaveBeenCalledWith(expect.objectContaining({ isFullGeneration: true }));
    onCheck.mockClear();

    saveMemory({ 'stale.ts': 'stale' });
    fs.unlinkSync(getPath('source.ts'));
    context.watcher.emit('unlink', getPath('source.ts'));
    context.watcher.emit('unlink', getPath('source.ts'));
    vi.advanceTimersByTime(5);

    await context.waitForResult();
    await flushMicrotasks();

    expect(onCheck).toHaveBeenCalledTimes(1);
    expect(onCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        changedFiles: [],
        deletedFiles: [
          { relativePath: 'source.ts', absolutePath: getPath('source.ts') },
          { relativePath: 'stale.ts', absolutePath: getPath('stale.ts') },
        ],
        isFullGeneration: false,
      })
    );

    saveMemory({ 'next.ts': 'next' });
    context.watcher.emit('add', getPath('next.ts'));
    vi.advanceTimersByTime(5);

    await context.waitForResult(2);
    await flushMicrotasks();

    expect(onCheck).toHaveBeenLastCalledWith(
      expect.objectContaining({
        changedFiles: [{ relativePath: 'next.ts', absolutePath: getPath('next.ts') }],
        deletedFiles: [],
        isFullGeneration: false,
      })
    );

    await context.generator.stopWatch();
  });

  it('passes watched additions and changes with generated writes to checkers', async () => {
    saveMemory({ 'source.ts': 'source' });

    const onCheck = mock((_args: TypeCheckerCheckArgs) => undefined);
    const { generator } = await createGenerator({
      plugins: [new SilentPlugin({ generatedFiles: [generatedFile('generated.ts', 'generated')] })],
      checkers: [new TestChecker({ onCheck })],
    });

    await generator.startWatch({ aggregationTimeout: 5 });

    const watcher = chokidarMock.watchers[0];

    watcher?.emit('add', getPath('source.ts'));
    watcher?.emit('change', getPath('source.ts'));
    watcher?.emit('change', getPath('generated.ts'));
    watcher?.emit('unlink', getPath('removed.ts'));

    vi.advanceTimersByTime(5);

    await flushMicrotasks();

    expect(onCheck).toHaveBeenCalledTimes(1);
    expect(onCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        changedFiles: [
          { relativePath: 'generated.ts', absolutePath: getPath('generated.ts') },
          { relativePath: 'source.ts', absolutePath: getPath('source.ts') },
        ],
        deletedFiles: [{ relativePath: 'removed.ts', absolutePath: getPath('removed.ts') }],
        isFullGeneration: false,
      })
    );
  });

  it('excludes watched files changed and then deleted before checkers run', async () => {
    saveMemory({ 'source.ts': 'source' });

    const onCheck = mock((_args: TypeCheckerCheckArgs) => undefined);
    const context = await createWatchGenerator({ checkers: [new TestChecker({ onCheck })] });

    context.watcher.emit('change', getPath('source.ts'));
    fs.unlinkSync(getPath('source.ts'));
    context.watcher.emit('unlink', getPath('source.ts'));

    vi.advanceTimersByTime(5);

    await context.waitForResult();
    await flushMicrotasks();

    expect(constructMemory()).toEqual({});
    expect(onCheck).toHaveBeenCalledTimes(1);
    expect(onCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        changedFiles: [],
        deletedFiles: [{ relativePath: 'source.ts', absolutePath: getPath('source.ts') }],
        isFullGeneration: false,
      })
    );

    await context.generator.stopWatch();
  });

  it('aggregates changes received during generation into the next cycle', async () => {
    const queuedFiles = [
      createChangedFile({ filePath: getPath('added.ts'), event: 'add', eventTimeMs: expect.any(Number) }),
      createChangedFile({ filePath: getPath('changed.ts'), eventTimeMs: expect.any(Number) }),
      createChangedFile({ filePath: getPath('removed.ts'), event: 'unlink', eventTimeMs: expect.any(Number) }),
    ];
    const onCheck = mock(() => undefined);
    const onStart = mock(() => undefined);
    const context = await createWatchGenerator(
      {
        plugins: [
          new SilentPlugin({
            onGenerate: () => {
              if (context.results.length) return;

              for (const file of queuedFiles) {
                context.watcher.emit(file.event, file.filePath);
              }
            },
          }),
        ],
        checkers: [new TestChecker({ onCheck })],
      },
      { onStart }
    );

    await emitWatchedChange();

    const result = await context.waitForResult(2);

    await flushMicrotasks();

    expect(result.logs.generator).toContainEqual({ type: 'iteration:start', changedFiles: queuedFiles });
    expect(context.results).toHaveLength(2);
    expect(onStart).toHaveBeenCalledTimes(2);
    expect(onCheck).toHaveBeenCalledTimes(2);

    for (const file of queuedFiles) {
      expect(context.results[0]?.logs.generator).toContainEqual({
        type: 'watch:discard',
        relativePath: file.relativePath,
      });
    }
  });

  it('waits for afterFinish before processing changes received during it', async () => {
    const lifecycle: Array<string> = [];
    const finishCallback = createDeferred();
    const context = await createWatchGenerator(
      {
        plugins: [new SilentPlugin({ onGenerate: () => lifecycle.push('generate') })],
        checkers: [new TestChecker({ onCheck: () => lifecycle.push('check') })],
        afterFinish: async () => {
          lifecycle.push('finish:start');
          if (context.results.length === 1) await finishCallback.promise;
          lifecycle.push('finish:end');
        },
      },
      { onStart: () => lifecycle.push('start') }
    );

    await emitWatchedChange();
    await context.waitForResult();

    expect(lifecycle).toEqual(['start', 'generate', 'check', 'finish:start']);

    fs.writeFileSync(getPath('duringFinish.ts'), 'fixed', 'utf8');
    context.watcher.emit('change', getPath('duringFinish.ts'));
    vi.advanceTimersByTime(5);
    await flushMicrotasks();

    expect(context.results).toHaveLength(1);
    expect(lifecycle).toEqual(['start', 'generate', 'check', 'finish:start']);

    finishCallback.resolve();

    const result = await context.waitForResult(2);

    await flushMicrotasks();

    expect(lifecycle).toEqual([
      'start',
      'generate',
      'check',
      'finish:start',
      'finish:end',
      'start',
      'generate',
      'check',
      'finish:start',
      'finish:end',
    ]);
    expect(result.logs.generator).toContainEqual({
      type: 'iteration:start',
      changedFiles: [createChangedFile({ filePath: getPath('duringFinish.ts'), eventTimeMs: expect.any(Number) })],
    });
  });

  it('runs watch cycle immediately without aggregationTimeout', async () => {
    const afterFinish = mock(async (_result: TypeGenerateResult) => undefined);
    const { generator } = await createGenerator();

    await generator.startWatch({ afterFinish });

    await emitWatchedChange({ filePath: 'file.ts', timeout: 0 });

    expect(afterFinish).toHaveBeenCalledTimes(1);
    expect(afterFinish.mock.calls[0]?.[0].logs.generator).toContainEqual({
      type: 'iteration:start',
      changedFiles: [createChangedFile({ filePath: path.resolve(rootDir, 'file.ts') })],
    });
    expect(afterFinish.mock.calls[0]?.[0].logs.generator).toContainEqual(
      expect.objectContaining({ type: 'phase:end', phase: 'cleanup' })
    );
    expect(logsToConsole(afterFinish.mock.calls[0]![0].logs, { verbosity: 'normal', noStdout: true })).not.toContain(
      '[cleanup]'
    );
  });

  it('aggregates file changes and restarts debounce timeout', async () => {
    const afterFinish = mock(async (_result: TypeGenerateResult) => undefined);
    const { generator } = await createGenerator();

    const firstFilePath = path.resolve(rootDir, 'first.ts');
    const secondFilePath = path.resolve(rootDir, 'second.ts');

    await generator.startWatch({ aggregationTimeout: 5, afterFinish });

    chokidarMock.watchers[0]?.emit('change', firstFilePath);

    vi.advanceTimersByTime(4);

    chokidarMock.watchers[0]?.emit('change', secondFilePath);

    vi.advanceTimersByTime(4);

    await flushMicrotasks();

    expect(afterFinish).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    await flushMicrotasks();

    expect(afterFinish).toHaveBeenCalledTimes(1);

    const iterationLog = afterFinish.mock.calls[0]?.[0].logs.generator.find((log) => log.type === 'iteration:start');

    expect(iterationLog?.changedFiles?.map(({ relativePath }) => relativePath)).toEqual(['first.ts', 'second.ts']);
  });

  it('sorts watched files by relative path for plugins, logs and history while preserving timestamps', async () => {
    saveMemory({ 'first.ts': 'first', 'second.ts': 'second' });

    const onGenerate = mock((_args: TypePluginGenerateArgs) => undefined);
    const context = await createWatchGenerator({
      historyPath: feedbackPath,
      plugins: [new SilentPlugin({ onGenerate })],
    });
    const firstStats = fs.statSync(getPath('first.ts'));
    const secondStats = fs.statSync(getPath('second.ts'));

    firstStats.mtimeMs = 2000;
    secondStats.mtimeMs = 1000;

    context.watcher.emit('change', getPath('second.ts'), secondStats);
    context.watcher.emit('change', getPath('first.ts'), firstStats);
    vi.advanceTimersByTime(5);

    const result = await context.waitForResult(1);

    await flushMicrotasks();

    const changedFiles = [
      createChangedFile({ filePath: getPath('first.ts'), eventTimeMs: 2000 }),
      createChangedFile({ filePath: getPath('second.ts'), eventTimeMs: 1000 }),
    ];

    expect(onGenerate).toHaveBeenCalledWith(expect.objectContaining({ changedFiles }));
    expect(result.logs.generator).toContainEqual({ type: 'iteration:start', changedFiles });
    expect(readFeedbackHistory().at(-1)?.result?.logs.generator).toContainEqual({
      type: 'iteration:start',
      changedFiles,
    });
  });

  it.each(['add', 'change'] as const)('filters its own %s events with matching mtimeMs', async (event) => {
    if (event === 'change') saveMemory({ 'generated.ts': 'old content' });

    const onStart = mock(() => undefined);
    let hasEmitted = false;
    const onCheck = mock(() => {
      if (hasEmitted) return;

      hasEmitted = true;
      const filePath = getPath('generated.ts');

      context.watcher.emit(event, filePath, fs.statSync(filePath));
    });
    const context = await createWatchGenerator(
      {
        plugins: [new SilentPlugin({ generatedFiles: [generatedFile('generated.ts', 'generated')] })],
        checkers: [new TestChecker({ onCheck })],
      },
      { onStart }
    );

    await emitWatchedChange();

    const result = await context.waitForResult();

    await flushMicrotasks();

    expect(result.logs.generator).toContainEqual({
      type: 'iteration:start',
      changedFiles: [
        createChangedFile({
          filePath: getPath('generated.ts'),
          event,
          origin: 'cascade',
          eventTimeMs: fs.statSync(getPath('generated.ts')).mtimeMs,
        }),
      ],
    });
    expect(result.logs.generator).toContainEqual({ type: 'watch:discard', relativePath: 'generated.ts' });
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onCheck).toHaveBeenCalledTimes(1);
    expect(context.results).toHaveLength(1);
  });

  it.each(['path', 'event'])('keeps events with matching mtimeMs but a different %s', async (difference) => {
    saveMemory({ 'generated.ts': 'old content' });

    let queuedFile: TypeChangedFile | undefined;
    const onCheck = mock(() => {
      if (queuedFile) return;

      const stats = fs.statSync(getPath('generated.ts'));
      const filePath = difference === 'path' ? getPath('other.ts') : getPath('generated.ts');
      const event = difference === 'event' ? 'add' : 'change';

      queuedFile = createChangedFile({ filePath, event, eventTimeMs: stats.mtimeMs });
      context.watcher.emit(event, filePath, stats);
    });
    const context = await createWatchGenerator({
      plugins: [new SilentPlugin({ generatedFiles: [generatedFile('generated.ts', 'generated')] })],
      checkers: [new TestChecker({ onCheck })],
    });

    await emitWatchedChange();

    const result = await context.waitForResult(2);

    await flushMicrotasks();

    expect(context.results).toHaveLength(2);
    expect(result.logs.generator).toContainEqual({ type: 'iteration:start', changedFiles: [queuedFile!] });
    expect(context.results[0]?.logs.generator).toContainEqual(
      expect.objectContaining({ type: 'generation:end', iterations: 2 })
    );
    expect(result.logs.generator).toContainEqual(expect.objectContaining({ type: 'generation:end', iterations: 1 }));
    expect(onCheck).toHaveBeenCalledTimes(2);
  });

  it('processes checker changes to a generated file with a newer mtimeMs', async () => {
    saveMemory({ 'generated.ts': 'old content' });

    const plugin = new SilentPlugin({ generatedFiles: [generatedFile('generated.ts', 'generated')] });
    let queuedFile: TypeChangedFile | undefined;
    const onCheck = mock(() => {
      if (queuedFile) return;

      const filePath = getPath('generated.ts');
      const cascadeStats = fs.statSync(filePath);
      const { watcher } = context;

      watcher.emit('change', filePath, cascadeStats);
      fs.writeFileSync(filePath, 'checker fixed', 'utf-8');
      fs.utimesSync(filePath, cascadeStats.atime, new Date(cascadeStats.mtimeMs + 1000));

      const stats = fs.statSync(filePath);

      queuedFile = createChangedFile({ filePath, eventTimeMs: stats.mtimeMs });
      watcher.emit('change', filePath, stats);
      plugin.generatedFiles = [];
    });
    const context = await createWatchGenerator({
      plugins: [plugin],
      checkers: [new TestChecker({ onCheck })],
    });

    await emitWatchedChange();

    const result = await context.waitForResult(2);

    await flushMicrotasks();

    expect(context.results).toHaveLength(2);
    expect(result.logs.generator).toContainEqual({ type: 'iteration:start', changedFiles: [queuedFile!] });
    expect(onCheck).toHaveBeenCalledTimes(2);
    expect(constructMemory()).toEqual({ 'generated.ts': 'checker fixed' });
  });

  it('replays unlink events even when the file was removed in a cascade', async () => {
    saveMemory({ 'removed.ts': 'old content' });

    let hasEmitted = false;
    const onCheck = mock(() => {
      if (hasEmitted) return;

      hasEmitted = true;
      context.watcher.emit('unlink', getPath('removed.ts'));
    });
    const context = await createWatchGenerator({
      plugins: [new SilentPlugin({ cleanupFiles: [{ filePath: getPath('removed.ts'), plugin: 'test-generator' }] })],
      checkers: [new TestChecker({ onCheck })],
    });

    await emitWatchedChange();

    const result = await context.waitForResult(2);

    await flushMicrotasks();

    expect(context.results).toHaveLength(2);
    expect(context.results[0]?.logs.generator).toContainEqual({
      type: 'iteration:start',
      changedFiles: [
        createChangedFile({
          filePath: getPath('removed.ts'),
          event: 'unlink',
          origin: 'cascade',
          eventTimeMs: expect.any(Number),
        }),
      ],
    });
    expect(result.logs.generator).toContainEqual({
      type: 'iteration:start',
      changedFiles: [
        createChangedFile({ filePath: getPath('removed.ts'), event: 'unlink', eventTimeMs: expect.any(Number) }),
      ],
    });
    expect(onCheck).toHaveBeenCalledTimes(2);
    expect(constructMemory()).toEqual({});
  });

  it('ignores file events from a detached watcher', async () => {
    const afterFinish = mock(async (_result: TypeGenerateResult) => undefined);
    const { generator } = await createGenerator();

    await generator.startWatch({ aggregationTimeout: 5, afterFinish });

    const detachedWatcher = chokidarMock.watchers[0];

    await generator.stopWatch();

    await generator.startWatch({ aggregationTimeout: 5, afterFinish });

    const detachedFilePath = path.resolve(rootDir, 'detached.ts');
    const currentFilePath = path.resolve(rootDir, 'current.ts');

    detachedWatcher?.emit('change', detachedFilePath);

    vi.advanceTimersByTime(5);

    await flushMicrotasks();

    expect(afterFinish).not.toHaveBeenCalled();

    await emitWatchedChange({ filePath: currentFilePath });

    expect(afterFinish).toHaveBeenCalledTimes(1);

    const iterationLog = afterFinish.mock.calls[0]?.[0].logs.generator.find((log) => log.type === 'iteration:start');

    expect(iterationLog?.changedFiles?.map(({ relativePath }) => relativePath)).toEqual(['current.ts']);
  });

  it('keeps the watcher active and resets state between successful cycles', async () => {
    const afterFinish = mock(async (_result: TypeGenerateResult) => undefined);
    const { generator } = await createGenerator();
    const firstFilePath = path.resolve(rootDir, 'first.ts');
    const secondFilePath = path.resolve(rootDir, 'second.ts');

    await generator.startWatch({ aggregationTimeout: 5, afterFinish });

    await emitWatchedChange({ filePath: firstFilePath });
    await emitWatchedChange({ filePath: secondFilePath });

    expect(afterFinish).toHaveBeenCalledTimes(2);

    const secondIterationLog = afterFinish.mock.calls[1]?.[0].logs.generator.find(
      (log) => log.type === 'iteration:start'
    );

    expect(secondIterationLog?.changedFiles?.map(({ relativePath }) => relativePath)).toEqual(['second.ts']);
    expect(afterFinish.mock.calls[1]?.[0].logs.generator).toContainEqual({
      type: 'generation:end',
      duration: '0ms',
      iterations: 1,
    });

    expect(chokidarMock.watch).toHaveBeenCalledTimes(1);
    expect(chokidarMock.watchers[0]?.close).not.toHaveBeenCalled();
  });

  it('records afterFinish errors in feedback and processes queued changes without replacing the watcher', async () => {
    const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Error('watch failed');
    const queuedFile = createChangedFile({ filePath: getPath('queued.ts'), eventTimeMs: expect.any(Number) });
    const context = await createWatchGenerator({
      historyPath: feedbackPath,
      afterFinish: () => {
        if (context.results.length === 1) {
          context.watcher.emit(queuedFile.event, queuedFile.filePath);
          throw error;
        }
      },
    });

    await emitWatchedChange();
    await context.waitForResult(2);
    await flushMicrotasks();

    expect(consoleErrorSpy.mock.calls).toEqual([['After finish callback failed', error]]);
    expect(context.results).toHaveLength(2);
    expect(context.results[0]?.logs.generator).toContainEqual({
      type: 'finish:error',
      message: 'After finish callback failed',
      error,
    });
    expect(context.results[0]?.logs.generator.at(-1)).toEqual({
      type: 'watch:error',
      message: 'Watch iteration failed',
      error,
    });
    expect(context.results[1]?.logs.generator).toContainEqual({
      type: 'iteration:start',
      changedFiles: [queuedFile],
    });
    expect(chokidarMock.watch).toHaveBeenCalledTimes(1);
    expect(context.watcher.close).not.toHaveBeenCalled();

    const finished = readFeedbackHistory().find(({ version, status }) => version === 0 && status === 'finished');
    const feedback = finished?.result?.logs.generator;

    expect(feedback).toContainEqual(expect.objectContaining({ type: 'finish:error' }));
    expect(feedback).toContainEqual(expect.objectContaining({ type: 'watch:error' }));
    expect(feedback).toContainEqual(
      expect.objectContaining({
        error: expect.objectContaining({ stack: expect.stringContaining('Error: watch failed') }),
      })
    );
  });

  it('recovers from watch errors before a result is created', async () => {
    const error = new Error('start failed');
    const afterFinish = mock(async () => undefined);
    const { generator } = await createGenerator({ historyPath: feedbackPath });

    await generator.startWatch({
      aggregationTimeout: 5,
      onStart: () => {
        throw error;
      },
      afterFinish,
    });

    await emitWatchedChange();

    const feedback = readFeedbackHistory().at(-1)?.result?.logs.generator;

    expect(afterFinish).toHaveBeenCalledTimes(1);
    expect(chokidarMock.watch).toHaveBeenCalledTimes(1);
    expect(chokidarMock.watchers[0]?.close).not.toHaveBeenCalled();
    expect(feedback).toContainEqual(
      expect.objectContaining({ type: 'watch:error', message: 'Watch iteration failed' })
    );
    expect(feedback).not.toContainEqual(expect.objectContaining({ type: 'finish:error' }));
  });

  it('throws on second watch call', async () => {
    const { generator } = await createGenerator();

    await generator.startWatch({});

    expect(generator.startWatch({})).rejects.toThrowError(
      'FileGenerator.startWatch() can only be called once per instance'
    );
  });

  it('stopWatch() cancels pending watch cycle', async () => {
    const afterFinish = mock(async () => undefined);

    const { generator } = await createGenerator();

    await generator.startWatch({ aggregationTimeout: 5, afterFinish });

    chokidarMock.watchers[0]?.emit('change', path.resolve(rootDir, 'file.ts'));

    await generator.stopWatch();

    vi.advanceTimersByTime(5);

    expect(afterFinish).not.toHaveBeenCalled();
    expect(chokidarMock.watch).toHaveBeenCalledTimes(1);
    expect(chokidarMock.watchers[0]?.close).toHaveBeenCalledTimes(1);
  });

  it('stopWatch() cancels queued changes and clears them before watch restarts', async () => {
    const deferred = createDeferred();
    const context = await createWatchGenerator({
      afterFinish: async () => {
        if (context.results.length === 1) await deferred.promise;
      },
    });

    await emitWatchedChange();
    await context.waitForResult();

    const { generator, watcher } = context;

    watcher.emit('change', getPath('queued.ts'));
    await generator.stopWatch();

    deferred.resolve();
    await flushMicrotasks();

    expect(context.results).toHaveLength(1);
    expect(chokidarMock.watch).toHaveBeenCalledTimes(1);
    expect(watcher.close).toHaveBeenCalledTimes(1);

    const freshFile = createChangedFile({ filePath: getPath('fresh.ts'), eventTimeMs: expect.any(Number) });

    await generator.startWatch({ aggregationTimeout: 5, afterFinish: context.afterFinish });
    await emitWatchedChange({ filePath: freshFile.filePath });
    await context.waitForResult(2);
    await flushMicrotasks();

    expect(context.results).toHaveLength(2);
    expect(context.results[1]?.logs.generator).toContainEqual({
      type: 'iteration:start',
      changedFiles: [freshFile],
    });
    expect(chokidarMock.watch).toHaveBeenCalledTimes(2);
    expect(context.watcher.close).not.toHaveBeenCalled();
  });

  it('passes plugin logs to startWatch() afterFinish', async () => {
    const afterFinish = mock(async (_result: TypeGenerateResult) => undefined);

    const { generator } = await createGenerator({
      plugins: [
        new SilentPlugin({
          onGenerate: ({ pluginLog }) => {
            pluginLog({ plugin: 'test-generator', message: 'plugin note' });
          },
        }),
      ],
    });

    await generator.startWatch({ aggregationTimeout: 5, afterFinish });

    await emitWatchedChange();

    expect(afterFinish).toHaveBeenCalledTimes(1);
    expect(afterFinish.mock.calls[0]?.[0].logs.plugins).toEqual([
      { type: 'plugin:log', plugin: 'test-generator', message: 'plugin note' },
    ]);
  });
});
