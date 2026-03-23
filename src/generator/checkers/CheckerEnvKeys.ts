import { BaseChecker } from '../BaseChecker';
import type { TypeCheckerCheckArgs } from '../types';

export type TypeConfig = { envKeys: Array<{ name: string; keys: Array<string> }> };

export class CheckerEnvKeys extends BaseChecker {
  readonly name = 'env-keys';
  private config: TypeConfig;

  constructor(config: TypeConfig) {
    super();

    this.config = config;
  }

  check({ checkerError }: TypeCheckerCheckArgs): void {
    const { envKeys } = this.config;

    for (const { keys, name } of envKeys) {
      const duplicates = [...new Set(keys.filter((key, index) => keys.indexOf(key) !== index))];

      if (duplicates.length) {
        checkerError({ message: 'Duplicate keys', error: `${name}: ${duplicates.join(', ')}` });
      }
    }

    for (let firstIndex = 0; firstIndex < envKeys.length; firstIndex++) {
      for (let secondIndex = firstIndex + 1; secondIndex < envKeys.length; secondIndex++) {
        const { keys: firstKeys, name: firstName } = envKeys[firstIndex];
        const { keys: secondKeys, name: secondName } = envKeys[secondIndex];

        const firstKeysSet = new Set(firstKeys);
        const secondKeysSet = new Set(secondKeys);

        const diff = {
          extra: new Set([...firstKeysSet].filter((key) => !secondKeysSet.has(key))),
          missing: new Set([...secondKeysSet].filter((key) => !firstKeysSet.has(key))),
        };

        if (diff.missing.size || diff.extra.size) {
          const diffMessages = [
            diff.missing.size ? `${firstName} missing ${[...diff.missing].join(', ')}` : '',
            diff.extra.size ? `${secondName} missing ${[...diff.extra].join(', ')}` : '',
          ].filter(Boolean);

          checkerError({
            message: 'Keys mismatch',
            error: `${firstName} vs ${secondName}: ${diffMessages.join('; ')}`,
          });
        }
      }
    }
  }
}
