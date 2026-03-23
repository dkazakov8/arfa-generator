```ts
runFullCycle(params?: {
  onStart?: () => void;
  afterCheckers?: (args: TypeAfterCheckersArgs) => void | Promise<void>;
  afterFinish?: (args: TypeAfterFinishArgs) => void | Promise<void>;
}): Promise<void>

type TypeAfterCheckersArgs = {
  changedFiles: Array<{ relativePath: string; absolutePath: string }>;
  deletedFiles: Array<{ relativePath: string; absolutePath: string }>;
  isFullGeneration: boolean;
};

type TypeAfterFinishArgs = TypeAfterCheckersArgs & { logs: TypeLogs };
```
