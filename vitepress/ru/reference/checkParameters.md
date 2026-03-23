### Аргументы

<table class="table-params"><tbody>

<tr><td class="table-td">

```ts wrap
schema: TypeRootSchema
```

</td><td>

Полная схема валидации контракта `{ request, response }`, возвращаемая `createValidators`

</td></tr>

<tr><td class="table-td">

```ts wrap
type: 'request' | 'response'
```

</td><td>

Часть схемы валидации, по которой проверяется значение

</td></tr>

<tr><td class="table-td">

```ts wrap
value: unknown
```

</td><td>

Проверяемые данные. Неизвестные поля объектов удаляются на месте (мутацией), даже при ошибках

</td></tr>

<tr><td class="table-td">

```ts wrap
getExtraneous?: (
  paths: Array<string>
) => void
```

</td><td>

Получает уникальные пути удалённых полей. Вызывается один раз, только при наличии удалений,
в том числе при ошибках проверки. Индексы массивов в путях заменяются на `[]`

</td></tr>

</tbody></table>
