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

type TypeScaffoldFile = {
  content: string;
  filePath: string;
};

export type TypeConfig = {
  entries: TypeEntries;
  createFiles: (params: { folderName: string; folderPath: string }) => Array<TypeScaffoldFile>;
};

export class PluginScaffold extends BasePlugin {
  name = 'scaffold';

  private configs: Array<TypeConfig>;
  private toDelete: Array<string> = [];

  constructor(configs: Array<TypeConfig>) {
    super();

    this.configs = configs;
  }

  async generate({ rootDir, pluginError }: TypePluginGenerateArgs): Promise<TypeGeneratedFiles> {
    const generatedFiles: TypeGeneratedFiles = [];
    const processedMarkers = new Set<string>();
    const plannedTargets = new Set<string>();

    this.toDelete = [];

    for (const { entries, createFiles } of this.configs) {
      const markerPaths = this.globToPaths({ rootDir, entries, kind: 'file' });
      const configFiles: TypeGeneratedFiles = [];
      const configMarkers: Array<string> = [];
      const configTargets = new Set<string>();
      const configProcessedMarkers = new Set<string>();

      let invalidConfig = false;

      for (const markerPath of markerPaths) {
        if (processedMarkers.has(markerPath) || configProcessedMarkers.has(markerPath)) continue;

        configProcessedMarkers.add(markerPath);

        const folderPath = path.dirname(markerPath);
        const folderName = path.basename(folderPath);
        const files = createFiles({ folderName, folderPath });
        const targetPaths = files.map(({ filePath }) => filePath);
        const relativeTarget = targetPaths.find((filePath) => !path.isAbsolute(filePath));

        if (relativeTarget !== undefined) {
          pluginError({
            plugin: this.name,
            message: 'createFiles should return absolute file paths',
            error: new Error(`${path.relative(rootDir, markerPath)}: ${relativeTarget}`),
          });

          invalidConfig = true;

          break;
        }

        const duplicateTarget = targetPaths.find((filePath, index) => targetPaths.indexOf(filePath) !== index);
        const occupiedTarget = targetPaths.find((filePath) => fs.lstatSync(filePath, { throwIfNoEntry: false }));
        const plannedTarget = targetPaths.find(
          (filePath) => plannedTargets.has(filePath) || configTargets.has(filePath)
        );

        if (!files.length || duplicateTarget || occupiedTarget || plannedTarget) {
          const marker = path.relative(rootDir, markerPath);

          let reason = 'createFiles returned no target files';

          if (duplicateTarget) reason = `duplicate target: ${path.relative(rootDir, duplicateTarget)}`;
          if (occupiedTarget) reason = `target already exists: ${path.relative(rootDir, occupiedTarget)}`;
          if (plannedTarget) reason = `target is already planned: ${path.relative(rootDir, plannedTarget)}`;

          pluginError({ plugin: this.name, message: 'Scaffold failed', error: new Error(`${marker}: ${reason}`) });

          continue;
        }

        files.forEach((file) => {
          configFiles.push({ filePath: file.filePath, rawContent: file.content, plugin: this.name, skipHeader: true });
        });

        targetPaths.forEach((filePath) => configTargets.add(filePath));

        configMarkers.push(markerPath);
      }

      if (invalidConfig) continue;

      generatedFiles.push(...configFiles);

      this.toDelete.push(...configMarkers);

      configTargets.forEach((filePath) => plannedTargets.add(filePath));

      configProcessedMarkers.forEach((markerPath) => processedMarkers.add(markerPath));
    }

    return generatedFiles;
  }

  cleanup({ generatedFiles }: TypePluginCleanupArgs): TypeCleanupFiles {
    const markerPaths = this.toDelete;

    this.toDelete = [];

    const scaffoldFiles = generatedFiles.filter(({ plugin }) => plugin === this.name);

    if (!scaffoldFiles.length || scaffoldFiles.some(({ filePath }) => !fs.existsSync(filePath))) return [];

    return markerPaths.map((filePath) => ({ filePath, plugin: this.name }));
  }
}
