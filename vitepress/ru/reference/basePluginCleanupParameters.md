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
generatedFiles: TypeGeneratedFiles
```

</td><td>

Результаты успешно завершившихся вызовов `generate` всех плагинов за текущую итерацию, включая не записанные на диск
из-за совпадения контента

</td></tr>

</tbody></table>
