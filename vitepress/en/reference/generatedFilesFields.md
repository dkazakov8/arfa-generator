<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
plugin: string
```

</td><td>

The plugin name used in logs

</td></tr>

<tr><td class="table-td">

```ts wrap
filePath: string
```

</td><td>

The absolute path of the target file

</td></tr>

<tr><td class="table-td">

```ts wrap
rawContent: string
```

</td><td>

The content before `headerTemplate` and `format` are applied

</td></tr>

<tr><td class="table-td">

```ts wrap
skipHeader?: boolean
```

</td><td>

Disables the common header for this file. Useful for JSON, assets, documentation, etc.

</td></tr>

</tbody></table>
