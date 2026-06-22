import React, { useMemo, useState } from 'react';
import { Link2, Plus, Bug, Headphones } from 'lucide-react';
import { Ticket as TicketType } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useTranslation } from '../../lib/context/I18nContext';
import {
  getLinkedBugTicket,
  getLinkedSupportTickets,
  getTicketKind,
  isBugTicket,
  isSupportTicket,
  devStatusLabelKey,
} from '../../lib/ticketWorkspace';

interface RelationalLinksCardProps {
  ticket: TicketType;
  allTickets: TicketType[];
  onLinkToBug: (bugId: string) => void;
  onCreateBugLink: () => void;
}

export function RelationalLinksCard({
  ticket,
  allTickets,
  onLinkToBug,
  onCreateBugLink,
}: RelationalLinksCardProps) {
  const { t } = useTranslation();
  const [pickerValue, setPickerValue] = useState('');
  const kind = getTicketKind(ticket);
  const linkedBug = getLinkedBugTicket(ticket, allTickets);
  const linkedSupport = getLinkedSupportTickets(ticket, allTickets);

  const bugOptions = useMemo(
    () => allTickets.filter((t) => isBugTicket(t) && t.id !== ticket.id),
    [allTickets, ticket.id],
  );

  return (
    <Card className="border-border rounded-xl shadow-none">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-indigo-500" />
          <h3 className="text-xs font-bold text-foreground">
            {t('tickets.relations.title', 'Relational Links')}
          </h3>
        </div>

        {kind === 'support' ? (
          <div className="space-y-2">
            {linkedBug ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Bug className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                  <span className="text-xs font-semibold truncate">#{linkedBug.id.slice(-6)} {linkedBug.subject}</span>
                </div>
                <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                  {t(devStatusLabelKey(linkedBug.devStatus), linkedBug.devStatus ?? 'backlog')}
                </Badge>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {t('tickets.relations.noBugLinked', 'No engineering bug linked yet.')}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={pickerValue} onValueChange={setPickerValue}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder={t('tickets.relations.linkExistingBug', 'Link to Existing Bug')} />
                </SelectTrigger>
                <SelectContent>
                  {bugOptions.map((bug) => (
                    <SelectItem key={bug.id} value={bug.id}>
                      #{bug.id.slice(-6)} — {bug.subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs shrink-0"
                disabled={!pickerValue}
                onClick={() => {
                  if (pickerValue) {
                    onLinkToBug(pickerValue);
                    setPickerValue('');
                  }
                }}
              >
                {t('tickets.relations.linkToBug', 'Link to Bug')}
              </Button>
              <Button type="button" size="sm" className="h-8 text-xs shrink-0" onClick={onCreateBugLink}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                {t('tickets.relations.createLinkToBug', 'Create Link to Bug')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              {t('tickets.relations.supportCasesBlocked', '{{count}} customer cases linked')
                .replace('{{count}}', String(linkedSupport.length))}
            </p>
            {linkedSupport.slice(0, 4).map((st) => (
              <div key={st.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 px-3 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Headphones className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="text-[11px] font-medium truncate">#{st.id.slice(-6)} {st.subject}</span>
                </div>
                <Badge variant="outline" className="text-[9px] h-5">
                  {t(`tickets.statusLabels.${st.status}`, st.status)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
