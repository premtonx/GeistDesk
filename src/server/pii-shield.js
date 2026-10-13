/**
 * ==============================================================================
 * NEXUS SOVEREIGN PLATFORM - PII SHIELD SECURITY ENGINE
 * ==============================================================================
 *
 * Local-first asynchronous parsing engine designed to strip out sensitive data
 * patterns (credentials, passcodes, emails, server tokens, or private keys)
 * before any user inputs are stored or forwarded to Cloud Model endpoints.
 */

function countMatches(text, regex) {
  if (!text) return 0;
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
  const re = new RegExp(regex.source, flags);
  return (text.match(re) || []).length;
}

export const PIIShield = {
  /**
   * Evaluates raw input text and scrubs out confidential patterns locally.
   *
   * @param {string} text - Raw content derived from the incoming user stream or audio transcript
   * @returns {Promise<{ cleanText: string, wasScrubbed: boolean, counts: { emails: number, passwords: number, apiKeys: number, ipAddresses: number } }>}
   */
  async redact(text) {
    const emptyCounts = { emails: 0, passwords: 0, apiKeys: 0, ipAddresses: 0 };
    if (!text || typeof text !== 'string') {
      return { cleanText: '', wasScrubbed: false, counts: emptyCounts };
    }

    const emailRegex = /[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/g;
    const credentialRegex =
      /(password|secret|token|passwd|private_key|api_key|apikey)\s*[:=]\s*["']?([a-zA-Z0-9_\-+=/]{12,})["']?/gi;
    const authHeaderRegex = /bearer\s+([a-zA-Z0-9_\-+=/.]+)/gi;
    const cloudTokenRegex =
      /\b(xoxb-[0-9]{11,13}-[0-9]{11,13}-[a-zA-Z0-9]{24}|ghp_[a-zA-Z0-9]{36}|AIzaSy[a-zA-Z0-9_\-]{33}|sk-[a-zA-Z0-9]{20,})\b/gi;
    const ipv4Regex =
      /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;

    const emails = countMatches(text, emailRegex);
    const ipAddresses = countMatches(text, ipv4Regex);
    const bearer = countMatches(text, authHeaderRegex);
    const cloudTokens = countMatches(text, cloudTokenRegex);

    let passwords = 0;
    let apiKeysFromKv = 0;
    const kvRe = new RegExp(credentialRegex.source, 'gi');
    let kvMatch;
    while ((kvMatch = kvRe.exec(text)) !== null) {
      const prefix = String(kvMatch[1] || '').toLowerCase();
      if (prefix === 'password' || prefix === 'passwd' || prefix === 'secret') passwords += 1;
      else apiKeysFromKv += 1;
    }

    const counts = {
      emails,
      passwords,
      apiKeys: apiKeysFromKv + bearer + cloudTokens,
      ipAddresses,
    };

    let cleanText = text;
    cleanText = cleanText.replace(emailRegex, '[REDACTED_EMAIL]');
    cleanText = cleanText.replace(credentialRegex, (match, prefix) => `${prefix}: [REDACTED_CREDENTIAL]`);
    cleanText = cleanText.replace(authHeaderRegex, 'Bearer [REDACTED_TOKEN]');
    cleanText = cleanText.replace(cloudTokenRegex, '[REDACTED_SERVER_TOKEN]');
    cleanText = cleanText.replace(ipv4Regex, '[REDACTED_IP]');

    const wasScrubbed = counts.emails + counts.passwords + counts.apiKeys + counts.ipAddresses > 0;
    if (wasScrubbed) {
      console.warn('[PIIShield Compliance Alert] Raw context scrubbed and security mask applied successfully.');
    }

    return { cleanText, wasScrubbed, counts };
  },
};
