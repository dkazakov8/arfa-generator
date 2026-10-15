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
generatedFiles: TypeGeneratedFiles
```

</td><td>

The results of successful `generate` calls from all plugins in the current iteration, including files not written
to disk because their content was unchanged

</td></tr>

</tbody></table>
