<script setup>
import boundariesApiLayers from '@/emulator/CheckerBoundaries-api-layers.json';
import boundariesFeatureIsolation from '@/emulator/CheckerBoundaries-feature-isolation.json';
import boundariesRuntimeImports from '@/emulator/CheckerBoundaries-runtime-imports.json';
import cliBiomeChangedFiles from '@/emulator/CheckerCli-biome-changed-files.json';
import cliTypeScript from '@/emulator/CheckerCli-typescript.json';
import cliVitestRelated from '@/emulator/CheckerCli-vitest-related.json';
import envKeysEnvFiles from '@/emulator/CheckerEnvKeys-env-files.json';
import envKeysParsedEnv from '@/emulator/CheckerEnvKeys-parsed-env.json';
import envKeysDuplicates from '@/emulator/CheckerEnvKeys-duplicate-keys.json';
</script>

// #region cli

# CheckerCli

Runs an external CLI command within the generator’s unified pipeline, with `cwd: rootDir`. The command runs
synchronously through `spawnSync`. Standard output from successful runs is not included in the logs. If the command
fails, its output, exit code, signal, and other available information are logged.

<!-- @include: ./reference/checkerCliOptions.md -->

<GeneratorSandbox :recipe="cliVitestRelated" />

<GeneratorSandbox :recipe="cliBiomeChangedFiles" />

<GeneratorSandbox :recipe="cliTypeScript" />

// #endregion cli

// #region env-keys

# CheckerEnvKeys

Checks that multiple lists of keys match and that each list contains no duplicates. For security, the checker does not
read files itself; parsing them is left to the user.

For watch mode, env files must be inside `rootDir`. Pass keys through the `envKeys` getter, as shown in the examples:
an array created once will not update.

<!-- @include: ./reference/checkerEnvKeysOptions.md -->

<GeneratorSandbox :recipe="envKeysEnvFiles" />

<GeneratorSandbox :recipe="envKeysParsedEnv" />

<GeneratorSandbox :recipe="envKeysDuplicates" />

// #endregion env-keys

// #region boundaries

# CheckerBoundaries

Checks architectural import boundaries: scans the project’s TypeScript files, resolves imports through
`tsconfig.json`, and reports forbidden imports, grouping violations by file.

<!-- @include: ./reference/checkerBoundariesOptions.md -->

## importsInsideScope

- `none` — forbids imports within the same scope unless explicitly allowed through `allow.imports`;
- `all` — allows any cross-imports within the scope;
- `sameTopLevel` — allows imports within the same module or feature, but forbids imports from a neighboring module
  or feature.

<GeneratorSandbox :recipe="boundariesApiLayers" />

<GeneratorSandbox :recipe="boundariesFeatureIsolation" />

<GeneratorSandbox :recipe="boundariesRuntimeImports" />

// #endregion boundaries
