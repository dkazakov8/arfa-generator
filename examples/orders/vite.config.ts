import fs from 'node:fs';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

function tsPathsToViteAlias(): Record<string, string> {
  const tsconfig: Record<string, any> = JSON.parse(
    fs.readFileSync(path.resolve('tsconfig.json'), 'utf-8')
  );
  const aliases: Record<string, string> = {};

  Object.entries(tsconfig.compilerOptions?.paths).forEach(([alias, substitutions]) => {
    aliases[alias.replace(/\/\*$/, '')] = path.resolve(
      (substitutions as any)[0].replace(/\/\*$/, '')
    );
  });

  return aliases;
}

export default defineConfig({
  plugins: [react()],
  resolve: { alias: tsPathsToViteAlias() },
  server: { port: 5174 },
});
