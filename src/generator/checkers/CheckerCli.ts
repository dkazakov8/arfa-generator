import { spawnSync } from 'node:child_process';

import { BaseChecker } from '../BaseChecker';
import type { TypeCheckerCheckArgs } from '../types';

export type TypeConfig = {
  name: string;
  getCommand: (
    args: Pick<TypeCheckerCheckArgs, 'changedFiles' | 'deletedFiles' | 'isFullGeneration'>
  ) => false | Array<string>;
};

export class CheckerCli extends BaseChecker {
  readonly name: string;
  private config: TypeConfig;

  constructor(config: TypeConfig) {
    super();

    this.config = config;
    this.name = config.name;
  }

  check({ rootDir, changedFiles, deletedFiles, isFullGeneration, checkerError }: TypeCheckerCheckArgs): void {
    const command = this.config.getCommand({ changedFiles, deletedFiles, isFullGeneration });

    if (command === false) return;

    const [executable, ...args] = command;
    const result = spawnSync(executable, args, {
      cwd: rootDir,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 10,
    });

    if (result.status === 0) return;

    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    const status = result.status === null ? 'unknown' : String(result.status);
    const signal = result.signal ? `, signal ${result.signal}` : '';
    const error = result.error ? `\n${result.error.message}` : '';

    checkerError({
      message: 'CLI violation found',
      error: new Error(
        `Command failed with exit ${status}${signal}: ${command.map((part) => this.formatCommandPart(part)).join(' ')}\n${output || 'No output.'}${error}`
      ),
    });
  }
  // Make the failed command readable and shell-copyable in logs:
  // --fix -> --fix
  // value with space -> 'value with space'
  // value with quote -> 'value'\''with quote'
  private formatCommandPart(part: string): string {
    if (part === '') return "''";

    if (/^[\w/:=.,@%+-]+$/.test(part)) return part;

    return `'${part.replace(/'/g, "'\\''")}'`;
  }
}
