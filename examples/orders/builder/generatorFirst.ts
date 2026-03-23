import { logsToConsole, type TypeGenerateResult } from '@arfa-tools/generator';
import { build, preview } from 'vite';

import { generator } from './generator.ts';
import { closeReloadConnections, reloadPlugin, sendReloadSignal } from './reloadPlugin.ts';

const isWatch = process.argv.includes('--watch');

async function afterCheckers() {
  await build({
    logLevel: 'warn',
    plugins: isWatch ? [reloadPlugin] : [],
    build: { watch: null, minify: false, cssMinify: false, reportCompressedSize: false },
  });
}

function afterFinish(result: TypeGenerateResult) {
  logsToConsole(result.logs, { verbosity: 'normal' });

  sendReloadSignal();
}

await generator.runFullCycle({ afterCheckers, afterFinish });

if (isWatch) {
  await generator.startWatch({ aggregationTimeout: 50, afterCheckers, afterFinish });

  const server = await preview({
    plugins: [reloadPlugin],
    preview: { host: '0.0.0.0', port: 5174 },
  });

  server.printUrls();

  let isShuttingDown = false;

  async function shutdown(): Promise<void> {
    if (isShuttingDown) return;

    isShuttingDown = true;

    await generator.stopWatch();

    closeReloadConnections();

    server.httpServer.close();
  }

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}
