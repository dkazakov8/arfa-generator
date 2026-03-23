import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, spyOn, vi } from 'bun:test';

import { appendFeedbackEntry, readLatestHistoryReport, runFeedbackCommand } from '../../src/generator/feedback';
import { defaultFeedbackInstructions } from '../../src/generator/formatters/logsToMarkdownSummary';
import { rootDir } from './helpers';

const feedbackPath = path.resolve(rootDir, '.llm/history.jsonl');
const timestamp = Date.parse('2026-10-10T12:30:00.000Z');
const emptyResult = { logs: { generator: [], plugins: [], checkers: [] } };
const originalArgv = process.argv;
const originalCwd = process.cwd();
const originalExitCode = process.exitCode;

describe('feedback', () => {
  let stdoutWrite: ReturnType<typeof spyOn>;
  let stderrWrite: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fs.mkdirSync(path.dirname(feedbackPath), { recursive: true });

    stdoutWrite = spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrWrite = spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
    stdoutWrite.mockRestore();
    stderrWrite.mockRestore();
    process.argv = originalArgv;
    process.exitCode = originalExitCode ?? 0;
    process.chdir(originalCwd);
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('renders the latest finished feedback without removing history', async () => {
    process.chdir(rootDir);

    appendFeedbackEntry(feedbackPath, { version: 0, status: 'inProgress' });
    appendFeedbackEntry(feedbackPath, { version: 0, status: 'finished', timestamp, result: emptyResult });
    appendFeedbackEntry(feedbackPath, { version: 1, status: 'inProgress' });
    appendFeedbackEntry(feedbackPath, { version: 1, status: 'finished', timestamp, result: emptyResult });

    process.argv = ['node', 'consumeFeedback.mjs', `--path=${feedbackPath}`, '--wait-timeout=100'];

    await runFeedbackCommand();

    expect(stdoutWrite).toHaveBeenCalledWith(
      expect.stringContaining('# Feedback (version 1, 2026-10-10T12:30:00.000Z)')
    );
    expect(stdoutWrite.mock.calls[0]?.[0]).not.toContain('# Feedback (version 0, 2026-10-10T12:30:00.000Z)');
    expect(stdoutWrite.mock.calls[0]?.[0]).toContain(defaultFeedbackInstructions);
    expect(fs.readFileSync(feedbackPath, 'utf8').split('\n').filter(Boolean)).toHaveLength(4);
  });

  it('reads default instructions relative to the current directory', async () => {
    process.chdir(rootDir);
    fs.writeFileSync('.llm/instructions.md', 'Custom instructions\nFix all issues.', 'utf8');
    appendFeedbackEntry(feedbackPath, { version: 0, status: 'finished', timestamp, result: emptyResult });
    process.argv = ['node', 'consumeFeedback.mjs', `--path=${feedbackPath}`];

    await runFeedbackCommand();

    expect(stdoutWrite.mock.calls[0]?.[0]).toContain('Custom instructions\nFix all issues.');
    expect(stdoutWrite.mock.calls[0]?.[0]).not.toContain('Instructions:');
    expect(stdoutWrite.mock.calls[0]?.[0]).not.toContain('Diagnostic data below');
  });

  it.each(['Custom instructions\nFix all issues.', ''])(
    'uses an explicitly selected instructions file with content %j',
    async (instructions) => {
      process.chdir(rootDir);
      fs.writeFileSync('.llm/instructions.md', 'Default file instructions', 'utf8');
      fs.writeFileSync('custom-instructions.md', instructions, 'utf8');
      appendFeedbackEntry(feedbackPath, { version: 0, status: 'finished', timestamp, result: emptyResult });
      process.argv = ['node', 'consumeFeedback.mjs', `--path=${feedbackPath}`, '--instructions=custom-instructions.md'];

      await runFeedbackCommand();

      const output = stdoutWrite.mock.calls[0]?.[0];

      expect(output).toContain('# Feedback (version 0, 2026-10-10T12:30:00.000Z)');
      expect(output).toContain(instructions ? `\n\n${instructions}\n\n## issues` : '\n\n## issues');
      expect(output).not.toContain('Default file instructions');
      expect(output).not.toContain('Instructions:');
      expect(output).not.toContain('Diagnostic data below');
    }
  );

  it('reports an error when an explicitly selected instructions file is missing', async () => {
    process.chdir(rootDir);
    fs.writeFileSync('.llm/instructions.md', 'Default file instructions', 'utf8');
    appendFeedbackEntry(feedbackPath, { version: 0, status: 'finished', timestamp, result: emptyResult });
    process.argv = ['node', 'consumeFeedback.mjs', `--path=${feedbackPath}`, '--instructions=missing.md'];

    await runFeedbackCommand();

    expect(process.exitCode).toBe(1);
    expect(stderrWrite).toHaveBeenCalledWith(`Cannot read instructions file: ${path.resolve(rootDir, 'missing.md')}\n`);
    expect(stdoutWrite).not.toHaveBeenCalled();
  });

  it('returns no entry or version for an empty history file', () => {
    fs.writeFileSync(feedbackPath, '', 'utf8');

    expect(readLatestHistoryReport(feedbackPath)).toEqual({
      lastReport: undefined,
      lastVersion: undefined,
      incomplete: false,
    });
  });

  it('reads enough of the tail for the latest large result', () => {
    const message = 'x'.repeat(12000);

    for (const version of [0, 1]) {
      appendFeedbackEntry(feedbackPath, { version, status: 'inProgress' });
      appendFeedbackEntry(feedbackPath, {
        version,
        status: 'finished',
        timestamp,
        result: {
          logs: {
            generator: [{ type: 'feedback:error', message }],
            plugins: [],
            checkers: [],
          },
        },
      });
    }

    const { lastReport, lastVersion, incomplete } = readLatestHistoryReport(feedbackPath);

    expect(incomplete).toBe(false);
    expect(lastVersion).toBe(1);
    expect(lastReport).toEqual({
      version: 1,
      status: 'finished',
      timestamp,
      result: {
        logs: {
          generator: [{ type: 'feedback:error', message }],
          plugins: [],
          checkers: [],
        },
      },
    });
  });

  it('exits immediately with an error when the history file is missing', async () => {
    vi.useFakeTimers();
    process.chdir(rootDir);
    process.argv = ['node', 'consumeFeedback.mjs', '--path=.llm/history.jsonl', '--wait-timeout=30000'];

    await runFeedbackCommand();

    expect(process.exitCode).toBe(1);
    expect(stderrWrite).toHaveBeenCalledWith(
      `History file not found: ${feedbackPath}\nRun generator with historyPath before calling this command.\n`
    );
    expect(stdoutWrite).not.toHaveBeenCalled();
  });

  it('returns only a timeout message and history path for an empty history file', async () => {
    fs.writeFileSync(feedbackPath, '', 'utf8');
    process.argv = ['node', 'consumeFeedback.mjs', `--path=${feedbackPath}`, '--wait-timeout=0'];

    await runFeedbackCommand();

    expect(stdoutWrite).toHaveBeenCalledWith(
      `Timed out after 0ms waiting for feedback report.\nHistory file: ${feedbackPath}\n`
    );
  });

  it.each(['.llm/instructions.md', 'missing.md'])(
    'ignores instructions from %s on timeout',
    async (instructionsPath) => {
      process.chdir(rootDir);
      fs.writeFileSync('.llm/instructions.md', 'Custom instructions', 'utf8');
      fs.writeFileSync(feedbackPath, '', 'utf8');
      process.argv = [
        'node',
        'consumeFeedback.mjs',
        `--path=${feedbackPath}`,
        `--instructions=${instructionsPath}`,
        '--wait-timeout=0',
      ];

      await runFeedbackCommand();

      expect(stdoutWrite).toHaveBeenCalledWith(
        `Timed out after 0ms waiting for feedback report.\nHistory file: ${feedbackPath}\n`
      );
      expect(stderrWrite).not.toHaveBeenCalled();
    }
  );

  it('times out while the latest version remains in progress', async () => {
    appendFeedbackEntry(feedbackPath, { version: 0, status: 'finished', timestamp, result: emptyResult });
    appendFeedbackEntry(feedbackPath, { version: 1, status: 'inProgress' });
    process.argv = ['node', 'consumeFeedback.mjs', `--path=${feedbackPath}`, '--wait-timeout=0'];

    await runFeedbackCommand();

    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('Timed out after 0ms'));
    expect(stdoutWrite.mock.calls[0]?.[0]).not.toContain('# Feedback (version 0, 2026-10-10T12:30:00.000Z)');
  });

  it('keeps error stacks and causes in structured results', () => {
    const error = new Error('outer', { cause: new Error('inner') });

    appendFeedbackEntry(feedbackPath, {
      version: 0,
      status: 'finished',
      timestamp,
      result: {
        logs: {
          generator: [{ type: 'finish:error', message: 'Finish callback failed', error }],
          plugins: [],
          checkers: [],
        },
      },
    });

    const entry = JSON.parse(fs.readFileSync(feedbackPath, 'utf8'));

    expect(entry.result.logs.generator[0].error).toEqual(
      expect.objectContaining({
        name: 'Error',
        message: 'outer',
        stack: expect.stringContaining('Error: outer'),
        cause: expect.objectContaining({ message: 'inner', stack: expect.stringContaining('Error: inner') }),
      })
    );
  });

  it('renders a stored error stack in Markdown', async () => {
    appendFeedbackEntry(feedbackPath, {
      version: 0,
      status: 'finished',
      timestamp,
      result: {
        logs: {
          generator: [{ type: 'finish:error', message: 'Finish callback failed', error: new Error('stored stack') }],
          plugins: [],
          checkers: [],
        },
      },
    });
    process.argv = ['node', 'consumeFeedback.mjs', `--path=${feedbackPath}`];

    await runFeedbackCommand();

    expect(stdoutWrite.mock.calls[0]?.[0]).toContain('Error: stored stack');
    expect(stdoutWrite.mock.calls[0]?.[0]).toContain('```text');
  });

  it('preserves the stack when the same error appears in multiple logs', () => {
    const error = new Error('repeated');

    appendFeedbackEntry(feedbackPath, {
      version: 0,
      status: 'finished',
      timestamp,
      result: {
        logs: {
          generator: [
            { type: 'finish:error', message: 'Finish callback failed', error },
            { type: 'watch:error', message: 'Watch iteration failed', error },
          ],
          plugins: [],
          checkers: [],
        },
      },
    });

    const entry = JSON.parse(fs.readFileSync(feedbackPath, 'utf8'));

    expect(entry.result.logs.generator[0].error.stack).toContain('Error: repeated');
    expect(entry.result.logs.generator[1].error.stack).toContain('Error: repeated');
  });

  it('waits while the latest entry is in progress', async () => {
    vi.useFakeTimers();

    process.argv = ['node', 'consumeFeedback.mjs', `--path=${feedbackPath}`, '--poll-interval=10', '--wait-timeout=50'];

    appendFeedbackEntry(feedbackPath, { version: 0, status: 'finished', timestamp, result: emptyResult });
    appendFeedbackEntry(feedbackPath, { version: 1, status: 'inProgress' });

    const feedbackPromise = runFeedbackCommand();

    vi.advanceTimersByTime(10);

    expect(stdoutWrite).not.toHaveBeenCalled();

    appendFeedbackEntry(feedbackPath, { version: 1, status: 'finished', timestamp, result: emptyResult });

    vi.advanceTimersByTime(10);

    await feedbackPromise;

    expect(stdoutWrite).toHaveBeenCalledWith(
      expect.stringContaining('# Feedback (version 1, 2026-10-10T12:30:00.000Z)')
    );
    expect(fs.existsSync(feedbackPath)).toBe(true);
  });

  it('uses default feedback path and ignores invalid number arguments', async () => {
    process.chdir(rootDir);

    appendFeedbackEntry(feedbackPath, { version: 0, status: 'finished', timestamp, result: emptyResult });

    process.argv = ['node', 'consumeFeedback.mjs', '--wait-timeout=invalid', '--poll-interval=invalid'];

    await runFeedbackCommand();

    expect(stdoutWrite).toHaveBeenCalledWith(
      expect.stringContaining('# Feedback (version 0, 2026-10-10T12:30:00.000Z)')
    );
    expect(fs.existsSync(feedbackPath)).toBe(true);
  });

  it('ignores an incomplete trailing line until it is finished', async () => {
    vi.useFakeTimers();

    fs.writeFileSync(feedbackPath, '{"version":0,"status":"inProgress"}\n{"version":0,"status":"finished"', 'utf8');
    process.argv = ['node', 'consumeFeedback.mjs', `--path=${feedbackPath}`, '--poll-interval=10', '--wait-timeout=50'];

    const feedbackPromise = runFeedbackCommand();

    expect(stdoutWrite).not.toHaveBeenCalled();

    fs.appendFileSync(feedbackPath, `,"timestamp":${timestamp},"result":${JSON.stringify(emptyResult)}}\n`, 'utf8');
    vi.advanceTimersByTime(10);

    await feedbackPromise;

    expect(stdoutWrite).toHaveBeenCalledWith(
      expect.stringContaining('# Feedback (version 0, 2026-10-10T12:30:00.000Z)')
    );
  });

  it('does not return a previous result while the next marker is incomplete', async () => {
    vi.useFakeTimers();

    appendFeedbackEntry(feedbackPath, { version: 0, status: 'finished', timestamp, result: emptyResult });
    fs.appendFileSync(feedbackPath, '{"version":1,"status":"inProgress"', 'utf8');
    process.argv = ['node', 'consumeFeedback.mjs', `--path=${feedbackPath}`, '--poll-interval=10', '--wait-timeout=50'];

    const feedbackPromise = runFeedbackCommand();

    expect(stdoutWrite).not.toHaveBeenCalled();

    fs.appendFileSync(feedbackPath, '}\n', 'utf8');
    appendFeedbackEntry(feedbackPath, { version: 1, status: 'finished', timestamp, result: emptyResult });
    vi.advanceTimersByTime(10);

    await feedbackPromise;

    expect(stdoutWrite).toHaveBeenCalledWith(
      expect.stringContaining('# Feedback (version 1, 2026-10-10T12:30:00.000Z)')
    );
  });

  it('can append after a truncated line from a previous process', () => {
    fs.writeFileSync(feedbackPath, '{"version":0,"status":"inProgress"', 'utf8');

    appendFeedbackEntry(feedbackPath, { version: 0, status: 'inProgress' });
    appendFeedbackEntry(feedbackPath, { version: 0, status: 'finished', timestamp, result: emptyResult });

    expect(readLatestHistoryReport(feedbackPath)).toEqual({
      lastReport: {
        version: 0,
        status: 'finished',
        timestamp,
        result: emptyResult,
      },
      lastVersion: 0,
      incomplete: false,
    });
  });

  it('does not return an older result after a malformed trailing line', async () => {
    appendFeedbackEntry(feedbackPath, { version: 0, status: 'finished', timestamp, result: emptyResult });
    fs.appendFileSync(feedbackPath, '{"version":1,"status":"inProgress"\n', 'utf8');
    process.argv = ['node', 'consumeFeedback.mjs', `--path=${feedbackPath}`, '--wait-timeout=0'];

    await runFeedbackCommand();

    expect(stdoutWrite).toHaveBeenCalledWith(expect.stringContaining('Timed out after 0ms'));
    expect(stdoutWrite.mock.calls[0]?.[0]).not.toContain('# Feedback (version 0, 2026-10-10T12:30:00.000Z)');
  });
});
