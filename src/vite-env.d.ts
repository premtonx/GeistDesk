/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BETA_AUTO_ADMIN?: string;
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_ENABLE_DEMO_LOGIN?: string;
  readonly VITE_OLLAMA_ENDPOINT?: string;
  readonly VITE_MASTER_KEY_SALT?: string;
  readonly VITE_PUBLIC_APP_URL?: string;
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
