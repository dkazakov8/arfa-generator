import { logsToConsole, type TypeGenerateResult } from '@arfa-tools/generator';
import { build, createServer } from 'vite';

import { generator } from './generator.ts';

const isWatch = process.argv.includes('--watch');

function afterFinish(result: TypeGenerateResult) {
  logsToConsole(result.logs, { verbosity: 'normal' });
}

await generator.runFullCycle({ afterFinish });

if (isWatch) {
  await generator.startWatch({ aggregationTimeout: 50, afterFinish });

  const vite = await createServer({ server: { host: '0.0.0.0' } });

  await vite.listen();

  vite.printUrls();

  let isShuttingDown = false;

  async function shutdown(): Promise<void> {
    if (!isShuttingDown) {
      isShuttingDown = true;

      await generator.stopWatch();

      await vite.close();
    }
  }

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
} else {
  await build({ build: { watch: null } });
}
