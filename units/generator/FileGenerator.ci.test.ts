import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it, mock, spyOn } from 'bun:test';

import {
  chokidarMock,
  constructMemory,
  createDeferred,
  createGenerator,
  feedbackPath,
  flushMicrotasks,
  generatedFile,
  SilentPlugin,
  saveMemory,
  setupFileGeneratorTests,
  TestChecker,
  ThrowingChecker,
  ThrowingCleanupPlugin,
  ThrowingPlugin,
} from './helpers';

setupFileGeneratorTests();

describe('FileGenerator CI mode', () => {
  it.each(['reported', 'thrown'])('rejects %s plugin errors after awaiting afterFinish', async (mode) => {
    const error = new Error('plugin boom');
    const lifecycle: Array<string> = [];
    const finishStarted = createDeferred();
    const finishCallback = createDeferred();
    const failingPlugin =
      mode === 'thrown'
        ? new ThrowingPlugin(error)
        : new SilentPlugin({
            onGenerate: ({ pluginError }) => {
              pluginError({ plugin: 'test-generator', message: 'Plugin violation found', error });
            },
          });
    const context = await createGenerator({
      ci: true,
      plugins: [
        failingPlugin,
        new SilentPlugin({ generatedFiles: [generatedFile('generated.ts', 'export const value = 1;')] }),
      ],
      checkers: [new TestChecker({ onCheck: () => lifecycle.push('check') })],
      afterFinish: async () => {
        lifecycle.push('finish:start');
        finishStarted.resolve();
        await finishCallback.promise;
        lifecycle.push('finish:end');
      },
    });

    const generation = context.generator
      .runFullCycle({ afterFinish: context.afterFinish })
      .catch((failure: unknown) => {
        lifecycle.push('rejected');
        return failure;
      });

    await finishStarted.promise;
    await flushMicrotasks();

    expect(lifecycle).toEqual(['check', 'finish:start']);
    expect(constructMemory()).toEqual({ 'generated.ts': 'export const value = 1;' });
    expect(context.result?.logs.plugins).toContainEqual(expect.objectContaining({ type: 'plugin:error', error }));

    finishCallback.resolve();

    expect(await generation).toEqual(
      expect.objectContaining({ message: 'Generation failed in CI mode. See generation logs for details.' })
    );
    expect(lifecycle).toEqual(['check', 'finish:start', 'finish:end', 'rejected']);
  });

  it.each(['reported', 'thrown'])('rejects %s checker errors after running subsequent checkers', async (mode) => {
    const error = new Error('checker boom');
    const onCheck = mock(() => undefined);
    const afterFinish = mock(() => undefined);
    const failingChecker =
      mode === 'thrown'
        ? new ThrowingChecker(error)
        : new TestChecker({
            onCheck: ({ checkerError }) => {
              checkerError({ message: 'Checker violation found', error });
            },
          });
    const context = await createGenerator({
      ci: true,
      checkers: [failingChecker, new TestChecker({ onCheck })],
      afterFinish,
    });

    await expect(context.generator.runFullCycle({ afterFinish: context.afterFinish })).rejects.toThrow(
      'Generation failed in CI mode. See generation logs for details.'
    );

    expect(onCheck).toHaveBeenCalledTimes(1);
    expect(afterFinish).toHaveBeenCalledTimes(1);
    expect(context.result?.logs.checkers).toContainEqual(expect.objectContaining({ type: 'checker:error', error }));
  });

  it('succeeds with informational logs and recoverable format errors', async () => {
    const error = new Error('format boom');
    const { result } = await createGenerator({
      ci: true,
      run: 'runFullCycle',
      format: () => {
        throw error;
      },
      plugins: [
        new SilentPlugin({
          generatedFiles: [generatedFile('generated.ts', 'export const value = 1;')],
          logs: [{ plugin: 'test-generator', message: 'plugin:error is only mentioned in this message' }],
        }),
      ],
      checkers: [new TestChecker({ logs: [{ message: 'checker note' }] })],
    });

    expect(constructMemory()).toEqual({ 'generated.ts': 'export const value = 1;' });
    expect(result?.logs.generator).toContainEqual(
      expect.objectContaining({ type: 'phase:error', phase: 'write', recoverable: true, error })
    );
    expect(result?.logs.checkers).toContainEqual({
      type: 'checker:log',
      checker: 'test-checker',
      message: 'checker note',
    });
  });

  it('preserves the original afterFinish exception when plugin errors are present', async () => {
    const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Error('finish boom');
    const context = await createGenerator({
      ci: true,
      plugins: [new ThrowingPlugin(new Error('plugin boom'))],
      afterFinish: async () => {
        throw error;
      },
    });

    await expect(context.generator.runFullCycle({ afterFinish: context.afterFinish })).rejects.toBe(error);

    expect(consoleErrorSpy.mock.calls).toEqual([['After finish callback failed', error]]);
    expect(context.result?.logs.generator).toContainEqual({
      type: 'finish:error',
      message: 'After finish callback failed',
      error,
    });
  });

  it('preserves the original phase exception when plugin errors are present', async () => {
    const error = new Error('cleanup boom');
    const afterFinish = mock(() => undefined);
    const context = await createGenerator({
      ci: true,
      plugins: [new ThrowingPlugin(new Error('plugin boom')), new ThrowingCleanupPlugin(error)],
      afterFinish,
    });

    await expect(context.generator.runFullCycle({ afterFinish: context.afterFinish })).rejects.toBe(error);

    expect(afterFinish).toHaveBeenCalledTimes(1);
  });

  it('ignores repeated watch calls and their callbacks', async () => {
    const onStart = mock(() => undefined);
    const afterFinish = mock(() => undefined);
    const { generator } = await createGenerator({ ci: true });

    await generator.startWatch({ onStart, afterFinish });
    await generator.startWatch({ onStart, afterFinish });
    await generator.stopWatch();

    expect(chokidarMock.watch).not.toHaveBeenCalled();
    expect(chokidarMock.watchers).toHaveLength(0);
    expect(onStart).not.toHaveBeenCalled();
    expect(afterFinish).not.toHaveBeenCalled();
  });

  it.each([false, true])('does not create feedback files or directories with checker errors=%s', async (hasErrors) => {
    const context = await createGenerator({
      ci: true,
      historyPath: feedbackPath,
      checkers: hasErrors ? [new ThrowingChecker(new Error('checker boom'))] : [],
    });

    if (hasErrors) {
      await expect(context.generator.runFullCycle({ afterFinish: context.afterFinish })).rejects.toThrow(
        'Generation failed in CI mode. See generation logs for details.'
      );
    } else {
      await context.generator.runFullCycle({ afterFinish: context.afterFinish });
    }

    expect(fs.existsSync(path.dirname(feedbackPath))).toBe(false);
    expect(fs.existsSync(feedbackPath)).toBe(false);
    expect(context.result?.logs.generator).not.toContainEqual(expect.objectContaining({ type: 'feedback:enabled' }));
  });

  it('does not read or modify existing feedback history', async () => {
    const history = '{"version":7,"status":"inProgress"}\n';

    saveMemory({ '.llm/history.jsonl': history });

    const openFileSpy = spyOn(fs, 'openSync');

    await createGenerator({ ci: true, run: 'runFullCycle', historyPath: feedbackPath });

    expect(openFileSpy).not.toHaveBeenCalled();
    expect(fs.readFileSync(feedbackPath, 'utf8')).toBe(history);
  });
});
