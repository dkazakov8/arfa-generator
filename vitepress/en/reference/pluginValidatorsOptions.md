<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
entries: Array<string>
```

</td><td>

An array of glob patterns for finding folders within <code>rootDir</code>

</td></tr>

<tr><td class="table-td">

```ts wrap
exclude?: RegExp
```

</td><td>

A regular expression for excluding files from processing

</td></tr>

<tr><td class="table-td">

```ts wrap
requestDeclaration: string
```

</td><td>

The name of the request type declaration (such as `Request`)

</td></tr>

<tr><td class="table-td">

```ts wrap
responseDeclaration: string
```

</td><td>

The name of the response type declaration (such as `Response`)

</td></tr>

<tr><td class="table-td">

```ts wrap
targetFolder: string
```

</td><td>

The folder where validation schema files are generated

</td></tr>

<tr><td class="table-td">

```ts wrap
tsconfigPath: string
```

</td><td>

The path to tsconfig for finding TypeScript aliases and resolving paths

</td></tr>

<tr><td class="table-td">

```ts wrap
formatContent: (params: {
  schema: TypeBuilderOutputFile['schema'];
  sourcePath: string;
  targetPath: string;
}) => string
```

</td><td>

A function for formatting the validation schema file content

</td></tr>

<tr><td class="table-td">

```ts wrap
getDegraded?: (degraded: Array<string>) => void
```

</td><td>

A callback that receives the list of types that fell back to `any`. Called before the error is thrown when `bailOnDegraded: true`

</td></tr>

<tr><td class="table-td">

```ts wrap
bailOnDegraded?: boolean
```

</td><td>

Defaults to `false`: fallbacks do not interrupt generation. When `true`, the plugin throws an error listing the
fallbacks after calling `getDegraded`. To make the entire generation run fail,
also enable `ci: true` in `FileGenerator`

</td></tr>

</tbody></table>
