<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
rootDir: string
```

</td><td>

Корневая директория, переданная в `FileGenerator`

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

Список изменившихся файлов в watch-режиме или каскадной итерации. На первой итерации `generator.runFullCycle()` приходит
`undefined`

</td></tr>

<tr><td class="table-td">

```ts wrap
pluginLog: (log: {
  message: string;
  plugin: string;
}) => void
```

</td><td>

Функция для регистрации информационных сообщений

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

Функция для регистрации ошибок

</td></tr>

</tbody></table>
