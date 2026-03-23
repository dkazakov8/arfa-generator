<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
entries: Array<string>
```

</td><td>

Массив с glob-паттернами поиска папок внутри <code>rootDir</code>

</td></tr>

<tr><td class="table-td">

```ts wrap
template: (params: { 
  folderName: string, 
  files: Array<{
    ext: string;
    name: string;
    fileName: string; 
  }> 
}) => string
```

</td><td>

Функция-шаблон, возвращающая содержимое файла реэкспорта. <code>files</code> — отсортированный список дочерних файлов и папок

</td></tr>

<tr><td class="table-td">

```ts wrap
exclude?: RegExp
```

</td><td>

Регулярное выражение для исключения файлов/директорий из обработки

</td></tr>

<tr><td class="table-td">

```ts wrap
noPackage?: boolean
```

</td><td>

Если `true`, `package.json` не будет сгенерирован

</td></tr>

<tr><td class="table-td">

```ts wrap
onlyPackage?: boolean
```

</td><td>

Если `true`, будет сгенерирован только `package.json` без файла реэкспорта

</td></tr>

<tr><td class="table-td">

```ts wrap
validateContent?: (params: {
  ext: string;
  name: string;
  content: string;
  fileName: string;
  folderName: string;
}) => boolean
```

</td><td>

Функция валидации содержимого файла. Если возвращает `false`, файл не добавляется в реэкспорт. Проверяет только файлы; дочерние папки добавляются без проверки содержимого

</td></tr>

<tr><td class="table-td">

```ts wrap
fileNameTemplate?: (params: { 
  folderName: string 
}) => string
```

</td><td>

Функция-шаблон для имени генерируемого файла реэкспорта. По умолчанию — `_reexport.ts`

</td></tr>

</tbody></table>
