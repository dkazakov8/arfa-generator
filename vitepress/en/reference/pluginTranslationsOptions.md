<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
entries: Array<string>
```

</td><td>

An array of glob patterns for finding files within <code>rootDir</code>

</td></tr>

<tr><td class="table-td">

```ts wrap
targetFile: string
```

</td><td>

The absolute path of the JSON file where translations are saved

</td></tr>

<tr><td class="table-td">

```ts wrap
languages: Array<string>
```

</td><td>

An array of language codes, such as `['en', 'ru', 'de']`

</td></tr>

<tr><td class="table-td">

```ts wrap
baseLanguage: string
```

</td><td>

The source language of the original text. Its text is stored in `defaultValue`; a separate translation for this
language is not created automatically. `translate` is called only for the other languages

</td></tr>

<tr><td class="table-td">

```ts wrap
parseMessages: (filePath: string) => Array<{ 
  name: string; 
  defaultValue: string 
}>
```

</td><td>

A function for extracting messages from a file

</td></tr>

<tr><td class="table-td">

```ts wrap
translate: (params: { 
  to: string; 
  text: string 
}) => Promise<string>
```

</td><td>

An asynchronous function for translating text from `baseLanguage` into a language specified in `languages`

</td></tr>

<tr><td class="table-td">

```ts wrap
getKey?: (params: { 
  rootDir: string; 
  name: string 
}) => string
```

</td><td>

A function for generating a unique translation key. Defaults to the messages file path relative to `rootDir`

</td></tr>

</tbody></table>
