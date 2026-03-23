import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import { createValidators } from '../../src/api-contract-check/builder';
import { getTestTmpDir, prepare } from './helpers';

const tmpDir = getTestTmpDir(path.resolve(process.cwd(), 'units/api-contract-check'));
const tsconfigPath = path.resolve(`${tmpDir}/tsconfig.json`);

const tsconfigContent = `{ "compilerOptions": {} }`;

beforeEach(() => {
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(tsconfigPath, tsconfigContent);
});

afterEach(() => {
  fs.rmSync(tmpDir, { force: true, recursive: true });
});

describe('Union Generation', () => {
  it('prefers generic substitutions over local declarations and flattens substituted unions', () => {
    const filePath = '/virtual/unionGenericSubstitution.ts';
    const memory: Record<string, string> = {
      [filePath]: `
        type TypeItem = boolean;
        type TypeChoice<TypeItem> = TypeItem | null;
        type TypeRequest = TypeChoice<string>;
        type TypeResponse = TypeChoice<number | string>;
      `,
    };
    const getDegraded = mock();
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], { ...options, getDegraded });

    expect(schema).toEqual({
      request: ['union', 'string', ['literal', null]],
      response: ['union', 'number', 'string', ['literal', null]],
    });
    expect(getDegraded).not.toBeCalled();
  });

  it('emits literal schemas for boolean, null, negative number and enum literals', () => {
    const filePath = '/virtual/literalValues.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      enum LiteralEnum {
        Ready = 'READY',
        'Waiting' = 'WAITING',
        Zero = 0,
        Negative = -1,
        Enabled = true,
        Empty = null,
      }
      type TypeRequest = true | false | null | -2;
      type TypeResponse = LiteralEnum;
    `,
    };
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], options);

    expect(schema).toEqual({
      request: ['union', ['literal', true], ['literal', false], ['literal', null], ['literal', -2]],
      response: [
        'union',
        ['literal', 'READY'],
        ['literal', 'WAITING'],
        ['literal', 0],
        ['literal', -1],
        ['literal', true],
        ['literal', null],
      ],
    });
  });

  it('falls back to any for enum members with unsupported computed names', () => {
    const filePath = '/virtual/computedEnumName.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      const key = 'Ready';
      enum ComputedEnum {
        [key] = 'READY',
      }
      type TypeRequest = ComputedEnum;
      type TypeResponse = ComputedEnum;
    `,
    };
    const getDegraded = mock();
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], { ...options, getDegraded });

    expect(schema).toEqual({ request: 'any', response: 'any' });
    expect(getDegraded).toBeCalledWith(['TypeRequest', 'TypeResponse']);
  });

  it('falls back to any for enum members with unsupported initializer values', () => {
    const filePath = '/virtual/unsupportedEnumInitializer.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      const ready = 'READY';
      enum ComputedEnum {
        Ready = ready,
      }
      type TypeRequest = ComputedEnum;
      type TypeResponse = ComputedEnum;
    `,
    };
    const getDegraded = mock();
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], { ...options, getDegraded });

    expect(schema).toEqual({ request: 'any', response: 'any' });
    expect(getDegraded).toBeCalledWith(['TypeRequest', 'TypeResponse']);
  });

  it('falls back to any for empty enums', () => {
    const filePath = '/virtual/emptyEnum.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      enum EmptyEnum {}
      type TypeRequest = EmptyEnum;
      type TypeResponse = EmptyEnum;
    `,
    };
    const getDegraded = mock();
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], { ...options, getDegraded });

    expect(schema).toEqual({ request: 'any', response: 'any' });
    expect(getDegraded).not.toBeCalled();
  });

  it('dedupes structurally equal branches and collapses a single remaining variant', () => {
    const filePath = '/virtual/unionCanonicalization.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      type Left = { a: string; b: number; };
      type Right = { b: number; a: string; };
      type TypeRequest = Left | Right;
      type TypeResponse = string | string;
    `,
    };
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], options);

    expect(schema).toEqual({ request: { a: 'string', b: 'number' }, response: 'string' });
  });

  it('collapses unions containing any to any', () => {
    const filePath = '/virtual/unionAnyDominates.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      type Payload = { value: string; };
      type TypeRequest = Payload | any;
      type TypeResponse = string | any | number;
    `,
    };

    const getDegraded = mock();
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], {
      ...options,
      getDegraded,
    });

    expect(schema).toEqual({ request: 'any', response: 'any' });
    expect(getDegraded).not.toBeCalled();
  });

  it('falls back to any for unsupported literal and qualified references', () => {
    const filePath = '/virtual/unsupportedReferenceValues.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      enum Status {
        Ready = 'ready',
      }
      namespace Api {
        export type Payload = string;
      }
      type TypeRequest = Status.Missing;
      type TypeResponse = 1n | Api.Payload;
    `,
    };
    const getDegraded = mock();
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], { ...options, getDegraded });

    expect(schema).toEqual({ request: 'any', response: 'any' });
    expect(getDegraded).toBeCalledWith(['TypeRequest', 'TypeResponse']);
  });

  it('falls back to any for unsupported generic type references', () => {
    const filePath = '/virtual/unsupportedGenerics.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      type TypeRequest = Map<string, number>;
      type TypeResponse = Promise<string>;
    `,
    };
    const getDegraded = mock();
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], { ...options, getDegraded });

    expect(schema).toEqual({ request: 'any', response: 'any' });
    expect(getDegraded).toBeCalledWith(['TypeRequest', 'TypeResponse']);
  });
});

describe('Tuple Generation', () => {
  it('emits tuple schemas for named tuple members', () => {
    const filePath = '/virtual/tupleNamed.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      type TypeRequest = [id: string, count: number];
      type TypeResponse = [active: boolean];
    `,
    };
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], options);

    expect(schema).toEqual({
      request: ['tuple', 'string', 'number'],
      response: ['tuple', 'boolean'],
    });
  });

  it('falls back to any for optional and rest tuple members', () => {
    const filePath = '/virtual/tupleUnsupportedMembers.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      type TypeRequest = [id?: string];
      type TypeResponse = [label: string, ...rest: number[]];
    `,
    };
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], options);

    expect(schema).toEqual({ request: 'any', response: 'any' });
  });

  it('emits tuple schemas for fixed tuples', () => {
    const filePath = '/virtual/tupleFixed.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      type Pair = [number, string];
      type TypeRequest = Pair;
      type TypeResponse = Array<Pair>;
    `,
    };
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], options);

    expect(schema).toEqual({
      request: ['tuple', 'number', 'string'],
      response: ['array', ['tuple', 'number', 'string']],
    });
  });
});

describe('Record Generation', () => {
  it('emits record schemas for Record<string, T>', () => {
    const filePath = '/virtual/recordString.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      type TypeRequest = Record<string, number>;
      type TypeResponse = Record<string, { id: string; active?: boolean; }>;
    `,
    };
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], options);

    expect(schema).toEqual({
      request: ['record', 'number'],
      response: ['record', { id: 'string', active: ['optional', 'boolean'] }],
    });
  });

  it('falls back to any for unsupported Record key types', () => {
    const filePath = '/virtual/recordUnsupportedKey.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      type TypeRequest = Record<number, string>;
      type TypeResponse = Record<'a' | 'b', string>;
    `,
    };
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], options);

    expect(schema).toEqual({ request: 'any', response: 'any' });
  });
});

describe('Object Generation', () => {
  it('emits inherited interface properties and instantiated generic aliases', () => {
    const filePath = '/virtual/objectSemanticTypes.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      interface Base {
        id: string;
      }
      interface User extends Base {
        name: string;
      }
      type Box<T> = {
        value: T;
      };
      type TypeRequest = User;
      type TypeResponse = Box<User>;
    `,
    };
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], options);

    expect(schema).toEqual({
      request: { id: 'string', name: 'string' },
      response: { value: { id: 'string', name: 'string' } },
    });
  });

  it('resolves nested generic aliases with matching parameter names', () => {
    const filePath = '/virtual/objectNestedGenericMatchingNames.ts';
    const memory: Record<string, string> = {
      [filePath]: `
        type TypeBox<TValue> = { value: TValue };
        type TypeOuter<TValue> = TypeBox<TValue>;
        type TypeRequest = TypeOuter<string>;
        type TypeResponse = TypeOuter<number>;
      `,
    };
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], options);

    expect(schema).toEqual({
      request: { value: 'string' },
      response: { value: 'number' },
    });
  });

  it('resolves nested generic aliases across three parameter scopes', () => {
    const filePath = '/virtual/objectNestedGenericThreeScopes.ts';
    const memory: Record<string, string> = {
      [filePath]: `
        type TypeBox<TValue> = { value: TValue };
        type TypeMiddle<TItem> = TypeBox<TItem>;
        type TypeOuter<TValue> = TypeMiddle<TValue>;
        type TypeRequest = TypeOuter<string>;
        type TypeResponse = TypeOuter<number>;
      `,
    };
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], options);

    expect(schema).toEqual({
      request: { value: 'string' },
      response: { value: 'number' },
    });
  });

  it('keeps local types separate from caller parameters in nested generic aliases', () => {
    const filePath = '/virtual/objectNestedGenericLocalType.ts';
    const memory: Record<string, string> = {
      [filePath]: `
        type TypeValue = boolean;
        type TypeBox<TItem> = { value: TItem; local: TypeValue };
        type TypeOuter<TypeValue> = TypeBox<TypeValue>;
        type TypeRequest = TypeOuter<string>;
        type TypeResponse = TypeOuter<number>;
      `,
    };
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], options);

    expect(schema).toEqual({
      request: { value: 'string', local: 'boolean' },
      response: { value: 'number', local: 'boolean' },
    });
  });

  it('keeps optional union properties inside instantiated generic aliases', () => {
    const filePath = '/virtual/objectOptionalGenericUnion.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      type Box<T> = {
        value?: T;
      };
      type TypeRequest = Box<string | number>;
      type TypeResponse = {
        payload: Box<{ status?: 'ready' | 'pending' }>;
      };
    `,
    };
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], options);

    expect(schema).toEqual({
      request: { value: ['optional', ['union', 'string', 'number']] },
      response: {
        payload: {
          value: [
            'optional',
            {
              status: ['optional', ['union', ['literal', 'ready'], ['literal', 'pending']]],
            },
          ],
        },
      },
    });
  });

  it('emits indexed access schemas for object keys and array items', () => {
    const filePath = '/virtual/objectIndexedAccess.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      type SomeType = {
        someKey: string;
        optional?: number;
      };
      type SomeArrayType = Array<{ id: string }>;
      type TypeRequest = {
        value: SomeType['someKey'];
        optional: SomeType['optional'];
      };
      type TypeResponse = SomeArrayType[number];
    `,
    };
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], options);

    expect(schema).toEqual({
      request: { value: 'string', optional: ['optional', 'number'] },
      response: { id: 'string' },
    });
  });

  it('degrades tuple indexed access with number', () => {
    const filePath = '/virtual/tupleIndexedAccess.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      type TypeTuple = [string, number];
      type TypeRequest = TypeTuple[number];
      type TypeResponse = string;
    `,
    };
    const getDegraded = mock();
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], { ...options, getDegraded });

    expect(schema).toEqual({ request: 'any', response: 'string' });
    expect(getDegraded).toBeCalledWith(['TypeRequest']);
  });

  it('emits numeric property names and degrades members without concrete value types', () => {
    const filePath = '/virtual/objectMemberEdgeCases.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      const computed = 'computed';
      type TypeRequest = {
        1: string;
        [computed]: boolean;
        value;
        run(): void;
      };
      type TypeResponse = {
        2?: number;
      };
    `,
    };
    const getDegraded = mock();
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], { ...options, getDegraded });

    expect(schema).toEqual({
      request: { '1': 'string', '<computed>': 'any', value: 'any', run: 'any' },
      response: { '2': ['optional', 'number'] },
    });
    expect(getDegraded).toBeCalledWith(['<computed>', 'run', 'value']);
  });

  it('emits parenthesized object schemas', () => {
    const filePath = '/virtual/parenthesizedObject.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      type Payload = ({ id: string });
      type TypeRequest = Payload;
      type TypeResponse = ({ ok: boolean });
    `,
    };
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], options);

    expect(schema).toEqual({
      request: { id: 'string' },
      response: { ok: 'boolean' },
    });
  });
});

describe('Intersection Generation', () => {
  it('keeps generic substitutions in members, operands and instantiated aliases', () => {
    const filePath = '/virtual/intersectionGenericSubstitution.ts';
    const memory: Record<string, string> = {
      [filePath]: `
        type TypeItem = boolean;
        type TypePayload<TypeItem> = ({ value: TypeItem } & { id: string });
        type TypeExtended<TValue> = TValue & { flag: boolean };
        type TypeBox<TValue> = { boxed: TValue };
        type TypeRequest = TypePayload<number>;
        type TypeResponse = {
          extended: TypeExtended<{ name: string }>;
          boxed: TypeBox<string> & { ok: boolean };
        };
      `,
    };
    const getDegraded = mock();
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], { ...options, getDegraded });

    expect(schema).toEqual({
      request: { value: 'number', id: 'string' },
      response: {
        extended: { name: 'string', flag: 'boolean' },
        boxed: { boxed: 'string', ok: 'boolean' },
      },
    });
    expect(getDegraded).not.toBeCalled();
  });

  it('merges intersections with object keyword and optional object keys', () => {
    const filePath = '/virtual/intersectionObjectKeyword.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      type TypeRequest = object & object & {
        payload?: { id: string };
      } & {
        payload?: object;
      };
      type TypeResponse = object & {
        meta?: object;
      } & {
        meta?: { page: number };
      };
    `,
    };
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], options);

    expect(schema).toEqual({
      request: { payload: ['optional', { id: 'string' }] },
      response: { meta: ['optional', { page: 'number' }] },
    });
  });

  it('merges nested intersections through type references', () => {
    const filePath = '/virtual/intersectionNestedReferences.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      type Left = { left: string };
      type Middle = Left & { middle: number };
      type TypeRequest = Middle & { right: boolean };
      type TypeResponse = (Left & { middle: number }) & { right: boolean };
    `,
    };
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], options);

    expect(schema).toEqual({
      request: { left: 'string', middle: 'number', right: 'boolean' },
      response: { left: 'string', middle: 'number', right: 'boolean' },
    });
  });

  it('merges nested object properties without changing cached schemas', () => {
    const filePath = '/virtual/intersectionNestedObjectMerge.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      type TypeBase = { payload: { id: string } };
      type TypeRequest = TypeBase & { payload: { name: string } };
      type TypeResponse = TypeBase;
    `,
    };
    const getDegraded = mock();
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], { ...options, getDegraded });

    expect(schema).toEqual({
      request: { payload: { id: 'string', name: 'string' } },
      response: { payload: { id: 'string' } },
    });
    expect(getDegraded).not.toBeCalled();
  });

  it('degrades conflicting nested properties without changing cached schemas', () => {
    const filePath = '/virtual/intersectionNestedObjectConflict.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      type TypeBase = { payload: { id: string } };
      type TypeRequest = TypeBase & { payload: { extra: boolean; id: number } };
      type TypeResponse = TypeBase;
    `,
    };
    const getDegraded = mock();
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], { ...options, getDegraded });

    expect(schema).toEqual({
      request: 'any',
      response: { payload: { id: 'string' } },
    });
    expect(getDegraded).toBeCalledWith(['TypeRequest']);
  });

  it('falls back to any when intersections include non-object references', () => {
    const filePath = '/virtual/intersectionNonObjectReference.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      enum Role {
        Admin = 'admin',
      }
      type Name = string;
      type TypeRequest = object & Role;
      type TypeResponse = object & Name;
    `,
    };
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], options);

    expect(schema).toEqual({ request: 'any', response: 'any' });
  });

  it('emits escaped keys when merging object intersections', () => {
    const filePath = '/virtual/intersectionEscapedKeys.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      export type EscapedPayload = object & {
        "can't": string;
        "quote\\"key"?: number;
      };
  
      type TypeRequest = EscapedPayload;
      type TypeResponse = EscapedPayload;
    `,
    };
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], options);

    expect(schema).toEqual({
      request: { "can't": 'string', 'quote"key': ['optional', 'number'] },
      response: { "can't": 'string', 'quote"key': ['optional', 'number'] },
    });
  });

  it('keeps compatible duplicate keys when merging object intersections', () => {
    const filePath = '/virtual/intersectionCompatibleDuplicateKeys.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      type Role = 'manager' | 'admin';
      type Base = {
        id: string;
        role: Role;
      };
      type TypeRequest = Base & {
        role: Role;
        gender: string;
      };
      type TypeResponse = TypeRequest;
    `,
    };
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], options);

    expect(schema).toEqual({
      request: {
        id: 'string',
        role: ['union', ['literal', 'manager'], ['literal', 'admin']],
        gender: 'string',
      },
      response: {
        id: 'string',
        role: ['union', ['literal', 'manager'], ['literal', 'admin']],
        gender: 'string',
      },
    });
  });

  it('falls back to any when object intersections contain duplicate keys', () => {
    const filePath = '/virtual/intersectionDuplicateKeys.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      type Left = { value: string; };
      type Right = { value: number; };
      type TypeRequest = Left & Right;
      type TypeResponse = Left & Right;
    `,
    };
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], options);

    expect(schema).toEqual({ request: 'any', response: 'any' });
  });

  it('falls back to any when intersections include missing or generic references', () => {
    const filePath = '/virtual/intersectionUnsupportedReferences.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      type TypeRequest = Missing & { id: string };
      type TypeResponse = Array<string> & { id: string };
    `,
    };
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], options);

    expect(schema).toEqual({ request: 'any', response: 'any' });
  });
});

describe('Recursive Generation', () => {
  it('degrades direct object self references outside arrays', () => {
    const filePath = '/virtual/directSelfReference.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      type Node = {
        id: string;
        child: Node;
        choice: Node | string;
      };
      type TypeRequest = Node;
      type TypeResponse = Node;
    `,
    };
    const getDegraded = mock();
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], { ...options, getDegraded });

    expect(schema).toEqual({
      request: { id: 'string', child: 'any', choice: 'any' },
      response: { id: 'string', child: 'any', choice: 'any' },
    });
    expect(getDegraded).toBeCalledWith(['child', 'choice']);
  });

  it('emits recursive arrays from tuple and array self references', () => {
    const filePath = '/virtual/tupleSelfReference.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      type Node = {
        id: string;
        children: Array<[Node]>;
      };
      type TypeRequest = Node;
      type TypeResponse = {
        id: string;
        children: Array<TypeResponse>;
      };
    `,
    };
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], options);

    expect(schema).toEqual({
      request: [
        'recursiveArray',
        {
          id: 'string',
          children: ['array', ['tuple', ['self']]],
        },
      ],
      response: [
        'recursiveArray',
        {
          id: 'string',
          children: ['array', ['self']],
        },
      ],
    });
  });

  it.each([
    '{ id: string; children: Array<TypeNode | string> }',
    '{ id: string } & { children: Array<TypeNode | string> }',
  ])('emits recursive union arrays in %s', (nodeType) => {
    const filePath = '/virtual/unionSelfReference.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      type TypeNode = ${nodeType};
      type TypeRequest = TypeNode;
      type TypeResponse = TypeNode;
    `,
    };
    const getDegraded = mock();
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], { ...options, getDegraded });

    expect(schema).toEqual({
      request: ['recursiveArray', { id: 'string', children: ['array', ['union', ['self'], 'string']] }],
      response: ['recursiveArray', { id: 'string', children: ['array', ['union', ['self'], 'string']] }],
    });
    expect(getDegraded).not.toBeCalled();
  });

  it('falls back to any for recursive alias cycles', () => {
    const filePath = '/virtual/recursiveAliasCycle.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      type A = B;
      type B = A;
      type TypeRequest = A;
      type TypeResponse = B;
    `,
    };
    const getDegraded = mock();
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], { ...options, getDegraded });

    expect(schema).toEqual({ request: 'any', response: 'any' });
    expect(getDegraded).toBeCalledWith(['TypeRequest', 'TypeResponse']);
  });

  it('falls back to any for recursive array roots', () => {
    const filePath = '/virtual/recursiveArrayRoot.ts';
    const memory: Record<string, string> = {
      [filePath]: `
      type TypeRequest = Array<TypeRequest>;
      type TypeResponse = TypeRequest;
    `,
    };
    const getDegraded = mock();
    const options = prepare('memory', memory, tsconfigPath);

    const {
      result: [{ schema }],
    } = createValidators([filePath], { ...options, getDegraded });

    expect(schema).toEqual({ request: 'any', response: 'any' });
    expect(getDegraded).toBeCalledWith(['TypeRequest', 'TypeResponse']);
  });
});
