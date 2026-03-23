import type { BaseChecker, BasePlugin, TypeFullCycleOptions } from '../../src/generator';

export type TypeSandboxLocalizedText = { ru: string; en: string };

export type TypeRecipeFile =
  | { path: string; operation: 'add' | 'change'; content: string }
  | { path: string; operation: 'remove' };

export type TypeSandboxRecipeConfig = {
  id: string;
  title: TypeSandboxLocalizedText;
  description: TypeSandboxLocalizedText;
  steps: Array<{
    title: string;
    files: Array<TypeRecipeFile>;
  }>;
} & (
  | {
      plugin: (params: { rootDir: string }) => BasePlugin;
      checker?: (params: { rootDir: string }) => BaseChecker;
      afterFinish?: never;
    }
  | {
      checker: (params: { rootDir: string }) => BaseChecker;
      plugin?: (params: { rootDir: string }) => BasePlugin;
      afterFinish?: never;
    }
  | {
      afterFinish: (params: { rootDir: string }) => NonNullable<TypeFullCycleOptions['afterFinish']>;
      plugin?: never;
      checker?: never;
    }
);

export type TypeSandboxCode = {
  content: string;
  lang: string;
};

export type TypeSandboxRecipe = {
  id: string;
  kind?: 'checker' | 'afterFinish';
  title: TypeSandboxLocalizedText;
  description: TypeSandboxLocalizedText;
  pluginCode: TypeSandboxCode;
  steps: Array<{
    title: string;
    inputFiles: Array<{
      path: string;
      code: TypeSandboxCode;
      operation: 'add' | 'change' | 'remove';
    }>;
    consoleNormal: TypeSandboxCode;
    consoleMinimal: TypeSandboxCode;
    markdownFeedback: TypeSandboxCode;
    rawLogs: TypeSandboxCode;
    files: Array<{ path: string; code: TypeSandboxCode }>;
  }>;
};
