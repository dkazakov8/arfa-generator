import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { TypePreparedFiles } from '@arfa-tools/generator';
import * as biome from '@biomejs/wasm-nodejs';

const workspaceDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const biomeConfigPath = path.resolve(workspaceDirectory, 'biome.json');

biome.main();

const workspace = new biome.Workspace();
const { projectKey } = workspace.openProject({ path: workspaceDirectory, openUninitialized: true });

workspace.updateSettings({
  projectKey,
  workspaceDirectory,
  configuration: JSON.parse(fs.readFileSync(biomeConfigPath, 'utf-8')),
});

export function format(files: TypePreparedFiles): TypePreparedFiles {
  return files.map(({ content, filePath, plugin }) => {
    workspace.openFile({
      projectKey,
      path: filePath,
      content: { type: 'fromClient', content, version: 0 },
    });

    let result: biome.FixFileResult;

    try {
      result = workspace.fixFile({
        projectKey,
        path: filePath,
        fixFileMode: 'safeAndUnsafeFixes',
        shouldFormat: true,
        ruleCategories: ['syntax', 'lint', 'action'],
      });
    } finally {
      workspace.closeFile({ projectKey, path: filePath });
    }

    return { content: result.code, filePath, plugin };
  });
}
