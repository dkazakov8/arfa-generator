<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
entries: Array<string>
```

</td><td>

An array of glob patterns for finding files and folders within <code>rootDir</code>

</td></tr>

<tr><td class="table-td">

```ts wrap
entryKind: 'file' | 'dir'
```

</td><td>

Determines how matches for entries are processed

</td></tr>

<tr><td class="table-td">

```ts wrap
targetFile: string
```

</td><td>

The absolute path of the file to generate

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

A template function that returns the target file content

</td></tr>

</tbody></table>
