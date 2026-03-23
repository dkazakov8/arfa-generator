import type { TypeCheckerCheckArgs } from './types';

export abstract class BaseChecker {
  abstract name: string;

  /**
   * Runs the check. Logs are written via the provided `checkerLog` callback.
   * This method must be implemented by all subclasses.
   */
  abstract check(args: TypeCheckerCheckArgs): Promise<void> | void;
}
