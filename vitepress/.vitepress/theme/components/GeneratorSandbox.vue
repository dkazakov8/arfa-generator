<script setup lang="ts">
import { codeToHtml } from 'shiki';
import { useData } from 'vitepress';
import { reactive } from 'vue';

import type { TypeSandboxCode, TypeSandboxRecipe } from '../../../../scripts/emulator/types';
import { activeOutputMode, outputTabs, selectOutputMode } from '../useOutputMode';
import { escapeHtml } from '../utils';
import Accordion from './Accordion.vue';

const props = defineProps<{ recipe: TypeSandboxRecipe }>();

const { id, steps, title, description } = props.recipe;

const { lang: pageLang } = useData();

const translations = {
  ru: {
    example: 'Пример',
    runSandbox: 'Запустить Sandbox',
    user: 'USER',
    fileCreated: 'создан с содержимым:',
    fileChanged: 'изменён, новое содержимое:',
    fileRemoved: 'удалён',
    showsLogs: 'выводит логи:',
    updatedFiles: 'обновил файлы проекта:',
    generatedFiles: 'сгенерировал файлы:',
    copyCode: 'Копировать код',
  },
  en: {
    example: 'Example',
    runSandbox: 'Run Sandbox',
    user: 'USER',
    fileCreated: 'was created with content:',
    fileChanged: 'was updated with content:',
    fileRemoved: 'was removed',
    showsLogs: 'shows logs:',
    updatedFiles: 'updated project files:',
    generatedFiles: 'generated files:',
    copyCode: 'Copy code',
  },
};

const highlightedCode = reactive(new Map<string, string | null>());

function getCodeKey(code: TypeSandboxCode): string {
  return `${pageLang.value}\x00${code.lang}\x00${code.content}`;
}

function wrapCodeHtml(code: TypeSandboxCode, html: string): string {
  const lang = code.lang === 'svg' || code.lang === 'console' ? 'txt' : code.lang;

  return `<div class="language-${lang}">
    <button title="${state.text.copyCode}" class="copy"></button>
    <span class="lang">${lang}</span>
    ${html.replace('<pre ', '<pre dir="ltr" v-pre="" ')}
  </div>`.replace(/(\n\s+)/g, '\n');
}

function renderPlainCode(code: TypeSandboxCode) {
  let content = escapeHtml(code.content);

  if (code.lang === 'console') {
    content = content.replace(/\x1b\[(\d+)m/g, (_, code: string) => {
      return code === '39' ? '</span>' : `<span class="sandbox-ansi-${code}">`;
    });
  }

  return wrapCodeHtml(
    code,
    `<pre dir="ltr" v-pre="" class="shiki shiki-themes github-light github-dark" tabindex="0"><code>${content
      .split('\n')
      .map((line) => `<span class="line">${line}</span>`)
      .join('\n')}</code></pre>`
  );
}

async function ensureHighlighted(code: TypeSandboxCode): Promise<void> {
  const key = getCodeKey(code);

  if (highlightedCode.has(key)) return;

  if (code.lang === 'console') {
    highlightedCode.set(key, renderPlainCode(code));

    return;
  }

  highlightedCode.set(key, null);

  try {
    const html = await codeToHtml(code.content, {
      lang: code.lang === 'svg' ? 'text' : code.lang,
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    });

    highlightedCode.set(key, wrapCodeHtml(code, html));
  } catch {
    highlightedCode.set(key, renderPlainCode(code));
  }
}

function renderCode(code: TypeSandboxCode): string {
  void ensureHighlighted(code);

  return highlightedCode.get(getCodeKey(code)) ?? renderPlainCode(code);
}

class VM {
  stepIndex = 0;
  fileIndex = 0;

  get selectedTabHtml() {
    const step = this.currentStep;

    const content = step[activeOutputMode.value];

    if (!content) return '';

    return renderCode(content);
  }

  get selectedFileContent() {
    return this.currentStep.files[this.fileIndex]?.code;
  }

  get currentStep() {
    return steps[this.stepIndex];
  }

  get selectedLanguage() {
    return pageLang.value === 'ru' ? 'ru' : 'en';
  }

  get text() {
    return translations[this.selectedLanguage];
  }

  get title() {
    return title[this.selectedLanguage];
  }

  get description() {
    return description[this.selectedLanguage];
  }

  selectStep(index: number) {
    this.stepIndex = index;
    this.fileIndex = 0;
  }
}

const state = reactive(new VM());
</script>

<template>
  <div class="wrapper">
    <h2 :id="id">{{ state.text.example }}: {{ state.title }}</h2>
    <p class="description" v-html="state.description" />
    <div class="plugin-code" v-html="renderCode(recipe.pluginCode)" />

    <Accordion :title="state.text.runSandbox">
      <div class="vp-code-group">
        <div class="tabs">
          <template v-for="(step, stepIndex) in recipe.steps" :key="step.title">
            <input
              type="radio"
              :name="`group-${id}-${stepIndex}`"
              :id="`tab-${id}-${stepIndex}`"
              :checked="state.stepIndex === stepIndex"
              @change="state.selectStep(stepIndex)"
            />
            <label :for="`tab-${id}-${stepIndex}`" :data-title="stepIndex">
              {{ step.title }}
            </label>
          </template>
        </div>
      </div>

      <div class="vp-code-group">
        <div
          v-for="inputFile in state.currentStep.inputFiles"
          :key="inputFile.path"
          class="inputFiles"
        >
          <div class="inputFilesDescription" v-if="inputFile.operation === 'add'">{{ state.text.user }}: {{ inputFile.path }} {{ state.text.fileCreated }}</div>
          <div class="inputFilesDescription" v-else-if="inputFile.operation === 'change'">{{ state.text.user }}: {{ inputFile.path }} {{ state.text.fileChanged }}</div>
          <div class="inputFilesDescription" v-else>{{ state.text.user }}: {{ inputFile.path }} {{ state.text.fileRemoved }}</div>
          <div
            v-if="inputFile.operation !== 'remove'"
            class="block active"
            v-html="renderCode(inputFile.code)"
          />
        </div>
      </div>

      <div class="systemText"><b>ARFA Generator</b> {{ state.text.showsLogs }}</div>

      <div class="vp-code-group">
        <div class="tabs">
          <template v-for="outputTab in outputTabs" :key="outputTab.mode">
            <input
              type="radio"
              :name="`group-${id}-output`"
              :id="`tab-${id}-${outputTab.mode}`"
              :checked="activeOutputMode === outputTab.mode"
              @change="selectOutputMode(outputTab.mode)"
            />
            <label :for="`tab-${id}-${outputTab.mode}`" :data-title="outputTab.mode">
              {{ outputTab.title }}
            </label>
          </template>
        </div>
        <div class="block active" v-html="state.selectedTabHtml" />
      </div>

      <div v-if="recipe.kind === 'afterFinish'" class="systemText"><b>afterFinish</b> {{ state.text.updatedFiles }}</div>
      <div v-else-if="recipe.kind !== 'checker'" class="systemText"><b>ARFA Generator</b> {{ state.text.generatedFiles }}</div>

      <div v-if="recipe.kind !== 'checker'" class="vp-code-group">
        <div class="tabs">
          <template v-for="(outputFile, fileIndex) in state.currentStep.files" :key="outputFile.path">
            <input
              type="radio"
              :name="`group-${id}-${outputFile.path}`"
              :id="`tab-${id}-${outputFile.path}`"
              :checked="state.fileIndex === fileIndex"
              @change="state.fileIndex = fileIndex"
            />
            <label :for="`tab-${id}-${outputFile.path}`" :data-title="outputFile.path">
              {{ outputFile.path }}
            </label>
          </template>
        </div>
        <div class="block active" v-html="state.selectedFileContent ? renderCode(state.selectedFileContent) : ''" />
      </div>
    </Accordion>
  </div>
</template>

<style scoped>

.wrapper {
  margin: 24px 0;

  & :deep(pre) {
    white-space: break-spaces;
    font-size: 14px;
  }

  & .description {
    margin: -8px 0 16px;
    color: var(--vp-c-text-2);
  }

  & .plugin-code {
    margin-bottom: 16px;

    & :deep(> div[class*="language-"]) {
      margin: 0;
    }
  }

  & .vp-code-group {
    margin: 0;

    & .block {
      display: none;
      overflow: auto;

      &.active {
        display: block;

        & > :deep(div) {
          display: block;
          margin: 0;
        }
      }
    }
  }

  & .inputFiles {
    background-color: var(--vp-code-block-bg);
    padding: 20px 0 10px 0;

    & .inputFilesDescription {
      padding: 0 24px;
      font-size: 14px;
    }
  }
}

.systemText {
  padding: 20px 0;
  font-size: 14px;
}
</style>
