import fs, { type Stats } from 'node:fs';
import path from 'node:path';

import { watch as chokidarWatch, type FSWatcher } from 'chokidar';

import { appendFeedbackEntry, readLatestHistoryReport } from './feedback';
import type {
  TypeAfterCheckersArgs,
  TypeChangedFile,
  TypeCleanupFiles,
  TypeFileGeneratorOptions,
  TypeFilePath,
  TypeFullCycleOptions,
  TypeGeneratedFiles,
  TypeGeneratorLog,
  TypeLogs,
  TypePhase,
  TypePreparedFiles,
  TypeWatchOptions,
} from './types';
import { createChangedFile, excludeCascadeChanges, resolveFilePaths, resolveInsideRootDir } from './utils/files';
import { hasBlockingErrors } from './utils/logs';
import { createDuration } from './utils/time';

const MAX_CASCADE_ITERATIONS = 10;

type TypeContext = {
  logs: TypeLogs;
  changedPaths: Set<string>;
  deletedPaths: Set<string>;
  isFullGeneration: boolean;
};

type TypeSession = {
  options: TypeWatchOptions;
  watcher: FSWatcher;
  pendingChangedFiles: Array<TypeChangedFile>;
  debounceTimer?: NodeJS.Timeout;
  runContext?: TypeContext;
};

export class FileGenerator {
  constructor(options: TypeFileGeneratorOptions) {
    this.options = options;
  }

  private options: TypeFileGeneratorOptions;
  private failedPlugins = new Set<TypeFileGeneratorOptions['plugins'][number]>();
  private session?: TypeSession;
  private feedbackVersion?: number;
  private nextFeedbackVersion?: number;

  private createContext(changedFiles?: Array<TypeChangedFile>): TypeContext {
    const context: TypeContext = {
      logs: { generator: [], plugins: [], checkers: [] },
      changedPaths: new Set(),
      deletedPaths: new Set(),
      isFullGeneration: !changedFiles,
    };

    for (const file of changedFiles ?? []) {
      const paths = file.event === 'unlink' ? context.deletedPaths : context.changedPaths;

      paths.add(file.relativePath);
    }

    return context;
  }

  private isErrorLogged(context: TypeContext, error: unknown, types: Array<TypeGeneratorLog['type']>): boolean {
    return context.logs.generator.some((log) => types.includes(log.type) && 'error' in log && log.error === error);
  }

  private startFeedback(): void {
    const { historyPath, ci } = this.options;

    if (ci || !historyPath || this.feedbackVersion !== undefined) return;

    if (this.nextFeedbackVersion === undefined) {
      const lastVersion = fs.existsSync(historyPath) ? readLatestHistoryReport(historyPath).lastVersion : undefined;

      this.nextFeedbackVersion = lastVersion === undefined ? 0 : lastVersion + 1;
    }

    const version = this.nextFeedbackVersion;

    appendFeedbackEntry(historyPath, { version, status: 'inProgress' });

    this.feedbackVersion = version;
    this.nextFeedbackVersion = version + 1;
  }

  private writeFeedback(logs: TypeLogs): void {
    const { historyPath, ci } = this.options;

    if (ci || !historyPath || this.feedbackVersion === undefined) return;

    const version = this.feedbackVersion;

    try {
      appendFeedbackEntry(historyPath, { version, status: 'finished', timestamp: Date.now(), result: { logs } });
    } catch (error) {
      console.error('Failed to write feedback', error);
    } finally {
      this.feedbackVersion = undefined;
    }
  }

  private removeFiles(context: TypeContext, files: TypeCleanupFiles): Array<TypeChangedFile> {
    const { rootDir } = this.options;

    const deletedFiles: Array<TypeChangedFile> = [];

    for (const { filePath, plugin } of files) {
      const absPath = resolveInsideRootDir(rootDir, { filePath, action: 'remove' });

      if (!fs.existsSync(absPath)) continue;

      fs.unlinkSync(absPath);

      const changedFile = createChangedFile(rootDir, { event: 'unlink', origin: 'cascade', filePath: absPath });

      deletedFiles.push(changedFile);

      context.deletedPaths.add(changedFile.relativePath);
      context.logs.generator.push({ type: 'file:remove', plugin, relativePath: changedFile.relativePath });
    }

    return deletedFiles;
  }

  private getCleanupFiles(generatedFiles: TypeGeneratedFiles, changedFiles?: Array<TypeChangedFile>): TypeCleanupFiles {
    const { plugins, rootDir } = this.options;

    return plugins.flatMap((plugin) => {
      if (this.failedPlugins.has(plugin)) return [];

      return plugin.cleanup?.({ generatedFiles, changedFiles, rootDir }) || [];
    });
  }

  private getAfterCheckersArgs(context: TypeContext): TypeAfterCheckersArgs {
    const { rootDir } = this.options;

    return {
      changedFiles: resolveFilePaths(rootDir, context.changedPaths),
      deletedFiles: resolveFilePaths(rootDir, context.deletedPaths, false),
      isFullGeneration: context.isFullGeneration,
    };
  }

  private async runPhase<TRes>(
    context: TypeContext,
    { phase, cb }: { phase: TypePhase; cb: () => TRes | Promise<TRes> }
  ): Promise<TRes> {
    const getDuration = createDuration();

    try {
      return await cb();
    } catch (error) {
      context.logs.generator.push({ type: 'phase:error', phase, message: `Phase ${phase} failed`, error });

      throw error;
    } finally {
      context.logs.generator.push({ type: 'phase:end', phase, duration: getDuration() });
    }
  }

  private async runPhaseEmit(context: TypeContext, changedFiles?: Array<TypeChangedFile>): Promise<TypeGeneratedFiles> {
    context.logs.generator.push({ type: 'iteration:start', changedFiles: structuredClone(changedFiles) });

    return this.runPhase(context, {
      phase: 'emit',
      cb: async () => {
        const { plugins, rootDir } = this.options;

        const generatedFiles: TypeGeneratedFiles = [];

        for (const plugin of plugins) {
          let pluginFiles: TypeGeneratedFiles = [];

          try {
            pluginFiles = await plugin.generate({
              changedFiles: this.failedPlugins.has(plugin) ? undefined : changedFiles,
              rootDir,
              pluginLog: (params) => {
                context.logs.plugins.push({ type: 'plugin:log', ...params });
              },
              pluginError: (params) => {
                context.logs.plugins.push({ type: 'plugin:error', ...params });
              },
            });

            if (this.failedPlugins.delete(plugin)) {
              context.logs.plugins.push({ type: 'plugin:log', plugin: plugin.name, message: 'Plugin recovered' });
            }
          } catch (error) {
            this.failedPlugins.add(plugin);

            context.logs.plugins.push({ type: 'plugin:error', plugin: plugin.name, message: 'Plugin failed', error });
          }

          generatedFiles.push(...pluginFiles);

          context.logs.generator.push({ type: 'plugin:emit', plugin: plugin.name, emittedCount: pluginFiles.length });
        }

        return generatedFiles;
      },
    });
  }

  private async runPhaseWrite(context: TypeContext, files: TypeGeneratedFiles): Promise<Array<TypeChangedFile>> {
    if (!files.length) return [];

    return this.runPhase(context, {
      phase: 'write',
      cb: async () => {
        const { rootDir, headerTemplate, format } = this.options;

        const modifiedFiles: Array<TypeChangedFile> = [];

        let preparedFiles: TypePreparedFiles = files.map(({ filePath, rawContent, plugin, skipHeader }) => ({
          filePath,
          plugin,
          content: `${skipHeader ? '' : headerTemplate || ''}${rawContent}`,
        }));

        if (format) {
          try {
            preparedFiles = await format(preparedFiles);
          } catch (error) {
            const message = 'Format failed, writing unformatted generated files';

            context.logs.generator.push({ type: 'phase:error', phase: 'write', message, recoverable: true, error });
          }
        }

        for (const { filePath, content, plugin } of preparedFiles) {
          const absPath = resolveInsideRootDir(rootDir, { filePath, action: 'write' });

          const oldContent = fs.existsSync(absPath) ? fs.readFileSync(absPath, 'utf-8') : null;

          if (content === oldContent) continue;

          fs.mkdirSync(path.dirname(absPath), { recursive: true });

          fs.writeFileSync(absPath, content, 'utf-8');

          const changedFile = createChangedFile(rootDir, {
            event: oldContent == null ? 'add' : 'change',
            origin: 'cascade',
            filePath: absPath,
            eventTimeMs: fs.statSync(absPath).mtimeMs,
          });

          modifiedFiles.push(changedFile);

          context.changedPaths.add(changedFile.relativePath);
          context.logs.generator.push({ type: 'file:write', plugin, relativePath: changedFile.relativePath });
        }

        return modifiedFiles;
      },
    });
  }

  private async runPhaseCleanup(
    context: TypeContext,
    generatedFiles: TypeGeneratedFiles,
    changedFiles?: Array<TypeChangedFile>
  ): Promise<Array<TypeChangedFile>> {
    return this.runPhase(context, {
      phase: 'cleanup',
      cb: () => this.removeFiles(context, this.getCleanupFiles(generatedFiles, changedFiles)),
    });
  }

  private async runPhaseCheck(context: TypeContext): Promise<void> {
    return this.runPhase(context, {
      phase: 'check',
      cb: async () => {
        const { checkers, rootDir } = this.options;

        if (!checkers?.length) return;

        const files = this.getAfterCheckersArgs(context);

        for (const checker of checkers) {
          try {
            await checker.check({
              rootDir,
              ...files,
              checkerLog: (params) => {
                context.logs.checkers.push({ type: 'checker:log', checker: checker.name, ...params });
              },
              checkerError: (params) => {
                context.logs.checkers.push({ type: 'checker:error', checker: checker.name, ...params });
              },
            });
          } catch (error) {
            context.logs.checkers.push({
              type: 'checker:error',
              checker: checker.name,
              message: 'Checker failed',
              error,
            });
          }
        }
      },
    });
  }

  private async runGeneration(
    context: TypeContext,
    options?: TypeFullCycleOptions,
    changedFiles?: Array<TypeChangedFile>
  ): Promise<void> {
    const getDuration = createDuration();

    let generationError: { value: unknown } | undefined;
    let iterations = 1;

    try {
      options?.onStart?.();

      while (true) {
        if (iterations > MAX_CASCADE_ITERATIONS) {
          throw new Error(`Cascade generation exceeded ${MAX_CASCADE_ITERATIONS} iterations`);
        }

        const generatedFiles = await this.runPhaseEmit(context, changedFiles);
        const writtenFiles = await this.runPhaseWrite(context, generatedFiles);
        const deletedFiles = await this.runPhaseCleanup(context, generatedFiles, changedFiles);
        const modifiedFiles = [...writtenFiles, ...deletedFiles];

        if (!modifiedFiles.length) {
          await this.runPhaseCheck(context);

          break;
        }

        changedFiles = modifiedFiles;

        iterations++;
      }
    } catch (error) {
      generationError = { value: error };

      if (!this.isErrorLogged(context, error, ['phase:error'])) {
        context.logs.generator.push({
          type: context.isFullGeneration ? 'finish:error' : 'watch:error',
          message: context.isFullGeneration ? 'Generation failed' : 'Watch iteration failed',
          error,
        });
      }
    }

    const afterCheckersArgs = this.getAfterCheckersArgs(context);

    if (!generationError) {
      if (options?.afterCheckers) {
        const getAfterCheckersDuration = createDuration();

        try {
          await options.afterCheckers(afterCheckersArgs);
        } catch (error) {
          generationError = { value: error };

          context.logs.generator.push({ type: 'finish:error', message: 'Finish callback failed', error });
        } finally {
          context.logs.generator.push({ type: 'afterCheckers:end', duration: getAfterCheckersDuration() });
        }
      }

      context.logs.generator.push({ type: 'generation:end', duration: getDuration(), iterations });
    }

    try {
      await options?.afterFinish?.({ ...afterCheckersArgs, logs: context.logs });
    } catch (error) {
      generationError ??= { value: error };

      context.logs.generator.push({ type: 'finish:error', message: 'After finish callback failed', error });

      console.error('After finish callback failed', error);
    }

    if (generationError) throw generationError.value;
  }

  async runFullCycle(options?: TypeFullCycleOptions): Promise<void> {
    const context = this.createContext();

    this.startFeedback();

    try {
      await this.runGeneration(context, options);

      if (this.options.ci && hasBlockingErrors(context.logs)) {
        throw new Error('Generation failed in CI mode. See generation logs for details.');
      }
    } finally {
      this.writeFeedback(context.logs);
    }
  }

  async startWatch(options?: TypeWatchOptions): Promise<void> {
    if (this.options.ci) return;

    if (this.session) {
      throw new Error('FileGenerator.startWatch() can only be called once per instance');
    }

    this.session = {
      options: options || {},
      watcher: chokidarWatch(this.options.rootDir, { ignoreInitial: true }),
      pendingChangedFiles: [],
    };

    const session = this.session;

    for (const event of ['add', 'change', 'unlink'] as const) {
      session.watcher.on(event, (filePath: string, stats?: Stats): void => {
        if (session !== this.session) return;

        const eventTimeMs = stats?.mtimeMs;
        const changedFile = createChangedFile(this.options.rootDir, { event, origin: 'watch', filePath, eventTimeMs });

        session.pendingChangedFiles.push(changedFile);

        if (session.runContext) {
          session.runContext.logs.generator.push({ type: 'watch:discard', relativePath: changedFile.relativePath });

          return;
        }

        this.startFeedback();

        clearTimeout(session.debounceTimer);

        session.debounceTimer = setTimeout(async () => {
          while (session === this.session && session.pendingChangedFiles.length) {
            const changedFiles = session.pendingChangedFiles.sort((a, b) =>
              a.relativePath.localeCompare(b.relativePath)
            );
            const context = this.createContext(changedFiles);

            session.pendingChangedFiles = [];
            session.runContext = context;

            try {
              this.startFeedback();

              await this.runGeneration(context, session.options, changedFiles);
            } catch (error) {
              if (!this.isErrorLogged(context, error, ['phase:error', 'watch:error'])) {
                context.logs.generator.push({ type: 'watch:error', message: 'Watch iteration failed', error });
              }
            } finally {
              session.runContext = undefined;
            }

            session.pendingChangedFiles = excludeCascadeChanges(session.pendingChangedFiles, context.logs.generator);

            this.writeFeedback(context.logs);
          }
        }, session.options.aggregationTimeout || 0);
      });
    }

    await new Promise<void>((resolve) => {
      session.watcher.once('ready', resolve);
    });
  }

  async stopWatch(): Promise<void> {
    const session = this.session;

    if (!session) return;

    this.session = undefined;

    clearTimeout(session.debounceTimer);

    await session.watcher.close();
  }

  async getControlledFiles(): Promise<Array<TypeFilePath>> {
    const { rootDir } = this.options;

    const context = this.createContext();
    const generatedFiles = await this.runPhaseEmit(context);
    const paths = new Set<string>();

    for (const { filePath } of [...this.getCleanupFiles(generatedFiles), ...generatedFiles]) {
      paths.add(path.relative(rootDir, path.resolve(rootDir, filePath)).replace(/\\/g, '/'));
    }

    return resolveFilePaths(rootDir, paths);
  }

  async removeGeneratedFiles(): Promise<void> {
    const context = this.createContext();
    const generatedFiles = await this.runPhaseEmit(context);

    this.removeFiles(context, [...this.getCleanupFiles(generatedFiles), ...generatedFiles]);
  }
}
