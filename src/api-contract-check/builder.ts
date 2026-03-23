import path from 'node:path';

import ts from 'typescript';

import type { TypeObjectSchema, TypeRecursiveArraySchema, TypeRootSchema, TypeSchema } from './types';
import type { TypeTsProjectResolution } from './typescriptProject';
import { createTsProjectResolution, getTsModuleSpecifier, resolveRequiredModulePath } from './typescriptProject';

export type { TypeTsProjectResolution } from './typescriptProject';
export {
  createTsProjectResolution,
  getTsModuleSpecifier,
  resolveTsModule,
} from './typescriptProject';

type TypeLiteralValue = boolean | number | string | null;

type TypeResolvedDeclaration = ts.EnumDeclaration | ts.InterfaceDeclaration | ts.TypeAliasDeclaration;

type TypeResolvedModule = {
  filePath: string;
  dependencies: Set<string>;
  starExportSources: Set<string>;
  exports: Map<
    string,
    { kind: 'local'; localName: string } | { exportedName: string; kind: 'reexport'; sourceFilePath: string }
  >;
  imports: Map<string, { importedName: string; sourceFilePath: string }>;
  localDeclarations: Map<string, TypeResolvedDeclaration>;
};

type TypeCompileResult = {
  /** null means the current value degraded; otherwise only the listed members degraded. */
  readonly degradedNames: ReadonlySet<string> | null;
  readonly hasSelfReference: boolean;
  readonly schema: TypeSchema;
};

type TypeCompilerState = {
  modulesByPath: ReadonlyMap<string, TypeResolvedModule>;
  activeDeclarations: Set<TypeResolvedDeclaration>;
  declarationResultsCache: Map<TypeResolvedDeclaration, TypeCompileResult>;
  enumMemberValuesCache: Map<ts.EnumDeclaration, ReadonlyMap<string, TypeLiteralValue> | null>;
  referenceCache: Map<string, TypeResolvedDeclaration | undefined>;
};

type TypeSubstitution = {
  module: TypeResolvedModule;
  node: ts.TypeNode;
  substitutions: ReadonlyMap<string, TypeSubstitution>;
};

type TypeCompileContext = {
  compilerState: TypeCompilerState;
  module: TypeResolvedModule;
  insideArrayItem: boolean;
  recursiveTarget: TypeResolvedDeclaration;
  substitutions: ReadonlyMap<string, TypeSubstitution>;
};

export type TypeOptions = {
  getDegraded?: (names: string[]) => void;
  readFile?: (filePath: string) => string | undefined;
  requestDeclaration: string;
  responseDeclaration: string;
  tsconfigPath: string;
};

export type TypeBuilderOutputFile = { filePath: string; schema: TypeRootSchema };

const fallbackSchema: TypeSchema = 'any';
const unsupportedLiteral = Symbol('unsupportedLiteral');

const primitiveSchemaByKind: Partial<Record<ts.SyntaxKind, 'any' | 'boolean' | 'number' | 'object' | 'string'>> = {
  [ts.SyntaxKind.AnyKeyword]: 'any',
  [ts.SyntaxKind.BooleanKeyword]: 'boolean',
  [ts.SyntaxKind.NumberKeyword]: 'number',
  [ts.SyntaxKind.ObjectKeyword]: 'object',
  [ts.SyntaxKind.StringKeyword]: 'string',
};

function extractLiteralValue(node: ts.Node): TypeLiteralValue | typeof unsupportedLiteral {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  )
    return -Number(node.operand.text);

  return unsupportedLiteral;
}

function getMemberName(propertyName: ts.PropertyName): string | null {
  if (ts.isIdentifier(propertyName) || ts.isStringLiteral(propertyName) || ts.isNumericLiteral(propertyName))
    return propertyName.text;

  return null;
}

function isObjectSchema(schema: TypeSchema): schema is TypeObjectSchema {
  return typeof schema === 'object' && schema !== null && !Array.isArray(schema);
}

function serializeCanonicalSchema(schema: TypeSchema): string {
  return JSON.stringify(schema, (_, value) => {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const sortedObject: Record<string, unknown> = {};

      for (const propertyName of Object.keys(value).sort()) sortedObject[propertyName] = value[propertyName];

      return sortedObject;
    }

    return value;
  });
}

function hasExportModifier(node: ts.Node): boolean {
  return !ts.canHaveModifiers(node)
    ? false
    : (ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false);
}

function getEnumMemberValues(
  compilerState: TypeCompilerState,
  declaration: ts.EnumDeclaration
): ReadonlyMap<string, TypeLiteralValue> | null {
  const cachedMemberValues = compilerState.enumMemberValuesCache.get(declaration);

  if (cachedMemberValues !== undefined) return cachedMemberValues;

  compilerState.enumMemberValuesCache.set(declaration, null);

  const memberValues = new Map<string, TypeLiteralValue>();
  let nextNumericValue = 0;

  for (const member of declaration.members) {
    const memberName = getMemberName(member.name);

    if (memberName == null) return null;

    if (!member.initializer) {
      memberValues.set(memberName, nextNumericValue++);
      continue;
    }

    const literalValue = extractLiteralValue(member.initializer);

    if (literalValue === unsupportedLiteral) return null;

    memberValues.set(memberName, literalValue);

    if (typeof literalValue === 'number') nextNumericValue = literalValue + 1;
  }

  compilerState.enumMemberValuesCache.set(declaration, memberValues);

  return memberValues;
}

function parseModule(args: {
  sourceText: string;
  filePath: string;
  resolutionContext: TypeTsProjectResolution;
}): TypeResolvedModule {
  const { sourceText, filePath, resolutionContext } = args;
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  // TypeScript normalizes separators; declaration owners must retain the exact module-map key.
  sourceFile.fileName = filePath;

  const module: TypeResolvedModule = {
    filePath,
    dependencies: new Set(),
    starExportSources: new Set(),
    exports: new Map(),
    imports: new Map(),
    localDeclarations: new Map(),
  };

  for (const statement of sourceFile.statements) {
    if (
      ts.isEnumDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement)
    ) {
      const declarationName = statement.name.text;

      module.localDeclarations.set(declarationName, statement);
      if (hasExportModifier(statement))
        module.exports.set(declarationName, { kind: 'local', localName: declarationName });
      continue;
    }

    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;

    const moduleSpecifier = getTsModuleSpecifier(statement);
    const sourceFilePath = moduleSpecifier
      ? resolveRequiredModulePath(resolutionContext, moduleSpecifier, filePath)
      : null;

    if (sourceFilePath) module.dependencies.add(sourceFilePath);

    if (ts.isImportDeclaration(statement)) {
      const importBindings = statement.importClause?.namedBindings;

      if (sourceFilePath && importBindings && ts.isNamedImports(importBindings)) {
        for (const specifier of importBindings.elements)
          module.imports.set(specifier.name.text, {
            importedName: specifier.propertyName?.text ?? specifier.name.text,
            sourceFilePath,
          });
      }
      continue;
    }

    if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const specifier of statement.exportClause.elements) {
        const referencedName = specifier.propertyName?.text ?? specifier.name.text;

        module.exports.set(
          specifier.name.text,
          sourceFilePath
            ? { exportedName: referencedName, kind: 'reexport', sourceFilePath }
            : { kind: 'local', localName: referencedName }
        );
      }
      continue;
    }

    if (sourceFilePath && !statement.exportClause) module.starExportSources.add(sourceFilePath);
  }

  return module;
}

function collectModules(entryFilePaths: ReadonlyArray<string>, options: TypeOptions): Map<string, TypeResolvedModule> {
  const resolutionContext = createTsProjectResolution({
    allowNoInputs: true,
    readFile: options.readFile,
    tsconfigPath: options.tsconfigPath,
  });

  const pendingFilePaths = [...entryFilePaths];
  const modulesByPath = new Map<string, TypeResolvedModule>();

  while (pendingFilePaths.length > 0) {
    const filePath = pendingFilePaths.pop()!;

    if (modulesByPath.has(filePath)) continue;

    const sourceText = resolutionContext.host.readFile?.(filePath);

    if (sourceText == null) throw new Error(`Failed to read source file "${filePath}"`);

    const module = parseModule({ sourceText, filePath, resolutionContext });

    modulesByPath.set(filePath, module);

    for (const dependencyFilePath of module.dependencies)
      if (!modulesByPath.has(dependencyFilePath)) pendingFilePaths.push(dependencyFilePath);
  }

  return modulesByPath;
}

function resolveExportedDeclaration(
  compilerState: TypeCompilerState,
  module: TypeResolvedModule,
  exportedName: string,
  visitedExportKeys: Set<string>
): TypeResolvedDeclaration | undefined {
  const exportKey = `${module.filePath}:${exportedName}`;

  if (visitedExportKeys.has(exportKey)) return undefined;

  visitedExportKeys.add(exportKey);

  const exportBinding = module.exports.get(exportedName);
  if (exportBinding) {
    if (exportBinding.kind === 'local')
      return resolveReference(compilerState, module, exportBinding.localName, visitedExportKeys);

    // collectModules loads all re-export dependencies before compilation.
    const sourceModule = compilerState.modulesByPath.get(exportBinding.sourceFilePath)!;

    return resolveExportedDeclaration(compilerState, sourceModule, exportBinding.exportedName, visitedExportKeys);
  }

  for (const sourceFilePath of module.starExportSources) {
    const sourceModule = compilerState.modulesByPath.get(sourceFilePath);

    if (!sourceModule) continue;

    const declaration = resolveExportedDeclaration(compilerState, sourceModule, exportedName, visitedExportKeys);

    if (declaration) return declaration;
  }

  return undefined;
}

function resolveReference(
  compilerState: TypeCompilerState,
  module: TypeResolvedModule,
  referenceName: string,
  visitedExportKeys: Set<string>
): TypeResolvedDeclaration | undefined {
  const localDeclaration = module.localDeclarations.get(referenceName);

  if (localDeclaration) return localDeclaration;

  const referenceKey = `${module.filePath}:${referenceName}`;

  if (compilerState.referenceCache.has(referenceKey)) return compilerState.referenceCache.get(referenceKey);

  const importBinding = module.imports.get(referenceName);

  if (!importBinding) return undefined;

  const sourceModule = compilerState.modulesByPath.get(importBinding.sourceFilePath);
  const declaration = sourceModule
    ? resolveExportedDeclaration(compilerState, sourceModule, importBinding.importedName, visitedExportKeys)
    : undefined;

  compilerState.referenceCache.set(referenceKey, declaration);

  return declaration;
}

function getDeclarationModule(
  compilerState: TypeCompilerState,
  declaration: TypeResolvedDeclaration
): TypeResolvedModule {
  const filePath = declaration.getSourceFile().fileName;
  const module = compilerState.modulesByPath.get(filePath);

  if (!module) throw new Error(`Can't resolve declaration owner "${filePath}"`);

  return module;
}

function createCompileResult(
  schema: TypeSchema,
  degradedNames: Iterable<string> | null = [],
  hasSelfReference = false
): TypeCompileResult {
  return { degradedNames: degradedNames === null ? null : new Set(degradedNames), hasSelfReference, schema };
}

function createDegradedResult(): TypeCompileResult {
  return createCompileResult(fallbackSchema, null);
}

function combineCompileResults(schema: TypeSchema, results: ReadonlyArray<TypeCompileResult>): TypeCompileResult {
  const degradedNames = new Set<string>();
  let hasDegradedValue = false;
  let hasSelfReference = false;

  for (const result of results) {
    hasSelfReference ||= result.hasSelfReference;
    if (result.degradedNames === null) hasDegradedValue = true;
    else for (const name of result.degradedNames) degradedNames.add(name);
  }

  return { degradedNames: hasDegradedValue ? null : degradedNames, hasSelfReference, schema };
}

function mergeIntersectionValues(leftSchema: TypeSchema, rightSchema: TypeSchema): TypeSchema | null {
  if (leftSchema === rightSchema) return leftSchema;
  if (serializeCanonicalSchema(leftSchema) === serializeCanonicalSchema(rightSchema)) return leftSchema;
  if (leftSchema === 'object' && isObjectSchema(rightSchema)) return rightSchema;
  if (rightSchema === 'object' && isObjectSchema(leftSchema)) return leftSchema;
  if (isObjectSchema(leftSchema) && isObjectSchema(rightSchema)) {
    const mergedSchema: TypeObjectSchema = { ...leftSchema };

    if (!mergeObjectProperties(rightSchema, mergedSchema)) return null;

    return mergedSchema;
  }

  return null;
}

function mergeIntersectionSchemas(leftSchema: TypeSchema, rightSchema: TypeSchema): TypeSchema | null {
  const isLeftOptional = Array.isArray(leftSchema) && leftSchema[0] === 'optional';
  const isRightOptional = Array.isArray(rightSchema) && rightSchema[0] === 'optional';
  const leftValueSchema = isLeftOptional ? leftSchema[1] : leftSchema;
  const rightValueSchema = isRightOptional ? rightSchema[1] : rightSchema;

  const mergedValueSchema = mergeIntersectionValues(leftValueSchema, rightValueSchema);

  if (!mergedValueSchema) return null;

  return isLeftOptional && isRightOptional ? ['optional', mergedValueSchema] : mergedValueSchema;
}

function mergeObjectProperties(sourceSchema: TypeObjectSchema, targetSchema: TypeObjectSchema): boolean {
  for (const [propertyName, propertySchema] of Object.entries(sourceSchema) as [string, TypeSchema][]) {
    const currentPropertySchema = targetSchema[propertyName];

    if (currentPropertySchema === undefined) {
      targetSchema[propertyName] = propertySchema;
      continue;
    }

    const mergedPropertySchema = mergeIntersectionSchemas(currentPropertySchema, propertySchema);

    if (!mergedPropertySchema) return false;

    targetSchema[propertyName] = mergedPropertySchema;
  }

  return true;
}

function mergeObjectResults(results: Iterable<TypeCompileResult>): TypeCompileResult {
  const objectSchema: TypeObjectSchema = {};
  const parts: Array<TypeCompileResult> = [];

  for (const result of results) {
    if (result.degradedNames === null) return createDegradedResult();
    if (
      result.schema !== 'object' &&
      (!isObjectSchema(result.schema) || !mergeObjectProperties(result.schema, objectSchema))
    )
      return createDegradedResult();
    parts.push(result);
  }

  return combineCompileResults(objectSchema, parts);
}

function compileObjectMembers(context: TypeCompileContext, members: ReadonlyArray<ts.TypeElement>): TypeCompileResult {
  const objectSchema: TypeObjectSchema = {};
  const parts: Array<TypeCompileResult> = [];

  for (const member of members) {
    if (!ts.isPropertySignature(member) && !ts.isMethodSignature(member)) return createDegradedResult();

    const memberName = getMemberName(member.name);
    const propertyName = memberName ?? '<computed>';

    if (memberName == null || ts.isMethodSignature(member) || !member.type) {
      objectSchema[propertyName] = fallbackSchema;
      parts.push(createCompileResult(fallbackSchema, [propertyName]));
      continue;
    }

    const memberResult = compileTypeNode(context, member.type);
    objectSchema[propertyName] = member.questionToken ? ['optional', memberResult.schema] : memberResult.schema;
    parts.push(
      memberResult.degradedNames === null ? { ...memberResult, degradedNames: new Set([propertyName]) } : memberResult
    );
  }

  return combineCompileResults(objectSchema, parts);
}

function mergeUnionResults(results: ReadonlyArray<TypeCompileResult>): TypeCompileResult {
  const schemasByKey = new Map<string, TypeSchema>();
  const parts: Array<TypeCompileResult> = [];

  for (const result of results) {
    // A degraded variant only degrades the whole union when it collapses to any.
    parts.push(result.degradedNames === null ? { ...result, degradedNames: new Set<string>() } : result);

    let variantSchemas: ReadonlyArray<TypeSchema> = [result.schema];

    if (result.degradedNames !== null && Array.isArray(result.schema) && result.schema[0] === 'union') {
      const [, ...nestedSchemas] = result.schema;
      variantSchemas = nestedSchemas;
    }

    for (const schema of variantSchemas) {
      const schemaKey = serializeCanonicalSchema(schema);

      if (!schemasByKey.has(schemaKey)) schemasByKey.set(schemaKey, schema);
    }
  }

  if (schemasByKey.size === 0 || schemasByKey.has(serializeCanonicalSchema(fallbackSchema))) {
    if (results.some((result) => result.degradedNames === null)) return createDegradedResult();

    return { ...combineCompileResults(fallbackSchema, parts), hasSelfReference: false };
  }

  const variantSchemas = [...schemasByKey.values()];

  return combineCompileResults(variantSchemas.length === 1 ? variantSchemas[0] : ['union', ...variantSchemas], parts);
}

function compileArrayElementType(context: TypeCompileContext, elementTypeNode: ts.TypeNode): TypeCompileResult {
  const itemResult = compileTypeNode({ ...context, insideArrayItem: true }, elementTypeNode);

  return { ...itemResult, schema: ['array', itemResult.schema] };
}

function compileTupleTypeNode(context: TypeCompileContext, node: ts.TupleTypeNode): TypeCompileResult {
  const itemSchemas: Array<TypeSchema> = [];
  const parts: Array<TypeCompileResult> = [];

  for (const element of node.elements) {
    if (ts.isRestTypeNode(element) || ts.isOptionalTypeNode(element)) return createDegradedResult();

    let typeNode: ts.TypeNode;

    if (ts.isNamedTupleMember(element)) {
      if (element.questionToken || element.dotDotDotToken) return createDegradedResult();
      typeNode = element.type;
    } else {
      typeNode = element;
    }

    const itemResult = compileTypeNode(context, typeNode);

    itemSchemas.push(itemResult.schema);
    parts.push(itemResult);
  }

  return combineCompileResults(['tuple', ...itemSchemas], parts);
}

function compileGenericTypeReference(
  context: TypeCompileContext,
  typeName: ts.EntityName,
  typeArguments: ReadonlyArray<ts.TypeNode>
): TypeCompileResult {
  if (!ts.isIdentifier(typeName)) return createDegradedResult();

  if (typeArguments.length === 1 && typeName.text === 'Array')
    return compileArrayElementType(context, typeArguments[0]);
  if (
    typeArguments.length === 2 &&
    typeName.text === 'Record' &&
    typeArguments[0].kind === ts.SyntaxKind.StringKeyword
  ) {
    const valueResult = compileTypeNode(context, typeArguments[1]);

    return { ...valueResult, schema: ['record', valueResult.schema] };
  }

  const declaration = resolveReference(context.compilerState, context.module, typeName.text, new Set());

  if (!declaration || !ts.isTypeAliasDeclaration(declaration)) return createDegradedResult();

  const typeParameters = declaration.typeParameters;

  if (!typeParameters || typeParameters.length !== typeArguments.length) return createDegradedResult();

  // Alias parameters have their own scope; arguments retain the caller's scope.
  const substitutions = new Map<string, TypeSubstitution>();

  typeArguments.forEach((typeArgument, index) => {
    substitutions.set(typeParameters[index].name.text, {
      module: context.module,
      node: typeArgument,
      substitutions: context.substitutions,
    });
  });

  return compileDeclaration(context.compilerState, declaration, {
    insideArrayItem: context.insideArrayItem,
    substitutions,
  });
}

function compileQualifiedTypeReference(context: TypeCompileContext, typeName: ts.QualifiedName): TypeCompileResult {
  if (!ts.isIdentifier(typeName.left)) return createDegradedResult();

  const declaration = resolveReference(context.compilerState, context.module, typeName.left.text, new Set());

  if (!declaration || !ts.isEnumDeclaration(declaration)) return createDegradedResult();

  const memberValue = getEnumMemberValues(context.compilerState, declaration)?.get(typeName.right.text);

  return memberValue == null ? createDegradedResult() : createCompileResult(['literal', memberValue]);
}

function compileIdentifierTypeReference(context: TypeCompileContext, typeName: ts.Identifier): TypeCompileResult {
  const substitution = context.substitutions.get(typeName.text);

  if (substitution)
    return compileTypeNode(
      { ...context, module: substitution.module, substitutions: substitution.substitutions },
      substitution.node
    );

  const declaration = resolveReference(context.compilerState, context.module, typeName.text, new Set());

  if (!declaration) return createDegradedResult();

  if (declaration === context.recursiveTarget) {
    if (!context.insideArrayItem) return createDegradedResult();

    return createCompileResult(['self'], [], true);
  }

  return compileDeclaration(context.compilerState, declaration);
}

function compileTypeReferenceNode(context: TypeCompileContext, node: ts.TypeReferenceNode): TypeCompileResult {
  const typeArguments = node.typeArguments;

  if (typeArguments?.length) return compileGenericTypeReference(context, node.typeName, typeArguments);
  if (ts.isQualifiedName(node.typeName)) return compileQualifiedTypeReference(context, node.typeName);

  return compileIdentifierTypeReference(context, node.typeName);
}

function compileIndexedAccessTypeNode(context: TypeCompileContext, node: ts.IndexedAccessTypeNode): TypeCompileResult {
  const objectResult = compileTypeNode(context, node.objectType);

  if (objectResult.degradedNames === null) return createDegradedResult();

  if (node.indexType.kind === ts.SyntaxKind.NumberKeyword) {
    if (Array.isArray(objectResult.schema) && objectResult.schema[0] === 'array')
      return { ...objectResult, schema: objectResult.schema[1] };

    return createDegradedResult();
  }

  if (!ts.isLiteralTypeNode(node.indexType)) return createDegradedResult();

  const indexValue = extractLiteralValue(node.indexType.literal);

  if ((typeof indexValue !== 'string' && typeof indexValue !== 'number') || !isObjectSchema(objectResult.schema))
    return createDegradedResult();

  const propertySchema = objectResult.schema[String(indexValue)];

  if (propertySchema === undefined) return createDegradedResult();

  return { ...objectResult, schema: propertySchema };
}

function compileTypeNode(context: TypeCompileContext, node: ts.TypeNode): TypeCompileResult {
  const primitiveSchema = primitiveSchemaByKind[node.kind];

  if (primitiveSchema) return createCompileResult(primitiveSchema);
  if (ts.isLiteralTypeNode(node)) {
    const literalValue = extractLiteralValue(node.literal);

    return literalValue === unsupportedLiteral
      ? createDegradedResult()
      : createCompileResult(['literal', literalValue]);
  }
  if (ts.isTypeReferenceNode(node)) return compileTypeReferenceNode(context, node);
  if (ts.isIndexedAccessTypeNode(node)) return compileIndexedAccessTypeNode(context, node);
  if (ts.isTypeLiteralNode(node)) return compileObjectMembers(context, node.members);
  if (ts.isArrayTypeNode(node)) return compileArrayElementType(context, node.elementType);
  if (ts.isTupleTypeNode(node)) return compileTupleTypeNode(context, node);
  if (ts.isUnionTypeNode(node))
    return mergeUnionResults(node.types.map((typeNode) => compileTypeNode(context, typeNode)));
  if (ts.isIntersectionTypeNode(node))
    return mergeObjectResults(node.types.map((typeNode) => compileTypeNode(context, typeNode)));
  if (ts.isParenthesizedTypeNode(node)) return compileTypeNode(context, node.type);

  return createDegradedResult();
}

function compileInterfaceDeclaration(
  context: TypeCompileContext,
  declaration: ts.InterfaceDeclaration
): TypeCompileResult {
  const baseTypes =
    declaration.heritageClauses
      ?.filter((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword)
      .flatMap((clause) => [...clause.types]) ?? [];
  const results: Array<TypeCompileResult> = [];

  for (const baseType of baseTypes) {
    if (baseType.typeArguments?.length || !ts.isIdentifier(baseType.expression)) return createDegradedResult();

    const baseDeclaration = resolveReference(
      context.compilerState,
      context.module,
      baseType.expression.text,
      new Set()
    );

    if (!baseDeclaration || !ts.isInterfaceDeclaration(baseDeclaration)) return createDegradedResult();

    results.push(compileDeclaration(context.compilerState, baseDeclaration));
  }

  results.push(compileObjectMembers(context, declaration.members));

  return mergeObjectResults(results);
}

function wrapSelfReferentialSchema(result: TypeCompileResult): TypeCompileResult {
  if (!result.hasSelfReference) return result;
  if (!isObjectSchema(result.schema)) return createDegradedResult();

  const recursiveSchema: TypeRecursiveArraySchema = ['recursiveArray', result.schema];

  return { ...result, hasSelfReference: false, schema: recursiveSchema };
}

function compileDeclaration(
  compilerState: TypeCompilerState,
  declaration: TypeResolvedDeclaration,
  instantiation?: Pick<TypeCompileContext, 'insideArrayItem' | 'substitutions'>
): TypeCompileResult {
  if (!instantiation) {
    const cachedResult = compilerState.declarationResultsCache.get(declaration);

    if (cachedResult) return cachedResult;
  }

  if (compilerState.activeDeclarations.has(declaration)) return createDegradedResult();

  compilerState.activeDeclarations.add(declaration);

  try {
    const context: TypeCompileContext = {
      compilerState,
      module: getDeclarationModule(compilerState, declaration),
      insideArrayItem: instantiation?.insideArrayItem ?? false,
      recursiveTarget: declaration,
      substitutions: instantiation?.substitutions ?? new Map(),
    };
    let result: TypeCompileResult;
    if (ts.isEnumDeclaration(declaration)) {
      const memberValues = getEnumMemberValues(compilerState, declaration);

      result = memberValues
        ? mergeUnionResults([...memberValues.values()].map((value) => createCompileResult(['literal', value])))
        : createDegradedResult();
    } else if (ts.isInterfaceDeclaration(declaration)) result = compileInterfaceDeclaration(context, declaration);
    else result = compileTypeNode(context, declaration.type);

    result = wrapSelfReferentialSchema(result);
    if (!instantiation) compilerState.declarationResultsCache.set(declaration, result);

    return result;
  } finally {
    compilerState.activeDeclarations.delete(declaration);
  }
}

function compileEntryModule(
  compilerState: TypeCompilerState,
  module: TypeResolvedModule,
  options: Pick<TypeOptions, 'requestDeclaration' | 'responseDeclaration'>,
  degradedNames: Set<string>
): TypeRootSchema | null {
  const { requestDeclaration, responseDeclaration } = options;
  const requestTypeDeclaration = module.localDeclarations.get(requestDeclaration);
  const responseTypeDeclaration = module.localDeclarations.get(responseDeclaration);

  if (!requestTypeDeclaration && !responseTypeDeclaration) return null;

  if (
    !requestTypeDeclaration ||
    !responseTypeDeclaration ||
    ts.isEnumDeclaration(requestTypeDeclaration) ||
    ts.isEnumDeclaration(responseTypeDeclaration)
  ) {
    const missingDeclarationNames = [
      !requestTypeDeclaration || ts.isEnumDeclaration(requestTypeDeclaration) ? requestDeclaration : null,
      !responseTypeDeclaration || ts.isEnumDeclaration(responseTypeDeclaration) ? responseDeclaration : null,
    ]
      .filter(Boolean)
      .join(' and ');
    throw new Error(`Entry file "${module.filePath}" must declare ${missingDeclarationNames}`);
  }

  const requestResult = compileDeclaration(compilerState, requestTypeDeclaration);
  const responseResult = compileDeclaration(compilerState, responseTypeDeclaration);

  for (const degradedName of requestResult.degradedNames ?? [requestDeclaration]) degradedNames.add(degradedName);
  for (const degradedName of responseResult.degradedNames ?? [responseDeclaration]) degradedNames.add(degradedName);

  return { request: requestResult.schema, response: responseResult.schema };
}

function buildInverseDependencies(
  modulesByPath: ReadonlyMap<string, TypeResolvedModule>,
  generatedEntryFilePaths: Set<string>
): Record<string, Array<string>> {
  const dependentEntriesByFilePath = new Map<string, Set<string>>();

  for (const entryFilePath of generatedEntryFilePaths) {
    const visitedFilePaths = new Set<string>();
    const pendingFilePaths = [entryFilePath];

    while (pendingFilePaths.length > 0) {
      const currentFilePath = pendingFilePaths.pop()!;

      if (visitedFilePaths.has(currentFilePath)) continue;

      visitedFilePaths.add(currentFilePath);

      if (currentFilePath !== entryFilePath) {
        const dependentEntryFilePaths = dependentEntriesByFilePath.get(currentFilePath);

        if (dependentEntryFilePaths) dependentEntryFilePaths.add(entryFilePath);
        else dependentEntriesByFilePath.set(currentFilePath, new Set([entryFilePath]));
      }

      const module = modulesByPath.get(currentFilePath);

      if (!module) continue;

      for (const dependencyFilePath of module.dependencies)
        if (modulesByPath.has(dependencyFilePath)) pendingFilePaths.push(dependencyFilePath);
    }
  }

  return Object.fromEntries(
    [...dependentEntriesByFilePath.entries()]
      .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
      .map(([filePath, entryFilePaths]) => [filePath, [...entryFilePaths].sort()])
  );
}

export function createValidators(
  inputFilePaths: Array<string>,
  options: TypeOptions
): { result: Array<TypeBuilderOutputFile>; deps: Record<string, Array<string>> } {
  if (!options.requestDeclaration) throw new Error('Missing requestDeclaration option');
  if (!options.responseDeclaration) throw new Error('Missing responseDeclaration option');

  const entryFilePaths = inputFilePaths.map((filePath) => {
    if (!path.isAbsolute(filePath)) throw new Error(`Input file path must be absolute: ${filePath}`);

    return path.resolve(filePath);
  });

  const modulesByPath = collectModules(entryFilePaths, options);
  const compilerState: TypeCompilerState = {
    activeDeclarations: new Set(),
    declarationResultsCache: new Map(),
    enumMemberValuesCache: new Map(),
    referenceCache: new Map(),
    modulesByPath,
  };
  const outputFiles: Array<TypeBuilderOutputFile> = [];
  const degradedNames = new Set<string>();
  const generatedEntryFilePaths = new Set<string>();

  for (const entryFilePath of entryFilePaths) {
    const module = modulesByPath.get(entryFilePath);

    if (!module) throw new Error(`Can't process ${entryFilePath}`);

    const schema = compileEntryModule(compilerState, module, options, degradedNames);

    if (!schema) continue;

    outputFiles.push({ filePath: entryFilePath, schema });
    generatedEntryFilePaths.add(entryFilePath);
  }

  if (outputFiles.length === 0) {
    throw new Error(
      entryFilePaths.length === 1
        ? `Entry file "${entryFilePaths[0]}" must declare both ${options.requestDeclaration} and ${options.responseDeclaration}`
        : `Expected at least one input entry file to declare both ${options.requestDeclaration} and ${options.responseDeclaration}`
    );
  }

  const inverseDependencies = buildInverseDependencies(modulesByPath, generatedEntryFilePaths);

  if (degradedNames.size > 0)
    options.getDegraded?.([...degradedNames].sort((left, right) => left.localeCompare(right)));

  return { deps: inverseDependencies, result: outputFiles };
}
