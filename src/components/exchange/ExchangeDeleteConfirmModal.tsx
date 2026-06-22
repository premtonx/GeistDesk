import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from '../../lib/context/I18nContext';
import { Button } from '../ui/button';
import type { ExchangeItemRow } from './exchange-utils';

interface ExchangeDeleteConfirmModalProps {
  item: ExchangeItemRow | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
}

export function ExchangeDeleteConfirmModal({ item, onClose, onConfirm }: ExchangeDeleteConfirmModalProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {item ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/50 overflow-y-auto animate-fade-in">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-3xl overflow-hidden max-w-sm w-full p-6 space-y-4 border border-slate-100 shadow-2xl relative"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 hover:bg-slate-100 h-7 w-7 rounded-full flex items-center justify-center text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="h-10 w-10 bg-rose-100 text-rose-700 rounded-2xl flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <div>
              <h4 className="font-bold text-slate-900 text-sm">
                {t('exchange.delete.confirmTitle', 'Delete exchange permanently?')}
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                {t(
                  'exchange.delete.confirmMessage',
                  'Do you want to permanently delete this exchange? This action cannot be undone.',
                )}
              </p>
              <p className="text-xs font-semibold text-slate-800 mt-2 truncate">{item.name}</p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">
                {t('actions.cancel', 'Cancel')}
              </Button>
              <Button
                onClick={() => {
                  onConfirm(item.id);
                  onClose();
                }}
                className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700"
              >
                {t('exchange.delete.confirmAction', 'Delete permanently')}
              </Button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
