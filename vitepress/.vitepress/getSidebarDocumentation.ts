import type { DefaultTheme } from 'vitepress';

const languages = ['ru', 'en'] as const;

export type TypeLanguage = (typeof languages)[number];

export type TypeLocalization = Record<string, Record<TypeLanguage, string>>;

export function getSidebarDocumentation(ln: TypeLocalization) {
  const result: Record<TypeLanguage, DefaultTheme.SidebarMulti> & {
    defaultLink: Record<TypeLanguage, string>;
  } = {
    ru: {},
    en: {},
    defaultLink: { ru: '', en: '' },
  };

  for (const lang of languages) {
    result.defaultLink[lang] = `/${lang}/introduction/overview`;

    const sidebar: Array<DefaultTheme.SidebarItem> = [
      {
        items: [
          { text: ln.overview[lang], link: result.defaultLink[lang] },
          { text: ln.installation[lang], link: `/${lang}/introduction/installation` },
          { text: ln.fileGeneratorApi[lang], link: `/${lang}/introduction/file-generator-api` },
          { text: ln.llmCliFeedback[lang], link: `/${lang}/introduction/llm-cli-feedback` },
        ],
      },
      {
        text: ln.plugins[lang],
        items: [
          { text: ln.pluginReexport[lang], link: `/${lang}/plugins/reexport` },
          { text: ln.pluginScaffold[lang], link: `/${lang}/plugins/scaffold` },
          { text: ln.pluginModular[lang], link: `/${lang}/plugins/modular` },
          { text: ln.pluginValidators[lang], link: `/${lang}/plugins/validators` },
          { text: ln.pluginTranslations[lang], link: `/${lang}/plugins/translations` },
        ],
      },
      {
        text: ln.checkers[lang],
        items: [
          { text: ln.checkerCli[lang], link: `/${lang}/checkers/cli` },
          { text: ln.checkerEnvKeys[lang], link: `/${lang}/checkers/env-keys` },
          { text: ln.checkerBoundaries[lang], link: `/${lang}/checkers/boundaries` },
        ],
      },
      {
        text: ln.extending[lang],
        items: [
          { text: ln.customPlugin[lang], link: `/${lang}/extending/custom-plugin` },
          { text: ln.customChecker[lang], link: `/${lang}/extending/custom-checker` },
        ],
      },
      {
        text: ln.apiContractCheck[lang],
        items: [
          { text: ln.overview[lang], link: `/${lang}/api-contract-check/overview` },
          {
            text: ln.schemaGeneration[lang],
            link: `/${lang}/api-contract-check/schema-generation`,
          },
          {
            text: ln.payloadValidation[lang],
            link: `/${lang}/api-contract-check/payload-validation`,
          },
          {
            text: ln.incrementalGeneration[lang],
            link: `/${lang}/api-contract-check/incremental-generation`,
          },
        ],
      },
    ];

    for (const item of sidebar) {
      item.items?.forEach(({ link }) => {
        const sectionPath = link!.split('/').slice(0, 3).join('/');

        if (!result[lang][sectionPath]) {
          result[lang][sectionPath] = sidebar;
        }
      });
    }
  }

  return result;
}
