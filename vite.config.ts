import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const buildStamp = process.env.BUILD_ID || Date.now().toString(36);
  return {
    base: '/',
    plugins: [
      react({ jsxRuntime: 'automatic' }),
      tailwindcss(),
      wasm(),
      topLevelAwait()
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      __BUILD_ID__: JSON.stringify(buildStamp),
      global: 'globalThis',
      'localStorage': 'window.safeLocalStorage',
    },
    build: {
      emptyOutDir: true,
      rollupOptions: {
        output: {
          entryFileNames: `assets/[name]-[hash]-${buildStamp.slice(0, 12)}.js`,
          chunkFileNames: `assets/[name]-[hash]-${buildStamp.slice(0, 12)}.js`,
          assetFileNames: `assets/[name]-[hash]-${buildStamp.slice(0, 12)}[extname]`,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'firebase/app': path.resolve(__dirname, './src/lib/firebase-custom-client.ts'),
        'firebase/firestore': path.resolve(__dirname, './src/lib/firebase-custom-client.ts'),
        'firebase/auth': path.resolve(__dirname, './src/lib/firebase-custom-client.ts'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
