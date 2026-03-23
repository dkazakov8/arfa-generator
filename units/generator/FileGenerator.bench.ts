import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { FileGenerator } from '../../src/generator/FileGenerator';
import type { TypeChangedFile, TypeCleanupFiles, TypeGeneratedFiles, TypeLogs } from '../../src/generator/types';

type TypeContext = {
  logs: TypeLogs;
  changedPaths: Set<string>;
  deletedPaths: Set<string>;
  isFullGeneration: boolean;
};

// Keep access to private methods confined to this benchmark.
type TypeBenchmarkGenerator = {
  createContext: () => TypeContext;
  runPhaseWrite: (context: TypeContext, files: TypeGeneratedFiles) => Promise<Array<TypeChangedFile>>;
  removeFiles: (
    context: TypeContext,
    files: TypeCleanupFiles
  ) => Array<TypeChangedFile> | Promise<Array<TypeChangedFile>>;
};

type TypeBenchmark = {
  group: string;
  iterations: number;
  prepare: () => void;
  run: () => unknown | Promise<unknown>;
};

const warmupIterations = 3;
const timerIterations = 5;

async function runBenchmark({ group, iterations, prepare, run }: TypeBenchmark): Promise<void> {
  for (let index = 0; index < warmupIterations; index += 1) {
    prepare();
    await run();
  }

  let duration = 0;

  for (let index = 0; index < iterations; index += 1) {
    prepare();

    const startedAt = performance.now();

    await run();

    duration += performance.now() - startedAt;
  }

  // Measure timer responsiveness separately so it does not affect operation timings.
  let timerElapsedTime = 0;
  let maxTimerElapsedTime = 0;

  for (let index = 0; index < timerIterations; index += 1) {
    prepare();

    const startedAt = performance.now();
    const timer = new Promise<number>((resolve) => {
      setTimeout(() => resolve(performance.now() - startedAt), 0);
    });

    let timerDelay: number;

    try {
      await run();
    } finally {
      timerDelay = await timer;
    }

    timerElapsedTime += timerDelay;
    maxTimerElapsedTime = Math.max(maxTimerElapsedTime, timerDelay);
  }

  const mean = duration / iterations;
  const timerMean = timerElapsedTime / timerIterations;

  console.log(
    `${group}: \x1b[33m${mean.toFixed(5)} ms/batch\x1b[0m (${iterations} iterations); ` +
      `timer: mean ${timerMean.toFixed(3)} ms, max ${maxTimerElapsedTime.toFixed(3)} ms (${timerIterations} samples)`
  );
}

const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arfa-file-generator-bench-'));

try {
  const generator = new FileGenerator({ rootDir, plugins: [] }) as unknown as TypeBenchmarkGenerator;

  let baselineElapsedTime = 0;

  for (let index = 0; index < timerIterations; index += 1) {
    const startedAt = performance.now();

    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    baselineElapsedTime += performance.now() - startedAt;
  }

  console.log(`FileGenerator > idle timer baseline: ${(baselineElapsedTime / timerIterations).toFixed(3)} ms`);
  console.log('Real filesystem, warmed cache; fixture preparation and cleanup excluded from timings.');

  for (const fileCount of [1, 100, 1000]) {
    const iterations = fileCount === 1000 ? 10 : 30;
    const filePaths = Array.from({ length: fileCount }, (_, index) =>
      path.join(rootDir, `group-${Math.floor(index / 10)}`, `file-${index}.ts`)
    );

    let context = generator.createContext();

    const prepare = (content?: string): void => {
      fs.rmSync(rootDir, { recursive: true, force: true });
      fs.mkdirSync(rootDir, { recursive: true });

      if (content !== undefined) {
        for (const filePath of filePaths) {
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, content, 'utf8');
        }
      }

      context = generator.createContext();
    };

    for (const contentSize of [1024, 64 * 1024]) {
      const rawContent = 'a'.repeat(contentSize);
      const oldContent = 'b'.repeat(contentSize);
      const files: TypeGeneratedFiles = filePaths.map((filePath) => ({
        filePath,
        plugin: 'benchmark',
        rawContent,
      }));

      for (const scenario of ['create', 'overwrite', 'unchanged'] as const) {
        const initialContent = scenario === 'create' ? undefined : scenario === 'overwrite' ? oldContent : rawContent;

        await runBenchmark({
          group: `FileGenerator.runPhaseWrite > ${scenario} > ${fileCount} files > ${contentSize / 1024} KiB/file`,
          iterations,
          prepare: () => prepare(initialContent),
          run: () => generator.runPhaseWrite(context, files),
        });
      }
    }

    const files: TypeCleanupFiles = filePaths.map((filePath) => ({ filePath, plugin: 'benchmark' }));
    const existingContent = 'a'.repeat(1024);

    for (const scenario of ['existing', 'missing'] as const) {
      await runBenchmark({
        group: `FileGenerator.removeFiles > ${scenario} > ${fileCount} files`,
        iterations,
        prepare: () => prepare(scenario === 'existing' ? existingContent : undefined),
        run: () => generator.removeFiles(context, files),
      });
    }
  }
} finally {
  fs.rmSync(rootDir, { recursive: true, force: true });
}
