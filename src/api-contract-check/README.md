# api-contract-check

Generate compact runtime validators from TypeScript API contract files.

`api-contract-check` is a TypeScript-first contract validation tool inside `@arfa-tools/generator` for projects that already describe API request and response shapes as TypeScript types. It reads contract entry files, resolves their imports through a `tsconfig.json`, builds serializable schemas, and validates runtime payloads with predictable error messages.

It is not an OpenAPI parser and it is not a general-purpose TypeScript type checker. The supported type surface is focused on JSON-compatible API payloads: objects, arrays, tuples, records, unions, literals, enums, optional fields, recursion, imported model types, inherited interfaces, and simple generic type aliases. Constructs that do not describe JSON data directly, such as `Promise<T>` or broad generic containers, are intentionally degraded to `'any'`, so any value is valid for that property.

## Install

```bash
bun add @arfa-tools/generator
```

## Imports

```ts
import { createValidators } from '@arfa-tools/generator/api-contract-check/builder';
import { check } from '@arfa-tools/generator/api-contract-check/checker';
```

## Contract Shape

Each API entry file must declare the configured request and response root types. By default, most examples use `TypeRequest` and `TypeResponse`.

```ts
import type { TypeUser } from '../models/TypeUser';

type TypeRequest = {
  id: string;
};

type TypeResponse = TypeUser;
```

The root declarations are looked up locally in the entry file and do not need to be exported. They may reference imported types. `createValidators` resolves regular imports, type-only imports, re-exports, barrel files, and `tsconfig` path aliases.

## Build Schemas

`createValidators` requires absolute input paths; relative paths are rejected.

```ts
import path from 'node:path';

import { createValidators } from '@arfa-tools/generator/api-contract-check/builder';

const { result, deps } = createValidators([path.resolve('src/api/getUser.ts')], {
  tsconfigPath: 'tsconfig.json',
  requestDeclaration: 'TypeRequest',
  responseDeclaration: 'TypeResponse',
});

const [{ filePath, schema }] = result;

console.log(filePath);
console.log(schema.request);
console.log(schema.response);
console.log(deps);
```

`result` contains schemas for detected contracts with normalized absolute `filePath` values:

```ts
type BuilderResult = {
  result: Array<{
    filePath: string;
    schema: {
      request: Schema;
      response: Schema;
    };
  }>;
  deps: Record<string, string[]>;
};
```

`deps` maps each source file to the API entry files affected by its changes. All paths in keys and values are normalized and absolute.

## Validate Payloads

```ts
import { check } from '@arfa-tools/generator/api-contract-check/checker';

const payload = {
  id: 'user-1',
  debug: true,
};

const errors = check({
  schema,
  type: 'request',
  value: payload,
  getExtraneous: (paths) => {
    console.log(paths);
  },
});

console.log(errors); // null on success, otherwise string[]
console.log(payload); // extraneous object fields are removed in place
```

`check(...)` returns `null` when the payload is valid. Otherwise it returns an array of messages such as:

```ts
[
  'request.id is not a string',
  'response.items[].name is missing',
  'response.role is none of "manager", "admin"',
]
```

Unknown object keys are removed during validation. If `getExtraneous` is provided, it receives normalized paths such as `response.task.extra`.

## Memory And Disk Files

By default, `createValidators` reads files from disk. Pass `readFile` when your generator keeps some or all files in memory.

```ts
import { createValidators } from '@arfa-tools/generator/api-contract-check/builder';

const entryFilePath = '/virtual/api/getUser.ts';

const memory: Record<string, string> = {
  [entryFilePath]: `
    type TypeRequest = { id: string };
    type TypeResponse = { name: string };
  `,
};

const { result } = createValidators([entryFilePath], {
  tsconfigPath: 'tsconfig.json',
  requestDeclaration: 'TypeRequest',
  responseDeclaration: 'TypeResponse',
  readFile: (filePath) => memory[filePath],
});
```

If `readFile` returns `undefined`, the builder falls back to disk. This supports mixed pipelines where generated files live in memory and shared model files live on disk.

`tsconfigPath` is always read from disk through TypeScript APIs, so it must point to a real file.

## Incremental Regeneration

Store `deps` from a full run and use it to find which API entry files must be rebuilt after a source file changes.

```ts
import path from 'node:path';

import { createValidators } from '@arfa-tools/generator/api-contract-check/builder';

const entries = ['src/api/getUser.ts', 'src/api/getTask.ts'].map((filePath) => path.resolve(filePath));
const options = {
  tsconfigPath: 'tsconfig.json',
  requestDeclaration: 'TypeRequest',
  responseDeclaration: 'TypeResponse',
};

// Initial full build.
const initial = createValidators(entries, options);

// Persist this in your build cache.
const cachedDeps = initial.deps;

// Later, your watcher/build tool reports a changed source file.
const changedFilePath = path.resolve('src/models/TypeUser.ts');

// `deps` is file-level: if a dependency file changes, every mapped
// API entry is treated as affected. It does not try to detect whether
// only an unused type or field changed inside that file.
const affectedEntries = cachedDeps[changedFilePath] ?? [];

const next = createValidators(affectedEntries, options);
```

`deps` tracks the transitive import and re-export graph for each generated entry at file level.

## Degraded Types

Unsupported nested type constructs degrade to `'any'` so schema generation can continue. Use `getDegraded` to detect this.

```ts
createValidators([path.resolve('src/api/getUser.ts')], {
  tsconfigPath: 'tsconfig.json',
  requestDeclaration: 'TypeRequest',
  responseDeclaration: 'TypeResponse',
  getDegraded: (degradedProperties) => console.log(degradedProperties),
});
```

Missing root declarations, unreadable entry files, and unresolved imports are hard errors.

## Builder Semantics

The builder parses entry files and their transitive imports/re-exports, then compiles the configured local root declarations into compact schemas. Imported references are resolved through exported declarations of the imported module, including `export *` barrels, while root declarations themselves stay local to the entry file.

Interface inheritance is expanded for simple base interfaces:

```ts
interface Base {
  id: string;
}

interface User extends Base {
  name: string;
}
```

This compiles as:

```ts
{ id: 'string', name: 'string' }
```

Simple generic type aliases are instantiated by substituting type parameters in the alias body:

```ts
type Box<T> = {
  value?: T;
};

type TypeRequest = Box<string | number>;
```

This compiles as:

```ts
{ value: ['optional', ['union', 'string', 'number']] }
```

Union and intersection members use the same type compiler and preserve generic substitutions. A type parameter takes precedence over a declaration with the same name. For example:

```ts
type TypePayload<TValue> = { value: TValue } & { id: string };
type TypeRequest = TypePayload<number>;
```

This produces `{ value: 'number', id: 'string' }`. Intersections merge object schemas and the `object` keyword; incompatible properties or non-object members still degrade to `any`.

Self-references inside array unions are supported, including when the containing object is an intersection:

```ts
type TypeNode = { id: string } & { children: Array<TypeNode | string> };
```

This produces:

```ts
['recursiveArray', { id: 'string', children: ['array', ['union', ['self'], 'string']] }]
```

Each child must match the node schema or be a string. Direct self-references outside arrays and recursive non-object roots still degrade. These supported combinations retain concrete validation instead of falling back to `any`, and no longer report degradation through `getDegraded`.

Optional properties are represented with the `['optional', schema]` wrapper. The builder does not add `undefined` to the nested schema automatically.

Indexed access is supported for concrete object keys and array item access:

```ts
type Name = User['name'];
type Item = UserList[number];
```

## Supported TypeScript Subset

Supported:

- primitive keywords: `any`, `number`, `object`, `boolean`, `string`
- `null`
- type aliases and interfaces
- property signatures and optional properties
- simple `interface extends Base` inheritance
- imported type references
- inline object literals
- string, number, boolean, and null literals
- arrays
- fixed tuples
- `Record<string, T>`
- simple generic type alias instantiation, for example `Box<User>`
- indexed access for object literal keys and array items, for example `User['id']` and `UserList[number]`
- unions
- object intersections, including compatible duplicate members
- recursive object arrays such as `children: Array<Node>` and `children: Array<Node | string>`
- enums and enum member references
- `import`, `import type`, `export ... from`, and `export *`
- `tsconfig` path aliases

Unsupported or degraded:

- broad generic type evaluation beyond simple type alias substitution
- `Promise<T>`
- unknown generic containers such as `Map<K, V>`
- `Record<K, V>` with non-string keys
- generic `interface extends Base<T>`
- dynamic or missing indexed access keys
- tuple indexed access
- mapped types
- conditional types
- variadic/rest tuples
- function types as runtime schemas
- unsupported computed property names

## Runtime Behavior Notes

- Objects are checked structurally.
- Extra object fields are removed in place.
- Optional TypeScript properties (`name?: string`) may be omitted. If present, their value is still validated.
- Union validation reports compact top-level errors, for example `response.task is none of 2 types`.
- Array item paths are normalized with `[]`, for example `response.items[].id`. Large arrays do not produce separate messages for every index.
- Duplicate validation messages are deduplicated.

## Development

```bash
bun test
bun run bench
bun run analyze
```
