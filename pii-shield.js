/**
 * ==============================================================================
 * NEXUS SOVEREIGN PLATFORM - PII SHIELD SECURITY ENGINE
 * ==============================================================================
 * 
 * Local-first asynchronous parsing engine designed to strip out sensitive data
 * patterns (credentials, passcodes, emails, server tokens, or private keys)
 * before any user inputs are stored or forwarded to Cloud Model endpoints.
 */

export const PIIShield = {
  /**
   * Evaluates raw input text and scrubs out confidential patterns locally.
   * 
   * @param {string} text - Raw content derived from the incoming user stream or audio transcript
   * @returns {Promise<{ cleanText: string, wasScrubbed: boolean }>} Checked output string and scrubbed flag
   */
  async redact(text) {
    if (!text || typeof text !== "string") {
      return { cleanText: "", wasScrubbed: false };
    }

    // RegEx pattern to look for typical email templates
    const emailRegex = /[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/g;

    // RegEx to trap Key-Value structures commonly storing critical credentials
    const credentialRegex = /(password|secret|token|passwd|private_key|api_key|apikey)\s*[:=]\s*["']?([a-zA-Z0-9_\-+=/]{12,})["']?/gi;

    // RegEx patterns for HTTP Authorization bearers
    const authHeaderRegex = /bearer\s+([a-zA-Z0-9_\-+=/.]+)/gi;

    // RegEx signatures of common SaaS tokens (GitHub personal access, Slack Bot, AWS Key, etc.)
    const cloudTokenRegex = /\b(xoxb-[0-9]{11,13}-[0-9]{11,13}-[a-zA-Z0-9]{24}|ghp_[a-zA-Z0-9]{36}|AIzaSy[a-zA-Z0-9_\-]{33})\b/gi;

    let cleanText = text;
    let wasScrubbed = false;

    // 1. Scrub emails
    if (emailRegex.test(cleanText)) {
      cleanText = cleanText.replace(emailRegex, "[REDACTED_EMAIL]");
      wasScrubbed = true;
    }

    // 2. Scrub explicit key-value passwords/API keys
    if (cleanText.match(credentialRegex)) {
      cleanText = cleanText.replace(credentialRegex, (match, prefix) => {
        return `${prefix}: [REDACTED_CREDENTIAL]`;
      });
      wasScrubbed = true;
    }

    // 3. Scrub HTTP Authorization signatures
    if (authHeaderRegex.test(cleanText)) {
      cleanText = cleanText.replace(authHeaderRegex, "Bearer [REDACTED_TOKEN]");
      wasScrubbed = true;
    }

    // 4. Scrub static cloud platform API identifiers
    if (cloudTokenRegex.test(cleanText)) {
      cleanText = cleanText.replace(cloudTokenRegex, "[REDACTED_SERVER_TOKEN]");
      wasScrubbed = true;
    }

    if (wasScrubbed) {
      console.warn("[PIIShield Compliance Alert] Raw context scrubbed and security mask applied successfully.");
    }

    return { cleanText, wasScrubbed };
  }
};
