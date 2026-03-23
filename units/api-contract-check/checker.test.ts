import { describe, expect, it, mock } from 'bun:test';

import { check } from '../../src/api-contract-check/checker';

describe('Checker runtime validation', () => {
  it('accepts valid tuple values and reports item and length errors', () => {
    const schema = {
      request: ['tuple', 'number', 'string'],
      response: 'any',
    } as const;

    expect(check({ schema, type: 'request', value: [1, 'ok'] })).toBeNull();
    expect(check({ schema, type: 'request', value: [1, 2] })).toEqual(['request[1] is not a string']);
    expect(check({ schema, type: 'request', value: [1, 'ok', 'extra'] })).toEqual([
      'request does not match tuple length',
    ]);
  });

  it('validates record entries and removes nested extraneous fields', () => {
    const schema = {
      request: ['record', 'number'],
      response: ['record', { id: 'string', active: ['optional', 'boolean'] }],
    } as const;

    expect(check({ schema, type: 'request', value: { a: 1, b: 2 } })).toBeNull();
    expect(check({ schema, type: 'request', value: { a: 1, b: 'bad' } })).toEqual(['request.b is not a number']);

    const response: any = { first: { id: '1', active: true, extra: 'drop' } };
    const getExtraneous = mock();

    expect(check({ schema, type: 'response', getExtraneous, value: response })).toBeNull();
    expect(response).toEqual({ first: { id: '1', active: true } });
    expect(getExtraneous).toBeCalledWith(['response.first.extra']);
  });

  it('validates escaped object keys', () => {
    const schema = {
      request: { "can't": 'string', 'quote"key': ['optional', 'number'] },
      response: 'any',
    } as const;

    expect(check({ schema, type: 'request', value: { "can't": 'ok', 'quote"key': 1 } })).toBeNull();
  });

  it('validates schemas produced from compatible intersection keys', () => {
    const schema = {
      request: {
        id: 'string',
        role: ['union', ['literal', 'manager'], ['literal', 'admin']],
        gender: 'string',
      },
      response: 'any',
    } as const;

    expect(check({ schema, type: 'request', value: { id: 'u-1', role: 'manager', gender: 'f' } })).toBeNull();
  });

  it('validates top-level optional values when they are present', () => {
    const schema = {
      request: ['optional', 'number'],
      response: 'any',
    } as const;

    expect(check({ schema, type: 'request', value: undefined })).toBeNull();
    expect(check({ schema, type: 'request', value: 1 })).toBeNull();
    expect(check({ schema, type: 'request', value: 'bad' })).toEqual(['request is not a number']);
  });

  it('accepts missing and valid optional object properties', () => {
    const schema = {
      request: {
        maybe: ['optional', 'number'],
      },
      response: 'any',
    } as const;

    expect(check({ schema, type: 'request', value: {} })).toBeNull();
    expect(check({ schema, type: 'request', value: { maybe: 1 } })).toBeNull();
  });

  it('reports record entry and missing property errors together', () => {
    const schema = {
      request: {
        records: ['record', 'number'],
        required: 'string',
      },
      response: 'any',
    } as const;

    expect(check({ schema, type: 'request', value: { records: { ok: 1, bad: 'no' } } })).toEqual([
      'request.records.bad is not a number',
      'request.required is missing',
    ]);
  });

  it('removes extra fields from the selected union object variant', () => {
    const schema = {
      request: {
        payload: [
          'union',
          { kind: ['literal', 'user'], name: 'string' },
          { kind: ['literal', 'order'], total: 'number' },
        ],
      },
      response: 'any',
    } as const;
    const value: { payload: { kind: string; total: number; extra?: boolean } } = {
      payload: { kind: 'order', total: 10, extra: true },
    };
    const getExtraneous = mock();

    expect(check({ schema, type: 'request', getExtraneous, value })).toBeNull();
    expect(value).toEqual({ payload: { kind: 'order', total: 10 } });
    expect(getExtraneous).toBeCalledWith(['request.payload.extra']);
  });

  it('reports negative paths for optional, record, tuple and array schemas', () => {
    const schema = {
      request: {
        optionalValue: ['optional', 'number'],
        recordValue: ['record', 'string'],
        tupleValue: ['tuple', 'number', 'string'],
        arrayValue: ['array', 'number'],
      },
      response: 'object',
    } as const;

    expect(
      check({
        schema,
        type: 'request',
        value: {
          recordValue: null,
          tupleValue: 'bad',
          optionalValue: 'bad',
          arrayValue: 'bad',
        },
      })
    ).toEqual([
      'request.optionalValue is not a number',
      'request.recordValue is not an object',
      'request.tupleValue is not an array',
      'request.arrayValue is not an array',
    ]);

    expect(check({ schema, type: 'response', value: [] })).toBeNull();
  });

  it('reports invalid recursive self schemas and object root mismatches', () => {
    const recursiveSchema = {
      request: ['self'],
      response: { id: 'string' },
    } as const;
    const objectSchema = {
      request: { id: 'string' },
      response: 'any',
    } as const;

    expect(check({ schema: recursiveSchema, type: 'request', value: {} })).toEqual([
      'request has invalid recursive schema',
    ]);
    expect(check({ schema: objectSchema, type: 'request', value: null })).toEqual(['request is not an object']);
    expect(check({ schema: objectSchema, type: 'request', value: [] })).toEqual(['request is not an object']);
  });

  it('reports unknown array schema tags', () => {
    const schema = {
      request: ['unknownTag'],
      response: 'any',
    } as any;

    expect(check({ schema, type: 'request', value: {} })).toEqual(['request has invalid schema']);
  });

  it('selects a union object variant by value type', () => {
    const schema = {
      request: { payload: ['union', { id: 'number' }, { id: 'string' }] },
      response: 'any',
    } as const;

    expect(check({ schema, type: 'request', value: { payload: { id: 1 } } })).toBeNull();
    expect(check({ schema, type: 'request', value: { payload: { id: 'ok' } } })).toBeNull();
    expect(check({ schema, type: 'request', value: { payload: { id: true } } })).toEqual([
      'request.payload is none of 2 types',
    ]);
  });

  it('selects discriminated union object variants', () => {
    const schema = {
      request: {
        payload: [
          'union',
          { kind: ['literal', 'named'], title: 'string' },
          { kind: ['literal', 'sized'], size: 'number' },
        ],
      },
      response: 'any',
    } as const;

    expect(check({ schema, type: 'request', value: { payload: { kind: 'named', title: 'ok' } } })).toBeNull();
    expect(check({ schema, type: 'request', value: { payload: { kind: 'sized', size: 3 } } })).toBeNull();
    expect(check({ schema, type: 'request', value: { payload: { kind: 'sized', size: 'bad' } } })).toEqual([
      'request.payload is none of 2 types',
    ]);
  });

  it('selects a union object variant when discriminators match', () => {
    const schema = {
      request: {
        payload: [
          'union',
          { kind: ['literal', 'entry'], title: 'string' },
          { kind: ['literal', 'entry'], size: 'number' },
        ],
      },
      response: 'any',
    } as const;

    expect(check({ schema, type: 'request', value: { payload: { kind: 'entry', title: 'ok' } } })).toBeNull();
    expect(check({ schema, type: 'request', value: { payload: { kind: 'entry', size: 3 } } })).toBeNull();
    expect(check({ schema, type: 'request', value: { payload: { kind: 'entry', title: 1, size: '' } } })).toEqual([
      'request.payload is none of 2 types',
    ]);
  });
});
