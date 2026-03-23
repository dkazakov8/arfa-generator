import fs from 'node:fs';
import path from 'node:path';

import { BasePlugin } from '../BasePlugin';
import type {
  TypeCleanupFiles,
  TypeEntries,
  TypeGeneratedFiles,
  TypePluginCleanupArgs,
  TypePluginGenerateArgs,
} from '../types';
import { createValidators, type TypeBuilderOutputFile } from '#builder';

export type TypeConfig = {
  entries: TypeEntries;
  exclude?: RegExp;
  requestDeclaration: string;
  responseDeclaration: string;
  targetFolder: string;
  tsconfigPath: string;
  formatContent: (params: {
    schema: TypeBuilderOutputFile['schema'];
    sourcePath: string;
    targetPath: string;
  }) => string;
  getDegraded?: (degraded: Array<string>) => void;
  bailOnDegraded?: boolean;
};

export class PluginValidators extends BasePlugin {
  name = 'validators';

  private configs: Array<TypeConfig>;
  private deps: Record<string, Record<string, Set<string>>> = {};

  constructor(configs: Array<TypeConfig>) {
    super();

    this.configs = configs;
  }

  getAffectedSources(changedFiles?: TypePluginGenerateArgs['changedFiles']) {
    const affectedSources: Record<string, Set<string>> = {};

    if (!changedFiles) return affectedSources;

    for (const { filePath } of changedFiles) {
      if (!this.deps[filePath]) continue;

      for (const [folderPath, sourcePaths] of Object.entries(this.deps[filePath])) {
        affectedSources[folderPath] ??= new Set();

        for (const sourcePath of sourcePaths) {
          affectedSources[folderPath].add(sourcePath);
        }
      }
    }

    return affectedSources;
  }

  async generate({ changedFiles, rootDir }: TypePluginGenerateArgs): Promise<TypeGeneratedFiles> {
    const generatedFiles: TypeGeneratedFiles = [];

    if (changedFiles && !changedFiles.length) return generatedFiles;

    const changedPaths = changedFiles && new Set(changedFiles.map(({ filePath }) => filePath));

    const affectedSourcesByFolder = this.getAffectedSources(changedFiles);

    for (const {
      entries,
      exclude,
      requestDeclaration,
      responseDeclaration,
      targetFolder,
      tsconfigPath,
      formatContent,
      getDegraded,
      bailOnDegraded = false,
    } of this.configs) {
      const relevantFolders = this.globToPaths({ entries, rootDir, kind: 'dir' }).filter((folderPath) => {
        if (!changedPaths) return true;

        return (
          changedPaths.has(folderPath) ||
          changedFiles.some(({ filePath }) => filePath.startsWith(`${folderPath}/`)) ||
          affectedSourcesByFolder[folderPath] != null
        );
      });

      for (const folderPath of relevantFolders) {
        const sourcePaths = this.getDirectChildren({
          folderPath,
          exclude,
          filter: (filePath) =>
            !changedPaths || changedPaths.has(filePath) || affectedSourcesByFolder[folderPath]?.has(filePath),
        });

        if (!sourcePaths.length) continue;

        const { deps, result } = createValidators(sourcePaths, {
          tsconfigPath,
          requestDeclaration,
          responseDeclaration,
          getDegraded: (degraded) => {
            getDegraded?.(degraded);

            if (bailOnDegraded) {
              throw new Error(`API contracts degraded to any in "${folderPath}": ${degraded.join(', ')}`);
            }
          },
        });

        for (const [depPath, whichSourcesImportDep] of Object.entries(deps)) {
          this.deps[depPath] ??= {};
          this.deps[depPath][folderPath] ??= new Set();

          for (const sourcePath of whichSourcesImportDep) {
            this.deps[depPath][folderPath].add(sourcePath);
          }
        }

        for (const { schema, filePath: sourcePath } of result) {
          const targetPath = path.resolve(targetFolder, path.relative(rootDir, sourcePath));
          const rawContent = formatContent({ schema, sourcePath, targetPath });

          generatedFiles.push({ filePath: targetPath, rawContent, plugin: this.name });
        }
      }
    }

    return generatedFiles;
  }

  cleanup({ generatedFiles, changedFiles, rootDir }: TypePluginCleanupArgs): TypeCleanupFiles {
    const expectedPaths = new Set(generatedFiles.map(({ filePath }) => filePath));
    const cleanupFiles: TypeCleanupFiles = [];

    if (changedFiles) {
      for (const { event, filePath } of changedFiles) {
        if (event !== 'unlink' || fs.existsSync(filePath)) continue;

        const relativePath = path.relative(rootDir, filePath);
        const folderPath = path.dirname(relativePath).replace(/\\/g, '/');
        const fileName = path.basename(filePath);

        for (const { entries, exclude, targetFolder } of this.configs) {
          if (exclude?.test(fileName) || !entries.some((entry) => path.matchesGlob(folderPath, entry))) continue;

          const targetPath = path.resolve(targetFolder, relativePath);

          if (expectedPaths.has(targetPath)) continue;

          cleanupFiles.push({ filePath: targetPath, plugin: this.name });
        }
      }

      return cleanupFiles;
    }

    this.configs
      .filter(({ targetFolder }) => fs.existsSync(targetFolder))
      .forEach(({ targetFolder }) => {
        this.globToPaths({ rootDir: targetFolder, entries: ['**/*'], kind: 'file' })
          .filter((filePath) => !expectedPaths.has(filePath))
          .forEach((filePath) => {
            cleanupFiles.push({ filePath, plugin: this.name });
          });
      });

    return cleanupFiles;
  }
}
