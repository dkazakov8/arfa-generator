<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
entryPath
```

</td><td>

Абсолютный путь найденного файла или папки

</td></tr>

<tr><td class="table-td">

```ts wrap
entryFileName
```

</td><td>

Полное имя найденного файла или папки, включая расширение

</td></tr>

<tr><td class="table-td">

```ts wrap
entryName
```

</td><td>

Имя из `path.parse(entryPath).name`, без расширения

</td></tr>

<tr><td class="table-td">

```ts wrap
moduleName
```

</td><td>

Имя родительской папки найденного элемента

</td></tr>

<tr><td class="table-td">

```ts wrap
relativePath
```

</td><td>

Путь от `targetFolder` к найденному элементу без расширения

</td></tr>

<tr><td class="table-td">

```ts wrap
rootRelativePath
```

</td><td>

Путь от `rootDir` к найденному элементу, с расширением

</td></tr>

<tr><td class="table-td">

```ts wrap
files
```

</td><td>

При `entryKind: 'dir'` — непосредственные дочерние файлы и папки; при `'file'` — пустой массив

</td></tr>

</tbody></table>
