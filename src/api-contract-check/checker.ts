import type {
  TypeArraySchema,
  TypeLiteralSchema,
  TypeObjectSchema,
  TypePrimitiveSchema,
  TypeRecordSchema,
  TypeRootSchema,
  TypeSchema,
  TypeTupleSchema,
  TypeUnionSchema,
} from './types';

export type { TypeRootSchema } from './types';

type TypeContext = {
  errors: Array<string>;
  extraneousPaths: Set<string>;
  ignoreExtra?: boolean;
  recursiveSchema?: TypeObjectSchema;
};

type TypeChecker<TSchema extends TypeSchema> = (
  schema: TSchema,
  value: unknown,
  path: string,
  ctx: TypeContext
) => boolean;

function isTaggedSchema(schema: TypeSchema): schema is Exclude<TypeSchema, TypePrimitiveSchema | TypeObjectSchema> {
  return Array.isArray(schema);
}

function reportError(ctx: TypeContext, path: string, message: string): false {
  ctx.errors.push(`${path} ${message}`);

  return false;
}

const checkPrimitive: TypeChecker<TypePrimitiveSchema> = (schema, value, path, ctx) => {
  return (
    schema === 'any' ||
    (typeof value === schema && (schema !== 'object' || value !== null)) ||
    reportError(ctx, path, schema === 'object' ? 'is not an object' : `is not a ${schema}`)
  );
};

const checkLiteral: TypeChecker<TypeLiteralSchema> = (schema, value, path, ctx) => {
  return value === schema[1] || reportError(ctx, path, `is not ${JSON.stringify(schema[1])}`);
};

const checkArray: TypeChecker<TypeArraySchema> = (schema, value, path, ctx) => {
  if (!Array.isArray(value)) return reportError(ctx, path, 'is not an array');

  const prevErrorsLength = ctx.errors.length;

  for (const item of value) checkSchema(schema[1], item, `${path}[]`, ctx);

  return ctx.errors.length === prevErrorsLength;
};

const checkRecord: TypeChecker<TypeRecordSchema> = (schema, value, path, ctx) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return reportError(ctx, path, 'is not an object');
  }

  const prevErrorsLength = ctx.errors.length;

  for (const key of Object.keys(value)) {
    checkSchema(schema[1], (value as Record<string, unknown>)[key], `${path}.${key}`, ctx);
  }

  return ctx.errors.length === prevErrorsLength;
};

const checkTuple: TypeChecker<TypeTupleSchema> = (schema, value, path, ctx) => {
  if (!Array.isArray(value)) return reportError(ctx, path, 'is not an array');

  if (value.length !== schema.length - 1) return reportError(ctx, path, 'does not match tuple length');

  const prevErrorsLength = ctx.errors.length;

  for (let i = 0; i < schema.length - 1; i++) {
    checkSchema(schema[i + 1] as TypeSchema, value[i], `${path}[${i}]`, ctx);
  }

  return ctx.errors.length === prevErrorsLength;
};

const checkUnion: TypeChecker<TypeUnionSchema> = (schema, value, path, ctx) => {
  const errors: Array<string> = [];
  const names: Array<string> = [];
  let rest = 0;

  for (let i = 1; i < schema.length; i++) {
    const branch = schema[i] as TypeSchema;

    if (checkSchema(branch, value, path, { ...ctx, ignoreExtra: true, errors })) {
      return checkSchema(branch, value, path, ctx);
    }

    if (typeof branch === 'string') names.push(branch);
    else if (Array.isArray(branch) && branch[0] === 'literal') names.push(JSON.stringify(branch[1]));
    else rest++;
  }

  return reportError(
    ctx,
    path,
    names.length === 0
      ? `is none of ${rest} types`
      : `is none of ${names.join(', ')}${rest > 0 ? `, ${rest} more` : ''}`
  );
};

const checkObject: TypeChecker<TypeObjectSchema> = (schema, value, path, ctx) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return reportError(ctx, path, 'is not an object');
  }

  const prevErrorsLength = ctx.errors.length;

  for (const key of Object.keys(schema)) {
    const isOptional = Array.isArray(schema[key]) && schema[key][0] === 'optional';

    if ((value as Record<string, unknown>)[key] === undefined) {
      if (!isOptional) reportError(ctx, `${path}.${key}`, 'is missing');

      continue;
    }

    checkSchema(schema[key], (value as Record<string, unknown>)[key], `${path}.${key}`, ctx);
  }

  if (!ctx.ignoreExtra) {
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(schema, key)) {
        delete (value as Record<string, unknown>)[key];
        ctx.extraneousPaths.add(`${path}.${key}`);
      }
    }
  }

  return ctx.errors.length === prevErrorsLength;
};

const checkSchema: TypeChecker<TypeSchema> = (schema, value, path, ctx) => {
  if (typeof schema === 'string') return checkPrimitive(schema, value, path, ctx);

  if (!isTaggedSchema(schema)) return checkObject(schema, value, path, ctx);

  switch (schema[0]) {
    case 'literal':
      return checkLiteral(schema, value, path, ctx);
    case 'self':
      if (ctx.recursiveSchema) return checkObject(ctx.recursiveSchema, value, path, ctx);

      return reportError(ctx, path, 'has invalid recursive schema');
    case 'optional':
      return value === undefined || checkSchema(schema[1], value, path, ctx);
    case 'array':
      return checkArray(schema, value, path, ctx);
    case 'record':
      return checkRecord(schema, value, path, ctx);
    case 'tuple':
      return checkTuple(schema, value, path, ctx);
    case 'recursiveArray':
      return checkObject(schema[1], value, path, { ...ctx, recursiveSchema: schema[1] });
    case 'union':
      return checkUnion(schema, value, path, ctx);
    default:
      return reportError(ctx, path, 'has invalid schema');
  }
};

export function check(options: {
  type: 'request' | 'response';
  value: unknown;
  schema: TypeRootSchema;
  getExtraneous?: (paths: Array<string>) => void;
}): null | Array<string> {
  const extraneousPaths = new Set<string>();
  const errors: Array<string> = [];

  checkSchema(options.schema[options.type], options.value, options.type, { extraneousPaths, errors });

  if (extraneousPaths.size > 0) options.getExtraneous?.([...extraneousPaths]);

  return errors.length === 0 ? null : [...new Set(errors)];
}
