<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
tsconfigPath: string
```

</td><td>

The path to tsconfig for resolving imports and types

</td></tr>

<tr><td class="table-td">

```ts wrap
extensions: Array<string>
```

</td><td>

An array of file extensions to check

</td></tr>

<tr><td class="table-td">

```ts wrap
rules: Array<{
  entries: Array<string>;
  exclude?: RegExp;
  allow: {
    imports: Array<string>;
    importsInsideScope: 
      'none' | 'all' | 'sameTopLevel';
    node?: boolean;
    external?: boolean;
  };
}>
```

</td><td>

An array of rules, each containing:

<code>entries</code> — glob patterns for finding files relative to <code>rootDir</code>, such as `features/**`<br/>
<code>exclude</code> — a regular expression for excluding files from processing<br/>

<code>allow</code> — an object with the following fields:

<code>imports</code> — glob patterns for allowed imports relative to <code>rootDir</code><br/>
<code>importsInsideScope</code> — the policy for imports within the scope<br/>
<code>node</code> — allows imports with the `node:` prefix<br/>
<code>external</code> — allows modules identified by TypeScript as external libraries

</td></tr>

</tbody></table>
