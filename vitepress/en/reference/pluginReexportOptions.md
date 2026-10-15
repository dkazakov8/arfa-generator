<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
entries: Array<string>
```

</td><td>

An array of glob patterns for finding folders within <code>rootDir</code>

</td></tr>

<tr><td class="table-td">

```ts wrap
template: (params: { 
  folderName: string, 
  files: Array<{
    ext: string;
    name: string;
    fileName: string; 
  }> 
}) => string
```

</td><td>

A template function that returns the re-export file content. <code>files</code> is a sorted list of immediate child files and folders

</td></tr>

<tr><td class="table-td">

```ts wrap
exclude?: RegExp
```

</td><td>

A regular expression for excluding files and directories from processing

</td></tr>

<tr><td class="table-td">

```ts wrap
noPackage?: boolean
```

</td><td>

If `true`, `package.json` is not generated

</td></tr>

<tr><td class="table-td">

```ts wrap
onlyPackage?: boolean
```

</td><td>

If `true`, only `package.json` is generated, without a re-export file

</td></tr>

<tr><td class="table-td">

```ts wrap
validateContent?: (params: {
  ext: string;
  name: string;
  content: string;
  fileName: string;
  folderName: string;
}) => boolean
```

</td><td>

A function for validating file content. If it returns `false`, the file is not added to the re-exports. Only files are checked; child folders are added without content validation

</td></tr>

<tr><td class="table-td">

```ts wrap
fileNameTemplate?: (params: { 
  folderName: string 
}) => string
```

</td><td>

A template function for the generated re-export file name. Defaults to `_reexport.ts`

</td></tr>

</tbody></table>
