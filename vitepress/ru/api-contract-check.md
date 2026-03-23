<script setup>
import { data } from '@/dynamic.data';
</script>

// #region overview

# api-contract-check

<br>
<Badge type="info">Размер (builder): <span style="color:var(--docsearch-focus-color)">{{ data.builderSize }}</span></Badge>
<Badge type="info">Размер (checker): <span style="color:var(--docsearch-focus-color)">{{ data.checkerSize }}</span></Badge>

Эта библиотека входит в `@arfa-tools/generator` и строит сериализуемые схемы валидации из TypeScript-типов.
Поддерживаются TS alias для разрешения импортов, а также in-memory файлы (еще не сохраненные на диск) для длинных
цепочек преобразований.

Библиотека ориентирована на JSON-совместимые контракты. Неподдерживаемые типы деградируют до `any`, который принимает
любое значение. Деградации можно логировать.

Для большинства сценариев достаточно использовать <Link to="plugins/validators">PluginValidators</Link>, который уже
содержит эффективную схему использования библиотеки. Однако если генератор использовать не получится (например, у вас
свой пайплайн генерации или нужна кастомная логика), можно использовать API-интерфейс напрямую.

Сгенерированные схемы валидации подходят для проверки запросов и ответов API, формирования документации, генерации типов
для других языков, преобразования в схемы валидации сторонних библиотек и т.п.

## Поддерживаемые типы

- `any`, `number`, `object`, `boolean`, `string`, `null`, строковые, числовые и boolean literals;
- type aliases, interfaces, inline-объекты, обязательные и optional-свойства;
- наследование от базовых interfaces без generic-аргументов: свойства объединяются;
- массивы (`T[]`, `Array<T>`), фиксированные tuple и `Record<string, T>`;
- подстановка параметров generic type aliases, например `type Box<T> = { value?: T }`;
- indexed access по конкретному ключу объекта (`User['id']`) или элементу массива (`UserList[number]`);
- unions и пересечения объектов с совместимыми повторяющимися свойствами;
- самоссылки объекта внутри массивов, включая union и tuple: `children: Array<Node | string>`;
- enum с literal-инициализаторами и числовой автонумерацией, ссылки `Enum.Member`;
- именованные импорты, re-export, `export *` и path aliases из `tsconfig.json`.

Этого достаточно для описания практически всего, что может прийти из внешнего API.

<Accordion title="Пример поддерживаемых типов и сгенерированной схемы валидации">

<<< @/../units/api-contract-check/integration.test.ts#positiveContent

<<< @/../units/api-contract-check/integration.test.ts#positiveSchema

</Accordion>

## Неподдерживаемые (деградирующие до any) типы

- `Promise<T>`, `Map<K, V>` и другие неизвестные generic-контейнеры, generic interfaces и `extends Base<T>`;
- `Record<K, V>`, где ключ не задан непосредственно как `string`;
- dynamic или отсутствующие ключи indexed access, indexed access для tuple;
- mapped, conditional и function types, computed property names, вычисляемые enum-инициализаторы;
- optional- и rest-элементы tuple, несовместимые пересечения;
- прямые цикличные ссылки вне массивов, циклы aliases и рекурсивные корни, не являющиеся объектами;
- references через default/namespace imports; эти импорты учитываются только как файловые зависимости.

Деградации можно отслеживать через `getDegraded`. В union наличие ветки `any` превращает весь union в `any`.

<Accordion title="Пример неподдерживаемых типов и сгенерированной схемы валидации">

<<< @/../units/api-contract-check/integration.test.ts#fallbackContent

<<< @/../units/api-contract-check/integration.test.ts#fallbackSchema

</Accordion>

// #endregion overview

// #region schemaGeneration

# Генерация схем валидации

`createValidators` принимает список файлов и настройки проекта:

<!-- @include: @shared/api-contract-check/createValidatorsExample.md -->

Input-файлы должны локально объявлять оба root-типа через `type` или `interface`. Экспортировать их не обязательно. Файлы
без объявленных типов запроса и ответа пропускаются. Если объявлен только один из двух типов или не найдено ни одного
контракта (включая пустой список файлов), вызов завершится ошибкой.

<!-- @include: @shared/api-contract-check/contractTypesExample.md -->

Типы могут ссылаться на именованные импорты, включая `import type`, re-export и `export *` из barrel-файлов.
Поддерживаются path aliases из `tsconfig.json`.

<!-- @include: ./reference/createValidatorsReference.md -->

## In-memory файлы

`createValidators` читает файлы с диска, из памяти или из обоих источников. Пример чтения контрактов из памяти:

<!-- @include: @shared/api-contract-check/createValidatorsInMemoryExample.md -->

Это позволяет делать многочисленные трансформации и операции над файлами (например, если типы запроса и ответа выводятся
из OpenAPI, а `api-contract-check` на лету генерирует схемы валидации) и сохранять на диск единым батчем.

// #endregion schemaGeneration

// #region payloadValidation

# Валидация данных

<br>
<Badge type="info">Размер (checker): <span style="color:var(--docsearch-focus-color)">{{ data.checkerSize }}</span></Badge>

`check` проверяет объекты и массивы по схеме валидации. Поля, отсутствующие в схеме валидации, удаляются мутацией с
опциональным логированием. Несоответствия возвращаются списком ошибок.

Благодаря компактному размеру библиотеки и схемам валидации итоговый бандл увеличивается незначительно, а нативные
TS-типы не замедляют `tsc` и IDE, в отличие от библиотек, требующих описывать схемы валидации вручную и использующих
сложное выведение типов.

<!-- @include: @shared/api-contract-check/checkPayloadExample.md -->

Примеры errors:

<!-- @include: @shared/api-contract-check/checkErrorsOutput.md -->

<!-- @include: ./reference/checkParameters.md -->

## Использование в fetch

Обёртка для JSON POST-запросов использует сгенерированную схему валидации: проверяет запрос перед отправкой и ответ
перед возвратом. Таким образом, TS-типы запроса и ответа полностью совпадают с реальными данными.

<!-- @include: @shared/api-contract-check/httpRequestValidationExample.md -->

## Использование в WebSocket

Обёртка для WebSocket-запросов использует сгенерированную схему валидации: проверяет запрос перед отправкой и ответ
перед возвратом. Таким образом, TS-типы запроса и ответа полностью совпадают с реальными данными.

Сервер в данном случае принимает JSON-сообщения `{ id, method, payload }` и отвечает в формате `{ id, payload }`.

<!-- @include: @shared/api-contract-check/webSocketRequestValidationExample.md -->

// #endregion payloadValidation

// #region incrementalGeneration

# Инкрементальная генерация

Для пересборки после изменения зависимости можно сохранить `deps` полного запуска и обновлять после пересборки
затронутых entry-файлов.

Entry-файлы не включаются в `deps`, их нужно передавать напрямую.

<!-- @include: @shared/api-contract-check/createValidatorsIncrementalExample.md -->

// #endregion incrementalGeneration
