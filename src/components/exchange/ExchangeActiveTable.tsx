import { type MouseEvent } from 'react';
import { Lock, Upload, Building2, MoreHorizontal, Copy, Trash2, Zap, Download } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/context/I18nContext';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  exchangePanelClass,
  exchangeStatusClass,
  type ExchangeItemRow,
  type ExchangeQuickFilter,
} from './exchange-utils';
import {
  EXCHANGE_QUICK_FILTER_DEFAULT_TITLES,
  EXCHANGE_QUICK_FILTER_TITLE_KEYS,
} from './exchange-utils';
import {
  formatExchangeExpirationDisplay,
  getExchangeStatusDefaultLabel,
  getExchangeStatusLabelKey,
  isDropzoneClientUploadClosed,
  isExchangeActiveStatus,
  resolveExchangeStatus,
} from './exchange-status-utils';

interface ExchangeActiveTableProps {
  items: ExchangeItemRow[];
  selectedItemId?: string | null;
  onRowSelect?: (item: ExchangeItemRow, event?: MouseEvent) => void;
  onCopyLink?: (item: ExchangeItemRow) => void;
  onQuickAction?: (item: ExchangeItemRow) => void;
  onDeleteRequest?: (item: ExchangeItemRow) => void;
  onChangeSecurityPolicy?: (item: ExchangeItemRow) => void;
  onRotateToken?: (item: ExchangeItemRow) => void;
  quickFilter?: ExchangeQuickFilter;
  className?: string;
}

export function ExchangeActiveTable({
  items,
  selectedItemId,
  onRowSelect,
  onCopyLink,
  onQuickAction,
  onDeleteRequest,
  onChangeSecurityPolicy,
  onRotateToken,
  quickFilter,
  className,
}: ExchangeActiveTableProps) {
  const { t } = useTranslation();

  const sectionTitle = quickFilter
    ? t(
        EXCHANGE_QUICK_FILTER_TITLE_KEYS[quickFilter],
        EXCHANGE_QUICK_FILTER_DEFAULT_TITLES[quickFilter],
      )
    : t('exchange.activeExchanges.title', 'Active Exchanges');

  const emptyMessage = quickFilter
    ? t('exchange.focusedFilter.empty', 'No entries found for this filter.')
    : t('exchange.activeExchanges.empty', 'No active exchanges match your filters.');

  const handleOpenDetails = (item: ExchangeItemRow, event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onRowSelect?.(item, event);
  };

  return (
    <section className={cn(exchangePanelClass(), 'overflow-hidden', className)}>
      <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            {sectionTitle}
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {t('exchange.activeExchanges.subtitle', '{{count}} records in workspace').replace('{{count}}', String(items.length))}
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] font-semibold border-indigo-100 bg-indigo-50 text-indigo-700">
          {t('exchange.activeExchanges.live', 'Live')}
        </Badge>
      </header>

      <div className="px-5 pt-4">
        <p className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-[11px] leading-relaxed text-slate-600">
          {t(
            'exchange.activeExchanges.actionHint',
            '💡 Note: The copy button generates the one-time link for your clients. To inspect and download uploaded files, click “Manage & Download”.',
          )}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] uppercase font-semibold tracking-wider text-slate-400">
              <th className="px-5 py-3">{t('exchange.table.type', 'Type')}</th>
              <th className="px-5 py-3">{t('exchange.table.title', 'Title')}</th>
              <th className="px-5 py-3">{t('exchange.table.recipient', 'Recipient')}</th>
              <th className="px-5 py-3">{t('exchange.table.status', 'Status')}</th>
              <th className="px-5 py-3">{t('exchange.table.views', 'Views')}</th>
              <th className="px-5 py-3">{t('exchange.table.expires', 'Expires')}</th>
              <th className="px-5 py-3">{t('exchange.table.securityPolicy', 'Security Policy')}</th>
              <th className="px-5 py-3 text-right min-w-[220px]">{t('exchange.table.actions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length > 0 ? (
              items.map((item) => {
                const resolvedStatus = resolveExchangeStatus(item);
                const uploadSlotClosed = isDropzoneClientUploadClosed(item, resolvedStatus);
                const copyClientLinkLabel =
                  item.type === 'request'
                    ? t('exchange.actions.copyClientUploadLink', 'Copy Client Upload Link')
                    : t('exchange.actions.copyClientAccessLink', 'Copy Client Access Link');

                return (
                  <tr
                    key={item.id}
                    onClick={(event) => handleOpenDetails(item, event)}
                    className={cn(
                      'transition-colors group cursor-pointer',
                      selectedItemId === item.id
                        ? 'bg-[#E8F0FE]/70 hover:bg-[#E8F0FE]/80'
                        : 'hover:bg-slate-50/50',
                    )}
                  >
                    <td className="px-5 py-3">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center border',
                          item.type === 'secret'
                            ? 'bg-blue-50 border-blue-100 text-blue-600'
                            : 'bg-violet-50 border-violet-100 text-violet-600',
                        )}
                      >
                        {item.type === 'secret' ? <Lock className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
                      </div>
                    </td>
                    <td className="px-5 py-3 max-w-[220px]">
                      <p className="font-semibold text-slate-900 truncate group-hover:text-blue-600">{item.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 truncate">
                        <Building2 className="w-3 h-3 shrink-0" /> {item.company}
                      </p>
                      {item.type === 'request' && item.size ? (
                        <p className="text-[10px] text-violet-600 font-semibold mt-0.5">{item.size}</p>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-slate-600 max-w-[160px] truncate">{item.recipient}</td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          'text-[10px] font-semibold px-2 py-0.5 rounded-lg border',
                          exchangeStatusClass(resolvedStatus),
                        )}
                      >
                        {t(
                          getExchangeStatusLabelKey(resolvedStatus),
                          getExchangeStatusDefaultLabel(resolvedStatus),
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium tabular-nums text-slate-700">{item.views}</td>
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                      {formatExchangeExpirationDisplay(item.expires, t)}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600">
                        {item.type === 'secret'
                          ? t('exchange.policy.burnAfterRead', 'Burn after read')
                          : item.size || t('exchange.policy.malwareScan', 'Malware scan + 48h')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end items-center gap-1.5 opacity-90 group-hover:opacity-100">
                        {onRowSelect ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5 rounded-lg text-[10px] font-bold border-[#1A73E8]/35 text-[#1A73E8] bg-[#E8F0FE]/60 hover:bg-[#E8F0FE] shadow-xs whitespace-nowrap"
                            title={t(
                              'exchange.actions.manageDownloadTooltip',
                              'Inspect files, review malware scans, and securely download',
                            )}
                            aria-label={t('exchange.actions.manageDownload', 'Manage & Download')}
                            onClick={(event) => handleOpenDetails(item, event)}
                          >
                            <Download className="w-3.5 h-3.5 mr-1 shrink-0" />
                            <span className="hidden xl:inline">
                              {t('exchange.actions.manageDownload', 'Manage & Download')}
                            </span>
                            <span className="xl:hidden">
                              {t('exchange.actions.manageDownloadShort', 'Manage')}
                            </span>
                          </Button>
                        ) : null}
                        {onCopyLink ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={uploadSlotClosed}
                            className={cn(
                              'h-8 w-8',
                              uploadSlotClosed && 'opacity-35 cursor-not-allowed hover:bg-transparent',
                            )}
                            title={
                              uploadSlotClosed
                                ? t(
                                    'exchange.actions.uploadSlotClosed',
                                    'Upload slot closed — client link is no longer active',
                                  )
                                : copyClientLinkLabel
                            }
                            aria-label={copyClientLinkLabel}
                            onClick={() => {
                              if (!uploadSlotClosed) onCopyLink(item);
                            }}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        ) : null}
                        {onQuickAction && isExchangeActiveStatus(resolvedStatus) ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-amber-600"
                            title={t('exchange.actions.quickAction', 'Quick action')}
                            onClick={() => onQuickAction(item)}
                          >
                            <Zap className="w-3.5 h-3.5" />
                          </Button>
                        ) : null}
                        {onDeleteRequest ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-rose-500"
                            title={t('exchange.actions.delete', 'Delete')}
                            onClick={() => onDeleteRequest(item)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        ) : null}
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title={t('exchange.actions.moreOptions', 'More options')}
                              >
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </Button>
                            }
                          />
                          <DropdownMenuContent
                            align="end"
                            className="w-52 bg-white border border-slate-200 shadow-xl rounded-xl p-1 z-[100]"
                          >
                            <DropdownMenuItem
                              onClick={() => onChangeSecurityPolicy?.(item)}
                              className="text-xs font-semibold text-slate-700 p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer"
                            >
                              {t('exchange.actions.changeSecurityPolicy', 'Change security policy')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onRotateToken?.(item)}
                              className="text-xs font-semibold text-slate-700 p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer"
                            >
                              {t('exchange.actions.rotateAccessToken', 'Rotate access token')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-slate-400 text-sm">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
