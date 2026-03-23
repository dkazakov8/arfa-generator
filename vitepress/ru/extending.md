// #region customPlugin

# Свой плагин

Плагин — это класс, который наследуется от `BasePlugin` и возвращает массив предложенных файлов. Самостоятельно писать
файлы на диск плагину не нужно:
это делает `FileGenerator`, чтобы все артефакты проходили через общий `headerTemplate`, `format`, логирование, cleanup и
каскадные итерации.

### generate

Метод для рекомендации генератору создать или изменить файлы.

<!-- @include: @shared/extending/customPluginGenerateExample.md -->

<!-- @include: ./reference/basePluginGenerateParameters.md -->

При неизменных входных данных возвращайте одинаковое содержимое. `Date.now()`, случайные значения или другие
изменяющиеся данные внутри `generate` могут вызвать каскад (до лимита в 10 итераций).

### TypeGeneratedFiles

<!-- @include: ./reference/generatedFilesFields.md -->

### cleanup

Метод для рекомендации генератору удалить файлы.

<!-- @include: @shared/extending/customPluginCleanupExample.md -->

<!-- @include: ./reference/basePluginCleanupParameters.md -->

Cleanup вызывается после записи и получает результаты успешно завершившихся вызовов `generate` за текущую итерацию. Если
`generate` плагина выбросил исключение, его cleanup не выполняется, сохраняя ранее созданные артефакты.

### TypeCleanupFiles

<!-- @include: ./reference/cleanupFilesFields.md -->

## Встроенные helpers

`BasePlugin` содержит два helper-метода, которые возвращают отсортированные абсолютные пути:

<!-- @include: ./reference/basePluginHelpersReference.md -->

`entries` задаются относительно `rootDir` без абсолютных путей, а сегменты `..` не допускаются.

`exclude` проверяет имя файла или папки.

// #endregion customPlugin

// #region customChecker

# Свой чекер

Чекер — это класс, который наследуется от `BaseChecker` и проверяет уже стабилизированное состояние проекта. Чекеры
запускаются после того, как плагины завершили генерацию, cleanup, запись файлов и все каскадные итерации.

### check

<!-- @include: @shared/extending/customCheckerCheckExample.md -->

<!-- @include: ./reference/baseCheckerCheckParameters.md -->

## Регистрация ошибок

Если чекер может найти несколько независимых нарушений, лучше вызвать `checkerError` для каждого из них и не бросать
исключение, чтобы в логах сохранился весь список.

`throw` можно использовать для инфраструктурных сбоев: ошибки чтения, невозможность запустить внешний инструмент и т.п.
`FileGenerator` перехватит исключение и добавит его в общий результат как ошибку чекера, которая не блокирует следующий
чекер или метод `afterCheckers`.

// #endregion customChecker
