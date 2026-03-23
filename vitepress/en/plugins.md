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

Generates re-export barrel files and local `package.json` files for selected folders. It can also be used to
create a RootStore, a reducers map, an object containing images or icons, and more.

By default, the plugin creates two files for each matched folder:

- `_reexport.ts` with the result of `template`;
- `package.json` with `"main"` and `"types"` pointing to the re-export file.

The depth of re-export generation depends on `entries`: `utils/*` selects only the immediate subfolders of `utils`,
while `utils/**` selects `utils` itself and all nested folders. With `utils/**`, the generated file structure looks like this:

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

With `utils/*`, re-export files would be created only in `utils/date`.

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

Creates a set of files once, based on a marker file, without updating or checking the contents of the created files.

If any target file already exists, the plugin leaves the marker in place and reports an error. Once all files have
been written successfully, the marker is deleted.

The common `headerTemplate` is not added to these files.

<!-- @include: ./reference/pluginScaffoldOptions.md -->

<GeneratorSandbox :recipe="scaffoldFeatureSlice" />

<GeneratorSandbox :recipe="scaffoldNextPage" />

<GeneratorSandbox :recipe="scaffoldComponentStory" />

// #endregion scaffold

// #region modular

# PluginModular

Collects information about a set of files or folders and generates a single combined file. Use it when you need
a central module based on the project structure: a page registry, widget map, list of public entry points,
or route or import configuration.

Unlike `PluginReexport`, this plugin does not create a file in every matched folder. Instead, it writes one `targetFile`
per configuration.

In watch mode, the plugin responds only to files being added or deleted, ignoring changes to file content.

<!-- @include: ./reference/pluginModularOptions.md -->

## modules fields

<!-- @include: ./reference/pluginModularModuleFields.md -->

<GeneratorSandbox :recipe="modularFeatureEntrypoints" />

<GeneratorSandbox :recipe="modularPageTypes" />

<GeneratorSandbox :recipe="modularFeatureRoutes" />

<GeneratorSandbox :recipe="modularFeatureManifest" />

// #endregion modular

// #region validators

# PluginValidators

Generates validation schemas from TypeScript contracts using the <Link to="api-contract-check/overview">
api-contract-check</Link> library. The plugin reads input API files, finds request and response types, builds
serializable validation schemas, and writes them to `targetFolder`. When an API file is deleted, its corresponding
validation schema is deleted automatically.

The plugin works incrementally in watch mode by maintaining a reverse dependency map.

The target path is constructed as `targetFolder + relativePathFromRootDir`. If the source is located at
`src/api/orders.ts` and `targetFolder` is set to `src/validators`, the result is written to
`src/validators/api/orders.ts`. For convenience, you can also use `PluginReexport` in the `validators` folder.

Remember to enable runtime validation as described in <Link to="api-contract-check/payload-validation">
Payload validation</Link>.

<!-- @include: ./reference/pluginValidatorsOptions.md -->

<GeneratorSandbox :recipe="validatorsCentralApi" />

<GeneratorSandbox :recipe="validatorsFeatureApi" />

// #endregion validators

// #region translations

# PluginTranslations

Collects messages from source files and creates a JSON file containing the translations in use. The plugin stores
`defaultValue`, adds new keys, removes obsolete ones, and fills in missing translations through the
`translate` function.

Existing translations are preserved, while `defaultValue` is updated when the source text changes.

`translate` is called concurrently (up to 5 calls at a time) and only for missing translations.

<!-- @include: ./reference/pluginTranslationsOptions.md -->

<GeneratorSandbox :recipe="translationsComponentMessages" />

<GeneratorSandbox :recipe="translationsSync" />

// #endregion translations
