import { useEffect, useMemo, useState } from 'react';
import { GitMerge, Info, Search, SearchCheck } from 'lucide-react';
import { useTranslation } from '../../lib/context/I18nContext';
import { cn, safeString } from '../../lib/utils';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  formatTicketCode,
  isMergeableOpenTicket,
  searchMergeCandidateTickets,
} from '../../lib/ticketMerge';
import type { Ticket as TicketType } from '../../types';

export interface TicketMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected merge candidates (bulk selection or the current detail ticket). */
  candidateTickets: TicketType[];
  allTickets: TicketType[];
  /** When true, agent can search other open tickets from the same customer. */
  allowSearch: boolean;
  onConfirm: (primaryId: string, sourceIds: string[]) => Promise<void>;
  isMerging?: boolean;
}

export function TicketMergeDialog({
  open,
  onOpenChange,
  candidateTickets,
  allTickets,
  allowSearch,
  onConfirm,
  isMerging = false,
}: TicketMergeDialogProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [primaryId, setPrimaryId] = useState<string>('');
  const [searchFocused, setSearchFocused] = useState(false);

  const seedTickets = useMemo(
    () => candidateTickets.filter((ticket) => ticket && ticket.status !== 'merged'),
    [candidateTickets],
  );

  const mergeSet = useMemo(() => {
    const extra = allTickets.filter((ticket) => addedIds.includes(ticket.id));
    const byId = new Map<string, TicketType>();
    for (const ticket of [...seedTickets, ...extra]) byId.set(ticket.id, ticket);
    return [...byId.values()];
  }, [seedTickets, addedIds, allTickets]);

  const mergeSetIds = useMemo(() => new Set(mergeSet.map((ticket) => ticket.id)), [mergeSet]);

  const filteredSearch = useMemo(() => {
    if (!allowSearch || seedTickets.length === 0) return [];
    const current = seedTickets[0];
    return searchMergeCandidateTickets(current, allTickets, searchQuery)
      .filter((ticket) => !mergeSetIds.has(ticket.id))
      .slice(0, 12);
  }, [allowSearch, allTickets, seedTickets, searchQuery, mergeSetIds]);

  const showSuggestions = allowSearch && (searchFocused || searchQuery.trim().length > 0 || open);

  useEffect(() => {
    if (!open) return;
    setSearchQuery('');
    setAddedIds([]);
    setSearchFocused(true);
    const oldest = [...seedTickets].sort((a, b) => {
      const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
      const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
      return aTime - bTime;
    })[0];
    setPrimaryId(oldest?.id || seedTickets[0]?.id || '');
  }, [open, seedTickets]);

  const secondaries = mergeSet.filter((ticket) => ticket.id !== primaryId);
  const canConfirm =
    mergeSet.length >= 2 &&
    Boolean(primaryId) &&
    secondaries.length > 0 &&
    !isMerging;

  const addTicket = (ticket: TicketType) => {
    setAddedIds((prev) => (prev.includes(ticket.id) ? prev : [...prev, ticket.id]));
    if (!primaryId) setPrimaryId(ticket.id);
  };

  const handleSuggestionClick = (ticket: TicketType) => {
    if (mergeSetIds.has(ticket.id)) {
      setPrimaryId(ticket.id);
      return;
    }
    addTicket(ticket);
  };

  const handleConfirm = async () => {
    if (!canConfirm) return;
    await onConfirm(primaryId, secondaries.map((ticket) => ticket.id));
  };

  const emptySearchCopy = searchQuery.trim()
    ? t('tickets.merge.noSearchMatches', 'Keine passenden offenen Tickets gefunden.')
    : t(
        'tickets.merge.noSameCustomer',
        'Keine weiteren offenen Tickets für diesen Kunden gefunden.',
      );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] border-border bg-card">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-100">
              <GitMerge className="w-5 h-5 text-indigo-600" />
            </div>
            <DialogTitle className="text-xl font-bold text-foreground">
              {t('tickets.merge.title', 'Tickets zusammenführen')}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            {t(
              'tickets.merge.desc',
              'Wählen Sie das primäre Ticket (Master), das offen bleibt. Nachrichten und Notizen der übrigen Tickets werden dorthin übernommen.',
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {allowSearch && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-foreground uppercase tracking-widest px-1">
                {t('tickets.merge.searchSameCustomer', 'Offenes Ticket desselben Kunden suchen')}
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('tickets.merge.searchPlaceholder', 'Nach ID oder Betreff suchen...')}
                  className="pl-10 h-11 bg-muted/30 border-border rounded-xl"
                  value={searchQuery}
                  autoComplete="off"
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => {
                    window.setTimeout(() => setSearchFocused(false), 180);
                  }}
                />
              </div>
              {showSuggestions && (
                <div className="space-y-2 max-h-52 overflow-y-auto rounded-xl border border-border bg-card p-1.5">
                  {filteredSearch.length > 0 ? (
                    filteredSearch.map((ticket) => (
                      <button
                        key={ticket.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSuggestionClick(ticket)}
                        disabled={!isMergeableOpenTicket(ticket)}
                        className="w-full text-left p-3 rounded-xl border border-transparent hover:border-indigo-300 hover:bg-indigo-50/30 transition-all disabled:opacity-50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-indigo-600 uppercase tracking-tighter">
                            {formatTicketCode(ticket)}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-foreground truncate block mt-0.5">
                          {safeString(ticket.subject)}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-1 min-w-0">
                          <span className="truncate">{safeString(ticket.customerName)}</span>
                          <Badge className="text-[9px] font-bold h-4 uppercase shrink-0">
                            {t(`tickets.status.${(ticket.status || 'open').toLowerCase()}`, ticket.status || 'Offen')}
                          </Badge>
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="py-6 text-center text-muted-foreground space-y-1">
                      <SearchCheck className="w-7 h-7 mx-auto opacity-20" />
                      <p className="text-xs font-medium">{emptySearchCopy}</p>
                      {!searchQuery.trim() && (
                        <p className="text-[10px] text-muted-foreground/80 px-4">
                          {t(
                            'tickets.merge.typeToSearchOthers',
                            'Tippen Sie, um andere offene Tickets (auch anderer Kunden) zu finden.',
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground uppercase tracking-widest px-1">
              {t('tickets.merge.choosePrimary', 'Primäres Ticket (Master) wählen')}
            </label>
            <p className="text-[11px] text-muted-foreground px-1">
              {t(
                'tickets.merge.choosePrimaryDesc',
                'Dieses Ticket bleibt offen. Die anderen werden auf Zusammengeführt gesetzt und mit der Master-ID verknüpft.',
              )}
            </p>
            <div className="space-y-2">
              {mergeSet.map((ticket) => {
                const selected = ticket.id === primaryId;
                return (
                  <label
                    key={ticket.id}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                      selected
                        ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
                        : 'border-border bg-card hover:border-indigo-200',
                    )}
                  >
                    <input
                      type="radio"
                      name="merge-primary"
                      className="mt-1 accent-indigo-600"
                      checked={selected}
                      onChange={() => setPrimaryId(ticket.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-indigo-600 uppercase">
                          {formatTicketCode(ticket)}
                        </span>
                        {selected && (
                          <Badge className="text-[9px] font-bold h-4 bg-indigo-600 text-white">
                            {t('tickets.merge.primaryStaysOpen', 'Bleibt offen')}
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm font-bold text-foreground truncate block">
                        {safeString(ticket.subject)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {safeString(ticket.customerName)} · {t(`tickets.status.${(ticket.status || 'open').toLowerCase()}`, ticket.status || 'Offen')}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {secondaries.length > 0 && (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3 space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {t('tickets.merge.secondaries', 'Diese Tickets werden zusammengeführt')}
              </p>
              {secondaries.map((ticket) => (
                <p key={ticket.id} className="text-xs font-semibold text-foreground">
                  {formatTicketCode(ticket)} — {safeString(ticket.subject)}
                </p>
              ))}
              <p className="text-[11px] text-muted-foreground pt-1 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {t(
                  'tickets.merge.warningDesc',
                  'Nachrichten und Notizen wandern ins Master-Ticket. Sekundäre Tickets erhalten den Status Zusammengeführt.',
                )}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="text-xs font-bold uppercase text-muted-foreground"
            onClick={() => onOpenChange(false)}
            disabled={isMerging}
          >
            {t('actions.cancel', 'Cancel')}
          </Button>
          <Button
            type="button"
            className="text-xs font-bold uppercase bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {isMerging
              ? t('tickets.merge.merging', 'Wird zusammengeführt…')
              : t('tickets.merge.confirm', 'Zusammenführen bestätigen')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
