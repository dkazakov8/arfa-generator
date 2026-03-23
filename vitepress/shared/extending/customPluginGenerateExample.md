```ts
import path from 'node:path';

import { 
  BasePlugin, 
  type TypeGeneratedFiles, 
  type TypePluginGenerateArgs 
} from '@arfa-tools/generator';

export class PluginBuildInfo extends BasePlugin {
  name = 'build-info';

  async generate({ 
    rootDir, 
    pluginLog 
  }: TypePluginGenerateArgs): Promise<TypeGeneratedFiles> {
    pluginLog({ plugin: this.name, message: 'Generating build info' });

    return [
      {
        plugin: this.name,
        filePath: path.resolve(rootDir, 'buildInfo.generated.ts'),
        rawContent: "export const generatorName = '@arfa-tools/generator';\n",
      },
    ];
  }
}
```
