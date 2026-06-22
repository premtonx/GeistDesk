import { toast } from 'sonner';
import { buildExchangeSecureUrl, isDemoExchangeId } from './exchange-status-utils';

export async function copyExchangeLinkToClipboard(
  id: string,
  t: (key: string, defaultValue: string) => string,
): Promise<boolean> {
  if (isDemoExchangeId(id)) {
    toast.info(
      t(
        'exchange.actions.demoLinkHint',
        'This is a demo row — create a live secret link to generate a working /v/ URL.',
      ),
    );
    return false;
  }
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
