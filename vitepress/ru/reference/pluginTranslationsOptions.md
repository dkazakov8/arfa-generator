<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
entries: Array<string>
```

</td><td>

Массив с glob-паттернами поиска файлов внутри <code>rootDir</code>

</td></tr>

<tr><td class="table-td">

```ts wrap
targetFile: string
```

</td><td>

Абсолютный путь к JSON-файлу, в который будут сохраняться переводы

</td></tr>

<tr><td class="table-td">

```ts wrap
languages: Array<string>
```

</td><td>

Массив кодов языков, например `['en', 'ru', 'de']`

</td></tr>

<tr><td class="table-td">

```ts wrap
baseLanguage: string
```

</td><td>

Базовый язык исходных текстов. Его текст хранится в `defaultValue`; отдельный перевод для этого языка автоматически
не создаётся. `translate` вызывается только для остальных языков

</td></tr>

<tr><td class="table-td">

```ts wrap
parseMessages: (filePath: string) => Array<{ 
  name: string; 
  defaultValue: string 
}>
```

</td><td>

Функция для извлечения сообщений из файла

</td></tr>

<tr><td class="table-td">

```ts wrap
translate: (params: { 
  to: string; 
  text: string 
}) => Promise<string>
```

</td><td>

Асинхронная функция для перевода текста с `baseLanguage` на указанный в `languages` язык

</td></tr>

<tr><td class="table-td">

```ts wrap
getKey?: (params: { 
  rootDir: string; 
  name: string 
}) => string
```

</td><td>

Функция для генерации уникального ключа перевода. По умолчанию — путь файла с сообщениями относительно `rootDir`

</td></tr>

</tbody></table>
