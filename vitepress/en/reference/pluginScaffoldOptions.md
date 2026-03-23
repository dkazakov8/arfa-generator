<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
entries: Array<string>
```

</td><td>

An array of glob patterns for finding files within <code>rootDir</code>, such as `['features/*/.feature']`

</td></tr>

<tr><td class="table-td">

```ts wrap
createFiles: (params: {
  folderName: string;
  folderPath: string;
}) => Array<{
  filePath: string;
  content: string;
}>
```

</td><td>

Returns a set of files for the folder containing the marker.<br />

`folderPath` and `filePath` must be absolute paths; otherwise, the plugin reports an error

</td></tr>

</tbody></table>
