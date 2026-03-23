import type { TypeLogs } from '../types';
import { blue, yellow } from '../utils/colors';
import { logsPrefix } from '../utils/const';
import { countItems, formatError, prepareSummaryLogs } from './utils';

type TypeItem = { details?: Array<string>; key: Array<unknown>; label: string };
type TypeCountedItem = TypeItem & { count: number };

function prefixLines(lines: Array<string>): string {
  return lines.map((line) => `${logsPrefix} ${line}`).join('\n');
}

function formatCountedItems(items: Array<TypeCountedItem>): Array<string> {
  return items.flatMap(({ count, details = [], label }) => [
    `${label}${count > 1 ? ` x${count}` : ''}`,
    ...details.map((line) => `  ${line}`),
  ]);
}

function formatFiles(logs: ReturnType<typeof prepareSummaryLogs>['generator']): Array<string> {
  const files = countItems<TypeItem>(
    logs
      .filter((log) => log.type === 'file:write' || log.type === 'file:remove')
      .sort((a, b) => Number(a.type === 'file:remove') - Number(b.type === 'file:remove'))
      .map((log) => ({
        key: [log.relativePath],
        label: `${blue(`[${log.type.split(':')[1]}]`)} ${log.relativePath}`,
      })),
    (item) => item.key
  );

  return formatCountedItems(files);
}

function formatLogs(logs: ReturnType<typeof prepareSummaryLogs>): Array<string> {
  const messages = countItems<TypeItem>(
    [
      ...logs.plugins
        .filter((log) => log.type === 'plugin:log')
        .map((log) => ({
          key: [log.type.split(':')[0], log.plugin, log.message],
          label: `${yellow(`[${log.plugin}]`)} ${log.message}`,
        })),
      ...logs.checkers
        .filter((log) => log.type === 'checker:log')
        .map((log) => ({
          key: [log.type.split(':')[0], log.checker, log.message],
          label: `${yellow(`[${log.checker}]`)} ${log.message}`,
        })),
    ],
    (item) => item.key
  );

  return formatCountedItems(messages);
}

function formatErrors(logs: ReturnType<typeof prepareSummaryLogs>): Array<string> {
  const errors = countItems<TypeItem>(
    [
      ...logs.generator
        .filter((log) => log.type === 'phase:error' || log.type === 'finish:error' || log.type === 'watch:error')
        .map((log) => ({
          details: Object.hasOwn(log, 'error') ? formatError(log.error, true).split('\n') : [],
          key: [
            'generator',
            log.message,
            formatError(Object.hasOwn(log, 'error') ? log.error : '', true),
            log.type === 'phase:error' ? log.phase : log.type.split(':')[0],
          ],
          label: `${blue(`[${log.type === 'phase:error' ? log.phase : log.type.split(':')[0]}]`)} ${log.message[0]?.toLowerCase()}${log.message.slice(1)}`,
        })),
      ...logs.plugins
        .filter((log) => log.type === 'plugin:error')
        .map((log) => ({
          details: formatError(log.error, true).split('\n'),
          key: [log.type.split(':')[0], log.message, formatError(log.error, true), log.plugin],
          label: `${yellow(`[${log.plugin}]`)} ${log.message}`,
        })),
      ...logs.checkers
        .filter((log) => log.type === 'checker:error')
        .map((log) => ({
          details: formatError(log.error, true).split('\n'),
          key: [log.type.split(':')[0], log.message, formatError(log.error, true), log.checker],
          label: `${yellow(`[${log.checker}]`)} ${log.message}`,
        })),
    ],
    (item) => item.key
  );

  return formatCountedItems(errors);
}

function formatFinished(logs: ReturnType<typeof prepareSummaryLogs>['generator']): Array<string> {
  const finishedLog = logs.find((log) => log.type === 'generation:end');

  return !finishedLog ? [] : [`finished in ${yellow(finishedLog.duration)}`];
}

export function consoleMinimal(logs: TypeLogs, noStdout?: boolean) {
  const logsToPrint = prepareSummaryLogs(logs);
  const lines = [
    ...formatFiles(logsToPrint.generator),
    ...formatLogs(logsToPrint),
    ...formatErrors(logsToPrint),
    ...formatFinished(logsToPrint.generator),
  ];

  const result = prefixLines(lines);

  if (!noStdout) console.log(result);

  return result;
}
