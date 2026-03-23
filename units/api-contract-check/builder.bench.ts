import fs from 'node:fs';
import path from 'node:path';

import { createValidators } from '../../src/api-contract-check/builder';
import { check } from '../../src/api-contract-check/checker';
import { getTestTmpDir, prepare } from './helpers';

type TypeBenchmark = {
  group: string;
  iterations: number;
  warmupIterations: number;
  run: () => void;
};

function runBenchmark({ iterations, warmupIterations, run, group }: TypeBenchmark) {
  for (let index = 0; index < warmupIterations; index += 1) run();

  const startedAt = performance.now();

  for (let index = 0; index < iterations; index += 1) run();

  const mean = (performance.now() - startedAt) / iterations;

  console.log(`${group}: \x1b[33m${mean.toFixed(5)} ms\x1b[0m (${iterations} iterations)`);
}

const tmpDir = getTestTmpDir(path.resolve(process.cwd(), 'units/api-contract-check'));
const tsconfigPath = path.resolve(`${tmpDir}/tsconfig.json`);
const positiveApiFilePath = path.resolve(`${tmpDir}/positiveApi.ts`);

const tsconfigContent = `{
  "compilerOptions": {}
}
`;

const positiveContent = `
export enum NumberState {
  Draft = 1,
  Published,
  Archived = 7,
}

export enum StringState {
  Ready = 'READY',
  Waiting = 'WAITING',
}

export enum QuoteState {
  Owner = "O'Hara",
}

export type AliasId = number;

export type Variant = { kind: 'named'; title: string } | { kind: 'sized'; size: AliasId };

export type Pair = object & {
  left: string;
  right?: AliasId;
};

export interface ILeaf {
  exact: 'leaf';
  escapedLiteral: "can't";
  count: number;
  raw: any;
  metaObject: object;
  active?: boolean;
  enumState: NumberState;
  enumMember: StringState.Ready;
  escapedEnum: QuoteState.Owner;
  maybe: number | null;
  tags: string[];
  labels: Array<'x' | 'y'>;
  choice: string | number;
  mixed: Variant | boolean;
  pair: Pair;
  inline: {
    note: string;
    marker?: 'hot';
  };
}

export type AliasLeaf = ILeaf;

export interface ILevel4 {
  id: AliasId;
  mode: StringState;
  details: AliasLeaf;
}

export interface ILevel3 {
  title: string;
  variants: Array<Variant>;
  groups: Array<{
    name: string;
    level4Items: Array<{
      code: string;
      detail: {
        note: string;
      };
    }>;
  }>;
  level4: ILevel4;
}

export type Level2 = {
  flag: boolean;
  state: NumberState;
  literalCombo: 'open' | 3;
  nullable: null;
  level3: ILevel3;
};

export type DeepPayload = {
  requestId: string;
  objectHint: object;
  context: {
    channel: StringState;
    batch: Array<AliasId>;
    level2: Level2;
  };
};


type TypeRequest = DeepPayload;

type TypeResponse = DeepPayload;
`;

function createPositiveApiMultiFileFixture(fileCount: number) {
  const barrelCount = fileCount - 12;
  const rootDir = '/virtual/multi-file';
  const contractFilePath = `${rootDir}/contract.ts`;
  const files: Array<readonly [string, string]> = [];

  for (let index = 0; index < barrelCount; index += 1) {
    const currentFilePath = `${rootDir}/deepPayload-barrel-${index}.ts`;
    const nextTarget = index === barrelCount - 1 ? './deepPayload' : `./deepPayload-barrel-${index + 1}`;

    files.push([
      currentFilePath,
      `export type { DeepPayload } from "${nextTarget}";
`,
    ]);
  }

  files.push(
    [
      `${rootDir}/numberState.ts`,
      `export enum NumberState {
  Draft = 1,
  Published,
  Archived = 7,
}
`,
    ],
    [
      `${rootDir}/stringState.ts`,
      `export enum StringState {
  Ready = "READY",
  Waiting = "WAITING",
}
`,
    ],
    [
      `${rootDir}/quoteState.ts`,
      `export enum QuoteState {
  Owner = "O'Hara",
}
`,
    ],
    [
      `${rootDir}/aliasId.ts`,
      `export type AliasId = number;
`,
    ],
    [
      `${rootDir}/variant.ts`,
      `import type { AliasId } from "./aliasId";

export type Variant =
  | { kind: "named"; title: string }
  | { kind: "sized"; size: AliasId };
`,
    ],
    [
      `${rootDir}/pair.ts`,
      `import type { AliasId } from "./aliasId";

export type Pair = object & {
  left: string;
  right?: AliasId;
};
`,
    ],
    [
      `${rootDir}/leaf.ts`,
      `import type { NumberState } from "./numberState";
import type { Pair } from "./pair";
import type { QuoteState } from "./quoteState";
import type { StringState } from "./stringState";
import type { Variant } from "./variant";

export interface ILeaf {
  exact: "leaf";
  escapedLiteral: "can't";
  count: number;
  raw: any;
  metaObject: object;
  active?: boolean;
  enumState: NumberState;
  enumMember: StringState.Ready;
  escapedEnum: QuoteState.Owner;
  maybe: number | null;
  tags: string[];
  labels: Array<"x" | "y">;
  choice: string | number;
  mixed: Variant | boolean;
  pair: Pair;
  inline: {
    note: string;
    marker?: "hot";
  };
}

export type AliasLeaf = ILeaf;
`,
    ],
    [
      `${rootDir}/level4.ts`,
      `import type { AliasId } from "./aliasId";
import type { AliasLeaf } from "./leaf";
import type { StringState } from "./stringState";

export interface ILevel4 {
  id: AliasId;
  mode: StringState;
  details: AliasLeaf;
}
`,
    ],
    [
      `${rootDir}/level3.ts`,
      `import type { ILevel4 } from "./level4";
import type { Variant } from "./variant";

export interface ILevel3 {
  title: string;
  variants: Array<Variant>;
  groups: Array<{
    name: string;
    level4Items: Array<{
      code: string;
      detail: {
        note: string;
      };
    }>;
  }>;
  level4: ILevel4;
}
`,
    ],
    [
      `${rootDir}/level2.ts`,
      `import type { ILevel3 } from "./level3";
import type { NumberState } from "./numberState";

export type Level2 = {
  flag: boolean;
  state: NumberState;
  literalCombo: "open" | 3;
  nullable: null;
  level3: ILevel3;
};
`,
    ],
    [
      `${rootDir}/deepPayload.ts`,
      `import type { AliasId } from "./aliasId";
import type { Level2 } from "./level2";
import type { StringState } from "./stringState";

export type DeepPayload = {
  requestId: string;
  objectHint: object;
  context: {
    channel: StringState;
    batch: Array<AliasId>;
    level2: Level2;
  };
};
`,
    ],
    [
      contractFilePath,
      `import type { DeepPayload } from "./deepPayload-barrel-0";

type TypeRequest = DeepPayload;
type TypeResponse = DeepPayload;
`,
    ]
  );

  const memory = Object.fromEntries(files) as Record<string, string>;

  return {
    input: [contractFilePath],
    memory,
  };
}

fs.mkdirSync(tmpDir, { recursive: true });
fs.writeFileSync(tsconfigPath, tsconfigContent);

const memory: Record<string, string> = {
  [positiveApiFilePath]: positiveContent,
};

const options = prepare('memory', memory, tsconfigPath);
const positiveApiFixture100Files = createPositiveApiMultiFileFixture(100);
const positiveApiFixture100FilesOptions = prepare('memory', positiveApiFixture100Files.memory, tsconfigPath);

const positivePayload = {
  requestId: 'req-1',
  objectHint: { free: 'shape' },
  context: {
    channel: 'READY',
    batch: [1, 2, 3],
    level2: {
      flag: true,
      state: 2,
      literalCombo: 'open',
      nullable: null,
      level3: {
        title: 'third',
        variants: [
          { kind: 'named', title: 'alpha' },
          { kind: 'sized', size: 9 },
        ],
        groups: [
          {
            name: 'group-a',
            level4Items: [
              { code: 'item-a1', detail: { note: 'first' } },
              { code: 'item-a2', detail: { note: 'second' } },
            ],
          },
          {
            name: 'group-b',
            level4Items: [{ code: 'item-b1', detail: { note: 'third' } }],
          },
        ],
        level4: {
          id: 42,
          mode: 'WAITING',
          details: {
            exact: 'leaf',
            escapedLiteral: "can't",
            count: 5,
            raw: { passthrough: true },
            metaObject: { nested: 'ok' },
            active: true,
            enumState: 7,
            enumMember: 'READY',
            escapedEnum: "O'Hara",
            maybe: null,
            tags: ['a', 'b'],
            labels: ['x', 'y'],
            choice: 'selected',
            mixed: { kind: 'named', title: 'embedded' },
            pair: { left: 'left-value', right: 11 },
            inline: { note: 'hello', marker: 'hot' },
          },
        },
      },
    },
  },
};

const {
  result: [{ schema }],
} = createValidators([positiveApiFilePath], options);

[
  {
    group: 'builder > single-file fixture',
    iterations: 1000,
    warmupIterations: 1,
    run: () => createValidators([positiveApiFilePath], options),
  },
  {
    group: 'builder > 100-files fixture',
    iterations: 1000,
    warmupIterations: 1,
    run: () => createValidators(positiveApiFixture100Files.input, positiveApiFixture100FilesOptions),
  },
  {
    group: 'checker > valid payload',
    iterations: 1000,
    warmupIterations: 1,
    run: () => check({ schema, type: 'request', value: structuredClone(positivePayload) }),
  },
  {
    group: 'checker > valid payload with extraneous',
    iterations: 1000,
    warmupIterations: 1,
    run: () => {
      const payload: any = structuredClone(positivePayload);
      payload.extra1 = 'x';
      payload.context.extra2 = 'y';
      payload.context.level2.level3.level4.details.extra3 = 'z';
      check({ schema, type: 'request', value: payload });
    },
  },
].forEach(runBenchmark);
