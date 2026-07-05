import { useCallback, useEffect, useState } from 'react';
import {
  buildExchangeTemplate,
  loadCustomTemplates,
  saveCustomTemplates,
  validateCreateTemplateInput,
  type CreateExchangeTemplateInput,
  type ExchangeTemplate,
} from './exchange-template-utils';

export function useExchangeTemplates() {
  const [customTemplates, setCustomTemplates] = useState<ExchangeTemplate[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    const sync = () => setCustomTemplates(loadCustomTemplates());
    sync();
    window.addEventListener('module-config-changed', sync);
    return () => window.removeEventListener('module-config-changed', sync);
  }, []);

  const persistTemplates = useCallback(async (templates: ExchangeTemplate[]) => {
    setCustomTemplates(templates);
    await saveCustomTemplates(templates);
  }, []);

  const createTemplate = useCallback(
    (input: CreateExchangeTemplateInput): { ok: true; template: ExchangeTemplate } | { ok: false; errorKey: string } => {
      const validationError = validateCreateTemplateInput(input);
      if (validationError) {
        return { ok: false, errorKey: validationError };
      }

      const template = buildExchangeTemplate(input);
      void persistTemplates([template, ...customTemplates]);
      return { ok: true, template };
    },
    [customTemplates, persistTemplates],
  );

  const getTemplateById = useCallback(
    (id: string) => customTemplates.find((template) => template.id === id) ?? null,
    [customTemplates],
  );

  return {
    customTemplates,
    isCreateModalOpen,
    setIsCreateModalOpen,
    createTemplate,
    getTemplateById,
  };
}
