<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
name: string
```

</td><td>

The checker name used in logs

</td></tr>

<tr><td class="table-td">

```ts wrap
getCommand: (args: {
  changedFiles: Array<{
    relativePath: string;
    absolutePath: string;
  }>;
  deletedFiles: Array<{
    relativePath: string;
    absolutePath: string;
  }>;
  isFullGeneration: boolean;
}) => false | Array<string>
```

</td><td>

A function that returns an array whose first element is the command and whose remaining elements are its arguments.
Returning `false` skips the check.

`changedFiles` contains unique paths of files added or changed by the user in watch mode, or written by the generator
across all iterations of the current run.

`deletedFiles` contains unique paths of files deleted by the user in watch mode, or by the generator during cleanup
across all iterations of the current run.

`isFullGeneration` is `true` for a full `runFullCycle()` run and `false` for an incremental run in watch mode.
Useful for deciding when to run a full check

</td></tr>

</tbody></table>
