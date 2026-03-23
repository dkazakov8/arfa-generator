import type { TypeSandboxRecipeConfig } from '../types';
import { afterFinishRecipeConfigs } from './AfterFinish';
import { checkerBoundariesRecipeConfigs } from './CheckerBoundaries';
import { checkerCliRecipeConfigs } from './CheckerCli';
import { checkerEnvKeysRecipeConfigs } from './CheckerEnvKeys';
import { pluginModularRecipeConfigs } from './PluginModular';
import { pluginReexportRecipeConfigs } from './PluginReexport';
import { pluginScaffoldRecipeConfigs } from './PluginScaffold';
import { pluginTranslationsRecipeConfigs } from './PluginTranslations';
import { pluginValidatorsRecipeConfigs } from './PluginValidators';

export const sandboxRecipeConfigs: Array<TypeSandboxRecipeConfig> = [
  ...pluginReexportRecipeConfigs,
  ...pluginScaffoldRecipeConfigs,
  ...pluginModularRecipeConfigs,
  ...pluginTranslationsRecipeConfigs,
  ...pluginValidatorsRecipeConfigs,
  ...checkerBoundariesRecipeConfigs,
  ...checkerCliRecipeConfigs,
  ...checkerEnvKeysRecipeConfigs,
  ...afterFinishRecipeConfigs,
];
