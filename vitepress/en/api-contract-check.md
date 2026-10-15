<script setup>
import { data } from '@/dynamic.data';
</script>

// #region overview

# api-contract-check

<br>
<Badge type="info">Size (builder): <span style="color:var(--docsearch-focus-color)">{{ data.builderSize }}</span></Badge>
<Badge type="info">Size (checker): <span style="color:var(--docsearch-focus-color)">{{ data.checkerSize }}</span></Badge>

This library is included in `@arfa-tools/generator` and builds serializable validation schemas from TypeScript types.
It supports TypeScript aliases for resolving imports, as well as in-memory files (not yet saved to disk) for long
transformation chains.

The library is designed for JSON-compatible contracts. Unsupported types fall back to `any`, which accepts
any value. These fallbacks can be logged.

For most scenarios, <Link to="plugins/validators">PluginValidators</Link> is sufficient: it already provides
an efficient way to use the library. If you cannot use the generator (for example, if you have your own generation
pipeline or need custom logic), you can use the API directly.

The generated validation schemas can be used to validate API requests and responses, produce documentation, generate
types for other languages, convert to validation schemas for third-party libraries, and more.

## Supported types

- `any`, `number`, `object`, `boolean`, `string`, `null`, and string, numeric, and boolean literals;
- type aliases, interfaces, inline objects, and required and optional properties;
- inheritance from base interfaces without generic arguments: properties are merged;
- arrays (`T[]`, `Array<T>`), fixed-length tuples, and `Record<string, T>`;
- substitution of generic type alias parameters, such as `type Box<T> = { value?: T }`;
- indexed access with a specific object key (`User['id']`) or an array element (`UserList[number]`);
- unions and intersections of objects with compatible overlapping properties;
- object self-references within arrays, including unions and tuples: `children: Array<Node | string>`;
- enums with literal initializers and automatic numeric values, and `Enum.Member` references;
- named imports, re-exports, `export *`, and path aliases from `tsconfig.json`.

This is enough to describe almost anything that can come from an external API.

<Accordion title="Example of supported types and the generated validation schema">

<<< @/../units/api-contract-check/integration.test.ts#positiveContent

<<< @/../units/api-contract-check/integration.test.ts#positiveSchema

</Accordion>

## Unsupported types (fall back to any)

- `Promise<T>`, `Map<K, V>`, and other unknown generic containers, generic interfaces, and `extends Base<T>`;
- `Record<K, V>` where the key is not specified directly as `string`;
- indexed access with dynamic or missing keys, and indexed access on tuples;
- mapped, conditional, and function types, computed property names, and computed enum initializers;
- optional and rest tuple elements, and incompatible intersections;
- direct circular references outside arrays, alias cycles, and recursive roots that are not objects;
- references through default or namespace imports; these imports are tracked only as file dependencies.

You can track fallbacks through `getDegraded`. If a union contains an `any` branch, the entire union becomes `any`.

<Accordion title="Example of unsupported types and the generated validation schema">

<<< @/../units/api-contract-check/integration.test.ts#fallbackContent

<<< @/../units/api-contract-check/integration.test.ts#fallbackSchema

</Accordion>

// #endregion overview

// #region schemaGeneration

# Validation schema generation

`createValidators` accepts a list of files and project settings:

<!-- @include: @shared/api-contract-check/createValidatorsExample.md -->

Input files must declare both root types locally using `type` or `interface`. They do not have to be exported. Files
that declare neither the request nor the response type are skipped. If only one of the two types is declared, or no
contracts are found (including an empty file list), the call fails with an error.

<!-- @include: @shared/api-contract-check/contractTypesExample.md -->

Types can reference named imports, including `import type`, re-exports, and `export *` from barrel files.
Path aliases from `tsconfig.json` are supported.

<!-- @include: ./reference/createValidatorsReference.md -->

## In-memory files

`createValidators` reads files from disk, from memory, or from both sources. Here is an example of reading contracts from memory:

<!-- @include: @shared/api-contract-check/createValidatorsInMemoryExample.md -->

This lets you perform multiple transformations and file operations (for example, deriving request and response types
from OpenAPI while `api-contract-check` generates validation schemas on the fly) and save everything to disk in a single batch.

// #endregion schemaGeneration

// #region payloadValidation

# Payload validation

<br>
<Badge type="info">Size (checker): <span style="color:var(--docsearch-focus-color)">{{ data.checkerSize }}</span></Badge>

`check` validates objects and arrays against a validation schema. Fields absent from the schema are deleted in place
by mutation, with optional logging. Mismatches are returned as a list of errors.

The compact library and validation schemas add little to the final bundle size. Native TS types also avoid slowing
down `tsc` and the IDE, unlike libraries that require manually defined validation schemas and rely on complex
type inference.

<!-- @include: @shared/api-contract-check/checkPayloadExample.md -->

Example errors:

<!-- @include: @shared/api-contract-check/checkErrorsOutput.md -->

<!-- @include: ./reference/checkParameters.md -->

## Using with fetch

The wrapper for JSON POST requests uses a generated validation schema: it checks the request before sending it and
the response before returning it. This ensures that the TS request and response types match the actual data exactly.

<!-- @include: @shared/api-contract-check/httpRequestValidationExample.md -->

## Using with WebSocket

The wrapper for WebSocket requests uses a generated validation schema: it checks the request before sending it and
the response before returning it. This ensures that the TS request and response types match the actual data exactly.

In this example, the server accepts JSON messages in the `{ id, method, payload }` format and responds with `{ id, payload }`.

<!-- @include: @shared/api-contract-check/webSocketRequestValidationExample.md -->

// #endregion payloadValidation

// #region incrementalGeneration

# Incremental generation

To rebuild after a dependency changes, save `deps` from a full run and update it after rebuilding
the affected entry files.

Entry files are not included in `deps`; you need to pass them directly.

<!-- @include: @shared/api-contract-check/createValidatorsIncrementalExample.md -->

// #endregion incrementalGeneration
