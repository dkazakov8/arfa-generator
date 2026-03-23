<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
entries: Array<string>
```

</td><td>

Массив с glob-паттернами поиска файлов и папок внутри <code>rootDir</code>

</td></tr>

<tr><td class="table-td">

```ts wrap
entryKind: 'file' | 'dir'
```

</td><td>

Определяет, как обрабатываются совпадения с entries

</td></tr>

<tr><td class="table-td">

```ts wrap
targetFile: string
```

</td><td>

Абсолютный путь к файлу, который будет сгенерирован

</td></tr>

<tr><td class="table-td">

```ts wrap
template: (params: {
  modules: Array<{
    entryName: string;
    entryPath: string;
    moduleName: string;
    relativePath: string;
    entryFileName: string;
    rootRelativePath: string;
    files: Array<{
      ext: string;
      name: string;
      fileName: string;
      entryPath: string;
      relativePath: string;
      rootRelativePath: string;
    }>;
  }>;
  rootDir: string;
  targetFile: string;
  targetFolder: string;
}) => string;
```

</td><td>

Функция-шаблон, возвращающая содержимое целевого файла

</td></tr>

</tbody></table>
