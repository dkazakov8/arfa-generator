<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
entries: Array<string>
```

</td><td>

Массив с glob-паттернами поиска файлов внутри <code>rootDir</code>, например `['features/*/.feature']`

</td></tr>

<tr><td class="table-td">

```ts wrap
createFiles: (params: {
  folderName: string;
  folderPath: string;
}) => Array<{
  filePath: string;
  content: string;
}>
```

</td><td>

Возвращает набор файлов для папки marker.<br />

`folderPath` и `filePath` должны быть абсолютными путями, иначе плагин сообщит об ошибке

</td></tr>

</tbody></table>
