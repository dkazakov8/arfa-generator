### Arguments

<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
schema: TypeRootSchema
```

</td><td>

The complete `{ request, response }` contract validation schema returned by `createValidators`

</td></tr>

<tr><td class="table-td">

```ts wrap
type: 'request' | 'response'
```

</td><td>

The part of the validation schema used to check the value

</td></tr>

<tr><td class="table-td">

```ts wrap
value: unknown
```

</td><td>

The data to validate. Unknown object fields are deleted in place (by mutation), even when validation errors occur

</td></tr>

<tr><td class="table-td">

```ts wrap
getExtraneous?: (
  paths: Array<string>
) => void
```

</td><td>

Receives unique paths of deleted fields. Called once, only if fields were deleted,
including when validation errors occur. Array indices in paths are replaced with `[]`

</td></tr>

</tbody></table>
