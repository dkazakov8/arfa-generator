<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
name: string
```

</td><td>

Имя чекера для логов

</td></tr>

<tr><td class="table-td">

```ts wrap
getCommand: (args: {
  changedFiles: Array<{
    relativePath: string;
    absolutePath: string;
  }>;
  deletedFiles: Array<{
    relativePath: string;
    absolutePath: string;
  }>;
  isFullGeneration: boolean;
}) => false | Array<string>
```

</td><td>

Функция возвращает массив, где первый элемент — команда, остальные — её аргументы. Возврат `false` пропускает проверку.

`changedFiles` — уникальные пути файлов, добавленных или изменённых пользователем в watch-режиме либо записанных генератором
за все итерации текущего запуска.

`deletedFiles` — уникальные пути файлов, удалённых пользователем в watch-режиме либо генератором при cleanup за все
итерации текущего запуска.

`isFullGeneration` — `true` для полного запуска `runFullCycle()` и `false` для инкрементального
запуска в watch-режиме. Полезен для запуска полной проверки

</td></tr>

</tbody></table>
