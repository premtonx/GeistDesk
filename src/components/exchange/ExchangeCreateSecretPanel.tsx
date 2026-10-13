import { useEffect, useState } from 'react';
import { Zap, Clock, ChevronDown, ChevronUp, Mail, Shield, Lock, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import type { Company, Ticket } from '../../types';
import {
  EXCHANGE_EXPIRATION_PRESETS,
  EXCHANGE_VIEW_QUOTA_PRESETS,
  type ExchangeCreateSecretFormState,
} from './exchange-create-secret-utils';

const FIELD_LABEL =
  'text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans';
const FIELD_INPUT =
  'w-full h-11 px-4 mt-1.5 bg-[#F8F9FA] border border-slate-200 rounded-2xl text-xs font-bold';
const TOGGLE_ROW =
  'flex items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200';

interface ExchangeCreateSecretPanelProps {
  tickets: Ticket[];
  companies: Company[];
  isGenerating: boolean;
  generatedLink: string;
  shares: string[];
  formResetKey?: number;
  onGenerate: (state: ExchangeCreateSecretFormState) => void;
  onCopyLink: (link: string) => void;
}

function createDefaultFormState() {
  return {
    secretContent: '',
    secretType: 'password',
    maxViews: 1,
    customMaxViews: '',
    expirationPreset: '24h' as ExchangeCreateSecretFormState['expirationPreset'],
    customExpiresAt: '',
    shareViaEmailOpen: false,
    recipientEmails: '',
    notifyOnView: false,
    ipRestrictionEnabled: false,
    ipAllowlist: '',
    passphraseEnabled: false,
    passphrase: '',
    domainWhitelistEnabled: false,
    allowedEmailDomains: '',
    deliveryOption: 'copy_link',
    targetRecipient: '',
    targetTicketId: '',
    targetCompanyId: '',
    targetAssetId: '',
    mfaRequired: false,
    securityOpen: true,
  };
}

export function ExchangeCreateSecretPanel({
  tickets,
  companies,
  isGenerating,
  generatedLink,
  shares,
  formResetKey = 0,
  onGenerate,
  onCopyLink,
}: ExchangeCreateSecretPanelProps) {
  const { t } = useTranslation();
  const defaults = createDefaultFormState();

  const [secretContent, setSecretContent] = useState(defaults.secretContent);
  const [secretType, setSecretType] = useState(defaults.secretType);
  const [maxViews, setMaxViews] = useState<number>(defaults.maxViews);
  const [customMaxViews, setCustomMaxViews] = useState(defaults.customMaxViews);
  const [expirationPreset, setExpirationPreset] = useState<ExchangeCreateSecretFormState['expirationPreset']>(defaults.expirationPreset);
  const [customExpiresAt, setCustomExpiresAt] = useState(defaults.customExpiresAt);
  const [shareViaEmailOpen, setShareViaEmailOpen] = useState(defaults.shareViaEmailOpen);
  const [recipientEmails, setRecipientEmails] = useState(defaults.recipientEmails);
  const [notifyOnView, setNotifyOnView] = useState(defaults.notifyOnView);
  const [ipRestrictionEnabled, setIpRestrictionEnabled] = useState(defaults.ipRestrictionEnabled);
  const [ipAllowlist, setIpAllowlist] = useState(defaults.ipAllowlist);
  const [passphraseEnabled, setPassphraseEnabled] = useState(defaults.passphraseEnabled);
  const [passphrase, setPassphrase] = useState(defaults.passphrase);
  const [domainWhitelistEnabled, setDomainWhitelistEnabled] = useState(defaults.domainWhitelistEnabled);
  const [allowedEmailDomains, setAllowedEmailDomains] = useState(defaults.allowedEmailDomains);
  const [deliveryOption, setDeliveryOption] = useState(defaults.deliveryOption);
  const [targetRecipient, setTargetRecipient] = useState(defaults.targetRecipient);
  const [targetTicketId, setTargetTicketId] = useState(defaults.targetTicketId);
  const [targetCompanyId, setTargetCompanyId] = useState(defaults.targetCompanyId);
  const [targetAssetId, setTargetAssetId] = useState(defaults.targetAssetId);
  const [mfaRequired, setMfaRequired] = useState(defaults.mfaRequired);
  const [securityOpen, setSecurityOpen] = useState(defaults.securityOpen);

  useEffect(() => {
    if (formResetKey === 0) return;
    const next = createDefaultFormState();
    setSecretContent(next.secretContent);
    setSecretType(next.secretType);
    setMaxViews(next.maxViews);
    setCustomMaxViews(next.customMaxViews);
    setExpirationPreset(next.expirationPreset);
    setCustomExpiresAt(next.customExpiresAt);
    setShareViaEmailOpen(next.shareViaEmailOpen);
    setRecipientEmails(next.recipientEmails);
    setNotifyOnView(next.notifyOnView);
    setIpRestrictionEnabled(next.ipRestrictionEnabled);
    setIpAllowlist(next.ipAllowlist);
    setPassphraseEnabled(next.passphraseEnabled);
    setPassphrase(next.passphrase);
    setDomainWhitelistEnabled(next.domainWhitelistEnabled);
    setAllowedEmailDomains(next.allowedEmailDomains);
    setDeliveryOption(next.deliveryOption);
    setTargetRecipient(next.targetRecipient);
    setTargetTicketId(next.targetTicketId);
    setTargetCompanyId(next.targetCompanyId);
    setTargetAssetId(next.targetAssetId);
    setMfaRequired(next.mfaRequired);
    setSecurityOpen(next.securityOpen);
  }, [formResetKey]);

  const buildState = (): ExchangeCreateSecretFormState => ({
    secretContent,
    secretType,
    maxViews: customMaxViews ? Math.max(1, parseInt(customMaxViews, 10) || 1) : maxViews,
    expirationPreset,
    customExpiresAt,
    shareViaEmailOpen,
    recipientEmails,
    notifyOnView,
    ipRestrictionEnabled,
    ipAllowlist,
    passphraseEnabled,
    passphrase,
    domainWhitelistEnabled,
    allowedEmailDomains,
    deliveryOption,
    targetRecipient,
    targetTicketId,
    targetCompanyId,
    targetAssetId,
    mfaRequired,
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={FIELD_LABEL}>{t('vault.secretValueType', 'Secret Value Type')}</label>
          <select
            value={secretType}
            onChange={(e) => setSecretType(e.target.value)}
            className={cn(FIELD_INPUT, 'cursor-pointer')}
          >
            <option value="password">{t('vault.passwordKeyphrase', 'Password Keyphrase')}</option>
            <option value="api_key">{t('vault.apiKeyToken', 'Third-Party API Access Token')}</option>
            <option value="ssh_key">{t('vault.sshPrivateKey', 'SSH Private Credentials Pair')}</option>
            <option value="vpn_credentials">{t('vault.vpnSecureProfile', 'Corporate VPN Secure Profile')}</option>
            <option value="certificate">{t('vault.sslCertificate', 'SSL/TLS CA Certificate File')}</option>
            <option value="secure_note">{t('vault.generalSecureNote', 'General Confessional Secure Note')}</option>
          </select>
        </div>

        <div>
          <label className={FIELD_LABEL}>
            {t('exchange.createSecret.maxViews', 'Max Views / View Quota')}
          </label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {EXCHANGE_VIEW_QUOTA_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setMaxViews(preset);
                  setCustomMaxViews('');
                }}
                className={cn(
                  'h-9 min-w-[2.5rem] px-3 rounded-xl border text-xs font-bold transition-all',
                  maxViews === preset && !customMaxViews
                    ? 'bg-blue-50 border-[#1A73E8] text-[#1A73E8]'
                    : 'bg-white border-slate-200 hover:border-slate-400',
                )}
              >
                {preset}
              </button>
            ))}
            <Input
              type="number"
              min={1}
              placeholder={t('exchange.createSecret.customQuota', 'Custom')}
              value={customMaxViews}
              onChange={(e) => setCustomMaxViews(e.target.value)}
              className="h-9 w-20 text-xs bg-white rounded-xl border-slate-200"
            />
          </div>
          <p className="text-[9.5px] text-slate-400 mt-1.5 font-medium">
            {t(
              'exchange.createSecret.maxViewsHint',
              'Link stays active until the view quota is consumed, then returns 410 Gone.',
            )}
          </p>
        </div>
      </div>

      <div>
        <label className={FIELD_LABEL}>
          {t('exchange.createSecret.validityDuration', 'Validity Duration')}
        </label>
        <div className="mt-1.5 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {EXCHANGE_EXPIRATION_PRESETS.filter((p) => p.group === 'short').map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setExpirationPreset(preset.id)}
                className={cn(
                  'h-10 rounded-2xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all',
                  expirationPreset === preset.id
                    ? 'bg-blue-50 border-[#1A73E8] text-[#1A73E8]'
                    : 'bg-white border-slate-200 hover:border-slate-400',
                )}
              >
                <Clock className="w-3 h-3 shrink-0" />
                {t(preset.labelKey, preset.defaultLabel)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {EXCHANGE_EXPIRATION_PRESETS.filter((p) => p.group === 'extended').map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setExpirationPreset(preset.id)}
                className={cn(
                  'h-10 rounded-2xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all',
                  expirationPreset === preset.id
                    ? 'bg-blue-50 border-[#1A73E8] text-[#1A73E8]'
                    : 'bg-white border-slate-200 hover:border-slate-400',
                )}
              >
                {t(preset.labelKey, preset.defaultLabel)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setExpirationPreset('custom')}
              className={cn(
                'h-10 rounded-2xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all sm:col-span-2',
                expirationPreset === 'custom'
                  ? 'bg-blue-50 border-[#1A73E8] text-[#1A73E8]'
                  : 'bg-white border-slate-200 hover:border-slate-400',
              )}
            >
              {t('exchange.createSecret.expiration.custom', 'Custom date & time')}
            </button>
          </div>
          {expirationPreset === 'custom' ? (
            <Input
              type="datetime-local"
              value={customExpiresAt}
              onChange={(e) => setCustomExpiresAt(e.target.value)}
              className="h-11 text-xs bg-[#F8F9FA] rounded-2xl border-slate-200 max-w-md"
            />
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={FIELD_LABEL}>{t('vault.plainSecretLabel', 'Plain Secret Content to Shield')}</label>
        <Textarea
          placeholder={t('vault.plainSecretPlaceholder', 'Type or paste the credential logs, private tokens, or configs here...')}
          className="h-32 bg-[#F8F9FA] border-slate-200 rounded-2xl resize-none p-4 text-sm font-semibold"
          value={secretContent}
          onChange={(e) => setSecretContent(e.target.value)}
        />
        <span className="text-[9.5px] text-slate-400 block py-0.5 font-semibold">
          {t('vault.clientSideEncNote', 'Note: GeistDesk encrypts this client-side using ML-KEM post-quantum cryptographic parameters.')}
        </span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
        <button
          type="button"
          onClick={() => setSecurityOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
            {t('exchange.createSecret.advancedSecurity', 'Advanced Security Options')}
          </span>
          {securityOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        <AnimatePresence initial={false}>
          {securityOpen ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-3">
                <div className={TOGGLE_ROW}>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-slate-400" />
                      {t('exchange.createSecret.ipRestriction', 'IP Restriction')}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {t('exchange.createSecret.ipRestrictionHint', 'Restrict access to specific CIDR blocks or corporate IPs.')}
                    </p>
                  </div>
                  <Switch checked={ipRestrictionEnabled} onCheckedChange={setIpRestrictionEnabled} />
                </div>
                {ipRestrictionEnabled ? (
                  <Input
                    placeholder={t('exchange.createSecret.ipAllowlistPlaceholder', '203.0.113.0/24, 198.51.100.42')}
                    value={ipAllowlist}
                    onChange={(e) => setIpAllowlist(e.target.value)}
                    className="h-10 text-xs bg-white rounded-xl border-slate-200"
                  />
                ) : null}

                <div className={TOGGLE_ROW}>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      {t('exchange.createSecret.passphraseLayer', 'Additional Passphrase')}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {t('exchange.createSecret.passphraseHint', 'Recipients must enter this password on the /v/ viewer before decrypting.')}
                    </p>
                  </div>
                  <Switch checked={passphraseEnabled} onCheckedChange={setPassphraseEnabled} />
                </div>
                {passphraseEnabled ? (
                  <Input
                    type="password"
                    placeholder={t('exchange.createSecret.passphrasePlaceholder', 'Secondary access passphrase')}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    className="h-10 text-xs bg-white rounded-xl border-slate-200"
                  />
                ) : null}

                <div className={TOGGLE_ROW}>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-slate-400" />
                      {t('exchange.createSecret.domainWhitelist', 'Allowed Email Domains')}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {t('exchange.createSecret.domainWhitelistHint', 'Only authenticated viewers from listed domains may consume a view slot.')}
                    </p>
                  </div>
                  <Switch checked={domainWhitelistEnabled} onCheckedChange={setDomainWhitelistEnabled} />
                </div>
                {domainWhitelistEnabled ? (
                  <Input
                    placeholder={t('exchange.createSecret.domainWhitelistPlaceholder', 'intel.com, acme.corp')}
                    value={allowedEmailDomains}
                    onChange={(e) => setAllowedEmailDomains(e.target.value)}
                    className="h-10 text-xs bg-white rounded-xl border-slate-200"
                  />
                ) : null}

                <div className={TOGGLE_ROW}>
                  <span className="text-[10px] font-bold text-slate-500">{t('vault.mfaAuthReq', 'MFA AUTH REQ')}</span>
                  <Switch checked={mfaRequired} onCheckedChange={setMfaRequired} />
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
        <button
          type="button"
          onClick={() => setShareViaEmailOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Mail className="w-3.5 h-3.5" />
            {t('exchange.createSecret.shareViaEmail', 'Share via Email')}
          </span>
          {shareViaEmailOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        <AnimatePresence initial={false}>
          {shareViaEmailOpen ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-3">
                <Input
                  placeholder={t(
                    'exchange.createSecret.recipientEmailsPlaceholder',
                    'recipient@company.com, teammate@corp.io',
                  )}
                  value={recipientEmails}
                  onChange={(e) => setRecipientEmails(e.target.value)}
                  className="h-11 text-xs bg-white rounded-2xl border-slate-200"
                />
                <p className="text-[10px] text-slate-400">
                  {t('exchange.createSecret.recipientEmailsHint', 'Separate multiple addresses with commas or spaces.')}
                </p>
                <div className={TOGGLE_ROW}>
                  <span className="text-xs font-bold text-slate-700">
                    {t('exchange.createSecret.notifyOnView', 'Notify when read')}
                  </span>
                  <Switch checked={notifyOnView} onCheckedChange={setNotifyOnView} />
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-5">
        <div>
          <label className={FIELD_LABEL}>{t('vault.corpAssignment', 'Corporate Assignment (Linking)')}</label>
          <select
            value={deliveryOption}
            onChange={(e) => setDeliveryOption(e.target.value)}
            className={cn(FIELD_INPUT, 'cursor-pointer')}
          >
            <option value="copy_link">{t('vault.copyLinkOnly', 'Simultaneous Copy link only (Transient)')}</option>
            <option value="send_email">{t('vault.sendEmail', 'External Email delivery dispatch')}</option>
            <option value="attach_ticket">{t('vault.attachTicket', 'Attach Directly on Support Ticket')}</option>
            <option value="attach_company">{t('vault.syncCompany', 'Sync with Company Profile record')}</option>
            <option value="attach_asset">{t('vault.anchorHardware', 'Anchor onto Client Hardware Asset')}</option>
          </select>
        </div>
        <div className="flex flex-col justify-end">
          {deliveryOption === 'send_email' ? (
            <Input
              placeholder={t('vault.recipientEmailPlaceholder', 'Recipient email address (sarah@acme.com)')}
              value={targetRecipient}
              onChange={(e) => setTargetRecipient(e.target.value)}
              className="h-11 text-xs bg-[#F8F9FA] rounded-2xl border-slate-200"
            />
          ) : null}
          {deliveryOption === 'attach_ticket' ? (
            <select
              value={targetTicketId}
              onChange={(e) => setTargetTicketId(e.target.value)}
              className={cn(FIELD_INPUT, 'cursor-pointer')}
            >
              <option value="">{t('vault.selectTicketLink', 'Select ticket to link...')}</option>
              {tickets.map((ticket) => (
                <option key={ticket.id} value={ticket.id}>
                  {ticket.subject ? `[TKT] ${ticket.subject.substring(0, 30)}...` : ticket.id}
                </option>
              ))}
            </select>
          ) : null}
          {deliveryOption === 'attach_company' ? (
            <select
              value={targetCompanyId}
              onChange={(e) => setTargetCompanyId(e.target.value)}
              className={cn(FIELD_INPUT, 'cursor-pointer')}
            >
              <option value="">{t('vault.selectCompanyProfile', 'Select Company profile...')}</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          ) : null}
          {deliveryOption === 'attach_asset' ? (
            <select
              value={targetAssetId}
              onChange={(e) => setTargetAssetId(e.target.value)}
              className={cn(FIELD_INPUT, 'cursor-pointer')}
            >
              <option value="">{t('vault.selectCorpHardware', 'Select Corporate Hardware...')}</option>
              <option value="firewall-99">{t('vault.firewallGate', 'Firewall Core Gateway')}</option>
              <option value="server-core-2">{t('vault.secureServer', 'Sichere Server-core-02')}</option>
              <option value="db-node-primary">{t('vault.targetDbPostgres', 'Target Postgres Database Master')}</option>
              <option value="vpn-routing">{t('vault.vpnRoutingGateway', 'VPN Routing Gateway')}</option>
              <option value="ssl-cert">{t('vault.sslHostCert', 'Host Wildcard SSL certificate')}</option>
            </select>
          ) : null}
          {deliveryOption === 'copy_link' ? (
            <p className="text-[10px] italic text-slate-400 text-center pb-2">
              {t('vault.linkGeneratedClient', 'The link is generated inside the client workspace interface immediately.')}
            </p>
          ) : null}
        </div>
      </div>

      {generatedLink ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 bg-emerald-50 border border-emerald-300 rounded-2xl space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase text-[#137333] tracking-widest">
                {t('vault.encryptedPqcLink', 'Encrypted post-quantum link generated')}
              </p>
              <p className="text-xs font-mono font-bold text-emerald-800 truncate select-all">{generatedLink}</p>
            </div>
            <Button
              onClick={() => onCopyLink(generatedLink)}
              className="bg-[#34A853] hover:bg-[#2e9449] text-white shrink-0 font-bold text-xs rounded-full h-9"
            >
              {t('vault.copySecureUrl', 'Copy Secure URL')}
            </Button>
          </div>
          {shares.length > 0 ? (
            <div className="pt-2 border-t border-emerald-200 text-[10px] text-[#137333] flex flex-wrap gap-2 items-center">
              <Badge className="bg-blue-50 text-[#1A73E8] font-bold">{t('vault.pqcEncryption', 'PQC Level 3 Encryption')}</Badge>
              <span>{t('vault.secretPiecesScattered', 'Secret pieces scattered globally to sovereign shards.')}</span>
            </div>
          ) : null}
        </motion.div>
      ) : null}

      <Button
        className="w-full h-14 bg-[#1A73E8] hover:bg-[#1665cb] text-white rounded-2xl font-bold text-lg select-none uppercase tracking-wide flex items-center justify-center gap-2"
        onClick={() => onGenerate(buildState())}
        disabled={isGenerating}
      >
        {isGenerating
          ? t('vault.pqcCryptoSplit', 'Post-Quantum cryptographic split splitting...')
          : t('vault.generatePqcLink', 'Generate PQC Shielded Link')}
        <Zap className="w-5 h-5 fill-current text-white" />
      </Button>
    </div>
  );
}
