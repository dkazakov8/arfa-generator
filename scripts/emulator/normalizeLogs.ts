import type { TypeLogs } from '../../src/generator';

export function normalizeLogs(logs: TypeLogs): TypeLogs {
  return {
    generator: logs.generator.map((log) => {
      if (log.type === 'generation:end') return { ...log, duration: '0ms' };
      if (log.type === 'afterCheckers:end') return { ...log, duration: '0ms' };
      if (log.type === 'phase:end') return { ...log, duration: '0ms' };
      if (log.type === 'iteration:start' && log.changedFiles) {
        return {
          ...log,
          changedFiles: log.changedFiles.map((file) => ({
            ...file,
            filePath: '[hidden]',
            eventTimeMs: 0,
          })),
        };
      }
      if (log.type === 'phase:error') {
        return { ...log, error: log.error instanceof Error ? log.error.message : log.error };
      }

      return log;
    }),
    plugins: logs.plugins.map((log) => {
      if (log.type !== 'plugin:error') return log;

      return { ...log, error: log.error instanceof Error ? log.error.message : log.error };
    }),
    checkers: logs.checkers.map((log) => {
      if (log.type !== 'checker:error') return log;

      let error = log.error instanceof Error ? log.error.message : log.error;

      if (log.checker === 'vitest' && typeof error === 'string') {
        error = error
          .replace(/\x1b\[[\d;]*m/g, '')
          .replace(/\bStart at\s+\d{2}:\d{2}:\d{2}\b/g, 'Start at 00:00:00')
          .replace(/\b\d+(?:\.\d+)?\s*(?:ms|s)\b/g, '0ms')
          .replace(/^([ \t]*Duration[ \t]+0ms)[^\r\n]*/gm, '$1')
          .replace(/(?:^ [✓❯] [^\n]*(?:\n {3}[^\n]*)*\n)+/gm, (block) =>
            block
              .split(/(?=^ [✓❯] )/m)
              .sort((a, b) => a.slice(3).localeCompare(b.slice(3)))
              .join('')
          );
      }

      return {
        ...log,
        error:
          log.checker === 'biome' && typeof error === 'string'
            ? error.replace(/Checked (\d+ files?) in [\d.]+\s*(?:ns|µs|μs|us|ms|s)\b/g, 'Checked $1 in 0ms')
            : error,
      };
    }),
  };
}
