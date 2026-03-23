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
changedFiles: Array<{
  relativePath: string;
  absolutePath: string;
}>
```

</td><td>

Список уникальных путей файлов, добавленных или изменённых пользователем в watch-режиме либо записанных генератором за
все итерации текущего запуска, за исключением удаленных файлов

</td></tr>

<tr><td class="table-td">

```ts wrap
deletedFiles: Array<{
  relativePath: string;
  absolutePath: string;
}>
```

</td><td>

Список уникальных путей файлов, удалённых пользователем в watch-режиме либо генератором при cleanup за все итерации
текущего запуска

</td></tr>

<tr><td class="table-td">

```ts wrap
isFullGeneration: boolean
```

</td><td>

`true` для полного запуска `runFullCycle()` и `false` для инкрементального запуска в watch-режиме

</td></tr>

<tr><td class="table-td">

```ts wrap
checkerLog: (log: {
  message: string;
}) => void
```

</td><td>

Функция для регистрации информационных сообщений

</td></tr>

<tr><td class="table-td">

```ts wrap
checkerError: (log: {
  message: string;
  error: unknown;
}) => void
```

</td><td>

Функция для регистрации ошибок

</td></tr>

</tbody></table>
