export type {
  EmailChannelConfig,
  EmailConnectionType,
  EmailIngestionDriver,
  InboundAttachment,
  NormalizedInboundEmail,
} from './types.js';
export { createEmailIngestionDriver, isActivePullDriver } from './factory.js';
export { ingestNormalizedEmail, registerAiTriageHook } from './ingest-pipeline.js';
export { startEmailIngestionScheduler, pollEmailIngestionDriversOnce } from './scheduler.js';
export { parseInboundWebhookPayload, extractRouterAlias } from './drivers/webhook-adapter.js';
export { startInboundSmtpReceiver, stopInboundSmtpReceiver } from './inbound-smtp-receiver.js';
export {
  isAllowedInboundSmtpRecipient,
  listInboundSmtpAcceptDomains,
} from './inbound-smtp-domains.js';
export { parseRfc822ToNormalizedEmail } from './smtp-mime-parser.js';
