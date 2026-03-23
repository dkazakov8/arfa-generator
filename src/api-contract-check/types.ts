export type TypePrimitiveSchema = 'any' | 'number' | 'object' | 'boolean' | 'string';
export type TypeLiteralSchema = readonly ['literal', unknown];
export type TypeOptionalSchema = readonly ['optional', TypeSchema];
export type TypeArraySchema = readonly ['array', TypeSchema];
export type TypeTupleSchema = readonly ['tuple', ...TypeSchema[]];
export type TypeUnionSchema = readonly ['union', ...TypeSchema[]];
export type TypeObjectSchema = { [key: string]: TypeSchema };
export type TypeRecordSchema = readonly ['record', TypeSchema];
export type TypeRecursiveArraySchema = readonly ['recursiveArray', TypeObjectSchema];
export type TypeSelfSchema = readonly ['self'];
export type TypeSchema =
  | TypePrimitiveSchema
  | TypeLiteralSchema
  | TypeOptionalSchema
  | TypeArraySchema
  | TypeTupleSchema
  | TypeUnionSchema
  | TypeRecordSchema
  | TypeRecursiveArraySchema
  | TypeSelfSchema
  | TypeObjectSchema;

export type TypeRootSchema = { request: TypeSchema; response: TypeSchema };
