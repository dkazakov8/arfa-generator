import type { TypeLog, TypeLogs } from '../types';
import { blue, gray, yellow } from '../utils/colors';
import { logsPrefix } from '../utils/const';
import { plural } from '../utils/plural';
import { formatError } from './utils';

function formatLog(params: { text: string; name?: string; error?: unknown; phase?: string }) {
  const { name, text, error, phase } = params;

  let message = name ? `  ` : ``;

  if (phase) message += `${blue(`[${phase}]`)} `;
  if (name) message += `${yellow(`[${name}]`)} `;

  message += text;

  if (error != null) message += `\n${name ? `    ` : `  `}${formatError(error)}`;

  return message;
}

function mapLogs(log: TypeLog): string {
  switch (log.type) {
    case 'generation:end':
      return formatLog({
        text: `finished ${yellow(plural(log.iterations, 'iteration'))} in ${yellow(log.duration)}`,
      });
    case 'file:write':
    case 'file:remove':
      return formatLog({ name: log.plugin, phase: log.type.split(':')[1], text: log.relativePath });
    case 'plugin:emit':
      if (log.emittedCount === 0) return '';

      return formatLog({
        name: log.plugin,
        phase: log.type.split(':')[1],
        text: yellow(plural(log.emittedCount, 'file')),
      });
    case 'iteration:start': {
      return !log.changedFiles
        ? `run with all files`
        : log.changedFiles
            .filter(({ origin }) => origin !== 'cascade')
            .map((params) => {
              return `${blue(`[${params.origin}:${params.event}] [${params.eventTimeMs.toFixed(3)}]`)} ${params.relativePath}`;
            })
            .join('\n');
    }
    case 'phase:end':
      return formatLog({ phase: log.phase, text: `finished in ${yellow(log.duration)}` });
    case 'afterCheckers:end':
      return formatLog({ phase: 'afterCheckers', text: `finished in ${yellow(log.duration)}` });
    case 'phase:error': {
      return formatLog({ phase: log.phase, text: log.message, error: log.error });
    }
    case 'finish:error':
      return formatLog({ phase: 'finish', text: log.message, error: log.error });
    case 'watch:error':
      return formatLog({ phase: 'watch', text: log.message, error: log.error });
    case 'watch:discard':
      return `change in ${log.relativePath} discarded because generation is in progress`;
    case 'plugin:log':
      return formatLog({ name: log.plugin, text: log.message });
    case 'plugin:error':
      return formatLog({ name: log.plugin, text: log.message, error: log.error });
    case 'checker:log':
      return formatLog({ name: log.checker, text: log.message });
    case 'checker:error':
      return formatLog({ name: log.checker, text: log.message, error: log.error });
    default:
      return '';
  }
}

export function consoleNormal(logs: TypeLogs, noStdout?: boolean) {
  let hasRemovedFiles = false;
  let cleanupFailed = false;

  const lines = [
    ...logs.generator.filter((log) => {
      if (log.type === 'iteration:start') {
        hasRemovedFiles = false;
        cleanupFailed = false;
      } else if (log.type === 'file:remove') {
        hasRemovedFiles = true;
      } else if (log.type === 'phase:error' && log.phase === 'cleanup') {
        cleanupFailed = true;
      } else if (log.type === 'phase:end' && log.phase === 'cleanup') {
        return hasRemovedFiles && !cleanupFailed;
      }

      return log.type !== 'generation:end';
    }),
    ...(logs.plugins.length ? ['plugins' as const, ...logs.plugins] : []),
    ...(logs.checkers.length ? ['checkers' as const, ...logs.checkers] : []),
    ...logs.generator.filter((log) => log.type === 'generation:end'),
  ].flatMap((maybeLog) => {
    if (maybeLog === 'plugins') return [`${logsPrefix} ${gray('[plugins] logs')}`];
    if (maybeLog === 'checkers') return [`${logsPrefix} ${gray('[checkers] logs')}`];

    return mapLogs(maybeLog)
      .split('\n')
      .filter(Boolean)
      .map((line) => `${logsPrefix} ${line}`);
  });

  const result = lines.join('\n');

  if (!noStdout) console.log(result);

  return result;
}
