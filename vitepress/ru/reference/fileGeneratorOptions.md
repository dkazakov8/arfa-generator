<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
ci?: boolean
```

</td><td>

Режим CI, по умолчанию `false`. При `true` вызовы `startWatch()` и параметр `historyPath` игнорируются, а при возникновении
ошибок выбрасывается исключение

</td></tr>

<tr><td class="table-td">

```ts wrap
rootDir: string
```

</td><td>

Корневая директория для glob-паттернов плагинов и watch-режима. Генератор не меняет файлы за её пределами

</td></tr>

<tr><td class="table-td">

```ts wrap
plugins: Array<BasePlugin>
```

</td><td>

Плагины, которые предлагают файлы для записи. Выполняются в порядке объявления на каждой итерации

</td></tr>

<tr><td class="table-td">

```ts wrap
checkers?: Array<BaseChecker>
```

</td><td>

Проверки, которые запускаются после завершения работы плагинов и каскадных изменений

</td></tr>

<tr><td class="table-td">

```ts wrap
format?: (files: {
  plugin: string;
  content: string;
  filePath: string;
}) => {
  plugin: string;
  content: string;
  filePath: string;
} | Promise<{
  plugin: string;
  content: string;
  filePath: string;
}>
```

</td><td>

Функция форматирования содержимого файлов, предложенных плагинами. Вызывается перед сравнением с содержимым на диске и
записью

</td></tr>

<tr><td class="table-td">

```ts wrap
headerTemplate?: string
```

</td><td>

Общий текст, добавляемый в начало каждого сгенерированного файла, если плагин не указал `skipHeader`

</td></tr>

<tr><td class="table-td">

```ts wrap
historyPath?: string
```

</td><td>

Абсолютный путь к файлу с результатами запусков в формате JSONL, при `ci: true` или если не указан — история не читается и не записывается 

Размещайте файл за пределами `rootDir`, чтобы обновление не вызывало watch-события

</td></tr>

</tbody></table>
