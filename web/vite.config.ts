import { defineConfig } from 'vite';

function localPath(relative: string): string {
  return decodeURIComponent(new URL(relative, import.meta.url).pathname);
}

export default defineConfig({
  resolve: {
    alias: {
      '@setuplab/data': localPath('../packages/data/src/index.ts'),
      '@setuplab/physics': localPath('../packages/physics/src/index.ts'),
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
