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

Запускает внешнюю CLI-команду в рамках единого пайплайна генератора с `cwd: rootDir`. Команда выполняется синхронно
через `spawnSync`. stdout успешного выполнения не попадает в логи, а при неуспешном попадает вывод команды, exit code,
сигнал и другая доступная информация.

<!-- @include: ./reference/checkerCliOptions.md -->

<GeneratorSandbox :recipe="cliVitestRelated" />

<GeneratorSandbox :recipe="cliBiomeChangedFiles" />

<GeneratorSandbox :recipe="cliTypeScript" />

// #endregion cli

// #region env-keys

# CheckerEnvKeys

Проверяет совпадение нескольких списков ключей и дубликаты внутри них. Для безопасности чекер не читает файлы сам, их
парсинг остается за пользователем.

Для watch-режима env-файлы должны находиться внутри `rootDir`. Передавайте ключи через геттер `envKeys`, как в примерах:
массив, созданный один раз, не обновится.

<!-- @include: ./reference/checkerEnvKeysOptions.md -->

<GeneratorSandbox :recipe="envKeysEnvFiles" />

<GeneratorSandbox :recipe="envKeysParsedEnv" />

<GeneratorSandbox :recipe="envKeysDuplicates" />

// #endregion env-keys

// #region boundaries

# CheckerBoundaries

Проверяет архитектурные границы импортов: проходит по TypeScript-файлам проекта, резолвит импорты через
`tsconfig.json` и сообщает о запрещенных импортах, группируя нарушения по файлам.

<!-- @include: ./reference/checkerBoundariesOptions.md -->

## importsInsideScope

- `none` — запрещает импорты внутри той же области, если они явно не разрешены через `allow.imports`;
- `all` — разрешает любые кросс-импорты внутри области;
- `sameTopLevel` — разрешает импорты внутри одного модуля / feature, но запрещает импортировать из соседнего модуля /
  feature.

<GeneratorSandbox :recipe="boundariesApiLayers" />

<GeneratorSandbox :recipe="boundariesFeatureIsolation" />

<GeneratorSandbox :recipe="boundariesRuntimeImports" />

// #endregion boundaries
