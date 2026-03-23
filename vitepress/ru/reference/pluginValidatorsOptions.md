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
exclude?: RegExp
```

</td><td>

Регулярное выражение для исключения файлов из обработки

</td></tr>

<tr><td class="table-td">

```ts wrap
requestDeclaration: string
```

</td><td>

Имя декларации типа запроса (например, `Request`)

</td></tr>

<tr><td class="table-td">

```ts wrap
responseDeclaration: string
```

</td><td>

Имя декларации типа ответа (например, `Response`)

</td></tr>

<tr><td class="table-td">

```ts wrap
targetFolder: string
```

</td><td>

Папка, куда будут сгенерированы файлы со схемами валидации

</td></tr>

<tr><td class="table-td">

```ts wrap
tsconfigPath: string
```

</td><td>

Путь к tsconfig для поиска ts-алиасов и резолвинга путей

</td></tr>

<tr><td class="table-td">

```ts wrap
formatContent: (params: {
  schema: TypeBuilderOutputFile['schema'];
  sourcePath: string;
  targetPath: string;
}) => string
```

</td><td>

Функция форматирования содержимого файла со схемой валидации

</td></tr>

<tr><td class="table-td">

```ts wrap
getDegraded?: (degraded: Array<string>) => void
```

</td><td>

Колбэк для получения списка деградировавших до `any` типов. Вызывается до ошибки при `bailOnDegraded: true`

</td></tr>

<tr><td class="table-td">

```ts wrap
bailOnDegraded?: boolean
```

</td><td>

По умолчанию `false`: деградации не прерывают генерацию. При `true` после вызова `getDegraded` плагин
выбрасывает ошибку со списком деградаций. Для завершения всей генерации с ошибкой
включите также `ci: true` у `FileGenerator`

</td></tr>

</tbody></table>
