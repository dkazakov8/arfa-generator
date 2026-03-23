import Theme from 'vitepress/theme';
// @ts-ignore
import './custom.css';

import { h } from 'vue';

import Accordion from './components/Accordion.vue';
import CodeView from './components/CodeView.vue';
import CustomNotFound from './components/CustomNotFound.vue';
import GeneratorSandbox from './components/GeneratorSandbox.vue';
import Link from './components/Link.vue';
import MainPagePatch from './components/MainPagePatch.vue';
import OutputModeSelect from './components/OutputModeSelect.vue';

export default {
  ...Theme,
  Layout() {
    return h(Theme.Layout, null, {
      'layout-top': () => h(MainPagePatch),
      'not-found': () => h(CustomNotFound),
    });
  },
  enhanceApp(params: any) {
    Theme.enhanceApp(params);

    params.app.component('Link', Link);
    params.app.component('CodeView', CodeView);
    params.app.component('Accordion', Accordion);
    params.app.component('OutputModeSelect', OutputModeSelect);
    params.app.component('GeneratorSandbox', GeneratorSandbox);
  },
};
