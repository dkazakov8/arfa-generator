import type { BaseChecker } from './BaseChecker';
import type { BasePlugin } from './BasePlugin';

export type TypePhase = 'emit' | 'cleanup' | 'write' | 'check';
export type TypeEntries = Array<string>;
export type TypeMessage = { name: string; defaultValue: string };
export type TypeEntryKind = 'file' | 'dir';
export type TypeChangedFileEvent = 'add' | 'change' | 'unlink';

export type TypeChangedFile = {
  event: TypeChangedFileEvent;
  origin: 'watch' | 'cascade';
  filePath: string;
  eventTimeMs: number;
  relativePath: string;
};

export type TypeFilePath = { relativePath: string; absolutePath: string };

export type TypePluginFile = { plugin: string; filePath: string };

export type TypeGeneratedFile = TypePluginFile & { rawContent: string; skipHeader?: boolean };

export type TypeGeneratedFiles = Array<TypeGeneratedFile>;

export type TypeCleanupFiles = Array<TypePluginFile>;

export type TypePreparedFile = TypePluginFile & { content: string };

export type TypePreparedFiles = Array<TypePreparedFile>;

export type TypePluginGenerateArgs = {
  rootDir: string;
  pluginLog: (log: Omit<Extract<TypePluginLog, { type: 'plugin:log' }>, 'type'>) => void;
  pluginError: (log: Omit<Extract<TypePluginLog, { type: 'plugin:error' }>, 'type'>) => void;
  changedFiles?: Array<TypeChangedFile>;
};

export type TypePluginCleanupArgs = {
  rootDir: string;
  generatedFiles: TypeGeneratedFiles;
  changedFiles?: Array<TypeChangedFile>;
};

export type TypeGenerationData = {
  logs: TypeLogs;
  changedFiles: Array<TypeFilePath>;
  deletedFiles: Array<TypeFilePath>;
  isFullGeneration: boolean;
};

export type TypeCheckerCheckArgs = Pick<TypeGenerationData, 'changedFiles' | 'deletedFiles' | 'isFullGeneration'> & {
  rootDir: string;
  checkerLog: (log: Omit<Extract<TypeCheckerLog, { type: 'checker:log' }>, 'type' | 'checker'>) => void;
  checkerError: (log: Omit<Extract<TypeCheckerLog, { type: 'checker:error' }>, 'type' | 'checker'>) => void;
};

export type TypeGeneratorLog =
  | { type: 'generation:end'; duration: string; iterations: number }
  | { type: 'afterCheckers:end'; duration: string }
  | { type: 'file:write'; plugin: string; relativePath: string }
  | { type: 'file:remove'; plugin: string; relativePath: string }
  | { type: 'plugin:emit'; plugin: string; emittedCount: number }
  | { type: 'finish:error'; message: string; error: unknown }
  | { type: 'feedback:error'; message: string }
  | { type: 'iteration:start'; changedFiles?: Array<TypeChangedFile> }
  | { type: 'phase:end'; phase: TypePhase; duration: string }
  | { type: 'phase:error'; phase: TypePhase; message: string; recoverable?: boolean; error?: unknown }
  | { type: 'watch:discard'; relativePath: string }
  | { type: 'watch:error'; message: string; error: unknown };

export type TypePluginLog =
  | { type: 'plugin:log'; message: string; plugin: string }
  | { type: 'plugin:error'; message: string; plugin: string; error: unknown };

export type TypeCheckerLog =
  | { type: 'checker:log'; message: string; checker: string }
  | { type: 'checker:error'; message: string; checker: string; error: unknown };

export type TypeLog = TypeGeneratorLog | TypePluginLog | TypeCheckerLog;

export type TypeLogs = {
  generator: Array<TypeGeneratorLog>;
  plugins: Array<TypePluginLog>;
  checkers: Array<TypeCheckerLog>;
};

export type TypeGenerateResult = Pick<TypeGenerationData, 'logs'>;

export type TypeAfterCheckersArgs = Omit<TypeGenerationData, 'logs'>;

export type TypeAfterFinishArgs = TypeGenerationData;

export type TypeFullCycleOptions = {
  onStart?: () => void;
  afterCheckers?: (args: TypeAfterCheckersArgs) => void | Promise<void>;
  afterFinish?: (args: TypeAfterFinishArgs) => void | Promise<void>;
};

export type TypeWatchOptions = TypeFullCycleOptions & { aggregationTimeout?: number };

export type TypeFileGeneratorOptions = {
  ci?: boolean;
  format?: (files: TypePreparedFiles) => TypePreparedFiles | Promise<TypePreparedFiles>;
  rootDir: string;
  plugins: Array<BasePlugin>;
  checkers?: Array<BaseChecker>;
  historyPath?: string;
  headerTemplate?: string;
};
