import path from 'node:path';

import ts from 'typescript';

const noInputsFoundDiagnosticCode = 18003;

export type TypeTsModuleResolutionContext = {
  compilerOptions: ts.CompilerOptions;
  host: ts.ModuleResolutionHost;
  moduleResolutionCache: ts.ModuleResolutionCache;
};

export type TypeTsProjectResolution = TypeTsModuleResolutionContext & {
  fileNames: Array<string>;
  pathAliases: Record<string, Array<string>>;
  pathsBasePath: string;
};

export type TypeReadSourceFile = (filePath: string) => string | undefined;

export type TypeReadTsConfigOptions = { allowNoInputs?: boolean };

export type TypeCreateTsProjectResolutionArgs = TypeReadTsConfigOptions & {
  readFile?: TypeReadSourceFile;
  tsconfigPath: string;
};

export function readTsConfig(tsconfigPath: string, options: TypeReadTsConfigOptions = {}): ts.ParsedCommandLine {
  const { config, error } = ts.readConfigFile(tsconfigPath, ts.sys.readFile);

  if (error) throw new Error(ts.flattenDiagnosticMessageText(error.messageText, '\n'));

  const tsconfigDir = path.dirname(tsconfigPath);
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, tsconfigDir, {}, tsconfigPath);
  const diagnostic = parsed.errors.find((it) => !options.allowNoInputs || it.code !== noInputsFoundDiagnosticCode);

  if (diagnostic) throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));

  return parsed;
}

export function createTsProjectResolution(args: TypeCreateTsProjectResolutionArgs): TypeTsProjectResolution {
  const tsconfigPath = path.resolve(args.tsconfigPath);
  const tsConfig = readTsConfig(tsconfigPath, { allowNoInputs: args.allowNoInputs });
  const compilerOptions = tsConfig.options;
  const tsconfigDir = path.dirname(tsconfigPath);
  const customReadCache = new Map<string, string | undefined>();

  const readCustomFile = (filePath: string): string | undefined => {
    if (!args.readFile) return undefined;

    if (!customReadCache.has(filePath)) customReadCache.set(filePath, args.readFile(filePath));

    return customReadCache.get(filePath);
  };

  const host: ts.ModuleResolutionHost = {
    fileExists: (filePath) => readCustomFile(filePath) != null || ts.sys.fileExists(filePath),
    readFile: (filePath) => readCustomFile(filePath) ?? ts.sys.readFile(filePath),
  };

  return {
    compilerOptions,
    fileNames: tsConfig.fileNames,
    host,
    moduleResolutionCache: ts.createModuleResolutionCache(
      tsconfigDir,
      (fileName) =>
        ts.sys.useCaseSensitiveFileNames ? path.normalize(fileName) : path.normalize(fileName).toLowerCase(),
      compilerOptions
    ),
    pathAliases: compilerOptions.paths ?? {},
    pathsBasePath: typeof compilerOptions.pathsBasePath === 'string' ? compilerOptions.pathsBasePath : tsconfigDir,
  };
}

export function resolveTsModule(
  context: TypeTsModuleResolutionContext,
  source: string,
  containingFilePath: string
): ts.ResolvedModuleFull | undefined {
  return ts.resolveModuleName(
    source,
    containingFilePath,
    context.compilerOptions,
    context.host,
    context.moduleResolutionCache
  ).resolvedModule;
}

export function resolveRequiredModulePath(
  context: TypeTsModuleResolutionContext,
  source: string,
  containingFilePath: string
): string {
  const resolved = resolveTsModule(context, source, containingFilePath)?.resolvedFileName;

  if (resolved) return path.resolve(resolved);

  throw new Error(`Failed to resolve import "${source}" from "${containingFilePath}"`);
}

export function getTsModuleSpecifier(node: ts.Node): string | null {
  if (
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier &&
    ts.isStringLiteralLike(node.moduleSpecifier)
  )
    return node.moduleSpecifier.text;

  if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal))
    return node.argument.literal.text;

  if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword &&
    node.arguments.length >= 1 &&
    ts.isStringLiteralLike(node.arguments[0])
  )
    return node.arguments[0].text;

  return null;
}
