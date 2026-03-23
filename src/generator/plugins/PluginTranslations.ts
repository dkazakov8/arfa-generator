import fs from 'node:fs';
import path from 'node:path';

import { BasePlugin } from '../BasePlugin';
import type { TypeEntries, TypeGeneratedFiles, TypeMessage, TypePluginGenerateArgs } from '../types';

export type TypeConfig = {
  entries: TypeEntries;
  targetFile: string;
  languages: Array<string>;
  baseLanguage: string;
  getKey?: (params: { rootDir: string; name: string }) => string;
  parseMessages: (filePath: string) => Array<TypeMessage>;
  translate: (params: { to: string; text: string }) => Promise<string>;
};

type TypePreparedConfig = TypeConfig & {
  additionalLanguages: Array<string>;
  getKey: (params: { rootDir: string; name: string }) => string;
  languagesSet: Set<string>;
};

type TypeTranslations = Record<string, Record<string, string | undefined> & { defaultValue: string }>;

const TRANSLATE_CONCURRENCY = 5;

export class PluginTranslations extends BasePlugin {
  name = 'translations';
  private configs: Array<TypePreparedConfig>;

  constructor(configs: Array<TypeConfig>) {
    super();

    this.configs = configs.map((config) => ({
      ...config,
      additionalLanguages: config.languages.filter((lang) => lang !== config.baseLanguage),
      getKey: config.getKey || (({ rootDir, name }) => path.relative(rootDir, name).replace(/\\/g, '/')),
      languagesSet: new Set(config.languages),
    }));
  }

  private async runWithConcurrency(tasks: Array<() => Promise<void>>, concurrency: number): Promise<void> {
    if (!tasks.length) return;

    let currentIndex = 0;

    const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
      while (currentIndex < tasks.length) {
        const task = tasks[currentIndex++];

        await task();
      }
    });

    await Promise.all(workers);
  }

  async generate({ changedFiles, rootDir, pluginLog }: TypePluginGenerateArgs): Promise<TypeGeneratedFiles> {
    const generatedFiles: TypeGeneratedFiles = [];

    if (changedFiles && !changedFiles.length) return generatedFiles;

    for (const { entries, getKey, translate, targetFile, languagesSet, parseMessages, additionalLanguages } of this
      .configs) {
      if (
        changedFiles &&
        !changedFiles.some(({ relativePath }) => entries.some((entry) => path.matchesGlob(relativePath, entry)))
      )
        continue;

      const targetContent = fs.existsSync(targetFile) ? fs.readFileSync(targetFile, 'utf-8') : '{}';
      const translations: TypeTranslations = JSON.parse(targetContent);
      const translationTasks: Array<() => Promise<void>> = [];

      const defaultTranslations = this.globToPaths({ entries, rootDir, kind: 'file' })
        .flatMap((filePath) => parseMessages(filePath))
        .reduce((defaultTranslations, { name, defaultValue }) => {
          defaultTranslations[getKey({ rootDir, name })] = { defaultValue };

          return defaultTranslations;
        }, {} as TypeTranslations);

      Object.entries(defaultTranslations).forEach(([key, value]) => {
        if (translations[key] == null) {
          pluginLog({ message: `new key: ${key}`, plugin: this.name });

          translations[key] = value;
        } else if (translations[key].defaultValue !== value.defaultValue) {
          pluginLog({
            message: `default value for ${key} was overwritten: ${translations[key].defaultValue} -> ${value.defaultValue}; existing translations were preserved`,
            plugin: this.name,
          });

          translations[key].defaultValue = value.defaultValue;
        }
      });

      Object.entries(translations).forEach(([key, value]) => {
        if (!defaultTranslations[key]) {
          pluginLog({ message: `removed obsolete key: ${key}`, plugin: this.name });

          delete translations[key];

          return;
        }

        Object.keys(value).forEach((lang) => {
          if (lang !== 'defaultValue' && !languagesSet.has(lang)) {
            pluginLog({ message: `removed obsolete language ${lang} for ${key}`, plugin: this.name });

            delete value[lang];
          }
        });

        additionalLanguages.forEach((lang) => {
          if (value[lang] != null) return;

          translationTasks.push(async () => {
            const translatedValue = await translate({ to: lang, text: value.defaultValue });

            pluginLog({ message: `${key}: translated to [${lang}]: "${translatedValue}"`, plugin: this.name });

            value[lang] = translatedValue;
          });
        });
      });

      await this.runWithConcurrency(translationTasks, TRANSLATE_CONCURRENCY);

      const sortedTranslations: TypeTranslations = {};

      Object.keys(translations)
        .sort((a, b) => a.localeCompare(b))
        .forEach((key) => {
          sortedTranslations[key] = translations[key];
        });

      generatedFiles.push({
        filePath: targetFile,
        rawContent: `${JSON.stringify(sortedTranslations, null, 2)}\n`,
        skipHeader: true,
        plugin: this.name,
      });
    }

    return generatedFiles;
  }
}
