<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
globToPaths(params: {
  rootDir: string;
  entries: Array<string>;
  kind: 'file' | 'dir';
  exclude?: RegExp;
}): Array<string>
```

</td><td>

Finds files or directories using glob patterns relative to `rootDir`

</td></tr>

<tr><td class="table-td">

```ts wrap
getDirectChildren(params: {
  folderPath: string;
  filter?: (filePath: string) => boolean;
  exclude?: RegExp;
}): Array<string>
```

</td><td>

Returns the immediate child files of a folder, with optional filtering

</td></tr>

</tbody></table>
