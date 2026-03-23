```ts
const generator = new FileGenerator({
  rootDir,
  plugins: [],
  historyPath: path.resolve(rootDir, '../.llm/history.jsonl'),
});

await generator.runFullCycle();

await generator.startWatch();
```
