import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { AdminCard } from '../../AdminCard';
import { usePermissions } from '../../../hooks/usePermissions';
import { useTranslation } from '../../../lib/context/I18nContext';
import type { AdminHubCategory } from './adminHubConfig';

interface AdminHubSectionGridProps {
  categories: AdminHubCategory[];
}

export function AdminHubSectionGrid({ categories }: AdminHubSectionGridProps) {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { t } = useTranslation();

  if (categories.length === 0) return null;

  return (
    <div className="space-y-12">
      {categories.map((category) => (
        <div key={category.id} className="space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
            {t(`admin.categories.${category.id}`, category.title)}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {category.sections.map((section) => {
              const isAllowed = hasPermission(section.module || 'rbac', 'view');
              const sectionKey = section.title.toLowerCase().replace(/ & /g, '_and_').replace(/ /g, '_');
              return (
                <div key={section.path} className={cn(!isAllowed && 'opacity-50 grayscale')}>
                  <AdminCard
                    title={t(`admin.sections.${sectionKey}.title`, section.title)}
                    description={t(`admin.sections.${sectionKey}.description`, section.description)}
                    icon={isAllowed ? section.icon : Lock}
                    path={isAllowed ? section.path : '#'}
                    badge={
                      isAllowed
                        ? t(`admin.badges.${section.badge.toLowerCase().replace(/ /g, '_')}`, section.badge)
                        : t('admin.badges.restricted', 'Restricted')
                    }
                    color={section.color}
                    bgColor={section.bgColor}
                    borderColor={section.borderColor}
                    onClick={() => isAllowed && navigate(section.path)}
                    actionLabel={t('admin.configureSection', 'Configure Section')}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
