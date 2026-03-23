<script setup>
import reexportBasic from '@/emulator/PluginReexport-basic.json';
import reexportComponent from '@/emulator/PluginReexport-component.json';
import reexportComponentIndex from '@/emulator/PluginReexport-component-index.json';
import reexportDeep from '@/emulator/PluginReexport-deep.json';
import reexportFeaturePublicApi from '@/emulator/PluginReexport-feature-public-api.json';
import reexportIcons from '@/emulator/PluginReexport-icons.json';
import reexportLazyPages from '@/emulator/PluginReexport-lazy-pages.json';
import reexportReducers from '@/emulator/PluginReexport-reducers.json';
import reexportRootStore from '@/emulator/PluginReexport-root-store.json';
import reexportTypeOnly from '@/emulator/PluginReexport-type-only.json';
import scaffoldComponentStory from '@/emulator/PluginScaffold-component-story.json';
import scaffoldFeatureSlice from '@/emulator/PluginScaffold-feature-slice.json';
import scaffoldNextPage from '@/emulator/PluginScaffold-next-page.json';
import modularFeatureEntrypoints from '@/emulator/PluginModular-feature-entrypoints.json';
import modularFeatureManifest from '@/emulator/PluginModular-feature-manifest.json';
import modularFeatureRoutes from '@/emulator/PluginModular-feature-routes.json';
import modularPageTypes from '@/emulator/PluginModular-page-types.json';
import translationsComponentMessages from '@/emulator/PluginTranslations-component-messages.json';
import translationsSync from '@/emulator/PluginTranslations-sync.json';
import validatorsCentralApi from '@/emulator/PluginValidators-central-api.json';
import validatorsFeatureApi from '@/emulator/PluginValidators-feature-api.json';
</script>

// #region reexport

# PluginReexport

Генерирует реэкспортные barrel-файлы и локальные `package.json` для выбранных папок, а также может использоваться для
создания RootStore, reducers map, объекта с изображениями или иконками и т.п.

Для каждой найденной папки плагин по умолчанию создает два файла:

- `_reexport.ts` с результатом `template`;
- `package.json` с `"main"` и `"types"`, указывающими на файл реэкспорта.

Глубина генерации реэкспортов зависит от `entries`: `utils/*` выбирает только непосредственные подпапки `utils`, а
`utils/**` — саму `utils` и все вложенные папки. При `utils/**` структура сгенерированных файлов выглядит так:

```text
utils/
├── _reexport.ts
├── package.json
├── scroll.ts
└── date/
    ├── _reexport.ts
    ├── package.json
    ├── getTime.ts
    └── format/
        ├── _reexport.ts
        ├── package.json
        └── formatDate.ts
```

При `utils/*` реэкспортные файлы создавались бы только в `utils/date`.

<!-- @include: ./reference/pluginReexportOptions.md -->

<GeneratorSandbox :recipe="reexportBasic" />

<GeneratorSandbox :recipe="reexportComponentIndex" />

<GeneratorSandbox :recipe="reexportComponent" />

<GeneratorSandbox :recipe="reexportDeep" />

<GeneratorSandbox :recipe="reexportTypeOnly" />

<GeneratorSandbox :recipe="reexportFeaturePublicApi" />

<GeneratorSandbox :recipe="reexportLazyPages" />

<GeneratorSandbox :recipe="reexportIcons" />

<GeneratorSandbox :recipe="reexportRootStore" />

<GeneratorSandbox :recipe="reexportReducers" />

// #endregion reexport

// #region scaffold

# PluginScaffold

Одноразово создает набор файлов по marker-файлу, не обновляя и не проверяя содержимое созданных файлов.

Если хотя бы один целевой файл уже существует, плагин оставляет marker и сообщает об ошибке. Когда все файлы успешно
записаны, marker удаляется.

Общий `headerTemplate` к файлам не добавляется.

<!-- @include: ./reference/pluginScaffoldOptions.md -->

<GeneratorSandbox :recipe="scaffoldFeatureSlice" />

<GeneratorSandbox :recipe="scaffoldNextPage" />

<GeneratorSandbox :recipe="scaffoldComponentStory" />

// #endregion scaffold

// #region modular

# PluginModular

Собирает информацию о наборе файлов или папок и генерирует один общий файл. Он подходит для случаев, где нужен
централизованный модуль на основе структуры проекта: реестр страниц, карта виджетов, список публичных entrypoint,
конфигурация роутов или импортов.

В отличие от `PluginReexport`, этот плагин не создает файл в каждой найденной папке, а пишет один `targetFile`
для каждой конфигурации.

В watch-режиме плагин реагирует только на добавление или удаление файлов, игнорируя изменение контента файлов.

<!-- @include: ./reference/pluginModularOptions.md -->

## Поля modules

<!-- @include: ./reference/pluginModularModuleFields.md -->

<GeneratorSandbox :recipe="modularFeatureEntrypoints" />

<GeneratorSandbox :recipe="modularPageTypes" />

<GeneratorSandbox :recipe="modularFeatureRoutes" />

<GeneratorSandbox :recipe="modularFeatureManifest" />

// #endregion modular

// #region validators

# PluginValidators

Генерирует схемы валидации из TypeScript-контрактов через библиотеку <Link to="api-contract-check/overview">
api-contract-check</Link>. Плагин читает входные API-файлы, находит типы запроса и ответа, строит сериализуемые схемы
валидации и записывает их в `targetFolder`. При удалении API-файла соответствующая схема валидации автоматически
удаляется.

Плагин работает инкрементально в watch-режиме благодаря хранению обратной карты зависимостей.

Целевой путь строится как `targetFolder + relativePathFromRootDir`. Если исходник находится в
`src/api/orders.ts`, а `targetFolder` — на `src/validators`, результат будет записан в
`src/validators/api/orders.ts`. Для удобства можно также использовать `PluginReexport` в папке `validators`.

Не забудьте подключить realtime-валидацию, как описано в разделе <Link to="api-contract-check/payload-validation">
Валидация данных</Link>.

<!-- @include: ./reference/pluginValidatorsOptions.md -->

<GeneratorSandbox :recipe="validatorsCentralApi" />

<GeneratorSandbox :recipe="validatorsFeatureApi" />

// #endregion validators

// #region translations

# PluginTranslations

Собирает сообщения из исходных файлов и создает JSON-файл с используемыми переводами. Плагин хранит `defaultValue`,
добавляет новые ключи, удаляет устаревшие и дозаполняет отсутствующие переводы через функцию
`translate`.

Уже существующие переводы сохраняются, а `defaultValue` обновляется при изменении исходного текста.

`translate` вызывается параллельно (до 5 потоков) и только для отсутствующих переводов.

<!-- @include: ./reference/pluginTranslationsOptions.md -->

<GeneratorSandbox :recipe="translationsComponentMessages" />

<GeneratorSandbox :recipe="translationsSync" />

// #endregion translations
