import React from 'react';
import { Ticket as TicketType } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Textarea } from '../ui/textarea';
import { useTranslation } from '../../lib/context/I18nContext';
import { getTicketKind } from '../../lib/ticketWorkspace';

interface TicketKindFieldsCardProps {
  ticket: TicketType;
  onUpdate: (data: Partial<TicketType>) => void;
}

export function TicketKindFieldsCard({ ticket, onUpdate }: TicketKindFieldsCardProps) {
  const { t } = useTranslation();
  const kind = getTicketKind(ticket);

  return (
    <Card className="border-border rounded-xl shadow-none">
      <CardContent className="p-4 space-y-3">
        <h3 className="text-xs font-bold text-foreground">
          {kind === 'support'
            ? t('tickets.fields.supportContext', 'Support Context')
            : t('tickets.fields.bugContext', 'Bug Context')}
        </h3>

        {kind === 'support' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px]">{t('tickets.fields.slaTier', 'SLA Tier')}</Label>
              <Input
                className="h-8 text-xs"
                value={ticket.slaTier ?? ''}
                onChange={(e) => onUpdate({ slaTier: e.target.value })}
                placeholder={t('tickets.fields.slaTierPlaceholder', 'e.g. Platinum')}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">{t('tickets.fields.accountHealth', 'Account Health')}</Label>
              <Input
                className="h-8 text-xs"
                value={ticket.accountHealth ?? ''}
                onChange={(e) => onUpdate({ accountHealth: e.target.value })}
                placeholder={t('tickets.fields.accountHealthPlaceholder', 'e.g. At Risk')}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px]">{t('tickets.fields.affectedVersion', 'Affected Version / Build')}</Label>
                <Input
                  className="h-8 text-xs"
                  value={ticket.affectedVersion ?? ''}
                  onChange={(e) => onUpdate({ affectedVersion: e.target.value })}
                  placeholder="v2.4.1"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">{t('tickets.fields.environment', 'Environment')}</Label>
                <Input
                  className="h-8 text-xs"
                  value={ticket.environment ?? ''}
                  onChange={(e) => onUpdate({ environment: e.target.value })}
                  placeholder={t('tickets.fields.environmentPlaceholder', 'Production / Staging')}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">{t('tickets.fields.stepsToReproduce', 'Steps to Reproduce')}</Label>
              <Textarea
                className="min-h-[72px] text-xs"
                value={ticket.stepsToReproduce ?? ''}
                onChange={(e) => onUpdate({ stepsToReproduce: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">{t('tickets.fields.devStatus', 'Dev Status')}</Label>
              <Select
                value={ticket.devStatus ?? 'backlog'}
                onValueChange={(v) => onUpdate({ devStatus: v as TicketType['devStatus'] })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="backlog">{t('tickets.devStatus.backlog', 'Backlog')}</SelectItem>
                  <SelectItem value="in_dev">{t('tickets.devStatus.inDev', 'In Dev')}</SelectItem>
                  <SelectItem value="qa">{t('tickets.devStatus.qa', 'QA')}</SelectItem>
                  <SelectItem value="merged">{t('tickets.devStatus.merged', 'Merged')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
