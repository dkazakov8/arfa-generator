```ts obj
startWatch(params?: {
  onStart?: () => void;
  afterCheckers?: (args: TypeAfterCheckersArgs) => void | Promise<void>;
  afterFinish?: (args: TypeAfterFinishArgs) => void | Promise<void>;
  aggregationTimeout?: number;
}): Promise<void>
```
