<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
tsconfigPath: string
```

</td><td>

Путь к tsconfig для резолвинга импортов и типов

</td></tr>

<tr><td class="table-td">

```ts wrap
extensions: Array<string>
```

</td><td>

Массив расширений файлов для проверки

</td></tr>

<tr><td class="table-td">

```ts wrap
rules: Array<{
  entries: Array<string>;
  exclude?: RegExp;
  allow: {
    imports: Array<string>;
    importsInsideScope: 
      'none' | 'all' | 'sameTopLevel';
    node?: boolean;
    external?: boolean;
  };
}>
```

</td><td>

Массив правил, каждое из которых содержит:

<code>entries</code> — glob-паттерны поиска файлов относительно <code>rootDir</code>, например `features/**`<br/>
<code>exclude</code> — регулярное выражение для исключения файлов из обработки<br/>

<code>allow</code> — объект с полями:

<code>imports</code> — glob-паттерны разрешённых импортов относительно <code>rootDir</code><br/>
<code>importsInsideScope</code> — разрешение импортов внутри области<br/>
<code>node</code> — разрешить импорты с `node:` префиксом<br/>
<code>external</code> — разрешить модули, определённые TypeScript как внешние библиотеки

</td></tr>

</tbody></table>
