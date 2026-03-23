<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

import {
  activeOutputMode,
  initOutputModePreference,
  outputTabs,
  selectOutputMode,
  type TypeOutputMode,
} from '../useOutputMode';

const isOpen = ref(false);
const container = ref<HTMLElement | null>(null);
const selectedTitle = computed(() => outputTabs.find((tab) => tab.mode === activeOutputMode.value)!.title);

function select(mode: TypeOutputMode) {
  selectOutputMode(mode);
  isOpen.value = false;
}

function onClick(event: MouseEvent): void {
  if (event.target instanceof Node && container.value && !container.value.contains(event.target)) {
    isOpen.value = false;
  }
}

onMounted(() => {
  initOutputModePreference();

  window.addEventListener('click', onClick, { capture: true });
});

onUnmounted(() => {
  window.removeEventListener('click', onClick, { capture: true });
});
</script>

<template>
  <div class="wrapper vp-code-group" ref="container">
    <button class="value" @click="isOpen = !isOpen" :class="{ open: isOpen }">
      <label :data-title="activeOutputMode">{{ selectedTitle }}</label>
      <span class="arrow"></span>
    </button>
    <div v-if="isOpen" class="dropdown">
      <div
        v-for="outputTab in outputTabs"
        :key="outputTab.mode"
        class="option"
        :class="{ active: outputTab.mode === activeOutputMode }"
        @click="select(outputTab.mode)"
      >
        <label :data-title="outputTab.mode">{{ outputTab.title }}</label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrapper {
  position: relative;
  margin-top: 0 !important;
  display: flex;
  align-items: center;
  margin-right: 12px;

  & .value {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: var(--vp-c-bg-alt);
    border-radius: 6px;
    padding: 0 10px;
    color: var(--vp-c-text-1);
    cursor: pointer;
    width: 180px;
    height: 40px;

    & label {
      cursor: pointer;
      margin: 0;
      font-size: 13px;
      font-weight: 500;
    }

    &:hover,
    &.open {
      background-color: var(--vp-c-bg-soft);

      & .arrow {
        transform: rotate(180deg);
      }
    }

    & .arrow {
      width: 0;
      height: 0;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-top: 4px solid var(--vp-c-text-2);
      transition: transform 0.2s;
    }
  }

  & .dropdown {
    position: absolute;
    top: 50px;
    left: 0;
    right: 0;
    margin-top: 4px;
    border-radius: 6px;
    box-shadow: var(--vp-shadow-3);
    z-index: 100;
    overflow: hidden;

    & .option {
      padding: 5px 10px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      background-color: var(--vp-c-bg-alt);

      &:hover {
        background-color: var(--vp-c-bg);
      }

      &.active {
        background-color: var(--vp-c-bg) !important;
      }

      & label {
        cursor: pointer;
        display: block;
        width: 100%;
      }
    }
  }
}
</style>
