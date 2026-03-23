<table class="table-params"><tbody>

<tr><td class="table-td">

```text
--path
```

</td><td>

The path to the JSONL file. Relative paths are resolved from the current working directory;
defaults to `.llm/history.jsonl`

</td></tr>

<tr><td class="table-td">

```text
--wait-timeout
```

</td><td>

How long to wait for the result, in milliseconds. Defaults to `10000`

</td></tr>

<tr><td class="table-td">

```text
--poll-interval
```

</td><td>

The JSONL polling interval, in milliseconds. Defaults to `200`

</td></tr>

<tr><td class="table-td">

```text
--instructions
```

</td><td>

The path to the Markdown file with custom instructions. Relative paths are resolved from the current working
directory; defaults to `.llm/instructions.md`

</td></tr>

</tbody></table>
