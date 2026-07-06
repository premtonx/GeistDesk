/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BETA_AUTO_ADMIN?: string;
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace NodeJS {
  interface ProcessEnv {
    readonly NODE_ENV: 'development' | 'production' | 'test';
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};
