import * as fs from 'node:fs';
import * as path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

export type TypeMetrics = {
  coverage?: string;
  units?: number;
  'size-consumeFeedback'?: string;
  'size-generator/index'?: string;
  'size-api-contract-check/builder'?: string;
  'size-api-contract-check/checker'?: string;
};

const logPrefix = '\x1b[32m[metrics]\x1b[0m';

export function saveMetrics({
  key,
  value,
}: {
  [K in keyof TypeMetrics]-?: { key: K; value: TypeMetrics[K] };
}[keyof TypeMetrics]) {
  const metricsPath = path.resolve(process.cwd(), 'metrics.json');
  const metrics: TypeMetrics = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));

  if (isDeepStrictEqual(metrics[key], value)) {
    console.log(`${logPrefix} ${key}: \x1b[33m${String(value)}\x1b[0m`);
  } else {
    console.log(`${logPrefix} ${key}: \x1b[33m${String(metrics[key])}\x1b[0m -> \x1b[33m${String(value)}\x1b[0m`);

    (metrics as any)[key] = value;

    fs.writeFileSync(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`, 'utf-8');
  }
}
