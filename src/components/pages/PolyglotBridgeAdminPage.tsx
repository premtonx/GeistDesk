import { Globe } from 'lucide-react';
import { AdminBreadcrumbs } from '../AdminBreadcrumbs';
import { PolyglotBridgeConfigPanel } from '../admin/PolyglotBridgeConfigPanel';
import { useTranslation } from '../../lib/context/I18nContext';

export default function PolyglotBridgeAdminPage() {
  const { t } = useTranslation();

  return (
    <div className="flex-1 overflow-y-auto bg-[#fafafa]">
      <div className="p-8 max-w-4xl mx-auto pb-20">
        <AdminBreadcrumbs />

        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600 shadow-sm border border-teal-100">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {t('admin.sections.polyglot_bridge.title', 'Polyglot Bridge')}
              </h1>
              <p className="text-slate-500 text-sm mt-0.5">
                {t(
                  'admin.sections.polyglot_bridge.description',
                  'Manage workspace languages, translation credentials, and custom phrase dictionaries.',
                )}
              </p>
            </div>
          </div>
        </div>

        <PolyglotBridgeConfigPanel />
      </div>
    </div>
  );
}
