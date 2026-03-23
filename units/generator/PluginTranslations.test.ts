import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import { PluginTranslations, type PluginTranslationsConfig, type TypeMessage } from '../../src/generator';
import { createChangedFile, getPath, rootDir, saveMemory } from './helpers';

function createMessages<TMessages extends Record<string, string>>(dirname: string, obj: TMessages) {
  const messages: Record<keyof TMessages, { defaultValue: string; name: keyof TMessages }> = {} as any;
  const dirnameNormalized = dirname.replace(/\\/g, '/');

  for (const key in obj) {
    messages[key] = { name: `${dirnameNormalized}__${key}`, defaultValue: obj[key] };
  }

  return messages;
}

describe('PluginTranslations', () => {
  const targetFile = getPath('translations.json');
  const profileMessagesPath = getPath('features/profile/messages.ts');

  const memory = {
    'features/calendar/messages.ts': `
import { createMessages } from 'translations/createMessages';

export const messages = createMessages(__dirname, { title: 'Calendar', header: 'Calendar' });
`,
    'features/profile/messages.ts': `
import { createMessages } from 'translations/createMessages';

export const messages = createMessages(__dirname, { save: 'Save' });
`,
    'translations.json': `{
  "features/calendar__header": {
    "defaultValue": "Old header",
    "ru": "Календарь"
  },
  "features/calendar__legacy": {
    "defaultValue": "Legacy",
    "ru": "Легаси",
    "de": "Legacy"
  },
  "features/profile__save": {
    "defaultValue": "Save",
    "de": "Speichern"
  }
}
`,
  };

  const expectedTranslations = {
    'features/calendar__header': { defaultValue: 'Calendar', ru: 'Календарь' },
    'features/calendar__title': { defaultValue: 'Calendar', ru: 'ru:Calendar' },
    'features/profile__save': { defaultValue: 'Save', ru: 'ru:Save' },
  };

  const toGeneratedFiles = (translations: Record<string, Record<string, string>>) => [
    {
      plugin: 'translations',
      filePath: targetFile,
      skipHeader: true,
      rawContent: `${JSON.stringify(translations, null, 2)}\n`,
    },
  ];

  beforeEach(() => {
    fs.mkdirSync(rootDir, { recursive: true });
    saveMemory(memory);
  });

  afterEach(() => {
    mock.restore();
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  const baseConfig: Omit<PluginTranslationsConfig, 'translate'> = {
    entries: ['**/messages.ts'],
    targetFile,
    languages: ['en', 'ru'],
    baseLanguage: 'en',
    parseMessages(filePath: string): Array<TypeMessage> {
      const source = fs.readFileSync(filePath, 'utf-8');
      const content = source.replace(/^[\s\S]*?export\s+const\s+messages\s*=\s*/, 'return ');

      if (content === source) throw new Error(`Messages export not found in: ${filePath}`);

      try {
        const messages = new Function('createMessages', '__dirname', content)(createMessages, path.dirname(filePath));

        return Object.values(messages);
      } catch (error) {
        throw new Error(`Failed to parse messages file ${filePath}: ${error}`);
      }
    },
  };

  it('merges defaults, removes obsolete data, translates missing values and emits json without header', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const translate = mock(async ({ to, text }: { to: string; text: string }) => `${to}:${text}`);
    const pluginTranslations = new PluginTranslations([{ ...baseConfig, translate }]);

    expect(await pluginTranslations.generate({ rootDir, pluginLog, pluginError })).toEqual(
      toGeneratedFiles(expectedTranslations)
    );

    expect(translate.mock.calls).toEqual([[{ to: 'ru', text: 'Save' }], [{ to: 'ru', text: 'Calendar' }]]);

    const plugin = 'translations';

    expect(pluginLog.mock.calls).toEqual([
      [{ message: 'new key: features/calendar__title', plugin }],
      [
        {
          message:
            'default value for features/calendar__header was overwritten: Old header -> Calendar; existing translations were preserved',
          plugin,
        },
      ],
      [{ message: 'removed obsolete key: features/calendar__legacy', plugin }],
      [{ message: 'removed obsolete language de for features/profile__save', plugin }],
      [{ message: 'features/profile__save: translated to [ru]: "ru:Save"', plugin }],
      [{ message: 'features/calendar__title: translated to [ru]: "ru:Calendar"', plugin }],
    ]);
  });

  it('rebuilds on removed messages file and drops obsolete keys', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const translate = mock(async ({ to, text }: { to: string; text: string }) => `${to}:${text}`);
    const pluginTranslations = new PluginTranslations([{ ...baseConfig, translate }]);

    await pluginTranslations.generate({ rootDir, pluginLog, pluginError });

    expect(translate.mock.calls).toEqual([[{ to: 'ru', text: 'Save' }], [{ to: 'ru', text: 'Calendar' }]]);

    fs.unlinkSync(profileMessagesPath);

    const shortenedTranslations = structuredClone(expectedTranslations);

    // @ts-ignore
    delete shortenedTranslations['features/profile__save'];

    const changedFiles = [createChangedFile({ filePath: profileMessagesPath, event: 'unlink' })];

    expect(await pluginTranslations.generate({ rootDir, pluginLog, pluginError, changedFiles })).toEqual(
      toGeneratedFiles(shortenedTranslations)
    );

    expect(translate.mock.calls).toEqual([
      [{ to: 'ru', text: 'Save' }],
      [{ to: 'ru', text: 'Calendar' }],
      [{ to: 'ru', text: 'Calendar' }],
    ]);
  });

  it('does nothing for empty or unrelated changed files', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const translate = mock(async ({ to, text }: { to: string; text: string }) => `${to}:${text}`);
    const pluginTranslations = new PluginTranslations([{ ...baseConfig, translate }]);

    expect(await pluginTranslations.generate({ rootDir, pluginLog, pluginError, changedFiles: [] })).toEqual([]);

    const unrelatedFilePath = getPath('notes.ts');

    fs.writeFileSync(unrelatedFilePath, 'export const notes = 1;\n', 'utf-8');

    const changedFiles = [createChangedFile({ filePath: unrelatedFilePath })];

    expect(await pluginTranslations.generate({ rootDir, pluginLog, pluginError, changedFiles })).toEqual([]);

    expect(translate).not.toHaveBeenCalled();
  });

  it('limits translate concurrency', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    let activeCount = 0;
    let maxActiveCount = 0;

    const translate = mock(async ({ to, text }: { to: string; text: string }) => {
      activeCount += 1;
      maxActiveCount = Math.max(maxActiveCount, activeCount);

      await new Promise((resolve) => setTimeout(resolve, 5));

      activeCount -= 1;

      return `${to}:${text}`;
    });

    const pluginTranslations = new PluginTranslations([
      { ...baseConfig, languages: ['en', 'ru', 'de', 'fr'], translate },
    ]);

    await pluginTranslations.generate({ rootDir, pluginLog, pluginError });

    expect(translate.mock.calls).toEqual([
      [{ to: 'de', text: 'Calendar' }],
      [{ to: 'fr', text: 'Calendar' }],
      [{ to: 'ru', text: 'Save' }],
      [{ to: 'fr', text: 'Save' }],
      [{ to: 'ru', text: 'Calendar' }],
      [{ to: 'de', text: 'Calendar' }],
      [{ to: 'fr', text: 'Calendar' }],
    ]);
    expect(maxActiveCount).toBeLessThanOrEqual(5);
  });

  it('uses empty object when targetFile does not exist', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const translate = mock(async ({ to, text }: { to: string; text: string }) => `${to}:${text}`);
    const pluginTranslations = new PluginTranslations([{ ...baseConfig, translate }]);

    fs.unlinkSync(targetFile);

    expect(await pluginTranslations.generate({ rootDir, pluginLog, pluginError })).toEqual(
      toGeneratedFiles({
        'features/calendar__header': { defaultValue: 'Calendar', ru: 'ru:Calendar' },
        'features/calendar__title': { defaultValue: 'Calendar', ru: 'ru:Calendar' },
        'features/profile__save': { defaultValue: 'Save', ru: 'ru:Save' },
      })
    );
  });

  it('does not translate when additional language values are already present', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const translate = mock(async ({ to, text }: { to: string; text: string }) => `${to}:${text}`);
    const pluginTranslations = new PluginTranslations([{ ...baseConfig, translate }]);

    fs.writeFileSync(targetFile, `${JSON.stringify(expectedTranslations, null, 2)}\n`, 'utf-8');

    expect(await pluginTranslations.generate({ rootDir, pluginLog, pluginError })).toEqual(
      toGeneratedFiles(expectedTranslations)
    );

    expect(translate).not.toHaveBeenCalled();
    expect(pluginLog).not.toHaveBeenCalled();
  });

  it('keeps only defaultValue when only base language is configured', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const translate = mock(async ({ to, text }: { to: string; text: string }) => `${to}:${text}`);
    const pluginTranslations = new PluginTranslations([{ ...baseConfig, languages: ['en'], translate }]);

    expect(await pluginTranslations.generate({ rootDir, pluginLog, pluginError })).toEqual(
      toGeneratedFiles({
        'features/calendar__header': { defaultValue: 'Calendar' },
        'features/calendar__title': { defaultValue: 'Calendar' },
        'features/profile__save': { defaultValue: 'Save' },
      })
    );

    expect(translate).not.toHaveBeenCalled();
  });

  it('processes only matching config for changedFiles in multi-config mode', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const translate = mock(async ({ to, text }: { to: string; text: string }) => `${to}:${text}`);
    const secondaryTargetFile = getPath('admin-translations.json');
    const adminMessagesPath = getPath('admin/messages.ts');

    fs.mkdirSync(path.dirname(adminMessagesPath), { recursive: true });
    fs.writeFileSync(
      adminMessagesPath,
      `// @ts-ignore
import { wrapMessages } from 'dk-localize';

export const messages = wrapMessages(__dirname, {
  dashboard: 'Dashboard',
});
`,
      'utf-8'
    );

    const pluginTranslations = new PluginTranslations([
      { ...baseConfig, entries: ['features/**/messages.ts'], translate },
      {
        ...baseConfig,
        entries: ['admin/**/messages.ts'],
        targetFile: secondaryTargetFile,
        translate,
      },
    ]);

    const generatedFiles = await pluginTranslations.generate({
      rootDir,
      pluginLog,
      pluginError,
      changedFiles: [createChangedFile({ filePath: profileMessagesPath })],
    });

    expect(generatedFiles).toEqual(toGeneratedFiles(expectedTranslations));
    expect(generatedFiles.some(({ filePath }) => filePath === secondaryTargetFile)).toBe(false);
  });

  it('supports custom getKey for translation keys', async () => {
    const pluginLog = mock();
    const pluginError = mock();
    const translate = mock(async ({ to, text }: { to: string; text: string }) => `${to}:${text}`);
    const pluginTranslations = new PluginTranslations([
      {
        ...baseConfig,
        getKey: ({ rootDir, name }) => path.relative(path.dirname(rootDir), name).replace(/\\/g, '/'),
        translate,
      },
    ]);

    expect(await pluginTranslations.generate({ rootDir, pluginLog, pluginError })).toEqual(
      toGeneratedFiles({
        'tmp/features/calendar__header': { defaultValue: 'Calendar', ru: 'ru:Calendar' },
        'tmp/features/calendar__title': { defaultValue: 'Calendar', ru: 'ru:Calendar' },
        'tmp/features/profile__save': { defaultValue: 'Save', ru: 'ru:Save' },
      })
    );
  });
});
