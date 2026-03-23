import fs from 'node:fs';
import path from 'node:path';

import { BasePlugin } from '../BasePlugin';
import type { TypeEntries, TypeEntryKind, TypeGeneratedFiles, TypePluginGenerateArgs } from '../types';

type TypeModuleFile = {
  ext: string;
  name: string;
  fileName: string;
  entryPath: string;
  relativePath: string;
  rootRelativePath: string;
};

type TypeModule = {
  entryName: string;
  entryPath: string;
  moduleName: string;
  relativePath: string;
  entryFileName: string;
  rootRelativePath: string;
  files: Array<TypeModuleFile>;
};

export type TypeConfig = {
  entries: TypeEntries;
  entryKind: TypeEntryKind;
  targetFile: string;
  template: (params: {
    modules: Array<TypeModule>;
    rootDir: string;
    targetFile: string;
    targetFolder: string;
  }) => string;
};

function getParentCandidates(relativePath: string): Array<string> {
  const candidates = [relativePath];

  let nextPath = relativePath;

  while (nextPath !== '.' && nextPath !== '') {
    nextPath = path.posix.dirname(nextPath);

    if (nextPath === '.') break;

    candidates.push(nextPath);
  }

  return candidates;
}

function matchesEntry({
  entries,
  entryKind,
  relativePath,
}: {
  entries: TypeEntries;
  entryKind: TypeEntryKind;
  relativePath: string;
}) {
  const candidates = entryKind === 'dir' ? getParentCandidates(relativePath) : [relativePath];

  return candidates.some((candidate) => entries.some((entry) => path.matchesGlob(candidate, entry)));
}

export class PluginModular extends BasePlugin {
  readonly name = 'modular';

  private configs: Array<TypeConfig>;

  constructor(configs: Array<TypeConfig>) {
    super();

    this.configs = configs;
  }

  async generate({ rootDir, changedFiles }: TypePluginGenerateArgs): Promise<TypeGeneratedFiles> {
    const generatedFiles: TypeGeneratedFiles = [];

    const structuralChangedFiles = changedFiles?.filter(({ event }) => event === 'add' || event === 'unlink');

    if (structuralChangedFiles && !structuralChangedFiles.length) return generatedFiles;

    for (const { targetFile, entries, entryKind, template } of this.configs) {
      const targetFolder = path.dirname(targetFile);
      const entryPaths = this.globToPaths({ entries, rootDir, kind: entryKind });

      const shouldGenerate =
        !structuralChangedFiles ||
        structuralChangedFiles.some(({ filePath, relativePath }) => {
          if (matchesEntry({ entries, relativePath, entryKind })) return true;

          return entryPaths.some((entryPath) => filePath === entryPath || filePath.startsWith(`${entryPath}/`));
        });

      if (!shouldGenerate) continue;

      const modules = entryPaths.map((entryPath) => {
        const { base: entryFileName, dir, name: entryName } = path.parse(entryPath);

        const moduleName = path.basename(dir);
        const entryPathNoExt = path.resolve(dir, entryName);
        const relativePath = path.relative(targetFolder, entryPathNoExt).replace(/\\/g, '/');
        const rootRelativePath = path.relative(rootDir, entryPath).replace(/\\/g, '/');

        let files: Array<TypeModuleFile> = [];

        if (entryKind === 'dir') {
          files = fs
            .readdirSync(entryPath)
            .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
            .map((fileName) => {
              const filePath = path.resolve(entryPath, fileName);
              const { name, ext } = path.parse(fileName);

              const relativePath = path.relative(targetFolder, path.resolve(entryPath, name)).replace(/\\/g, '/');
              const rootRelativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');

              return { fileName, name, ext, entryPath: filePath, relativePath, rootRelativePath };
            });
        }

        return { moduleName, entryName, entryFileName, relativePath, rootRelativePath, entryPath, files };
      });

      generatedFiles.push({
        filePath: targetFile,
        rawContent: template({ modules, rootDir, targetFile, targetFolder }),
        plugin: this.name,
      });
    }

    return generatedFiles;
  }
}
