<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
ci?: boolean
```

</td><td>

CI mode; defaults to `false`. When `true`, `startWatch()` calls and the `historyPath` option are ignored,
and errors cause an exception to be thrown

</td></tr>

<tr><td class="table-td">

```ts wrap
rootDir: string
```

</td><td>

The root directory for plugin glob patterns and watch mode. The generator does not modify files outside it

</td></tr>

<tr><td class="table-td">

```ts wrap
plugins: Array<BasePlugin>
```

</td><td>

Plugins that propose files to write. Executed in declaration order on each iteration

</td></tr>

<tr><td class="table-td">

```ts wrap
checkers?: Array<BaseChecker>
```

</td><td>

Checks that run after the plugins and all cascading changes have completed

</td></tr>

<tr><td class="table-td">

```ts wrap
format?: (files: {
  plugin: string;
  content: string;
  filePath: string;
}) => {
  plugin: string;
  content: string;
  filePath: string;
} | Promise<{
  plugin: string;
  content: string;
  filePath: string;
}>
```

</td><td>

A function for formatting the content of files proposed by plugins. Called before comparing the content with
the file on disk and writing it

</td></tr>

<tr><td class="table-td">

```ts wrap
headerTemplate?: string
```

</td><td>

Common text prepended to each generated file unless the plugin sets `skipHeader`

</td></tr>

<tr><td class="table-td">

```ts wrap
historyPath?: string
```

</td><td>

The absolute path of the JSONL file containing run results. History is neither read nor written when `ci: true`
or when this option is omitted

Place the file outside `rootDir` so that updates do not trigger watch events

</td></tr>

</tbody></table>
