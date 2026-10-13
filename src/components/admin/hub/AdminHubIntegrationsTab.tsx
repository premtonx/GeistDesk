import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Mail, Webhook } from 'lucide-react';
import { Button } from '../../ui/button';
import { useWorkspaceModuleConfig } from '../../../hooks/useWorkspaceModuleConfig';
import { useTranslation } from '../../../lib/context/I18nContext';
import { AdminHubSectionGrid } from './AdminHubSectionGrid';
import { categoriesForTab } from './adminHubConfig';
import { AdminHubMcpPanel } from './AdminHubMcpPanel';

export function AdminHubIntegrationsTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { config } = useWorkspaceModuleConfig({ admin: true });

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <IntegrationTile
          icon={<Mail className="w-4 h-4 text-rose-500" />}
          title={t('admin.hubInt.mailTitle', 'Inbound mail')}
          body={`${config.email.supportEmail || 'support@…'} · ${config.email.smtpHost || 'SMTP unset'}`}
          action={t('admin.hubInt.openChannels', 'Email channels')}
          onClick={() => navigate('/email-channels')}
        />
        <IntegrationTile
          icon={<Webhook className="w-4 h-4 text-indigo-500" />}
          title={t('admin.hubInt.webhookTitle', 'Webhooks & APIs')}
          body={t('admin.hubInt.webhookBody', 'Personio, Slack, and inbound webhook listeners.')}
          action={t('admin.hubInt.openIntegrations', 'Integrations hub')}
          onClick={() => navigate('/admin/integrations')}
        />
        <IntegrationTile
          icon={<Bot className="w-4 h-4 text-amber-500" />}
          title={t('admin.hubInt.botsTitle', 'Bot adapters')}
          body={t('admin.hubInt.botsBody', 'Teams / Graph bot and notification adapters.')}
          action={t('admin.hubInt.openNotifications', 'Notifications')}
          onClick={() => navigate('/admin/notifications')}
        />
      </div>
      <AdminHubMcpPanel />
      <AdminHubSectionGrid categories={categoriesForTab('integrations')} />
    </div>
  );
}

function IntegrationTile({
  icon,
  title,
  body,
  action,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-[2rem] p-6 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <h3 className="text-sm font-black text-slate-900">{title}</h3>
      </div>
      <p className="text-sm text-slate-500 flex-1">{body}</p>
      <Button variant="outline" className="rounded-xl font-bold w-fit" onClick={onClick}>
        {action}
      </Button>
    </div>
  );
}
