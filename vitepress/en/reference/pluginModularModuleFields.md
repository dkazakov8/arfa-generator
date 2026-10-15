<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
entryPath
```

</td><td>

The absolute path of the matched file or folder

</td></tr>

<tr><td class="table-td">

```ts wrap
entryFileName
```

</td><td>

The full name of the matched file or folder, including the extension

</td></tr>

<tr><td class="table-td">

```ts wrap
entryName
```

</td><td>

The name from `path.parse(entryPath).name`, without the extension

</td></tr>

<tr><td class="table-td">

```ts wrap
moduleName
```

</td><td>

The name of the matched entry’s parent folder

</td></tr>

<tr><td class="table-td">

```ts wrap
relativePath
```

</td><td>

The path from `targetFolder` to the matched entry, without the extension

</td></tr>

<tr><td class="table-td">

```ts wrap
rootRelativePath
```

</td><td>

The path from `rootDir` to the matched entry, including the extension

</td></tr>

<tr><td class="table-td">

```ts wrap
files
```

</td><td>

For `entryKind: 'dir'`, the immediate child files and folders; for `'file'`, an empty array

</td></tr>

</tbody></table>
