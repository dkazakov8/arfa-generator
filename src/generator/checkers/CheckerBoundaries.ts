import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { BaseChecker } from '../BaseChecker';
import type { TypeCheckerCheckArgs } from '../types';
import { createTsProjectResolution, getTsModuleSpecifier, resolveTsModule } from '#builder';

type TypeResolvedImport = { path: string; external: boolean; node: boolean };
type TypeImportsInsideScope = 'none' | 'all' | 'sameTopLevel';

type TypeRule = {
  entries: Array<string>;
  exclude?: RegExp;
  allow: {
    imports: Array<string>;
    importsInsideScope: TypeImportsInsideScope;
    external?: boolean;
    node?: boolean;
  };
};

type TypeBoundariesContext = ReturnType<typeof createTsProjectResolution> & {
  projectRootDir: string;
  extensions: Array<string>;
  rules: Array<TypeRule>;
};

export type TypeConfig = {
  tsconfigPath: string;
  extensions: Array<string>;
  rules: Array<TypeRule>;
};

export type TypeBoundaryViolation = { path: string; source: string };
export type TypeBoundaryViolationGroup = {
  filePath: string;
  imports: Array<TypeBoundaryViolation>;
};

export class CheckerBoundaries extends BaseChecker {
  readonly name = 'boundaries';
  private config: TypeConfig;

  constructor(config: TypeConfig) {
    super();

    this.config = config;
  }

  getViolationGroups(args: Pick<TypeCheckerCheckArgs, 'rootDir'>): Array<TypeBoundaryViolationGroup> {
    const context = this.createContext(args);
    const violationGroups: Array<TypeBoundaryViolationGroup> = [];

    for (const filePath of context.fileNames) {
      if (!context.extensions.includes(path.extname(filePath))) continue;

      const violationGroup = this.checkFile(context, filePath);

      if (violationGroup) violationGroups.push(violationGroup);
    }

    return violationGroups.sort((a, b) => a.filePath.localeCompare(b.filePath));
  }

  async check(args: TypeCheckerCheckArgs): Promise<void> {
    const { checkerError } = args;
    const violationGroups = this.getViolationGroups(args);

    for (const group of violationGroups) {
      const imports = group.imports
        .map((imported) =>
          imported.source === imported.path ? imported.source : `${imported.source} -> ${imported.path}`
        )
        .join(', ');

      checkerError({
        message: 'Boundary violation found',
        error: new Error(`${group.filePath} has illegal imports: ${imports}`),
      });
    }
  }

  private createContext(args: Pick<TypeCheckerCheckArgs, 'rootDir'>): TypeBoundariesContext {
    const resolution = createTsProjectResolution({ tsconfigPath: this.config.tsconfigPath });

    return {
      ...resolution,
      extensions: this.config.extensions,
      projectRootDir: args.rootDir,
      rules: this.config.rules,
    };
  }

  private checkFile(context: TypeBoundariesContext, filePath: string): TypeBoundaryViolationGroup | null {
    const projectPath = this.toProjectPath(context, filePath);
    const fileName = path.basename(filePath);
    const fileRules = context.rules.filter(
      (rule) =>
        !rule.exclude?.test(fileName) &&
        rule.entries.some((entryPattern) => path.matchesGlob(projectPath, entryPattern))
    );

    if (fileRules.length === 0) return null;

    const sourceText = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
    const imports: Array<TypeBoundaryViolation> = [];
    const sourcesSet = new Set<string>();

    const visit = (node: ts.Node) => {
      const source = getTsModuleSpecifier(node);

      if (source) {
        if (sourcesSet.has(source)) {
          ts.forEachChild(node, visit);
          return;
        }

        sourcesSet.add(source);

        const imported = this.resolveImport(context, source, filePath);

        for (const rule of fileRules) {
          if (!this.isAllowedImport(projectPath, imported, rule)) {
            imports.push({ path: imported.path, source });
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return imports.length > 0 ? { filePath, imports } : null;
  }

  private isAllowedImport(projectPath: string, imported: TypeResolvedImport, rule: TypeRule): boolean {
    if (rule.allow.imports.some((importGlob) => path.matchesGlob(imported.path, importGlob))) {
      return (
        rule.allow.importsInsideScope !== 'sameTopLevel' ||
        !this.isTopLevelCrossImport(projectPath, imported.path, rule)
      );
    }

    if (
      rule.allow.importsInsideScope !== 'none' &&
      rule.entries.some((entryPattern) => path.matchesGlob(imported.path, entryPattern))
    ) {
      return rule.allow.importsInsideScope === 'all' || !this.isTopLevelCrossImport(projectPath, imported.path, rule);
    }

    return Boolean((rule.allow.node && imported.node) || (rule.allow.external && imported.external));
  }

  private isTopLevelCrossImport(projectPath: string, importedPath: string, rule: TypeRule): boolean {
    return rule.entries.some((entryPattern) => {
      const root = this.getTopLevelRoot(entryPattern);

      if (!root || !projectPath.startsWith(root) || !importedPath.startsWith(root)) return false;

      return this.getTopLevelName(projectPath, root) !== this.getTopLevelName(importedPath, root);
    });
  }

  private getTopLevelRoot(entryPattern: string): string | null {
    const wildcardIndex = entryPattern.search(/[*?{[]/);
    const plainPrefix = wildcardIndex === -1 ? entryPattern : entryPattern.slice(0, wildcardIndex);
    const root = plainPrefix.slice(0, plainPrefix.lastIndexOf('/') + 1);

    return root || null;
  }

  private getTopLevelName(projectPath: string, root: string): string {
    return projectPath.slice(root.length).split('/')[0];
  }

  private resolveImport(context: TypeBoundariesContext, source: string, containingFile: string): TypeResolvedImport {
    if (source.startsWith('node:')) return { path: source, external: false, node: true };

    const resolvedModule = resolveTsModule(context, source, containingFile);

    const resolvedFileName =
      resolvedModule?.resolvedFileName ?? this.resolveAssetImport(context, source, containingFile);

    return {
      path: resolvedFileName ? this.toProjectPath(context, resolvedFileName) : source,
      external: Boolean(resolvedModule?.isExternalLibraryImport),
      node: false,
    };
  }

  private resolveAssetImport(context: TypeBoundariesContext, source: string, containingFile: string): string | null {
    if (source.startsWith('.')) {
      const resolvedPath = path.resolve(path.dirname(containingFile), source);

      return fs.existsSync(resolvedPath) ? resolvedPath : null;
    }

    for (const [alias, substitutions] of Object.entries(context.pathAliases)) {
      const wildcard = this.matchPathAlias(source, alias);

      if (wildcard === null) continue;

      for (const substitution of substitutions) {
        const candidate = path.resolve(context.pathsBasePath, substitution.replace('*', wildcard));

        if (fs.existsSync(candidate)) return candidate;
      }
    }

    return null;
  }

  private matchPathAlias(source: string, alias: string): string | null {
    if (!alias.includes('*')) return source === alias ? '' : null;

    const [prefix, suffix] = alias.split('*');

    if (!source.startsWith(prefix) || !source.endsWith(suffix)) return null;

    return source.slice(prefix.length, source.length - suffix.length);
  }

  private toProjectPath(context: TypeBoundariesContext, filePath: string): string {
    return path.relative(context.projectRootDir, filePath).split(path.sep).join('/');
  }
}
