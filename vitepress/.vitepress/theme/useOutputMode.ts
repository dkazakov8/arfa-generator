import { ref, watch } from 'vue';

const STORAGE_KEY = 'vitepress-output-mode-preference';
export type TypeOutputMode = 'consoleNormal' | 'consoleMinimal' | 'markdownFeedback' | 'rawLogs';

export const outputTabs: Array<{ mode: TypeOutputMode; title: string }> = [
  { title: "Console 'normal'", mode: 'consoleNormal' },
  { title: "Console 'minimal'", mode: 'consoleMinimal' },
  { title: 'Markdown feedback', mode: 'markdownFeedback' },
  { title: 'Raw logs', mode: 'rawLogs' },
];

export const activeOutputMode = ref<TypeOutputMode>('consoleMinimal');

let isInitialized = false;

export function isOutputMode(mode: unknown): mode is TypeOutputMode {
  return outputTabs.some((tab) => tab.mode === mode);
}

export function initOutputModePreference() {
  if (isInitialized || typeof window === 'undefined') return;

  isInitialized = true;

  const storedOutputMode = localStorage.getItem(STORAGE_KEY);

  if (isOutputMode(storedOutputMode)) {
    activeOutputMode.value = storedOutputMode;
  }

  window.addEventListener('storage', ({ key, newValue }) => {
    if (key !== STORAGE_KEY || !isOutputMode(newValue)) return;

    if (activeOutputMode.value !== newValue) activeOutputMode.value = newValue;
  });

  watch(activeOutputMode, (newValue) => {
    const storedValue = localStorage.getItem(STORAGE_KEY);

    if (storedValue !== newValue) localStorage.setItem(STORAGE_KEY, newValue);
  });
}

export function selectOutputMode(mode: TypeOutputMode) {
  if (typeof window === 'undefined' || activeOutputMode.value === mode) return;

  activeOutputMode.value = mode;
}
