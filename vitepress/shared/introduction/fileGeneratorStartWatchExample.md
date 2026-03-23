```ts
await generator.startWatch({
  aggregationTimeout: 50,
  afterCheckers() {
    // maybe run bundler
  },
  afterFinish({ logs }) {
    logsToConsole(logs, { verbosity: 'normal' });
  },
});
```
