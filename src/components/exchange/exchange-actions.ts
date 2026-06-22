import { toast } from 'sonner';
import { buildExchangeSecureUrl } from './exchange-status-utils';

export async function copyExchangeLinkToClipboard(
  id: string,
  t: (key: string, defaultValue: string) => string,
): Promise<boolean> {
  const url = buildExchangeSecureUrl(id);
  try {
    await navigator.clipboard.writeText(url);
    toast.success(t('exchange.actions.copySuccess', 'Link copied successfully.'));
    return true;
  } catch {
    toast.error(t('exchange.actions.copyError', 'Unable to copy link to clipboard.'));
    return false;
  }
}
