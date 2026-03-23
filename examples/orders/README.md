# Demo: Order Management

This small order management interface demonstrates `@arfa-tools/generator` as a generation, checking, and LLM
feedback layer in a typical React + Vite project. The example uses the FSD 2.1 architecture.

## Download

```shell
npx degit dkazakov8/arfa-generator/examples/orders react-example
cd react-example
npm install
```

## Run modes

| Command | Behavior |
|---------|----------|
| `npm run parallel` | One generation and checking pass, followed by a separate Vite build. |
| `npm run parallel-watch` | Initial generation, then the generator watcher and Vite dev server run in parallel with HMR. Most edits trigger two HMR updates: one after the source file changes and another after the generator writes new files. Build errors are not included in the generator's report. |
| `npm run generator-first` | One generation and checking pass, with the Vite build called inside `afterCheckers`. |
| `npm run generator-first-watch` | Initial generation and build, then the generator watches for changes and calls each subsequent build inside `afterCheckers`. A custom plugin reloads the page once after the entire cycle, including the build, instead of using HMR. Build errors are included in the report. |
| `npm run feedback` | Read the latest report in Markdown format, suitable for LLM agents. |

## Generated files

**ARFA Generator** creates and updates the following files:

```text
src/pages/customers/api/index.ts
src/pages/customers/index.ts
src/pages/customers/ui/CustomerStatusBadge/package.json
src/pages/invoices/api/index.ts
src/pages/invoices/index.ts
src/pages/invoices/ui/InvoiceStatusBadge/package.json
src/pages/orders/api/index.ts
src/pages/orders/index.ts
src/pages/orders/ui/OrderStatusBadge/package.json
src/shared/api/customers/index.ts
src/shared/api/invoices/index.ts
src/shared/api/orders/index.ts
src/shared/api/validators/shared/api/customers/contracts/customers.ts
src/shared/api/validators/shared/api/invoices/contracts/invoices.ts
src/shared/api/validators/shared/api/orders/contracts/orders.ts
src/shared/api/validators/shared/api/orders/contracts/updateOrderStatus.ts
src/shared/i18n/index.ts
src/shared/i18n/usedTranslations.json
src/shared/lib/dates/index.ts
src/shared/lib/money/index.ts
src/shared/lib/timing/index.ts
src/shared/ui/Button/index.ts
src/shared/ui/Button/package.json
src/shared/ui/DataTable/index.ts
src/shared/ui/DataTable/package.json
src/shared/ui/EmptyState/index.ts
src/shared/ui/EmptyState/package.json
src/shared/ui/MoneyText/index.ts
src/shared/ui/MoneyText/package.json
```

This list was obtained using the generator's built-in tools: `removeGeneratedFiles` removed the generated files,
a full generation pass recreated them, and the Markdown report listed the files that were created.

```text
node --input-type=module -e 'const { generator } = await import("./builder/generator.ts"); await generator.removeGeneratedFiles();'
npm run generator-first
npm run feedback
```

## Try triggering errors

Run `npm run generator-first-watch` and make one change at a time. Use `npm run feedback` to read the latest report.
Undo each change before trying the next example.

- Rename the `TypeRequest` type in `src/shared/api/orders/contracts/orders.ts` along with its usages in that file
  to trigger a validation schema generation error.
- Import the orders page from the customers page to trigger a boundary violation between pages.
- Import any page from a component in `shared/ui` to trigger a shared layer boundary violation.
- In `App.tsx`, change the import from `pages/orders` to `pages/orders/ui/OrdersPage` to bypass the page's public API
  and trigger a boundary violation.
- In `loadOrders.ts`, rename the exported async function while keeping the filename to trigger a reexport
  validation error.
- In `OrderStatusBadge/messages.ts`, remove `export` from the messages declaration to trigger a translation
  processing error.
- In `App.tsx`, import a nonexistent module to trigger a Vite build error.
- Reference an undeclared variable in a TypeScript file to trigger a tsc diagnostic.
- Add `debugger;` inside the function in `loadOrders.ts` to trigger a Biome diagnostic.
