import fs from 'node:fs';
import path from 'node:path';

import type {
  TypeCleanupFiles,
  TypeEntries,
  TypeEntryKind,
  TypeGeneratedFiles,
  TypePluginCleanupArgs,
  TypePluginGenerateArgs,
} from './types';

export abstract class BasePlugin {
  abstract name: string;

  /**
   * Generates files based on the provided configuration
   * This method must be implemented by all subclasses
   */
  abstract generate(args: TypePluginGenerateArgs): Promise<TypeGeneratedFiles>;

  cleanup?(args: TypePluginCleanupArgs): TypeCleanupFiles;

  private assertRootRelativeEntries(entries: TypeEntries): void {
    entries.forEach((entry) => {
      const normalizedEntry = entry.replace(/\\/g, '/');

      if (
        path.isAbsolute(normalizedEntry) ||
        path.win32.isAbsolute(normalizedEntry) ||
        normalizedEntry.split('/').includes('..')
      ) {
        throw new Error(`Entry must stay inside rootDir: ${entry}`);
      }
    });
  }

  private assertInsideRootDir(params: { rootDir: string; filePath: string }): void {
    const { rootDir, filePath } = params;
    const relativePath = path.relative(rootDir, filePath);

    if (relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))) {
      return;
    }

    throw new Error(`Matched path must stay inside rootDir: ${filePath}`);
  }

  globToPaths(params: { rootDir: string; entries: TypeEntries; kind: TypeEntryKind; exclude?: RegExp }): Array<string> {
    const { rootDir, entries, exclude, kind } = params;

    this.assertRootRelativeEntries(entries);

    return fs
      .globSync(entries, { cwd: rootDir, withFileTypes: true })
      .filter((dirent) => (kind === 'file' ? dirent.isFile() : dirent.isDirectory()))
      .filter((dirent) => !exclude?.test(dirent.name))
      .map((dirent) => {
        const filePath = path.resolve(dirent.parentPath, dirent.name);

        this.assertInsideRootDir({ rootDir, filePath });

        return filePath;
      })
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }

  getDirectChildren(params: {
    folderPath: string;
    filter?: (filePath: string) => boolean;
    exclude?: RegExp;
  }): Array<string> {
    const { filter, folderPath, exclude } = params;

    return fs
      .readdirSync(folderPath, { withFileTypes: true })
      .filter((dirent) => dirent.isFile())
      .filter((dirent) => !exclude?.test(dirent.name))
      .map((dirent) => path.resolve(dirent.parentPath, dirent.name))
      .filter((filePath) => !filter || filter(filePath))
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }
}
