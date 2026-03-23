### Аргументы

Первый аргумент — `input`, второй — объект с остальными перечисленными полями.

<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
input: Array<string>
```

</td><td>

Абсолютные пути входных файлов

</td></tr>

<tr><td class="table-td">

```ts wrap
tsconfigPath: string
```

</td><td>

Путь к `tsconfig.json` на диске для разрешения импортов и path aliases.
Относительный путь разрешается от `process.cwd()`

</td></tr>

<tr><td class="table-td">

```ts wrap
requestDeclaration: string
```

</td><td>

Имя локальной декларации типа запроса, например `TypeRequest`

</td></tr>

<tr><td class="table-td">

```ts wrap
responseDeclaration: string
```

</td><td>

Имя локальной декларации типа ответа, например `TypeResponse`

</td></tr>

<tr><td class="table-td">

```ts wrap
readFile?: (filePath: string) => string | undefined
```

</td><td>

Чтение исходников по абсолютному пути. Возврат `undefined` означает чтение с диска

</td></tr>

<tr><td class="table-td">

```ts wrap
getDegraded?: (names: Array<string>) => void
```

</td><td>

Получает отсортированные уникальные имена свойств или root-деклараций, деградировавших до `any`,
без полных путей. Вызывается один раз за запуск при наличии деградаций

</td></tr>

</tbody></table>

### Результат

<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
result: Array<{
  filePath: string;
  schema: {
    request: TypeSchema;
    response: TypeSchema;
  };
}>
```

</td><td>

Схемы валидации найденных контрактов. `filePath` — абсолютный путь файла;
`schema.request` и `schema.response` содержат сериализуемые схемы валидации запроса и ответа

</td></tr>

<tr><td class="table-td">

```ts wrap
deps: Record<string, Array<string>>
```

</td><td>

Обратная карта зависимостей: импортируемый файл → затронутые entry-файлы.
Все пути в ключах и значениях абсолютные

</td></tr>

</tbody></table>
