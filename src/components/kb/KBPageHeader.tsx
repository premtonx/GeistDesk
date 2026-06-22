import React from 'react';
import { useTranslation } from '../../lib/context/I18nContext';
import { ModulePageCompactHeader } from '../ui/module-page/ModulePageCompactHeader';

interface KBPageHeaderProps {
  articleCount: number;
  categoryCount: number;
  healthScore: number;
  trailing?: React.ReactNode;
  className?: string;
}

export function KBPageHeader({
  articleCount,
  categoryCount,
  healthScore,
  trailing,
  className,
}: KBPageHeaderProps) {
  const { t } = useTranslation();

  const meta = t(
    'kb.headerMetaSummary',
    '{{articles}} Articles • {{categories}} Categories • {{health}}% Health Score',
  )
    .replace('{{articles}}', String(articleCount))
    .replace('{{categories}}', String(categoryCount))
    .replace('{{health}}', String(healthScore));

  return (
    <ModulePageCompactHeader
      className={className}
      title={t('kb.pageTitle', 'Knowledge Base')}
      meta={meta}
      trailing={trailing}
    />
  );
}
