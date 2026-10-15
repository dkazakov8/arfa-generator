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
changedFiles: Array<{
  relativePath: string;
  absolutePath: string;
}>
```

</td><td>

Unique paths of files added or changed by the user in watch mode, or written by the generator across all
iterations of the current run, excluding deleted files

</td></tr>

<tr><td class="table-td">

```ts wrap
deletedFiles: Array<{
  relativePath: string;
  absolutePath: string;
}>
```

</td><td>

Unique paths of files deleted by the user in watch mode, or by the generator during cleanup across all
iterations of the current run

</td></tr>

<tr><td class="table-td">

```ts wrap
isFullGeneration: boolean
```

</td><td>

`true` for a full `runFullCycle()` run and `false` for an incremental run in watch mode

</td></tr>

<tr><td class="table-td">

```ts wrap
checkerLog: (log: {
  message: string;
}) => void
```

</td><td>

A function for logging informational messages

</td></tr>

<tr><td class="table-td">

```ts wrap
checkerError: (log: {
  message: string;
  error: unknown;
}) => void
```

</td><td>

A function for reporting errors

</td></tr>

</tbody></table>
