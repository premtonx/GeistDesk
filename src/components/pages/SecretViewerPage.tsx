import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { vaultService } from '../../services/vaultService';
import { VaultItem } from '../../types';
import {
  ShieldCheck,
  Lock,
  Trash2,
  Copy,
  Check,
  ShieldAlert,
  Clock,
  Zap,
  ArrowRight,
  Upload,
  FileUp,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { combine } from 'shamir-secret-sharing';
import { useTranslation } from '../../lib/context/I18nContext';
import {
  fileMatchesAllowedTypes,
  formatUploadLimitLabel,
  getAllowedFileExtensions,
  isDropzoneVaultItem,
} from '../../lib/vault-dropzone-utils';

type ViewerLoadState = 'loading' | 'ready' | 'unavailable';

export default function SecretViewerPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [item, setItem] = useState<VaultItem | null>(null);
  const [loadState, setLoadState] = useState<ViewerLoadState>('loading');
  const [viewed, setViewed] = useState(false);
  const [copying, setCopying] = useState(false);
  const [reconstructedContent, setReconstructedContent] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [viewerEmail, setViewerEmail] = useState('');
  const [isRevealing, setIsRevealing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const hasRevealedRef = useRef(false);
  const revealInFlightRef = useRef(false);

  const isDropzone = useMemo(() => isDropzoneVaultItem(item), [item]);

  const loadItem = useCallback(async (vaultId: string) => {
    setLoadState('loading');
    setViewed(false);
    setUploadComplete(false);
    setReconstructedContent(null);
    hasRevealedRef.current = false;

    const data = await vaultService.getItem(vaultId);
    if (!data || data.isBurned) {
      setItem(null);
      setLoadState('unavailable');
      return;
    }

    setItem(data);
    setLoadState('ready');
    if (isDropzoneVaultItem(data)) {
      setViewed(true);
    }
  }, []);

  useEffect(() => {
    if (id) {
      void loadItem(id);
    }
  }, [id, loadItem]);

  const viewsRemaining = useMemo(() => {
    if (!item?.maxViews) return null;
    const used = item.viewCount ?? 0;
    return Math.max(0, item.maxViews - used);
  }, [item]);

  const allowedTypes = useMemo(() => getAllowedFileExtensions(item?.metadata), [item?.metadata]);

  const uploadLimitLabel = useMemo(() => {
    const limit = item?.metadata?.uploadLimit ?? '2GB';
    const maxSizeMb = item?.metadata?.maxSizeMb;
    if (maxSizeMb) return `${maxSizeMb >= 1024 ? `${maxSizeMb / 1024} GB` : `${maxSizeMb} MB`} Limit`;
    return formatUploadLimitLabel(limit);
  }, [item?.metadata]);

  const handleDropzoneUpload = async (file: File) => {
    if (!item || !isDropzone) return;

    if (!fileMatchesAllowedTypes(file.name, allowedTypes)) {
      toast.error(
        t(
          'exchange.createSecret.viewer.invalidFileType',
          'This file type is not accepted by the dropzone policy.',
        ),
      );
      return;
    }

    const maxSizeMb = item.metadata?.maxSizeMb ?? 2048;
    if (file.size > maxSizeMb * 1024 * 1024) {
      toast.error(
        t('exchange.createSecret.viewer.fileTooLarge', 'File exceeds the dropzone upload capacity limit.'),
      );
      return;
    }

    setIsUploading(true);
    try {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      await vaultService.uploadDropzoneFile(item.id, {
        content,
        fileName: file.name,
        fileSizeBytes: file.size,
      });

      setUploadComplete(true);
      toast.success(t('exchange.createSecret.viewer.uploadSuccess', 'Payload delivered successfully.'));
      void loadItem(item.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.';
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleReveal = async () => {
    if (!item || item.isBurned || isRevealing || loadState !== 'ready' || isDropzone) return;
    if (hasRevealedRef.current || revealInFlightRef.current) return;

    if (item.passphraseRequired && !passphrase.trim()) {
      toast.error(t('exchange.createSecret.viewer.passphraseRequired', 'Enter the additional passphrase to continue.'));
      return;
    }
    if (item.metadata?.domainWhitelistEnabled && !viewerEmail.trim()) {
      toast.error(t('exchange.createSecret.viewer.emailRequired', 'Enter your corporate email address to continue.'));
      return;
    }

    revealInFlightRef.current = true;
    hasRevealedRef.current = true;
    setIsRevealing(true);

    try {
      const revealed = await vaultService.revealItem(item.id, {
        passphrase: passphrase.trim() || undefined,
        viewerEmail: viewerEmail.trim() || undefined,
      });

      if (!revealed || revealed.preview) {
        hasRevealedRef.current = false;
        toast.error(t('exchange.createSecret.viewer.unavailable', 'This secret has expired or could not be found.'));
        return;
      }

      let resolvedContent: string | null = null;

      if (revealed.content) {
        resolvedContent = revealed.content;
      } else if (revealed.shares && revealed.shares.length > 0) {
        try {
          const uint8Shares = revealed.shares.slice(0, 3).map((shareB64) => {
            const binary = atob(shareB64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            return bytes;
          });

          const combinedUint8 = await combine(uint8Shares);
          resolvedContent = new TextDecoder().decode(combinedUint8);
        } catch (err) {
          console.error('SSS Reconstruction Failed:', err);
          hasRevealedRef.current = false;
          toast.error(t('exchange.createSecret.viewer.reconstructFailed', 'Failed to reconstruct the secure payload.'));
          return;
        }
      }

      if (!resolvedContent) {
        hasRevealedRef.current = false;
        toast.error(t('exchange.createSecret.viewer.unavailable', 'This secret has expired or could not be found.'));
        return;
      }

      setReconstructedContent(resolvedContent);
      setViewed(true);
      setItem({
        ...item,
        isBurned: revealed.burned ?? false,
        viewCount: revealed.viewCount,
        maxViews: revealed.maxViews ?? item.maxViews,
      });

      if (revealed.burned) {
        toast.info(t('exchange.createSecret.viewer.finalView', 'Final view consumed. This link is now expired.'));
      } else {
        toast.success(
          t('exchange.createSecret.viewer.viewConsumed', 'Secure payload revealed. {{remaining}} view slot(s) remaining.').replace(
            '{{remaining}}',
            String(Math.max(0, (revealed.maxViews ?? 0) - (revealed.viewCount ?? 0))),
          ),
        );
      }
    } finally {
      revealInFlightRef.current = false;
      setIsRevealing(false);
    }
  };

  const copyToClipboard = () => {
    const textToCopy = reconstructedContent;
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
    toast.success(t('exchange.createSecret.viewer.copied', 'Copied to clipboard.'));
  };

  if (loadState === 'loading') {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
        <div className="flex -space-x-2 animate-pulse mb-4">
          <div className="w-3 h-8 bg-blue-500 rounded-full"></div>
          <div className="w-3 h-8 bg-blue-400 rounded-full"></div>
          <div className="w-3 h-8 bg-blue-300 rounded-full"></div>
        </div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          {t('exchange.createSecret.viewer.loading', 'Loading secure envelope...')}
        </p>
      </div>
    );
  }

  if (loadState === 'unavailable' && !viewed) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
          <ShieldAlert className="w-10 h-10 text-slate-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          {isDropzone
            ? t('exchange.createSecret.viewer.dropzoneUnavailable', 'Dropzone Expired or Not Found')
            : t('exchange.createSecret.viewer.unavailable', 'Secret Expired or Not Found')}
        </h1>
        <p className="text-slate-500 max-w-md mb-8">
          {t(
            'exchange.createSecret.viewer.unavailableDesc',
            'This link is invalid, has expired, or the view quota has been consumed. Contact the sender for a new secure link.',
          )}
        </p>
        <Badge variant="outline" className="bg-white border-slate-200 text-slate-600 px-4 py-1">
          {t('exchange.createSecret.viewer.unavailableCode', 'Code 404: Not Found')}
        </Badge>
      </div>
    );
  }

  if (isDropzone && item) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg w-full bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-8 text-center space-y-6"
        >
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-violet-50 rounded-3xl flex items-center justify-center text-violet-600">
              <Upload className="w-8 h-8" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">
              {item.metadata?.requestName || t('exchange.createSecret.viewer.dropzoneActive', 'Secure Dropzone Active')}
            </h1>
            <p className="text-sm text-slate-500">
              {item.metadata?.description ||
                t(
                  'exchange.createSecret.viewer.dropzoneActiveDesc',
                  'Files uploaded here are encrypted with PQC-ECC before storage.',
                )}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <Badge className="bg-violet-50 text-violet-700 border-violet-100">{uploadLimitLabel}</Badge>
            {allowedTypes.length > 0 ? (
              <Badge variant="outline" className="text-[10px]">
                {allowedTypes.join(', ')}
              </Badge>
            ) : null}
            {item.metadata?.antivirusScan ? (
              <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-100 bg-emerald-50">
                {t('exchange.createSecret.viewer.antivirusEnabled', 'Antivirus scan')}
              </Badge>
            ) : null}
          </div>

          <div className="p-10 rounded-3xl bg-[#F3E8FF]/40 border-2 border-dashed border-violet-200 flex flex-col items-center justify-center gap-4">
            <FileUp className="w-10 h-10 text-violet-600" />
            <p className="text-sm font-bold text-slate-800">
              {uploadComplete
                ? t('exchange.createSecret.viewer.uploadDelivered', 'Secure payload delivered')
                : t('exchange.createSecret.viewer.selectPayload', 'SELECT PAYLOAD')}
            </p>
            <Input
              type="file"
              className="max-w-xs text-xs"
              disabled={isUploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleDropzoneUpload(file);
                e.target.value = '';
              }}
            />
            {isUploading ? (
              <p className="text-xs text-violet-600 font-semibold animate-pulse">
                {t('exchange.createSecret.viewer.uploading', 'Encrypting and transmitting payload...')}
              </p>
            ) : null}
          </div>

          <div className="pt-4 border-t border-slate-50 flex items-center justify-center gap-6">
            <div className="flex items-center gap-1.5 grayscale opacity-50">
              <ShieldCheck className="w-3 h-3 text-violet-600" />
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                {t('exchange.createSecret.viewer.pqcShield', 'PQC-ECC Shield')}
              </span>
            </div>
            <div className="flex items-center gap-1.5 grayscale opacity-50">
              <Clock className="w-3 h-3 text-violet-600" />
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                {t('exchange.createSecret.viewer.selfDestruct', 'Self Destruct')}
              </span>
            </div>
          </div>
        </motion.div>

        <p className="mt-8 text-[10px] font-bold text-slate-400 uppercase tracking-[.2em]">
          {t('exchange.createSecret.viewer.poweredBy', 'Powered by GeistDesk Phantom Vault')}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-8 text-center space-y-8"
      >
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-[#E8F0FE] rounded-3xl flex items-center justify-center text-[#1A73E8]">
            <Lock className="w-8 h-8" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">
            {t('exchange.createSecret.viewer.title', 'Secure Payload Received')}
          </h1>
          <p className="text-sm text-slate-500">
            {item?.maxViews && item.maxViews > 1
              ? t(
                  'exchange.createSecret.viewer.multiViewHint',
                  'This link allows up to {{max}} views. {{remaining}} remain before automatic expiry.',
                )
                  .replace('{{max}}', String(item.maxViews))
                  .replace('{{remaining}}', String(viewsRemaining ?? item.maxViews))
              : t(
                  'exchange.createSecret.viewer.singleViewHint',
                  'This secret will self-destruct once the allowed view quota is consumed.',
                )}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {!viewed ? (
            <motion.div key="reveal" exit={{ opacity: 0, y: -20 }} className="space-y-4">
              {item?.passphraseRequired ? (
                <Input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder={t('exchange.createSecret.viewer.passphrasePlaceholder', 'Additional passphrase')}
                  className="h-11 rounded-2xl border-slate-200"
                />
              ) : null}
              {item?.metadata?.domainWhitelistEnabled ? (
                <Input
                  type="email"
                  value={viewerEmail}
                  onChange={(e) => setViewerEmail(e.target.value)}
                  placeholder={t('exchange.createSecret.viewer.emailPlaceholder', 'you@company.com')}
                  className="h-11 rounded-2xl border-slate-200"
                />
              ) : null}

              <div className="p-12 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-4">
                <Zap className="w-8 h-8 text-[#1A73E8] fill-current animate-pulse" />
                <span className="text-sm font-bold text-[#1A73E8] uppercase tracking-widest">
                  {t('exchange.createSecret.viewer.clickReveal', 'Click to Reveal')}
                </span>
              </div>

              <Button
                type="button"
                onClick={() => void handleReveal()}
                disabled={isRevealing}
                className="w-full h-14 bg-[#1A73E8] hover:bg-[#1765cc] rounded-2xl font-bold"
              >
                {isRevealing
                  ? t('exchange.createSecret.viewer.decrypting', 'Decrypting Payload...')
                  : t('exchange.createSecret.viewer.revealSecret', 'Reveal Secret')}{' '}
                {!isRevealing ? <ArrowRight className="w-4 h-4 ml-2" /> : null}
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="space-y-6">
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-3xl opacity-20 blur group-hover:opacity-40 transition-opacity" />
                  <div className="relative p-6 bg-slate-50 rounded-3xl border border-slate-100 text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#1A73E8] mb-2">
                      {t('exchange.createSecret.viewer.secretContent', 'Secret Content')}
                    </p>
                    <pre className="text-sm font-mono text-slate-900 whitespace-pre-wrap break-all">
                      {reconstructedContent || t('exchange.createSecret.viewer.payloadBurned', 'Payload burned.')}
                    </pre>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 h-12 rounded-xl font-bold flex items-center justify-center gap-2"
                    onClick={copyToClipboard}
                  >
                    {copying ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    {copying
                      ? t('exchange.createSecret.viewer.copiedShort', 'Copied')
                      : t('exchange.createSecret.viewer.copyText', 'Copy Text')}
                  </Button>
                  <div className="h-12 px-4 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </div>
                </div>

                {item?.isBurned ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    {t(
                      'exchange.createSecret.viewer.linkExpiredAfterView',
                      'This link has been consumed. Refreshing this page will no longer show the secret.',
                    )}
                  </p>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pt-4 border-t border-slate-50 flex items-center justify-center gap-6">
          <div className="flex items-center gap-1.5 grayscale opacity-50">
            <ShieldCheck className="w-3 h-3 text-[#1A73E8]" />
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
              {t('exchange.createSecret.viewer.pqcShield', 'PQC-ECC Shield')}
            </span>
          </div>
          <div className="flex items-center gap-1.5 grayscale opacity-50">
            <Clock className="w-3 h-3 text-[#1A73E8]" />
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
              {t('exchange.createSecret.viewer.selfDestruct', 'Self Destruct')}
            </span>
          </div>
        </div>
      </motion.div>

      <p className="mt-8 text-[10px] font-bold text-slate-400 uppercase tracking-[.2em]">
        {t('exchange.createSecret.viewer.poweredBy', 'Powered by GeistDesk Phantom Vault')}
      </p>
    </div>
  );
}
