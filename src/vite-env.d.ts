/// <reference types="vite/client" />

declare namespace NodeJS {
  interface ProcessEnv {
    readonly NODE_ENV: 'development' | 'production' | 'test';
    readonly GEMINI_API_KEY?: string;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};
