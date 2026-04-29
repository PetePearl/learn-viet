import { defineConfig } from 'astro/config';
import solidJs from '@astrojs/solid-js';

export default defineConfig({
  integrations: [solidJs()],
  output: 'static',
  // base: '/repo-name/', // раскомментировать для project pages на GitHub
});
