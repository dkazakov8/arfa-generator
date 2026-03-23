import { describe, expect, it } from 'bun:test';

import { CheckerEnvKeys, type CheckerEnvKeysConfig, type TypeCheckerCheckArgs } from '../../src/generator';
import { rootDir } from './helpers';

type TestCheckerError = Parameters<TypeCheckerCheckArgs['checkerError']>[0];

describe('CheckerEnvKeys', () => {
  const cases: Array<[string, CheckerEnvKeysConfig['envKeys'], Array<TestCheckerError>]> = [
    [
      'does not report equal env keys',
      [
        { name: '.env', keys: ['API_URL', 'TOKEN'] },
        { name: '.env.example', keys: ['API_URL', 'TOKEN'] },
      ],
      [],
    ],
    [
      'reports different env keys',
      [
        { name: '.env', keys: ['API_URL', 'TOKEN'] },
        { name: '.env.example', keys: ['API_URL', 'SECRET'] },
      ],
      [
        {
          message: 'Keys mismatch',
          error: '.env vs .env.example: .env missing SECRET; .env.example missing TOKEN',
        },
      ],
    ],
    [
      'reports missing env keys without extra env keys',
      [
        { name: '.env', keys: ['API_URL'] },
        { name: '.env.example', keys: ['API_URL', 'TOKEN'] },
      ],
      [{ message: 'Keys mismatch', error: '.env vs .env.example: .env missing TOKEN' }],
    ],
    [
      'reports extra env keys without missing env keys',
      [
        { name: '.env', keys: ['API_URL', 'TOKEN'] },
        { name: '.env.example', keys: ['API_URL'] },
      ],
      [{ message: 'Keys mismatch', error: '.env vs .env.example: .env.example missing TOKEN' }],
    ],
    [
      'reports duplicate env keys',
      [{ name: '.env', keys: ['API_URL', 'TOKEN', 'TOKEN', 'API_URL'] }],
      [{ message: 'Duplicate keys', error: '.env: TOKEN, API_URL' }],
    ],
    ['does not report empty env keys', [], []],
    [
      'does not repeat duplicate keys in mismatches',
      [
        { name: '.env', keys: ['API_URL', 'TOKEN', 'TOKEN'] },
        { name: '.env.example', keys: ['API_URL', 'SECRET'] },
      ],
      [
        { message: 'Duplicate keys', error: '.env: TOKEN' },
        {
          message: 'Keys mismatch',
          error: '.env vs .env.example: .env missing SECRET; .env.example missing TOKEN',
        },
      ],
    ],
    [
      'reports differences between three env key sets',
      [
        { name: '.env', keys: ['API_URL', 'TOKEN'] },
        { name: '.env.development', keys: ['API_URL', 'TOKEN'] },
        { name: '.env.production', keys: ['API_URL', 'SECRET'] },
      ],
      [
        {
          message: 'Keys mismatch',
          error: '.env vs .env.production: .env missing SECRET; .env.production missing TOKEN',
        },
        {
          message: 'Keys mismatch',
          error: '.env.development vs .env.production: .env.development missing SECRET; .env.production missing TOKEN',
        },
      ],
    ],
  ];

  it.each(cases)('%s', (_, envKeys, errors) => {
    const actualErrors: Array<TestCheckerError> = [];

    new CheckerEnvKeys({ envKeys }).check({
      rootDir,
      changedFiles: [],
      deletedFiles: [],
      isFullGeneration: true,
      checkerLog: () => undefined,
      checkerError: (log) => actualErrors.push(log),
    });

    expect(actualErrors).toEqual(errors);
  });
});
