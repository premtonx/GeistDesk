import React from 'react';
import { useTranslation } from '../../lib/context/I18nContext';

export function VaultPageHeader() {
  const { t } = useTranslation();

  return (
    <header className="shrink-0">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        {t('vault.pageTitle', 'GeistVault')}
      </h1>
      <p className="text-sm text-slate-500 mt-1">
        {t('vault.pageSubtitle', 'Secure credential, secret, and access management.')}
      </p>
    </header>
  );
}
