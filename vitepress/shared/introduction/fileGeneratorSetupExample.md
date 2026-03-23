```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { 
  FileGenerator, 
  PluginReexport, 
  logsToConsole 
} from '@arfa-tools/generator';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), 
  '../src'
);

const generator = new FileGenerator({
  rootDir,
  plugins: [
    new PluginReexport([
      {
        entries: ['models'],
        template({ files }) {
          return files
            .map(({ name }) => `export * from './${name}';`)
            .join('\n');
        },
      },
    ]),
  ],
});

await generator.runFullCycle({
  afterCheckers() {
    // maybe run bundler
  },
  afterFinish({ logs }) {
    logsToConsole(logs, { verbosity: 'normal' });
  },
});
```
