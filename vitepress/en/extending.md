// #region customPlugin

# Custom plugin

A plugin is a class that extends `BasePlugin` and returns an array of proposed files. The plugin does not need to
write files to disk itself: `FileGenerator` handles this so that all artifacts go through the common `headerTemplate`,
`format`, logging, cleanup, and cascading iterations.

### generate

A method for proposing files for the generator to create or modify.

<!-- @include: @shared/extending/customPluginGenerateExample.md -->

<!-- @include: ./reference/basePluginGenerateParameters.md -->

Return the same content for unchanged inputs. `Date.now()`, random values, or other changing data inside
`generate` can trigger cascading iterations (up to the limit of 10).

### TypeGeneratedFiles

<!-- @include: ./reference/generatedFilesFields.md -->

### cleanup

A method for proposing files for the generator to delete.

<!-- @include: @shared/extending/customPluginCleanupExample.md -->

<!-- @include: ./reference/basePluginCleanupParameters.md -->

Cleanup runs after writing and receives the results of successful `generate` calls from the current iteration. If a
plugin’s `generate` throws an exception, its cleanup is skipped, preserving previously created artifacts.

### TypeCleanupFiles

<!-- @include: ./reference/cleanupFilesFields.md -->

## Built-in helpers

`BasePlugin` provides two helper methods that return sorted absolute paths:

<!-- @include: ./reference/basePluginHelpersReference.md -->

`entries` are specified relative to `rootDir`; absolute paths and `..` segments are not allowed.

`exclude` matches against the file or folder name.

// #endregion customPlugin

// #region customChecker

# Custom checker

A checker is a class that extends `BaseChecker` and checks the stabilized state of the project. Checkers run
after plugins have completed generation, cleanup, file writes, and all cascading iterations.

### check

<!-- @include: @shared/extending/customCheckerCheckExample.md -->

<!-- @include: ./reference/baseCheckerCheckParameters.md -->

## Reporting errors

If a checker can find multiple independent violations, call `checkerError` for each one instead of throwing
an exception, so the full list is preserved in the logs.

Use `throw` for infrastructure failures, such as read errors or an inability to start an external tool.
`FileGenerator` catches the exception and adds it to the overall result as a checker error, without blocking
the next checker or the `afterCheckers` method.

// #endregion customChecker
