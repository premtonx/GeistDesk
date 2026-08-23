/**
 * Microsoft OAuth2 device-code flow (frontend-only).
 *
 * Lets an admin complete an interactive Microsoft login ("Mit Microsoft
 * verbinden") without a server-side callback route:
 *   1. Request a device code from the /devicecode endpoint.
 *   2. Show the user_code + verification_uri to the operator.
 *   3. Poll /token until the user authorizes (or the flow expires).
 *   4. Return the refresh token for storage on the channel (IMAP OAuth2).
 */

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
  message?: string;
}

interface TokenPollResponse {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

const MICROSOFT_LOGIN_BASE = 'https://login.microsoftonline.com';

/**
 * Start a Microsoft device-code login for the given tenant + client.
 * `scopes` defaults to IMAP delegated access (used by the IMAP OAuth2 driver).
 */
export async function startMicrosoftDeviceFlow(params: {
  tenantId: string;
  clientId: string;
  scopes?: string;
}): Promise<{
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  message: string;
  expiresIn: number;
  interval: number;
}> {
  const { tenantId, clientId } = params;
  if (!tenantId.trim() || !clientId.trim()) {
    throw new Error('Tenant ID und Client ID sind für den OAuth-Verbindungsaufbau erforderlich.');
  }

  const scope =
    params.scopes || 'offline_access https://outlook.office.com/IMAP.AccessAsUser.All';

  const res = await fetch(
    `${MICROSOFT_LOGIN_BASE}/${encodeURIComponent(tenantId.trim())}/oauth2/v2.0/devicecode`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId.trim(),
        scope,
      }).toString(),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Device-Code-Anfrage fehlgeschlagen (${res.status}): ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as DeviceCodeResponse;
  if (!data.device_code || !data.user_code) {
    throw new Error('Ungültige Device-Code-Antwort des OAuth-Anbieters.');
  }

  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    message: data.message || '',
    expiresIn: data.expires_in || 900,
    interval: Math.max(data.interval || 5, 5),
  };
}

/**
 * Poll the token endpoint until the operator completes the device login.
 * Returns the refresh token on success; throws a human-readable error otherwise.
 */
export async function pollMicrosoftDeviceFlow(params: {
  tenantId: string;
  clientId: string;
  deviceCode: string;
  intervalMs: number;
  expiresInSec: number;
  onWaiting?: () => void;
}): Promise<{ accessToken: string; refreshToken: string }> {
  const { tenantId, clientId, deviceCode, intervalMs, expiresInSec } = params;
  const deadline = Date.now() + expiresInSec * 1000;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    params.onWaiting?.();

    const res = await fetch(
      `${MICROSOFT_LOGIN_BASE}/${encodeURIComponent(tenantId.trim())}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId.trim(),
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: deviceCode,
        }).toString(),
      },
    );

    const data = (await res.json().catch(() => ({}))) as TokenPollResponse;

    if (data.refresh_token && data.access_token) {
      return { accessToken: data.access_token, refreshToken: data.refresh_token };
    }

    if (data.error === 'authorization_pending') {
      continue; // Operator has not completed the prompt yet.
    }

    if (data.error === 'authorization_declined') {
      throw new Error('OAuth-Anmeldung wurde im Browser abgelehnt.');
    }

    if (data.error === 'expired_token') {
      throw new Error('OAuth-Code ist abgelaufen — bitte erneut versuchen.');
    }

    if (data.error) {
      throw new Error(data.error_description || data.error);
    }
  }

  throw new Error('OAuth-Anmeldung ist abgelaufen — bitte erneut versuchen.');
}

/** Convenience: full device-flow run → refresh token. */
export async function runMicrosoftDeviceFlow(params: {
  tenantId: string;
  clientId: string;
  onUserCode: (userCode: string, verificationUri: string, message: string) => void;
}): Promise<string> {
  const started = await startMicrosoftDeviceFlow({
    tenantId: params.tenantId,
    clientId: params.clientId,
  });
  params.onUserCode(
    started.userCode,
    started.verificationUri,
    started.message,
  );

  const result = await pollMicrosoftDeviceFlow({
    tenantId: params.tenantId,
    clientId: params.clientId,
    deviceCode: started.deviceCode,
    intervalMs: started.interval * 1000,
    expiresInSec: started.expiresIn,
  });

  return result.refreshToken;
}

/** Azure portal shortcut for managing the app registration of a tenant. */
export function azureAppRegistrationUrl(tenantId?: string | null): string {
  if (tenantId && tenantId.trim()) {
    return `https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade/tenantId/${encodeURIComponent(tenantId.trim())}`;
  }
  return 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade';
}
