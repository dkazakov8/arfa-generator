<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
globToPaths(params: {
  rootDir: string;
  entries: Array<string>;
  kind: 'file' | 'dir';
  exclude?: RegExp;
}): Array<string>
```

</td><td>

Находит файлы или директории по glob-паттернам относительно `rootDir`

</td></tr>

<tr><td class="table-td">

```ts wrap
getDirectChildren(params: {
  folderPath: string;
  filter?: (filePath: string) => boolean;
  exclude?: RegExp;
}): Array<string>
```

</td><td>

Возвращает прямые дочерние файлы папки с опциональной фильтрацией

</td></tr>

</tbody></table>
