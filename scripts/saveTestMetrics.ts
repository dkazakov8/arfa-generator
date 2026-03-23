import fs from 'node:fs';
import path from 'node:path';

import { saveMetrics } from './saveMetrics';

type TypeCounter = { found: number; hit: number };

type TypeCoverageTotals = { branches: TypeCounter; functions: TypeCounter; lines: TypeCounter };

const rootDir = process.cwd();
const lcovPath = path.resolve(rootDir, 'test-results/coverage/lcov.info');
const junitPath = path.resolve(rootDir, 'test-results/junit.xml');

function addLcovValue(totals: TypeCoverageTotals, key: string, value: number): void {
  if (key === 'LF') totals.lines.found += value;
  else if (key === 'LH') totals.lines.hit += value;
  else if (key === 'FNF') totals.functions.found += value;
  else if (key === 'FNH') totals.functions.hit += value;
  else if (key === 'BRF') totals.branches.found += value;
  else if (key === 'BRH') totals.branches.hit += value;
}

function parseLcov(content: string): TypeCoverageTotals {
  const totals: TypeCoverageTotals = {
    branches: { found: 0, hit: 0 },
    functions: { found: 0, hit: 0 },
    lines: { found: 0, hit: 0 },
  };

  for (const line of content.split(/\r?\n/)) {
    const match = /^(LF|LH|FNF|FNH|BRF|BRH):(\d+)$/.exec(line);

    if (match) addLcovValue(totals, match[1], Number(match[2]));
  }

  if (totals.lines.found === 0) throw new Error(`LCOV report contains no executable lines: ${lcovPath}`);

  return totals;
}

function getPercent({ found, hit }: TypeCounter): number {
  return found === 0 ? 100 : (hit / found) * 100;
}

function getCoverage(totals: TypeCoverageTotals): string {
  const lines = getPercent(totals.lines);
  const functions = getPercent(totals.functions);
  const branches = getPercent(totals.branches);
  const average = (lines + lines + functions + branches) / 4;

  return `${average.toFixed(2)} %`;
}

function getTestCount(content: string): number {
  const match = /<testsuites\b[^>]*\btests="(\d+)"/.exec(content);

  if (!match) throw new Error(`JUnit report contains no test count: ${junitPath}`);

  return Number(match[1]);
}

saveMetrics({ key: 'coverage', value: getCoverage(parseLcov(fs.readFileSync(lcovPath, 'utf-8'))) });

saveMetrics({ key: 'units', value: getTestCount(fs.readFileSync(junitPath, 'utf-8')) });
