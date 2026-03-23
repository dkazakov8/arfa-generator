import fs from 'node:fs';
import path from 'node:path';

import { BasePlugin } from '../BasePlugin';
import type { TypeEntries, TypeGeneratedFiles, TypePluginGenerateArgs } from '../types';

type TypeReexportFile = { fileName: string; name: string; ext: string };

export type TypeConfig = {
  entries: TypeEntries;
  exclude?: RegExp;
  fileNameTemplate?: (params: { folderName: string }) => string;
  noPackage?: boolean;
  onlyPackage?: boolean;
  validateContent?: (params: TypeReexportFile & { content: string; folderName: string }) => boolean;
  template: (params: { folderName: string; files: Array<TypeReexportFile> }) => string;
};

export class PluginReexport extends BasePlugin {
  name = 'reexport';

  private configs: Array<TypeConfig>;

  constructor(configs: Array<TypeConfig>) {
    super();

    this.configs = configs;
  }

  async generate({ changedFiles, rootDir, pluginError }: TypePluginGenerateArgs): Promise<TypeGeneratedFiles> {
    const generatedFiles: TypeGeneratedFiles = [];

    if (changedFiles && !changedFiles.length) return generatedFiles;

    for (const { entries, fileNameTemplate, noPackage, onlyPackage, validateContent, template, exclude } of this
      .configs) {
      const relevantFolders = this.globToPaths({ entries, rootDir, exclude, kind: 'dir' }).filter((folderPath) => {
        if (!changedFiles) return true;

        return changedFiles.some(({ filePath }) => {
          if (filePath === folderPath) return true;
          if (!filePath.startsWith(`${folderPath}/`)) return false;

          return !exclude?.test(path.basename(filePath));
        });
      });

      for (const folderPath of relevantFolders) {
        const folderName = path.basename(folderPath);
        const reexportName = fileNameTemplate?.({ folderName }) || '_reexport.ts';
        const targetPath = path.resolve(folderPath, reexportName);

        const files = fs
          .readdirSync(folderPath, { withFileTypes: true })
          .filter((dirent) => {
            const { name: fileName } = dirent;

            return !['package.json', reexportName].includes(fileName) && !exclude?.test(fileName);
          })
          .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
          .flatMap((dirent) => {
            const { name: fileName } = dirent;
            const { name, ext } = path.parse(fileName);

            const file = { fileName, name, ext };

            if (!validateContent || !dirent.isFile()) return [file];

            const content = fs.readFileSync(path.resolve(folderPath, fileName), 'utf-8');

            if (validateContent({ ...file, content, folderName })) return [file];

            const validationMessage = `file content has not passed validation, not added to reexport: ${path.relative(rootDir, path.resolve(folderPath, fileName))}`;

            pluginError({
              message: 'Reexport validation failed',
              plugin: this.name,
              error: new Error(validationMessage),
            });

            return [];
          });

        if (!noPackage) {
          generatedFiles.push({
            filePath: path.resolve(folderPath, 'package.json'),
            rawContent: `{ "main": "${reexportName}", "types": "${reexportName}" }`,
            plugin: this.name,
            skipHeader: true,
          });
        }

        if (!onlyPackage) {
          generatedFiles.push({ filePath: targetPath, rawContent: template({ folderName, files }), plugin: this.name });
        }
      }
    }

    return generatedFiles;
  }
}
