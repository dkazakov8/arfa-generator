import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import { createValidators } from '../../src/api-contract-check/builder';
import { check } from '../../src/api-contract-check/checker';
import type { TypeRootSchema, TypeSchema } from '../../src/api-contract-check/types';
import { cases, getTestTmpDir, prepare } from './helpers';

const tmpDir = getTestTmpDir(path.resolve(process.cwd(), 'units/api-contract-check'));
const tsconfigFilePath = path.resolve(`${tmpDir}/tsconfig.json`);

const tsconfigContent = `{ "compilerOptions": {} }`;

beforeEach(() => {
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(tsconfigFilePath, tsconfigContent);
});

afterEach(() => {
  fs.rmSync(tmpDir, { force: true, recursive: true });
});

const positiveContent = `
// #region positiveContent
enum TypeStatus { Draft = 1, Published, Archived = 7 }
enum TypeChannel { Ready = 'READY', Waiting = 'WAITING' }
enum TypeOwner { Owner = "O'Hara" }

type TypeId = number;
type TypePair = object & { left: string; right?: TypeId }
type TypeTuple = [string, TypeId];
type TypeScores = Record<string, TypeId>;
type TypeVariant = { kind: 'named'; title: string } | { kind: 'sized'; size: TypeId };;
type TypeTreeNode = { name: string; children: Array<TypeTreeNode> };

interface TypeBaseDetails { base: string }
interface TypeInheritedDetails extends TypeBaseDetails { own: TypeId }

type TypeDetails = {
  raw: any;
  tags: Array<string>;
  pair: TypePair;
  exact: 'leaf';
  count: number;
  maybe: number | null;
  mixed: TypeVariant | boolean;
  tuple: TypeTuple;
  labels: Array<'x' | 'y'>;
  choice: string | number;
  record: TypeScores;
  inline: { note: string; marker?: 'hot' };
  active?: boolean;
  enumState: TypeStatus;
  inherited: TypeInheritedDetails;
  recursive: TypeTreeNode;
  metaObject: object;
  enumMember: TypeChannel.Ready;
  escapedEnum: TypeOwner.Owner;
  escapedLiteral: "can't";
};

type TypeDetailsAlias = TypeDetails;
type TypeItem = { 
  id: TypeId; 
  mode: TypeChannel; 
  details: TypeDetailsAlias 
};

type TypeCollection = {
  title: string;
  level4: TypeItem;
  variants: Array<TypeVariant>;
  groups: Array<{
    name: string;
    level4Items: Array<{ code: string; detail: { note: string } }>;
  }>;
};

type TypeData = {
  flag: boolean;
  state: TypeStatus;
  level3: TypeCollection;
  nullable: null;
  literalCombo: 'open' | 3;
};

type TypePayload = {
  requestId: string;
  objectHint: object;
  context: { 
    channel: TypeChannel; 
    batch: Array<TypeId>; 
    level2: TypeData 
  };
};

type TypeRequest = TypePayload;
type TypeResponse = TypePayload;
// #endregion positiveContent
`;

// #region positiveSchema
const positiveRequestSchema = {
  requestId: 'string',
  objectHint: 'object',
  context: {
    channel: ['union', ['literal', 'READY'], ['literal', 'WAITING']],
    batch: ['array', 'number'],
    level2: {
      flag: 'boolean',
      state: ['union', ['literal', 1], ['literal', 2], ['literal', 7]],
      literalCombo: ['union', ['literal', 'open'], ['literal', 3]],
      nullable: ['literal', null],
      level3: {
        title: 'string',
        variants: [
          'array',
          ['union', { kind: ['literal', 'named'], title: 'string' }, { kind: ['literal', 'sized'], size: 'number' }],
        ],
        groups: [
          'array',
          {
            name: 'string',
            level4Items: ['array', { code: 'string', detail: { note: 'string' } }],
          },
        ],
        level4: {
          id: 'number',
          mode: ['union', ['literal', 'READY'], ['literal', 'WAITING']],
          details: {
            exact: ['literal', 'leaf'],
            escapedLiteral: ['literal', "can't"],
            count: 'number',
            raw: 'any',
            metaObject: 'object',
            active: ['optional', 'boolean'],
            enumState: ['union', ['literal', 1], ['literal', 2], ['literal', 7]],
            enumMember: ['literal', 'READY'],
            escapedEnum: ['literal', "O'Hara"],
            maybe: ['union', 'number', ['literal', null]],
            tags: ['array', 'string'],
            labels: ['array', ['union', ['literal', 'x'], ['literal', 'y']]],
            choice: ['union', 'string', 'number'],
            mixed: [
              'union',
              { kind: ['literal', 'named'], title: 'string' },
              { kind: ['literal', 'sized'], size: 'number' },
              'boolean',
            ],
            pair: { left: 'string', right: ['optional', 'number'] },
            record: ['record', 'number'],
            tuple: ['tuple', 'string', 'number'],
            inherited: { base: 'string', own: 'number' },
            inline: { note: 'string', marker: ['optional', ['literal', 'hot']] },
            recursive: ['recursiveArray', { name: 'string', children: ['array', ['self']] }],
          },
        },
      },
    },
  },
} satisfies TypeSchema;

const positiveSchema = {
  request: positiveRequestSchema,
  response: positiveRequestSchema, // same as request
} satisfies TypeRootSchema;
// #endregion positiveSchema

describe.each(cases)('Integration flow (%s)', (mode) => {
  it('validates generic substitutions inside unions and intersections', () => {
    const filePath = path.resolve(`${tmpDir}/genericCombinations.ts`);
    const memory: Record<string, string> = {
      [filePath]: `
        type TypeItem = boolean;
        type TypeChoice<TypeItem> = TypeItem | null;
        type TypePayload<TValue> = { value: TValue } & { id: string };
        type TypeRequest = TypePayload<number>;
        type TypeResponse = TypeChoice<string>;
      `,
    };
    const getDegraded = mock();
    const options = prepare(mode, memory, tsconfigFilePath);
    const {
      result: [{ schema }],
    } = createValidators([filePath], { ...options, getDegraded });

    expect(getDegraded).not.toBeCalled();
    expect(check({ schema, type: 'request', value: { id: 'item', value: 42 } })).toBeNull();
    expect(check({ schema, type: 'request', value: { id: 'item', value: 'wrong' } })).toEqual([
      'request.value is not a number',
    ]);
    expect(check({ schema, type: 'response', value: 'text' })).toBeNull();
    expect(check({ schema, type: 'response', value: null })).toBeNull();
    expect(check({ schema, type: 'response', value: true })).toEqual(['response is none of string, null']);
  });

  it('validates and cleans recursive union arrays in an intersection', () => {
    const filePath = path.resolve(`${tmpDir}/recursiveUnionIntersection.ts`);
    const memory: Record<string, string> = {
      [filePath]: `
        type TypeNode = { id: string } & { children: Array<TypeNode | string> };
        type TypeRequest = TypeNode;
        type TypeResponse = TypeNode;
      `,
    };
    const getDegraded = mock();
    const options = prepare(mode, memory, tsconfigFilePath);
    const {
      result: [{ schema }],
    } = createValidators([filePath], { ...options, getDegraded });

    expect(getDegraded).not.toBeCalled();

    for (const type of ['request', 'response'] as const) {
      const value = {
        id: 'root',
        extra: true,
        children: ['label', { id: 'branch', extra: true, children: [{ id: 'leaf', children: [] }] }],
      };
      const getExtraneous = mock();

      expect(check({ schema, type, value, getExtraneous })).toBeNull();
      expect(value).toEqual({
        id: 'root',
        children: ['label', { id: 'branch', children: [{ id: 'leaf', children: [] }] }],
      } as any);
      expect(getExtraneous).toBeCalledWith([`${type}.children[].extra`, `${type}.extra`]);

      for (const child of [42, { id: 7, children: [] }, { id: 'branch', children: [false] }]) {
        expect(check({ schema, type, value: { id: 'root', children: [child] } })).toEqual([
          `${type}.children[] is none of string, 1 more`,
        ]);
      }
    }
  });

  it('Positive: builds validators, clears extraneous and checks without errors', () => {
    const positiveApiFilePath = path.resolve(`${tmpDir}/positiveApi.ts`);

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
                record: { first: 1, second: 2 },
                tuple: ['tuple-left', 12],
                inherited: { base: 'base-value', own: 13 },
                inline: { note: 'hello', marker: 'hot' },
                recursive: {
                  name: 'root',
                  children: [
                    {
                      name: 'branch',
                      children: [
                        {
                          name: 'leaf',
                          children: [],
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    };

    const memory: Record<string, string> = {
      [positiveApiFilePath]: positiveContent,
    };

    const options = prepare(mode, memory, tsconfigFilePath);

    if (mode === 'disk') {
      fs.writeFileSync(positiveApiFilePath, positiveContent);
    }

    const { result } = createValidators([positiveApiFilePath], options);

    const [{ filePath, schema }] = result;

    expect(result).toHaveLength(1);
    expect(filePath).toBe(positiveApiFilePath);
    expect(schema).toEqual(positiveSchema);

    expect(check({ schema, type: 'request', value: positivePayload })).toBeNull();
    expect(check({ schema, type: 'response', value: positivePayload })).toBeNull();

    for (const type of ['request', 'response'] as const) {
      const bloatedPayload: any = structuredClone(positivePayload);

      bloatedPayload.rootExtra = 'root';
      bloatedPayload.context.contextExtra = 'context';
      bloatedPayload.context.level2.level2Extra = 'level2';
      bloatedPayload.context.level2.level3.level3Extra = 'level3';
      bloatedPayload.context.level2.level3.level4.level4Extra = 'level4';
      bloatedPayload.context.level2.level3.level4.details.leafExtra = 'leaf';
      bloatedPayload.context.level2.level3.level4.details.pair.pairExtra = 'pair';
      bloatedPayload.context.level2.level3.level4.details.inherited.inheritedExtra = 'inherited';
      bloatedPayload.context.level2.level3.level4.details.inline.inlineExtra = 'inline';
      bloatedPayload.context.level2.level3.level4.details.recursive.recursiveExtra = 'recursive';
      bloatedPayload.context.level2.level3.level4.details.recursive.children[0].branchExtra = 'branch';
      bloatedPayload.context.level2.level3.level4.details.recursive.children[0].children[0].leafExtra =
        'recursive-leaf';
      bloatedPayload.context.level2.level3.groups[0].groupExtra = 'group';
      bloatedPayload.context.level2.level3.groups[0].level4Items[0].itemExtra = 'item';
      bloatedPayload.context.level2.level3.groups[0].level4Items[0].detail.detailExtra = 'detail';
      bloatedPayload.context.level2.level3.groups[0].level4Items[1].itemExtra = 'item-2';
      bloatedPayload.context.level2.level3.groups[0].level4Items[1].detail.detailExtra = 'detail-2';
      bloatedPayload.context.level2.level3.groups[1].groupExtra = 'group-2';
      bloatedPayload.context.level2.level3.groups[1].level4Items[0].itemExtra = 'item-3';
      bloatedPayload.context.level2.level3.groups[1].level4Items[0].detail.detailExtra = 'detail-3';

      const getExtraneous = mock();

      expect(check({ schema, type, getExtraneous, value: bloatedPayload })).toBeNull();

      // all extraneous fields should be removed
      expect(bloatedPayload).toEqual(positivePayload);

      // and logged
      expect(getExtraneous).toBeCalledWith([
        `${type}.context.level2.level3.level4.details.pair.pairExtra`,
        `${type}.context.level2.level3.level4.details.inline.inlineExtra`,
        `${type}.context.level2.level3.level4.details.inherited.inheritedExtra`,
        `${type}.context.level2.level3.level4.details.recursive.children[].children[].leafExtra`,
        `${type}.context.level2.level3.level4.details.recursive.children[].branchExtra`,
        `${type}.context.level2.level3.level4.details.recursive.recursiveExtra`,
        `${type}.context.level2.level3.level4.details.leafExtra`,
        `${type}.context.level2.level3.level4.level4Extra`,
        `${type}.context.level2.level3.groups[].level4Items[].detail.detailExtra`,
        `${type}.context.level2.level3.groups[].level4Items[].itemExtra`,
        `${type}.context.level2.level3.groups[].groupExtra`,
        `${type}.context.level2.level3.level3Extra`,
        `${type}.context.level2.level2Extra`,
        `${type}.context.contextExtra`,
        `${type}.rootExtra`,
      ]);
    }
  });

  it('Negative: builds validators, clears extraneous and shows errors', () => {
    const positiveApiFilePath = path.resolve(`${tmpDir}/positiveApi.ts`);

    const negativePayload = {
      requestId: 1,
      objectHint: null,
      context: {
        channel: 'LATER',
        batch: ['bad'],
        level2: {
          flag: 'true',
          state: 99,
          literalCombo: false,
          nullable: 'null',
          level3: {
            title: 123,
            variants: [
              { kind: 'named', title: 1 },
              { kind: 'sized', size: 'large' },
            ],
            groups: [
              {
                name: 1,
                level4Items: [
                  { code: 2, detail: { note: 3 } },
                  { code: false, detail: { note: null } },
                ],
              },
              { name: null, level4Items: [{ code: {}, detail: { note: [] } }] },
            ],
            level4: {
              id: '42',
              mode: 'LATER',
              details: {
                exact: 'branch',
                escapedLiteral: 'cant',
                count: '5',
                raw: { still: 'valid' },
                metaObject: null,
                active: 'yes',
                enumState: 10,
                enumMember: 'WAITING',
                escapedEnum: "O'Henry",
                maybe: 'none',
                tags: [1],
                labels: ['z'],
                choice: false,
                mixed: { kind: 'sized', size: 'bad' },
                pair: { left: 1, right: 'bad' },
                record: { first: 'bad' },
                tuple: [1, 'bad'],
                inherited: { base: 1, own: 'bad' },
                inline: { note: 1, marker: 'cold' },
                recursive: {
                  name: 'root',
                  children: [
                    {
                      name: 'branch',
                      children: [
                        {
                          name: 123,
                          children: [],
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    };

    const recursiveNegativePayload = {
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
                record: { first: 1, second: 2 },
                tuple: ['tuple-left', 12],
                inherited: { base: 'base-value', own: 13 },
                inline: { note: 'hello', marker: 'hot' },
                recursive: {
                  name: 'root',
                  children: [
                    {
                      name: 'branch',
                      children: [
                        {
                          name: 123,
                          children: [],
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    };

    const missingRequiredPayload = {
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
                record: { first: 1, second: 2 },
                tuple: ['tuple-left', 12],
                inherited: { base: 'base-value', own: 13 },
                inline: { note: 'hello', marker: 'hot' },
                recursive: {
                  name: 'root',
                  children: [
                    {
                      name: 'branch',
                      children: [
                        {
                          name: 'leaf',
                          children: [],
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    };

    const memory: Record<string, string> = {
      [positiveApiFilePath]: positiveContent,
    };

    const options = prepare(mode, memory, tsconfigFilePath);

    if (mode === 'disk') {
      fs.writeFileSync(positiveApiFilePath, positiveContent);
    }

    const { result } = createValidators([positiveApiFilePath], options);

    const [{ schema }] = result;

    for (const type of ['request', 'response'] as const) {
      const bloatedPayload: any = structuredClone(negativePayload);

      bloatedPayload.rootExtra = 'root';
      bloatedPayload.context.contextExtra = 'context';
      bloatedPayload.context.level2.level2Extra = 'level2';
      bloatedPayload.context.level2.level3.level3Extra = 'level3';
      bloatedPayload.context.level2.level3.level4.level4Extra = 'level4';
      bloatedPayload.context.level2.level3.level4.details.leafExtra = 'leaf';
      bloatedPayload.context.level2.level3.level4.details.pair.pairExtra = 'pair';
      bloatedPayload.context.level2.level3.level4.details.inline.inlineExtra = 'inline';
      bloatedPayload.context.level2.level3.level4.details.recursive.recursiveExtra = 'recursive';
      bloatedPayload.context.level2.level3.level4.details.recursive.children[0].branchExtra = 'branch';
      bloatedPayload.context.level2.level3.level4.details.recursive.children[0].children[0].leafExtra =
        'recursive-leaf';
      bloatedPayload.context.level2.level3.groups[0].groupExtra = 'group';
      bloatedPayload.context.level2.level3.groups[0].level4Items[0].itemExtra = 'item';
      bloatedPayload.context.level2.level3.groups[0].level4Items[0].detail.detailExtra = 'detail';
      bloatedPayload.context.level2.level3.groups[0].level4Items[1].itemExtra = 'item-2';
      bloatedPayload.context.level2.level3.groups[0].level4Items[1].detail.detailExtra = 'detail-2';
      bloatedPayload.context.level2.level3.groups[1].groupExtra = 'group-2';
      bloatedPayload.context.level2.level3.groups[1].level4Items[0].itemExtra = 'item-3';
      bloatedPayload.context.level2.level3.groups[1].level4Items[0].detail.detailExtra = 'detail-3';

      const getExtraneous = mock();

      expect(check({ schema, type, value: structuredClone(recursiveNegativePayload) })).toEqual([
        `${type}.context.level2.level3.level4.details.recursive.children[].children[].name is not a string`,
      ]);

      expect(check({ schema, type, value: structuredClone(missingRequiredPayload) })).toEqual([
        `${type}.context.level2.level3.level4.details.count is missing`,
      ]);

      expect(check({ schema, type, getExtraneous, value: bloatedPayload })).toEqual([
        `${type}.requestId is not a string`,
        `${type}.objectHint is not an object`,
        `${type}.context.channel is none of "READY", "WAITING"`,
        `${type}.context.batch[] is not a number`,
        `${type}.context.level2.flag is not a boolean`,
        `${type}.context.level2.state is none of 1, 2, 7`,
        `${type}.context.level2.level3.title is not a string`,
        `${type}.context.level2.level3.level4.id is not a number`,
        `${type}.context.level2.level3.level4.mode is none of "READY", "WAITING"`,
        `${type}.context.level2.level3.level4.details.tags[] is not a string`,
        `${type}.context.level2.level3.level4.details.pair.left is not a string`,
        `${type}.context.level2.level3.level4.details.pair.right is not a number`,
        `${type}.context.level2.level3.level4.details.exact is not "leaf"`,
        `${type}.context.level2.level3.level4.details.count is not a number`,
        `${type}.context.level2.level3.level4.details.maybe is none of number, null`,
        `${type}.context.level2.level3.level4.details.mixed is none of boolean, 2 more`,
        `${type}.context.level2.level3.level4.details.tuple[0] is not a string`,
        `${type}.context.level2.level3.level4.details.tuple[1] is not a number`,
        `${type}.context.level2.level3.level4.details.labels[] is none of "x", "y"`,
        `${type}.context.level2.level3.level4.details.choice is none of string, number`,
        `${type}.context.level2.level3.level4.details.record.first is not a number`,
        `${type}.context.level2.level3.level4.details.inline.note is not a string`,
        `${type}.context.level2.level3.level4.details.inline.marker is not "hot"`,
        `${type}.context.level2.level3.level4.details.active is not a boolean`,
        `${type}.context.level2.level3.level4.details.enumState is none of 1, 2, 7`,
        `${type}.context.level2.level3.level4.details.inherited.base is not a string`,
        `${type}.context.level2.level3.level4.details.inherited.own is not a number`,
        `${type}.context.level2.level3.level4.details.recursive.children[].children[].name is not a string`,
        `${type}.context.level2.level3.level4.details.metaObject is not an object`,
        `${type}.context.level2.level3.level4.details.enumMember is not "READY"`,
        `${type}.context.level2.level3.level4.details.escapedEnum is not "O'Hara"`,
        `${type}.context.level2.level3.level4.details.escapedLiteral is not "can't"`,
        `${type}.context.level2.level3.variants[] is none of 2 types`,
        `${type}.context.level2.level3.groups[].name is not a string`,
        `${type}.context.level2.level3.groups[].level4Items[].code is not a string`,
        `${type}.context.level2.level3.groups[].level4Items[].detail.note is not a string`,
        `${type}.context.level2.nullable is not null`,
        `${type}.context.level2.literalCombo is none of "open", 3`,
      ]);

      // all extraneous fields should be removed
      expect(bloatedPayload).toEqual(negativePayload);

      // and logged
      expect(getExtraneous).toBeCalledWith([
        `${type}.context.level2.level3.level4.details.pair.pairExtra`,
        `${type}.context.level2.level3.level4.details.inline.inlineExtra`,
        `${type}.context.level2.level3.level4.details.recursive.children[].children[].leafExtra`,
        `${type}.context.level2.level3.level4.details.recursive.children[].branchExtra`,
        `${type}.context.level2.level3.level4.details.recursive.recursiveExtra`,
        `${type}.context.level2.level3.level4.details.leafExtra`,
        `${type}.context.level2.level3.level4.level4Extra`,
        `${type}.context.level2.level3.groups[].level4Items[].detail.detailExtra`,
        `${type}.context.level2.level3.groups[].level4Items[].itemExtra`,
        `${type}.context.level2.level3.groups[].groupExtra`,
        `${type}.context.level2.level3.level3Extra`,
        `${type}.context.level2.level2Extra`,
        `${type}.context.contextExtra`,
        `${type}.rootExtra`,
      ]);
    }
  });

  it('Fallback: unsupported syntax degrades to any and checks without errors', () => {
    const fallbackApiFilePath = path.resolve(`${tmpDir}/fallbackApi.ts`);

    const fallbackContent = `
// #region fallbackContent
type UnsupportedMapped = { [K in 'a' | 'b']: number };
type UnsupportedPromise = Promise<string>;
type UnsupportedFunction = (value: string) => number;
type UnsupportedGenericBox = Set<boolean>;
type UnsupportedConditional = string extends number ? 1 : 2;
type UnsupportedVariadicTuple = [string, ...number[]];

interface UnsupportedMethodObject {
  run(input: string): number;
}

interface UnsupportedIndexObject {
  [key: string]: number;
}

interface UnsupportedPayload {
  fn: UnsupportedFunction;
  mapped: UnsupportedMapped;
  promise: UnsupportedPromise;
  indexed: UnsupportedIndexObject;
  voidValue: void;
  genericBox: UnsupportedGenericBox;
  neverValue: never;
  conditional: UnsupportedConditional;
  symbolValue: symbol;
  unknownValue: unknown;
  variadicTuple: UnsupportedVariadicTuple;
  undefinedValue: undefined;
  methods: UnsupportedMethodObject;
}

type TypeRequest = UnsupportedPayload;
type TypeResponse = UnsupportedPromise;
// #endregion fallbackContent
`;

    // #region fallbackSchema
    const fallbackSchema = {
      request: {
        fn: 'any',
        mapped: 'any',
        promise: 'any',
        indexed: 'any',
        voidValue: 'any',
        genericBox: 'any',
        neverValue: 'any',
        conditional: 'any',
        symbolValue: 'any',
        unknownValue: 'any',
        variadicTuple: 'any',
        undefinedValue: 'any',
        methods: { run: 'any' },
      },
      response: 'any',
    } satisfies TypeRootSchema;
    // #endregion fallbackSchema

    const fallbackPayload = {
      promise: 123,
      genericBox: { boxed: true },
      variadicTuple: null,
      mapped: ['a', 'b'],
      conditional: { branch: 'unknown' },
      fn: 42,
      methods: { run: false },
      indexed: 'accept-anything',
      unknownValue: 'still-any',
      undefinedValue: 99,
      symbolValue: 'symbol-as-string',
      neverValue: null,
      voidValue: { nested: 'object' },
    };

    const memory: Record<string, string> = {
      [fallbackApiFilePath]: fallbackContent,
    };

    const options = prepare(mode, memory, tsconfigFilePath);

    if (mode === 'disk') {
      fs.writeFileSync(fallbackApiFilePath, fallbackContent);
    }

    const getDegraded = mock();
    const { result } = createValidators([fallbackApiFilePath], { ...options, getDegraded });

    const [{ filePath, schema }] = result;

    expect(result).toHaveLength(1);
    expect(filePath).toBe(fallbackApiFilePath);
    expect(schema).toEqual(fallbackSchema);

    expect(check({ schema, type: 'request', value: fallbackPayload })).toBeNull();
    expect(check({ schema, type: 'response', value: 'still-not-a-promise' })).toBeNull();
    expect(getDegraded).toBeCalledWith(
      [
        'promise',
        'genericBox',
        'variadicTuple',
        'mapped',
        'conditional',
        'fn',
        'run',
        'indexed',
        'unknownValue',
        'undefinedValue',
        'symbolValue',
        'neverValue',
        'voidValue',
        'TypeResponse',
      ].sort((a, b) => a.localeCompare(b))
    );
  });
});
