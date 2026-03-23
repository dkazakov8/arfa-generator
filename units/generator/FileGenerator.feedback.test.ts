import path from 'node:path';

import { describe, expect, it, spyOn } from 'bun:test';

import {
  chokidarMock,
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
  setupFileGeneratorTests,
  TestChecker,
} from './helpers';

setupFileGeneratorTests();

describe('FileGenerator feedback', () => {
  it('appends a raw result after runFullCycle() without a feedback command event', async () => {
    await createGenerator({
      run: 'runFullCycle',
      plugins: [new SilentPlugin()],
      historyPath: feedbackPath,
    });

    const history = readFeedbackHistory();

    expect(history[0]).toEqual({ version: 0, status: 'inProgress' });
    expect(history[1]).toEqual({
      version: 0,
      status: 'finished',
      timestamp: expect.any(Number),
      result: {
        logs: {
          generator: expect.arrayContaining([{ type: 'generation:end', duration: '0ms', iterations: 1 }]),
          plugins: [],
          checkers: [],
        },
      },
    });
    expect(history[1]?.result?.logs.generator).not.toContainEqual(
      expect.objectContaining({ type: 'feedback:enabled' })
    );
  });

  it('preserves history, advances version and records timestamps after afterFinish', async () => {
    const dateNowSpy = spyOn(Date, 'now').mockReturnValue(1000);
    const { generator } = await createGenerator({ plugins: [new SilentPlugin()], historyPath: feedbackPath });

    await generator.runFullCycle();
    await generator.runFullCycle({
      afterFinish: async () => {
        expect(readFeedbackHistory().at(-1)).toEqual({ version: 1, status: 'inProgress' });
        dateNowSpy.mockReturnValue(2000);
      },
    });

    expect(readFeedbackHistory().map(({ version, status }) => ({ version, status }))).toEqual([
      { version: 0, status: 'inProgress' },
      { version: 0, status: 'finished' },
      { version: 1, status: 'inProgress' },
      { version: 1, status: 'finished' },
    ]);
    expect(
      readFeedbackHistory()
        .filter(({ status }) => status === 'finished')
        .map(({ timestamp }) => timestamp)
    ).toEqual([1000, 2000]);
  });

  it('uses one version for all cascade iterations and resumes numbering in a new instance', async () => {
    const plugin = new SilentPlugin({ generatedFiles: [generatedFile('generated.ts', 'export const value = 1;')] });
    const first = await createGenerator({ plugins: [plugin], historyPath: feedbackPath });

    await first.generator.runFullCycle();

    expect(readFeedbackHistory().at(-1)?.result?.logs.generator).toContainEqual({
      type: 'generation:end',
      duration: '0ms',
      iterations: 2,
    });

    const second = await createGenerator({ plugins: [new SilentPlugin()], historyPath: feedbackPath });

    await second.generator.runFullCycle();

    expect(readFeedbackHistory().map(({ version, status }) => ({ version, status }))).toEqual([
      { version: 0, status: 'inProgress' },
      { version: 0, status: 'finished' },
      { version: 1, status: 'inProgress' },
      { version: 1, status: 'finished' },
    ]);
  });

  it('logs afterFinish errors and writes feedback before rethrowing from runFullCycle()', async () => {
    const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Error('finish boom');
    const context = await createGenerator({
      plugins: [new SilentPlugin()],
      historyPath: feedbackPath,
      afterFinish: async () => {
        throw error;
      },
    });

    await expect(context.generator.runFullCycle({ afterFinish: context.afterFinish })).rejects.toBe(error);

    expect(consoleErrorSpy.mock.calls).toEqual([['After finish callback failed', error]]);
    expect(context.result?.logs.generator.at(-1)).toEqual({
      type: 'finish:error',
      message: 'After finish callback failed',
      error,
    });
    const finished = readFeedbackHistory().at(-1);

    expect(finished?.status).toBe('finished');
    expect(finished?.result?.logs.generator).toContainEqual({
      type: 'finish:error',
      message: 'After finish callback failed',
      error: expect.objectContaining({
        name: 'Error',
        message: 'finish boom',
        stack: expect.stringContaining('finish boom'),
      }),
    });
  });

  it('finishes feedback before starting another queued cycle', async () => {
    const historyAtStart: Array<ReturnType<typeof readFeedbackHistory>> = [];
    const historyAtFinish: Array<ReturnType<typeof readFeedbackHistory>> = [];
    const context = await createWatchGenerator(
      {
        historyPath: feedbackPath,
        checkers: [
          new TestChecker({
            onCheck: () => {
              if (!context.results.length) context.watcher.emit('change', getPath('queued.ts'));
            },
          }),
        ],
        afterFinish: () => {
          historyAtFinish.push(readFeedbackHistory());
        },
      },
      {
        onStart: () => {
          historyAtStart.push(readFeedbackHistory());
        },
      }
    );

    await emitWatchedChange();
    await context.waitForResult(2);
    await flushMicrotasks();

    expect(historyAtStart[0]).toEqual([{ version: 0, status: 'inProgress' }]);
    expect(historyAtStart[1]?.at(-2)).toEqual(expect.objectContaining({ version: 0, status: 'finished' }));
    expect(historyAtStart[1]?.at(-1)).toEqual({ version: 1, status: 'inProgress' });
    expect(historyAtFinish.map((history) => history.at(-1))).toEqual([
      { version: 0, status: 'inProgress' },
      { version: 1, status: 'inProgress' },
    ]);
    expect(readFeedbackHistory().map(({ version, status }) => ({ version, status }))).toEqual([
      { version: 0, status: 'inProgress' },
      { version: 0, status: 'finished' },
      { version: 1, status: 'inProgress' },
      { version: 1, status: 'finished' },
    ]);
  });

  it('preserves history and completes a watch cycle after afterFinish', async () => {
    const { generator } = await createGenerator({ historyPath: feedbackPath });

    await generator.runFullCycle();

    await generator.startWatch({
      aggregationTimeout: 5,
      onStart: () => {
        expect(readFeedbackHistory().at(-1)).toEqual({ version: 1, status: 'inProgress' });
      },
    });

    await emitWatchedChange();

    const history = readFeedbackHistory();

    expect(history.map(({ version, status }) => ({ version, status }))).toEqual([
      { version: 0, status: 'inProgress' },
      { version: 0, status: 'finished' },
      { version: 1, status: 'inProgress' },
      { version: 1, status: 'finished' },
    ]);
    expect(history.at(-1)?.result?.logs.generator).not.toContainEqual(
      expect.objectContaining({ type: 'feedback:enabled' })
    );
  });

  it('marks feedback in progress before watch debounce finishes', async () => {
    const { generator } = await createGenerator({ historyPath: feedbackPath });

    await generator.startWatch({ aggregationTimeout: 5 });

    chokidarMock.watchers[0]?.emit('change', path.resolve(rootDir, 'file.ts'));

    expect(readFeedbackHistory()).toEqual([{ version: 0, status: 'inProgress' }]);
  });
});
