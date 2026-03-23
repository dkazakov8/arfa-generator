import fs from 'node:fs';
import path from 'node:path';

import type { TypeMetrics } from '../scripts/saveMetrics';

export default {
  load() {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
    const metrics: TypeMetrics = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'metrics.json'), 'utf8'));
    const passedTests = metrics.units || 0;

    const coreSizeNumber = Number(metrics['size-generator/index']?.replace('kb', ''));
    const checkerSizeNumber = Number(metrics['size-api-contract-check/checker']?.replace('kb', ''));
    const builderSizeNumber = Number(metrics['size-api-contract-check/builder']?.replace('kb', ''));

    return {
      version: pkg.version,
      passedTests,
      metrics,
      sizeForLabel: `${coreSizeNumber} KB`,
      checkerSize: `${checkerSizeNumber} KB`,
      builderSize: `${builderSizeNumber} KB`,
    };
  },
};
