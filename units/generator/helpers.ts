import fs, { type Stats } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, afterEach, beforeAll, beforeEach, mock, spyOn, vi } from 'bun:test';

import {
  BaseChecker,
  BasePlugin,
  FileGenerator,
  type TypeAfterFinishArgs,
  type TypeChangedFile,
  type TypeCheckerCheckArgs,
  type TypeCleanupFiles,
  type TypeFileGeneratorOptions,
  type TypeFullCycleOptions,
  type TypeGeneratedFiles,
  type TypeGenerateResult,
  type TypeLog,
  type TypePluginGenerateArgs,
  type TypeWatchOptions,
} from '../../src/generator';

const unitsGeneratorDirPath = path.dirname(fileURLToPath(import.meta.url));
const testWorkerId = process.env.VITEST_POOL_ID ?? process.pid.toString();

export const rootDir = path.resolve(unitsGeneratorDirPath, 'tmp', testWorkerId, 'tmp');
export const getPath = (...parts: Array<string>) => path.resolve(rootDir, ...parts);

export function saveMemory(memory: Record<string, string>) {
  for (const [fileName, content] of Object.entries(memory)) {
    const filePath = getPath(fileName);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}

export function constructMemory(): Record<string, string> {
  const memory: Record<string, string> = {};

  if (!fs.existsSync(rootDir)) return memory;

  function readFolder(folderPath: string): void {
    const dirents = fs.readdirSync(folderPath, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));

    for (const dirent of dirents) {
      const filePath = `${folderPath}/${dirent.name}`;

      if (dirent.isDirectory()) {
        readFolder(filePath);
        continue;
      }

      const relativePath = filePath.slice(rootDir.length + 1).replace(/\\/g, '/');

      memory[relativePath] = fs.readFileSync(filePath, 'utf-8');
    }
  }

  readFolder(rootDir);

  return memory;
}

export function createChangedFile({
  filePath,
  event = 'change',
  origin = 'watch',
  eventTimeMs = performance.timeOrigin,
}: {
  filePath: string;
  event?: TypeChangedFile['event'];
  origin?: TypeChangedFile['origin'];
  eventTimeMs?: number;
}): TypeChangedFile {
  return {
    event,
    origin,
    filePath,
    eventTimeMs,
    relativePath: path.relative(rootDir, filePath).replace(/\\/g, '/'),
  };
}

export function constructFullGenerateResult(filePaths: Array<string>): TypeGenerateResult {
  const pluginError = Object.assign(new Error('plugin boom'), { stack: 'plugin stack' });
  const formatError = Object.assign(new Error('format boom'), { stack: 'format stack' });
  const checkerError = Object.assign(new Error('checker boom'), { stack: 'checker stack' });

  return {
    logs: {
      checkers: [
        { type: 'checker:log', checker: 'test-checker', message: 'checker note' },
        {
          type: 'checker:error',
          checker: 'throwing-checker',
          message: 'Checker failed',
          error: checkerError,
        },
      ],
      generator: [
        { type: 'iteration:start', changedFiles: undefined },
        { type: 'plugin:emit', plugin: 'throwing-generator', emittedCount: 0 },
        { type: 'plugin:emit', plugin: 'test-generator', emittedCount: 2 },
        { type: 'phase:end', phase: 'emit', duration: '0ms' },
        { type: 'file:remove', plugin: 'test-generator', relativePath: 'generated/stale.ts' },
        { type: 'phase:end', phase: 'cleanup', duration: '0ms' },
        {
          type: 'phase:error',
          phase: 'write',
          message: 'Format failed, writing unformatted generated files',
          recoverable: true,
          error: formatError,
        },
        { type: 'file:write', plugin: 'test-generator', relativePath: 'package.json' },
        { type: 'file:write', plugin: 'test-generator', relativePath: 'index.ts' },
        { type: 'phase:end', phase: 'write', duration: '0ms' },
        {
          type: 'iteration:start',
          changedFiles: [
            createChangedFile({ filePath: filePaths[0], event: 'add', origin: 'cascade' }),
            createChangedFile({ filePath: filePaths[1], event: 'add', origin: 'cascade' }),
            createChangedFile({ filePath: filePaths[2], event: 'unlink', origin: 'cascade' }),
          ],
        },
        { type: 'plugin:emit', plugin: 'throwing-generator', emittedCount: 0 },
        { type: 'plugin:emit', plugin: 'test-generator', emittedCount: 2 },
        { type: 'phase:end', phase: 'emit', duration: '0ms' },
        {
          type: 'phase:error',
          phase: 'write',
          message: 'Format failed, writing unformatted generated files',
          recoverable: true,
          error: formatError,
        },
        { type: 'phase:end', phase: 'write', duration: '0ms' },
        { type: 'phase:end', phase: 'check', duration: '0ms' },
        { type: 'generation:end', duration: '0ms', iterations: 2 },
      ],
      plugins: [
        {
          type: 'plugin:error',
          plugin: 'throwing-generator',
          message: 'Plugin failed',
          error: pluginError,
        },
        { type: 'plugin:log', plugin: 'test-generator', message: 'first plugin note' },
        { type: 'plugin:log', plugin: 'test-generator', message: 'second plugin note' },
        {
          type: 'plugin:error',
          plugin: 'throwing-generator',
          message: 'Plugin failed',
          error: pluginError,
        },
        { type: 'plugin:log', plugin: 'test-generator', message: 'first plugin note' },
        { type: 'plugin:log', plugin: 'test-generator', message: 'second plugin note' },
      ],
    },
  };
}

class MockWatcher {
  handlers = new Map<string, (filePath: string, stats?: Stats) => void>();
  close = mock(async () => undefined);
  on = mock((event: string, handler: (filePath: string, stats?: Stats) => void) => {
    this.handlers.set(event, handler);
    return this;
  });
  once = mock((event: string, handler: () => void) => {
    if (event === 'ready') handler();
    return this;
  });
  emit(event: string, filePath: string, stats?: Stats): void {
    this.handlers.get(event)?.(filePath, stats);
  }
}

export const chokidarMock = {
  watchers: [] as Array<MockWatcher>,
  watch: mock((_rootDir: string) => {
    const watcher = new MockWatcher();

    chokidarMock.watchers.push(watcher);

    return watcher;
  }),
};

export function createDeferred() {
  let resolve!: () => void;

  const promise = new Promise<void>((r) => {
    resolve = r;
  });

  return { promise, resolve };
}

export async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

type TypeTestPluginLog = Omit<Extract<TypeLog, { type: 'plugin:log' }>, 'type'>;
type TypeTestCheckerLog = Omit<Extract<TypeLog, { type: 'checker:log' }>, 'type' | 'checker'>;
export const feedbackPath = getPath('.llm/history.jsonl');

export function readFeedbackHistory(): Array<{
  version: number;
  status: 'inProgress' | 'finished';
  timestamp?: number;
  result?: TypeGenerateResult;
}> {
  return fs
    .readFileSync(feedbackPath, 'utf8')
    .trimEnd()
    .split('\n')
    .map((line) => JSON.parse(line));
}

export async function emitWatchedChange({
  filePath = path.resolve(rootDir, 'file.ts'),
  timeout = 5,
}: {
  filePath?: string;
  timeout?: number;
} = {}) {
  chokidarMock.watchers.at(-1)?.emit('change', filePath);
  vi.advanceTimersByTime(timeout);
}

type TypeTestPluginParams = {
  name?: string;
  generatedFiles?: TypeGeneratedFiles;
  cleanupFiles?: TypeCleanupFiles;
  logs?: Array<TypeTestPluginLog>;
  onGenerate?: (args: TypePluginGenerateArgs) => void;
};

export function generatedFile(
  relativePath: string,
  rawContent: string,
  params: Partial<Omit<TypeGeneratedFiles[number], 'filePath' | 'rawContent'>> = {}
): TypeGeneratedFiles[number] {
  return { plugin: 'test-generator', rawContent, filePath: getPath(relativePath), ...params };
}

export class SilentPlugin extends BasePlugin {
  name: string;
  generatedFiles: TypeGeneratedFiles;
  cleanupFiles: TypeCleanupFiles;
  logs?: Array<TypeTestPluginLog>;
  onGenerate?: (args: TypePluginGenerateArgs) => void;

  constructor(params: TypeTestPluginParams = {}) {
    super();

    this.name = params.name ?? 'test-generator';
    this.generatedFiles = params.generatedFiles ?? [];
    this.cleanupFiles = params.cleanupFiles ?? [];
    this.logs = params.logs;
    this.onGenerate = params.onGenerate;
  }

  async generate(args: TypePluginGenerateArgs) {
    const logs = this.logs ?? [];

    this.onGenerate?.(args);

    logs.forEach(args.pluginLog);

    return this.generatedFiles;
  }

  cleanup() {
    return this.cleanupFiles;
  }
}

export async function createGenerator(
  options: Partial<Omit<TypeFileGeneratorOptions, 'rootDir'>> &
    TypeFullCycleOptions & {
      run?: 'runFullCycle' | 'removeGeneratedFiles';
    } = {}
) {
  const { onStart, afterCheckers, afterFinish, plugins = [new SilentPlugin()], run, ...restOptions } = options;

  const generator = new FileGenerator({ rootDir, plugins, ...restOptions }) as unknown as Pick<
    FileGenerator,
    keyof FileGenerator
  > & {
    isGenerating: boolean;
    logs: TypeGenerateResult['logs'];
  };

  let result: TypeGenerateResult | undefined;

  const handleFinish = async (generateResult: TypeAfterFinishArgs) => {
    result = { logs: generateResult.logs };

    await afterFinish?.(generateResult);
  };

  if (run === 'runFullCycle') await generator.runFullCycle({ onStart, afterCheckers, afterFinish: handleFinish });
  if (run === 'removeGeneratedFiles') await generator.removeGeneratedFiles();

  return {
    generator,
    get result() {
      return result;
    },
    afterFinish: handleFinish,
  };
}

export async function createWatchGenerator(
  options: Parameters<typeof createGenerator>[0] = {},
  watchOptions: Omit<TypeWatchOptions, 'afterFinish'> = {}
) {
  const { afterCheckers, afterFinish: handleFinish, ...generatorOptions } = options;
  const { generator } = await createGenerator(generatorOptions);
  const results: Array<TypeGenerateResult> = [];
  const resultSignals: Array<ReturnType<typeof createDeferred> | undefined> = [];
  const afterFinish = (result: TypeAfterFinishArgs) => {
    results.push(result);
    resultSignals[results.length - 1]?.resolve();

    return handleFinish?.(result);
  };

  await generator.startWatch({ aggregationTimeout: 5, afterCheckers, ...watchOptions, afterFinish });

  return {
    generator,
    get watcher() {
      return chokidarMock.watchers.at(-1)!;
    },
    results,
    afterFinish,
    // Resolves when afterFinish receives the result, before the cycle's finally block.
    async waitForResult(count = 1): Promise<TypeGenerateResult> {
      if (results.length < count) {
        await (resultSignals[count - 1] ??= createDeferred()).promise;
      }

      return results[count - 1]!;
    },
  };
}

export class ThrowingPlugin extends BasePlugin {
  name = 'throwing-generator';

  constructor(private error: unknown) {
    super();
  }

  async generate(): Promise<never> {
    throw this.error;
  }
}

export class ThrowingCleanupPlugin extends BasePlugin {
  name = 'throwing-cleanup-generator';

  constructor(private error: unknown) {
    super();
  }

  async generate(): Promise<TypeGeneratedFiles> {
    return [generatedFile('generated.ts', 'export const value = 1;', { plugin: this.name })];
  }

  cleanup(): TypeCleanupFiles {
    throw this.error;
  }
}

export class TestChecker extends BaseChecker {
  name: string;
  logs: Array<TypeTestCheckerLog>;
  onCheck?: (args: TypeCheckerCheckArgs) => void;

  constructor(
    params: { name?: string; logs?: Array<TypeTestCheckerLog>; onCheck?: (args: TypeCheckerCheckArgs) => void } = {}
  ) {
    super();

    this.name = params.name ?? 'test-checker';
    this.logs = params.logs ?? [];
    this.onCheck = params.onCheck;
  }

  check(args: TypeCheckerCheckArgs) {
    this.logs.forEach(args.checkerLog);
    this.onCheck?.(args);
  }
}

export class ThrowingChecker extends BaseChecker {
  name = 'throwing-checker';

  constructor(private error: unknown) {
    super();
  }

  check() {
    throw this.error;
  }
}

export function setupFileGeneratorTests() {
  mock.module('chokidar', () => ({ watch: chokidarMock.watch }));

  let performanceNowSpy: ReturnType<typeof spyOn>;

  beforeAll(() => {
    performanceNowSpy = spyOn(performance, 'now').mockReturnValue(0);
  });

  afterAll(() => {
    performanceNowSpy.mockRestore();
  });

  beforeEach(() => {
    fs.mkdirSync(rootDir, { recursive: true });
    chokidarMock.watchers.length = 0;
    chokidarMock.watch.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    mock.restore();
    fs.rmSync(rootDir, { recursive: true, force: true });
  });
}
