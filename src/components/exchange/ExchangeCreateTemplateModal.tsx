import React, { useState } from 'react';
import { FileStack, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from '../../lib/context/I18nContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import type { CreateExchangeTemplateInput } from './exchange-template-utils';

interface ExchangeCreateTemplateModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateExchangeTemplateInput) => { ok: true } | { ok: false; errorKey: string };
}

export function ExchangeCreateTemplateModal({ open, onClose, onSubmit }: ExchangeCreateTemplateModalProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [description, setDescription] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const resetForm = () => {
    setTitle('');
    setTagsRaw('');
    setDescription('');
    setErrorKey(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = () => {
    const result = onSubmit({
      title,
      tags: tagsRaw.split(',').map((tag) => tag.trim()).filter(Boolean),
      description,
    });

    if (result.ok === false) {
      setErrorKey(result.errorKey);
      return;
    }

    resetForm();
    onClose();
  };

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 overflow-y-auto animate-fade-in">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-3xl overflow-hidden max-w-md w-full p-6 space-y-4 border border-slate-100 shadow-2xl relative"
          >
            <button
              type="button"
              onClick={handleClose}
              className="absolute right-4 top-4 hover:bg-slate-100 h-7 w-7 rounded-full flex items-center justify-center text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="h-10 w-10 bg-blue-100 text-[#1A73E8] rounded-2xl flex items-center justify-center">
              <FileStack className="w-5 h-5" />
            </div>

            <div>
              <h4 className="font-bold text-slate-900 text-sm">
                {t('exchange.templates.createTitle', 'Create Exchange Template')}
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                {t(
                  'exchange.templates.createDesc',
                  'Save a reusable dropzone layout. Use placeholders like {{customer_name}} and {{ticket_id}} in the description.',
                )}
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {t('exchange.templates.fieldTitle', 'Template title')}
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('exchange.templates.fieldTitlePlaceholder', 'Log intake for {{customer_name}}')}
                  className="h-11 rounded-xl bg-slate-50 border-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {t('exchange.templates.fieldTags', 'Classification tags')}
                </label>
                <Input
                  value={tagsRaw}
                  onChange={(e) => setTagsRaw(e.target.value)}
                  placeholder={t('exchange.templates.fieldTagsPlaceholder', 'diagnostics, compliance, urgent')}
                  className="h-11 rounded-xl bg-slate-50 border-slate-200"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {t('exchange.templates.fieldDescription', 'Template body')}
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t(
                    'exchange.templates.fieldDescriptionPlaceholder',
                    'Collect logs for ticket {{ticket_id}} from {{customer_name}}.',
                  )}
                  className="min-h-[100px] rounded-xl bg-slate-50 border-slate-200 text-xs"
                />
              </div>

              {errorKey ? (
                <p className="text-xs font-semibold text-rose-600">
                  {t(`exchange.templates.errors.${errorKey}`, errorKey)}
                </p>
              ) : null}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleClose} className="flex-1 rounded-xl">
                {t('actions.cancel', 'Cancel')}
              </Button>
              <Button onClick={handleSubmit} className="flex-1 rounded-xl bg-[#1A73E8] hover:bg-blue-700">
                {t('exchange.templates.saveTemplate', 'Save Template')}
              </Button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
