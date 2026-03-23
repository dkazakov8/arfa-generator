```ts
import path from 'node:path';

import {
  BasePlugin,
  type TypeCleanupFiles,
  type TypeGeneratedFiles,
  type TypePluginCleanupArgs,
  type TypePluginGenerateArgs,
} from '@arfa-tools/generator';

export class PluginBuildInfo extends BasePlugin {
  name = 'build-info';

  async generate({ rootDir }: TypePluginGenerateArgs): Promise<TypeGeneratedFiles> {
    return [{
      plugin: this.name,
      filePath: path.resolve(rootDir, 'generated/buildInfo/index.generated.ts'),
      rawContent: "export const generatorName = '@arfa-tools/generator';\n",
    }];
  }

  cleanup({ rootDir, generatedFiles, changedFiles }: TypePluginCleanupArgs): TypeCleanupFiles {
    // Cleanup only during runFullCycle()
    if (changedFiles) return [];

    const expectedPaths = new Set(
      generatedFiles
        .filter(({ plugin }) => plugin === this.name)
        .map(({ filePath }) => filePath)
    );

    return this.globToPaths({
      rootDir,
      entries: ['generated/buildInfo/*.generated.ts'],
      kind: 'file',
    })
      .filter((filePath) => !expectedPaths.has(filePath))
      .map((filePath) => ({ plugin: this.name, filePath }));
  }
}
```
