import fs from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import { CheckerCli, type CheckerCliConfig, type TypeCheckerCheckArgs } from '../../src/generator';
import { getPath, rootDir } from './helpers';

type TypeCheckerError = Parameters<TypeCheckerCheckArgs['checkerError']>[0];

const spawnSyncMock = mock();

mock.module('node:child_process', () => ({
  spawnSync: spawnSyncMock,
}));

describe('CheckerCli', () => {
  function getRunErrors(
    checker: CheckerCli,
    changedFiles: TypeCheckerCheckArgs['changedFiles'] = [],
    deletedFiles: TypeCheckerCheckArgs['deletedFiles'] = [],
    isFullGeneration = true
  ): Array<TypeCheckerError> {
    const errors: Array<TypeCheckerError> = [];

    checker.check({
      rootDir,
      changedFiles,
      deletedFiles,
      isFullGeneration,
      checkerLog: () => undefined,
      checkerError: (log) => errors.push(log),
    });

    return errors;
  }

  beforeEach(() => {
    spawnSyncMock.mockReset();

    fs.mkdirSync(rootDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('accepts successful commands', () => {
    spawnSyncMock.mockReturnValue({ status: 0, stdout: '', stderr: '' });

    expect(getRunErrors(new CheckerCli({ name: 'custom-cli', getCommand: () => ['custom-command', '--fix'] }))).toEqual(
      []
    );
  });

  it('skips commands when getCommand returns false', () => {
    const changedFiles = [{ relativePath: 'src/file.ts', absolutePath: getPath('src/file.ts') }];
    const getCommand = mock((_args: Parameters<CheckerCliConfig['getCommand']>[0]) => false as const);

    expect(getRunErrors(new CheckerCli({ name: 'custom-cli', getCommand }), changedFiles)).toEqual([]);
    expect(getCommand).toHaveBeenCalledWith({ changedFiles, deletedFiles: [], isFullGeneration: true });
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });

  it.each([
    { changedFiles: [], deletedFiles: [], isFullGeneration: true },
    { changedFiles: [], deletedFiles: [], isFullGeneration: false },
    {
      changedFiles: [],
      deletedFiles: [{ relativePath: 'src/removed.ts', absolutePath: getPath('src/removed.ts') }],
      isFullGeneration: false,
    },
    {
      changedFiles: [{ relativePath: 'src/changed.ts', absolutePath: getPath('src/changed.ts') }],
      deletedFiles: [{ relativePath: 'src/removed.ts', absolutePath: getPath('src/removed.ts') }],
      isFullGeneration: false,
    },
  ])('passes the complete generation context to getCommand: %j', (context) => {
    spawnSyncMock.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    const getCommand = mock((_args: Parameters<CheckerCliConfig['getCommand']>[0]) => ['custom-command']);

    expect(
      getRunErrors(
        new CheckerCli({ name: 'custom-cli', getCommand }),
        [...context.changedFiles],
        [...context.deletedFiles],
        context.isFullGeneration
      )
    ).toEqual([]);
    expect(getCommand).toHaveBeenCalledWith(context);
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
  });

  it('reports failing command output', () => {
    spawnSyncMock.mockReturnValue({ status: 2, signal: null, stdout: 'stdout text', stderr: 'stderr text' });

    expect(
      getRunErrors(
        new CheckerCli({
          name: 'custom-cli',
          getCommand: () => ['custom-command', '--check'],
        })
      )
    ).toEqual([
      {
        message: 'CLI violation found',
        error: new Error('Command failed with exit 2: custom-command --check\nstdout text\nstderr text'),
      },
    ]);
  });

  it('reports stderr output without extra blank lines', () => {
    spawnSyncMock.mockReturnValue({ status: 1, signal: null, stdout: '', stderr: 'stderr text' });

    expect(getRunErrors(new CheckerCli({ name: 'custom-cli', getCommand: () => ['custom-command'] }))).toEqual([
      {
        message: 'CLI violation found',
        error: new Error('Command failed with exit 1: custom-command\nstderr text'),
      },
    ]);
  });

  it('reports termination signal', () => {
    spawnSyncMock.mockReturnValue({ status: null, signal: 'SIGTERM', stdout: '', stderr: '' });

    expect(getRunErrors(new CheckerCli({ name: 'custom-cli', getCommand: () => ['custom-command'] }))).toEqual([
      {
        message: 'CLI violation found',
        error: new Error('Command failed with exit unknown, signal SIGTERM: custom-command\nNo output.'),
      },
    ]);
  });

  it('runs command from rootDir built from changed files', () => {
    spawnSyncMock.mockReturnValue({ status: 1, stdout: 'command output', stderr: '' });

    const changedFiles = [{ relativePath: 'path with spaces', absolutePath: getPath('path with spaces') }];
    let receivedFiles: TypeCheckerCheckArgs['changedFiles'] | undefined;
    const getCommand: CheckerCliConfig['getCommand'] = ({ changedFiles }) => {
      receivedFiles = changedFiles;

      return ['custom-command', '--config', ...changedFiles.map((file) => file.relativePath)];
    };

    expect(getRunErrors(new CheckerCli({ name: 'custom-cli', getCommand }), changedFiles)).toEqual([
      {
        message: 'CLI violation found',
        error: new Error("Command failed with exit 1: custom-command --config 'path with spaces'\ncommand output"),
      },
    ]);

    expect(spawnSyncMock).toHaveBeenCalledWith('custom-command', ['--config', 'path with spaces'], {
      cwd: rootDir,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 10,
    });
    expect(receivedFiles).toEqual(changedFiles);
  });

  it('reports spawn errors for missing commands', () => {
    spawnSyncMock.mockReturnValue({
      status: null,
      signal: null,
      stdout: '',
      stderr: '',
      error: new Error('spawnSync missing-command ENOENT'),
    });

    expect(getRunErrors(new CheckerCli({ name: 'missing-cli', getCommand: () => ['missing-command'] }))).toEqual([
      {
        message: 'CLI violation found',
        error: new Error(
          'Command failed with exit unknown: missing-command\nNo output.\nspawnSync missing-command ENOENT'
        ),
      },
    ]);
  });

  it('formats command args unambiguously in errors', () => {
    spawnSyncMock.mockReturnValue({ status: 1, stdout: '', stderr: '' });

    expect(
      getRunErrors(
        new CheckerCli({
          name: 'custom-cli',
          getCommand: () => ['custom-command', '', '-e', 'process.exit(1)', 'value with space', "value'with quote"],
        })
      )
    ).toEqual([
      {
        message: 'CLI violation found',
        error: new Error(
          "Command failed with exit 1: custom-command '' -e 'process.exit(1)' 'value with space' 'value'\\''with quote'\nNo output."
        ),
      },
    ]);
  });
});
