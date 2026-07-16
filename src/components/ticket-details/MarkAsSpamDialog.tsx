import { Ban } from 'lucide-react';
import { useTranslation } from '../../lib/context/I18nContext';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

interface MarkAsSpamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  senderEmail: string;
  isSubmitting?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function MarkAsSpamDialog({
  open,
  onOpenChange,
  senderEmail,
  isSubmitting,
  onConfirm,
}: MarkAsSpamDialogProps) {
  const { t } = useTranslation();
  const email = senderEmail || t('tickets.spam.unknownSender', 'unbekannt');

  const description = t(
    'tickets.spam.confirmBody',
    'Möchten Sie dieses Ticket als Spam markieren und den Absender {{email}} dauerhaft blockieren? Zukünftige E-Mails dieser Adresse werden automatisch verworfen.',
  ).replace('{{email}}', email);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Ban className="w-4 h-4 text-rose-600" />
            {t('tickets.spam.confirmTitle', 'Als Spam markieren & blockieren')}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed pt-1">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            {t('actions.cancel', 'Abbrechen')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isSubmitting || !senderEmail}
            onClick={() => void onConfirm()}
            className="bg-rose-600 hover:bg-rose-700"
          >
            {isSubmitting
              ? t('tickets.spam.processing', 'Wird markiert…')
              : t('tickets.spam.confirmButton', 'Spam markieren & blockieren')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
