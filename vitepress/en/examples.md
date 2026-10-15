<script setup>
import examplesTree from '../tree.json'
</script>

// #region examples-orders

# Demo: Order Management

This small order management interface demonstrates `@arfa-tools/generator` as a layer for generation, checks, and LLM
feedback in a typical React + Vite project. This example uses the FSD 2.1 architecture.

### Preview

<CodeView framework="orders" :tree="examplesTree" />

### Download

```shell
npx degit dkazakov8/arfa-generator/examples/orders react-example
cd react-example
npm install
```

### Run modes

| Command | Behavior |
|---------|----------|
| `npm run parallel` | One generation and check cycle, followed by a separate Vite build |
| `npm run parallel-watch` | Initial generation, then the generator watcher and Vite dev server with HMR run in parallel. In most cases, there are two HMR updates: the first after a file is edited, and the second after the generator writes new files. In this mode, the generator is unaware of build errors and does not include them in the unified report |
| `npm run generator-first` | One generation and check cycle, with the Vite build running inside `afterCheckers` |
| `npm run generator-first-watch` | Initial generation and build, then only the generator watches for changes; each subsequent build runs in `afterCheckers`. HMR is not available in this mode. Instead, a custom plugin reloads the page once, after the entire cycle, including the build, has completed. Build errors are included in the report |
| `npm run feedback` | Retrieves the latest report in Markdown format (useful for LLM agents) |

### Generated files

**ARFA Generator** creates and updates the following files (the list was retrieved
using <Link to="introduction/file-generator-api#getcontrolledfiles">getControlledFiles</Link>):

<!-- @include: @shared/examples/ordersGeneratedFilesOutput.md -->

### Try triggering errors

Run `npm run generator-first-watch` and make one change at a time. Retrieve the latest report with
`npm run feedback`. Undo each change before trying the next experiment.

- Rename the `TypeRequest` type in `src/shared/api/orders/contracts/orders.ts` and all its usages — a validation schema
  generation error.
- Import the orders page from the customers page — a violation of page boundaries.
- Import any page from a component in `shared/ui` — a violation of the shared layer’s boundaries.
- In `App.tsx`, change the import from `pages/orders` to `pages/orders/ui/OrdersPage` — a violation of the page’s public API.
- In `loadOrders.ts`, rename the exported async function while keeping the file name — a re-export validation error.
- In `OrderStatusBadge/messages.ts`, remove `export` from the messages declaration — a translation processing error.
- In `App.tsx`, import a module that does not exist — a Vite build error.
- Reference an undeclared variable in a TypeScript file — a tsc diagnostic.
- Add `debugger;` inside a function in `loadOrders.ts` — a Biome diagnostic.

// #endregion examples-orders
