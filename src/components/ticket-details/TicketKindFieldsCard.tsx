import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { Ticket as TicketType } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
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

type BugDraft = {
  affectedVersion: string;
  environment: string;
  stepsToReproduce: string;
  devStatus: NonNullable<TicketType['devStatus']>;
};

function getBugDraft(ticket: TicketType): BugDraft {
  return {
    affectedVersion: ticket.affectedVersion ?? '',
    environment: ticket.environment ?? '',
    stepsToReproduce: ticket.stepsToReproduce ?? '',
    devStatus: ticket.devStatus ?? 'backlog',
  };
}

export function TicketKindFieldsCard({ ticket, onUpdate }: TicketKindFieldsCardProps) {
  const { t } = useTranslation();
  const kind = getTicketKind(ticket);
  const [bugDraft, setBugDraft] = useState<BugDraft>(() => getBugDraft(ticket));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setBugDraft(getBugDraft(ticket));
  }, [
    ticket.id,
    ticket.affectedVersion,
    ticket.environment,
    ticket.stepsToReproduce,
    ticket.devStatus,
  ]);

  const isDirty = useMemo(() => {
    if (kind === 'support') return false;
    const saved = getBugDraft(ticket);
    return (
      bugDraft.affectedVersion !== saved.affectedVersion ||
      bugDraft.environment !== saved.environment ||
      bugDraft.stepsToReproduce !== saved.stepsToReproduce ||
      bugDraft.devStatus !== saved.devStatus
    );
  }, [kind, ticket, bugDraft]);

  if (kind === 'support') {
    return null;
  }

  const handleDiscard = () => {
    setBugDraft(getBugDraft(ticket));
  };

  const handleSave = () => {
    if (!isDirty || isSaving) return;

    setIsSaving(true);
    try {
      onUpdate(bugDraft);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className={`border-border rounded-xl shadow-none ${isDirty ? 'ring-1 ring-amber-400/60' : ''}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-foreground">
            {t('tickets.fields.bugContext', 'Bug Context')}
          </h3>
          {isDirty && (
            <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">
              {t('tickets.fields.unsavedChanges', 'Unsaved changes')}
            </span>
          )}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px]">{t('tickets.fields.affectedVersion', 'Affected Version / Build')}</Label>
              <Input
                className="h-8 text-xs"
                value={bugDraft.affectedVersion}
                onChange={(e) => setBugDraft((prev) => ({ ...prev, affectedVersion: e.target.value }))}
                placeholder="v2.4.1"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">{t('tickets.fields.environment', 'Environment')}</Label>
              <Input
                className="h-8 text-xs"
                value={bugDraft.environment}
                onChange={(e) => setBugDraft((prev) => ({ ...prev, environment: e.target.value }))}
                placeholder={t('tickets.fields.environmentPlaceholder', 'Production / Staging')}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">{t('tickets.fields.stepsToReproduce', 'Steps to Reproduce')}</Label>
            <Textarea
              className="min-h-[72px] text-xs"
              value={bugDraft.stepsToReproduce}
              onChange={(e) => setBugDraft((prev) => ({ ...prev, stepsToReproduce: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">{t('tickets.fields.devStatus', 'Dev Status')}</Label>
            <Select
              value={bugDraft.devStatus}
              onValueChange={(v) => setBugDraft((prev) => ({ ...prev, devStatus: v as TicketType['devStatus'] }))}
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

        {isDirty && (
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleDiscard}
              disabled={isSaving}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              {t('tickets.fields.discardChanges', 'Discard')}
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Check className="w-3.5 h-3.5 mr-1.5" />
              {t('tickets.fields.saveChanges', 'Save changes')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
