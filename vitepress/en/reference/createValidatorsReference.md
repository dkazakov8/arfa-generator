### Arguments

The first argument is `input`; the second is an object containing the remaining fields listed below.

<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
input: Array<string>
```

</td><td>

Absolute paths of the input files

</td></tr>

<tr><td class="table-td">

```ts wrap
tsconfigPath: string
```

</td><td>

The path to `tsconfig.json` on disk for resolving imports and path aliases.
Relative paths are resolved from `process.cwd()`

</td></tr>

<tr><td class="table-td">

```ts wrap
requestDeclaration: string
```

</td><td>

The name of the local request type declaration, such as `TypeRequest`

</td></tr>

<tr><td class="table-td">

```ts wrap
responseDeclaration: string
```

</td><td>

The name of the local response type declaration, such as `TypeResponse`

</td></tr>

<tr><td class="table-td">

```ts wrap
readFile?: (filePath: string) => string | undefined
```

</td><td>

Reads source files by absolute path. Returning `undefined` falls back to reading from disk

</td></tr>

<tr><td class="table-td">

```ts wrap
getDegraded?: (names: Array<string>) => void
```

</td><td>

Receives sorted, unique names of properties or root declarations that fell back to `any`,
without full paths. Called once per run if any fallbacks occurred

</td></tr>

</tbody></table>

### Result

<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
result: Array<{
  filePath: string;
  schema: {
    request: TypeSchema;
    response: TypeSchema;
  };
}>
```

</td><td>

Validation schemas for the contracts found. `filePath` is the absolute file path;
`schema.request` and `schema.response` contain serializable request and response validation schemas

</td></tr>

<tr><td class="table-td">

```ts wrap
deps: Record<string, Array<string>>
```

</td><td>

A reverse dependency map: imported file → affected entry files.
All paths in keys and values are absolute

</td></tr>

</tbody></table>
