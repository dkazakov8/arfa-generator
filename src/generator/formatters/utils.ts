import type { TypeCheckerLog, TypeGeneratorLog, TypeLogs, TypePluginLog } from '../types';

const summaryGeneratorLogTypes = [
  'file:write',
  'file:remove',
  'generation:end',
  'phase:error',
  'finish:error',
  'watch:error',
  'feedback:error',
] as const;

type TypeSummaryGeneratorLog = Extract<TypeGeneratorLog, { type: (typeof summaryGeneratorLogTypes)[number] }>;

export function countItems<TItem>(
  items: Array<TItem>,
  getKey: (item: TItem) => Array<unknown>
): Array<TItem & { count: number }> {
  const itemsByKey: Record<string, TItem & { count: number }> = {};

  for (const item of items) {
    const key = JSON.stringify(getKey(item));

    itemsByKey[key] ??= { ...item, count: 0 };
    itemsByKey[key].count++;
  }

  return Object.values(itemsByKey);
}

export function formatError(error: unknown, onlyMessage?: boolean): string {
  if (error instanceof Error) return onlyMessage ? error.message : error.stack || error.message;
  if (error && typeof error === 'object' && 'stack' in error && typeof error.stack === 'string') {
    if (onlyMessage && 'message' in error && typeof error.message === 'string') return error.message;

    return error.stack;
  }
  if (typeof error === 'string') return error;

  try {
    return JSON.stringify(error, null, 2) || String(error);
  } catch {
    return String(error);
  }
}

export function isCriticalLog(log: TypePluginLog | TypeCheckerLog): boolean {
  return log.type === 'plugin:error' || log.type === 'checker:error';
}

export function prepareSummaryLogs(logs: TypeLogs): {
  generator: Array<TypeSummaryGeneratorLog>;
  plugins: TypeLogs['plugins'];
  checkers: TypeLogs['checkers'];
} {
  return {
    generator: logs.generator.filter((log): log is TypeSummaryGeneratorLog =>
      summaryGeneratorLogTypes.includes(log.type as TypeSummaryGeneratorLog['type'])
    ),
    plugins: [...logs.plugins].sort((a, b) => Number(isCriticalLog(b)) - Number(isCriticalLog(a))),
    checkers: [...logs.checkers],
  };
}
