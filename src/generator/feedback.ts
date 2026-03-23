import fs from 'node:fs';
import path from 'node:path';

import { logsToMarkdownSummary } from './formatters';
import type { TypeGenerateResult } from './types';

export type TypeFeedbackEntry =
  | { version: number; status: 'inProgress' }
  | { version: number; status: 'finished'; timestamp: number; result: TypeGenerateResult };

function withFeedbackFile<TResult>(feedbackPath: string, cb: (file: number, size: number) => TResult): TResult {
  const file = fs.openSync(feedbackPath, 'r');

  try {
    return cb(file, fs.fstatSync(file).size);
  } finally {
    fs.closeSync(file);
  }
}

export function readLatestHistoryReport(feedbackPath: string): {
  lastReport: TypeFeedbackEntry | undefined;
  lastVersion: number | undefined;
  incomplete: boolean;
} {
  return withFeedbackFile(feedbackPath, (file, size) => {
    if (size === 0) return { lastReport: undefined, lastVersion: undefined, incomplete: false };

    let readSize = Math.min(size, 4096);

    while (true) {
      const start = size - readSize;
      const buffer = Buffer.allocUnsafe(readSize);

      fs.readSync(file, buffer, 0, readSize, start);

      const content = buffer.toString('utf8');
      const hasUnterminatedLine = !content.endsWith('\n');
      const lines = content.split('\n');

      if (hasUnterminatedLine) lines.pop();
      if (start > 0) lines.shift();

      let lastReport: TypeFeedbackEntry | undefined;
      let invalidTrailingLine = false;

      for (const line of lines) {
        if (!line) continue;

        try {
          lastReport = JSON.parse(line) as TypeFeedbackEntry;
          invalidTrailingLine = false;
        } catch {
          // A previous process may have stopped in the middle of an append.
          invalidTrailingLine = true;
        }
      }

      if (start === 0 || lastReport !== undefined) {
        return {
          lastReport,
          lastVersion: lastReport?.version,
          incomplete: hasUnterminatedLine || invalidTrailingLine,
        };
      }

      readSize = Math.min(size, readSize * 2);
    }
  });
}

export function appendFeedbackEntry(feedbackPath: string, entry: TypeFeedbackEntry): void {
  fs.mkdirSync(path.dirname(feedbackPath), { recursive: true });

  const content = JSON.stringify(entry, (_key, value: unknown) => {
    if (value instanceof Error) {
      const errorData: Record<string, unknown> = {};

      for (const key of Object.getOwnPropertyNames(value)) errorData[key] = value[key as keyof Error];

      return { name: value.name, message: value.message, stack: value.stack, ...errorData };
    }

    return value;
  });

  let separator = '';

  if (fs.existsSync(feedbackPath)) {
    withFeedbackFile(feedbackPath, (file, size) => {
      const lastByte = Buffer.alloc(1);

      if (size > 0 && fs.readSync(file, lastByte, 0, 1, size - 1) > 0 && lastByte[0] !== 10) {
        separator = '\n';
      }
    });
  }

  fs.appendFileSync(feedbackPath, `${separator}${content}\n`, 'utf8');
}

function getArg(name: string, as: 'string'): string | undefined;
function getArg(name: string, as: 'number'): number | undefined;
function getArg(name: string, as: 'string' | 'number'): string | number | undefined {
  const value = process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

  if (as === 'string') return value;

  const parsedValue = value == null ? Number.NaN : Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

export async function runFeedbackCommand(): Promise<void> {
  const feedbackPath = path.resolve(getArg('path', 'string') || '.llm/history.jsonl');

  if (!fs.existsSync(feedbackPath)) {
    process.stderr.write(
      `History file not found: ${feedbackPath}\nRun generator with historyPath before calling this command.\n`
    );
    process.exitCode = 1;

    return;
  }

  const pollInterval = getArg('poll-interval', 'number') ?? 200;
  const waitTimeout = getArg('wait-timeout', 'number') ?? 10000;
  const deadline = Date.now() + waitTimeout;

  while (true) {
    const { lastReport, incomplete } = readLatestHistoryReport(feedbackPath);

    if (!incomplete && lastReport?.status === 'finished') {
      const instructionsArg = getArg('instructions', 'string');
      const instructionsPath = path.resolve(instructionsArg ?? '.llm/instructions.md');
      let instructions: string | undefined;

      if (instructionsArg !== undefined || fs.existsSync(instructionsPath)) {
        try {
          instructions = fs.readFileSync(instructionsPath, 'utf8');
        } catch {
          process.stderr.write(`Cannot read instructions file: ${instructionsPath}\n`);
          process.exitCode = 1;

          return;
        }
      }

      const content = logsToMarkdownSummary(lastReport.result.logs, {
        version: lastReport.version,
        timestamp: lastReport.timestamp,
        instructions,
      });

      process.stdout.write(`${content}\n`);

      return;
    }

    if (Date.now() >= deadline) break;

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  process.stdout.write(
    `Timed out after ${waitTimeout}ms waiting for feedback report.\nHistory file: ${feedbackPath}\n`
  );
}
