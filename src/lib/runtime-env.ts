/**
 * Environment accessors shared by browser (Vite) and Node server code.
 * Prefer explicit env vars over hardcoded localhost / secrets.
 */

function readEnv(name: string): string {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.[name] != null) {
      return String((import.meta as any).env[name] || '').trim();
    }
  } catch {
    /* ignore — not in Vite context */
  }
  if (typeof process !== 'undefined' && process.env?.[name] != null) {
    return String(process.env[name] || '').trim();
  }
  return '';
}

/** OpenAI-compatible local LLM base URL (includes `/v1` when set). */
export function getOllamaEndpoint(): string {
  const raw =
    readEnv('VITE_OLLAMA_ENDPOINT') ||
    readEnv('OLLAMA_ENDPOINT') ||
    '';
  if (!raw) return '';
  const trimmed = raw.replace(/\/$/, '');
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

/**
 * Optional global pepper for vault master-key salt derivation.
 * Leave unset to preserve legacy `user-salt-{userId}` salts.
 * Set only on fresh pilots before any vault unlock.
 */
export function getMasterKeySaltPepper(): string {
  return (
    readEnv('VITE_MASTER_KEY_SALT') ||
    readEnv('MASTER_KEY_SALT') ||
    ''
  );
}

/** True for production Node runtimes and production Vite client bundles. */
export function isProductionRuntime(): boolean {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.PROD === true) {
      return true;
    }
  } catch {
    /* ignore — not in Vite context */
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV === 'production' || process.env.IS_PROD === 'true';
  }
  return false;
}

/**
 * Showcase / demo login is an explicit non-production opt-in.
 * Honored only when ENABLE_DEMO_LOGIN or VITE_ENABLE_DEMO_LOGIN is "true"
 * AND the runtime is not production. Production instances never enable it.
 */
export function isDemoLoginEnabled(): boolean {
  if (isProductionRuntime()) return false;
  return readEnv('ENABLE_DEMO_LOGIN') === 'true' || readEnv('VITE_ENABLE_DEMO_LOGIN') === 'true';
}

/** @deprecated Use isDemoLoginEnabled — demo mode is never implicit from Vite DEV. */
export function isDemoModeClient(): boolean {
  return isDemoLoginEnabled();
}

export const DEMO_LOGIN_EMAIL = 'demo@geistdesk.com';
