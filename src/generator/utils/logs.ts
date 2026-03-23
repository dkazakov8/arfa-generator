import type { TypeLog, TypeLogs } from '../types';

export function isBlockingError(log: TypeLog): boolean {
  return log.type.endsWith(':error') && (log.type !== 'phase:error' || !log.recoverable);
}

export function hasBlockingErrors(logs: TypeLogs): boolean {
  return Object.values(logs).flat().some(isBlockingError);
}
