<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
rootDir: string
```

</td><td>

The root directory passed to `FileGenerator`

</td></tr>

<tr><td class="table-td">

```ts wrap
changedFiles?: Array<{
  event: 'add' | 'change' | 'unlink';
  origin: 'watch' | 'cascade';
  filePath: string;
  eventTimeMs: number;
  relativePath: string;
}>
```

</td><td>

The list of files changed in watch mode or a cascading iteration. On the first iteration of
`generator.runFullCycle()`, this is `undefined`

</td></tr>

<tr><td class="table-td">

```ts wrap
pluginLog: (log: {
  message: string;
  plugin: string;
}) => void
```

</td><td>

A function for logging informational messages

</td></tr>

<tr><td class="table-td">

```ts wrap
pluginError: (log: {
  message: string;
  plugin: string;
  error: unknown;
}) => void
```

</td><td>

A function for reporting errors

</td></tr>

</tbody></table>
