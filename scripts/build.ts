import * as fs from 'node:fs';
import * as path from 'node:path';

// @ts-ignore
import globalPkg from '../package.json' with { type: 'json' };
import { createExamplesTree } from './createExamplesTree';
import { buildRecipes } from './emulator/buildRecipes';
import { generateLlms } from './generateLlms.ts';
import { getCompressedSize } from './measure';
import { saveMetrics } from './saveMetrics';

const builderImport = '@arfa-tools/generator/api-contract-check/builder';

async function generateBuild(fileName: string, target: 'node' | 'browser', options?: { includeInExports?: boolean }) {
  const startTime = performance.now();

  const entryFile_path = path.resolve('src', fileName);
  const outFolder_path = path.resolve('dist');
  const outFile_path = path.resolve(outFolder_path, fileName);

  await Bun.build({
    entrypoints: [entryFile_path],
    outdir: path.dirname(outFile_path),
    naming: `${path.basename(outFile_path)}.mjs`,
    target,
    format: 'esm',
    packages: 'external',
    external: [builderImport],
    plugins: [
      {
        name: 'builder-alias',
        setup(build) {
          build.onLoad({ filter: /\.ts$/ }, async ({ path: filePath }) => ({
            contents: (await Bun.file(filePath).text()).replaceAll('#builder', builderImport),
            loader: 'ts',
          }));
        },
      },
    ],
    minify: false,
    sourcemap: 'none',
    splitting: false,
    treeShaking: true,
  });

  fs.readdirSync(path.resolve())
    .filter((file) => file.endsWith('.tsbuildinfo'))
    .forEach((file) => {
      fs.rmSync(path.resolve(file), { force: true });
    });

  const endTime = performance.now();

  console.log(`\x1b[32m[${fileName}]\x1b[0m built in \x1b[33m${(endTime - startTime).toFixed(2)}ms\x1b[0m`);

  return {
    relativePath: `./${path.relative(path.resolve('dist'), outFile_path).replaceAll('\\', '/')}`,
    includeInExports: options?.includeInExports !== false,
  };
}

void Promise.all([
  generateBuild('generator/index', 'node'),
  generateBuild('api-contract-check/builder', 'node'),
  generateBuild('api-contract-check/checker', 'browser'),
  generateBuild('consumeFeedback', 'node', { includeInExports: false }),
]).then(async (builtPackages) => {
  const exports: Record<string, string | { types: string; default: string }> = {
    './package.json': './package.json',
  };

  builtPackages.forEach(({ relativePath, includeInExports }) => {
    if (!includeInExports) return;

    exports[relativePath.replace('/generator/index', '')] = {
      types: `${relativePath}.d.ts`,
      default: `${relativePath}.mjs`,
    };
  });

  const releasePkg = {
    name: globalPkg.name,
    author: globalPkg.author,
    license: globalPkg.license,
    version: globalPkg.version,
    description: globalPkg.description,
    homepage: globalPkg.homepage,
    bugs: globalPkg.bugs,
    repository: globalPkg.repository,
    type: 'module',
    sideEffects: false,
    dependencies: globalPkg.dependencies,
    peerDependencies: globalPkg.peerDependencies,
    exports,
    types: (exports[`.`] as any).types,
    engines: globalPkg.engines,
  };

  fs.writeFileSync(path.resolve('./dist/package.json'), `${JSON.stringify(releasePkg, null, 2)}\n`, 'utf8');

  const outputTypeValidators = fs.readFileSync(path.resolve('./dist/generator/plugins/PluginValidators.d.ts'), 'utf8');

  fs.writeFileSync(
    path.resolve('./dist/generator/plugins/PluginValidators.d.ts'),
    outputTypeValidators.replace('#builder', builderImport),
    'utf8'
  );

  fs.cpSync(path.resolve('README.md'), path.resolve('dist/README.md'));

  for (const { relativePath } of builtPackages) {
    const size = (await getCompressedSize(path.resolve(`dist/${relativePath}.mjs`))).compressed;

    // @ts-ignore
    saveMetrics({ key: `size-${relativePath.replace('./', '')}`, value: `${size}kb` });
  }

  await createExamplesTree();

  await buildRecipes();

  generateLlms();
});
