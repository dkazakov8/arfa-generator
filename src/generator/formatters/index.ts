import type { TypeLogs } from '../types';
import { consoleMinimal } from './consoleMinimal';
import { consoleNormal } from './consoleNormal';

export { logsToMarkdownSummary } from './logsToMarkdownSummary';

export function logsToConsole(
  logs: TypeLogs,
  options?: { verbosity?: 'normal' | 'minimal'; noStdout?: boolean }
): string {
  if (options?.verbosity === 'minimal') return consoleMinimal(logs, options?.noStdout);

  return consoleNormal(logs, options?.noStdout);
}
