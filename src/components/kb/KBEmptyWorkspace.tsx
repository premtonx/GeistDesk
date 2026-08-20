import { BookOpen, Upload } from 'lucide-react';
import { Button } from '../ui/button';
import { useTranslation } from '../../lib/context/I18nContext';

interface KBEmptyWorkspaceProps {
  onCreateArticle: () => void;
  onImportDocs: () => void;
}

export function KBEmptyWorkspace({ onCreateArticle, onImportDocs }: KBEmptyWorkspaceProps) {
  const { t } = useTranslation();

  return (
    <section className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <BookOpen className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-900">
        {t('kb.emptyWorkspace.title', 'Wissensdatenbank ist noch leer')}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        {t(
          'kb.emptyWorkspace.subtitle',
          'Erstellen Sie Ihre ersten Kategorien und Artikel oder nutzen Sie den Dokumenten-Import.',
        )}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button type="button" className="h-10 rounded-xl text-sm font-semibold" onClick={onCreateArticle}>
          {t('kb.emptyWorkspace.createArticle', '+ Ersten Artikel erstellen')}
        </Button>
        <Button type="button" variant="outline" className="h-10 rounded-xl text-sm font-semibold gap-2" onClick={onImportDocs}>
          <Upload className="h-4 w-4" />
          {t('kb.emptyWorkspace.importDocs', 'Dokumente importieren')}
        </Button>
      </div>
    </section>
  );
}
