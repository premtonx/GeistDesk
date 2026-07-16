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

export function isDemoModeClient(): boolean {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      const env = (import.meta as any).env;
      return Boolean(env.DEV) || env.VITE_DEMO_MODE === 'true';
    }
  } catch {
    /* ignore */
  }
  return readEnv('VITE_DEMO_MODE') === 'true';
}
