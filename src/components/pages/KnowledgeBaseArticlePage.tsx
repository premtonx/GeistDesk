import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { KBArticle, KBArticleAlert, KBArticleHistoryEntry } from '../../types';
import { KBArticleDetailView } from '../kb/KBArticleDetailView';
import type { KBTranslateLanguage } from '../kb/KBArticleDetailToolbar';
import { kbArticleApi } from '../../services/kbArticleApi';
import { AIAdapter } from '../../lib/ai/provider-adapter';
import { DEFAULT_KB_ALERTS, resolveInfrastructureTrust } from '../../lib/kb-article-defaults';
import { kbRelationshipService, type KBRelationship } from '../../services/kbRelationshipService';
import { kbService } from '../../services/kbService';
import { trustScoreService } from '../../services/trustScoreService';

export interface KnowledgeBaseArticlePageProps {
  article: KBArticle & { id: string };
  isAiSearchReady: boolean;
  aiAdapter: AIAdapter;
  onBack: () => void;
  onCopyLink: (articleId: string) => void;
  onArticleUpdated: (articleId: string, patch: Partial<KBArticle>) => void;
}

function isSeedArticle(id: string) {
  return id.startsWith('seed-');
}

export function KnowledgeBaseArticlePage({
  article,
  isAiSearchReady,
  aiAdapter,
  onBack,
  onCopyLink,
  onArticleUpdated,
}: KnowledgeBaseArticlePageProps) {
  const [liveArticle, setLiveArticle] = useState(article);
  const [articleContentLanguage, setArticleContentLanguage] = useState<string>(article.language || 'English');
  const [isTranslating, setIsTranslating] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(article.aiSummary ?? null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<KBArticleHistoryEntry[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [relationships, setRelationships] = useState<KBRelationship[]>([]);
  // Strictly-once view-increment guard. Without this, the effect below re-fires
  // on every render because the parent recreates the `article` object (and the
  // inline `onArticleUpdated` callback) whenever the optimistic views patch is
  // applied — resulting in an infinite view-count loop.
  const viewIncrementedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setLiveArticle(article);
    setArticleContentLanguage(article.language || 'English');
    setAiSummary(article.aiSummary ?? null);
  }, [article]);

  useEffect(() => {
    const unsub = kbRelationshipService.subscribeToRelationships(setRelationships);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isSeedArticle(article.id)) return;
    if (viewIncrementedRef.current.has(article.id)) return;
    viewIncrementedRef.current.add(article.id);

    let cancelled = false;
    void kbArticleApi
      .incrementView(article.id)
      .then(({ views }) => {
        if (cancelled) return;
        setLiveArticle((prev) => ({ ...prev, views }));
        onArticleUpdated(article.id, { views });
      })
      .catch((error) => {
        console.warn('Failed to increment article views:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [article.id]);

  const loadHistory = useCallback(async () => {
    if (isSeedArticle(article.id)) {
      setHistoryEntries([
        {
          id: 'seed-history-1',
          articleId: article.id,
          changeSummary: 'Published revision',
          authorName: liveArticle.owner || 'Author',
          snapshotTitle: liveArticle.title,
          createdAt: liveArticle.updatedAt,
        },
        {
          id: 'seed-history-2',
          articleId: article.id,
          changeSummary: 'Initial draft',
          authorName: liveArticle.owner || 'Author',
          snapshotTitle: liveArticle.title,
          createdAt: liveArticle.createdAt,
        },
      ]);
      return;
    }

    setIsHistoryLoading(true);
    try {
      const { history } = await kbArticleApi.getHistory(article.id);
      setHistoryEntries(history);
    } catch (error) {
      console.warn('Failed to load article history:', error);
      setHistoryEntries([]);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [article.id, liveArticle.createdAt, liveArticle.owner, liveArticle.title, liveArticle.updatedAt]);

  const baseLanguage = liveArticle.language || 'English';

  const resolvedAlerts = useMemo((): KBArticleAlert[] => {
    const translated = liveArticle.translations?.[articleContentLanguage]?.alerts;
    if (articleContentLanguage !== baseLanguage && translated?.length) {
      return translated;
    }
    if (liveArticle.alerts?.length) {
      return liveArticle.alerts;
    }
    if (isSeedArticle(liveArticle.id) && liveArticle.id === 'seed-1') {
      return DEFAULT_KB_ALERTS;
    }
    return [];
  }, [articleContentLanguage, baseLanguage, liveArticle.alerts, liveArticle.id, liveArticle.translations]);

  const displayTitle = useMemo(() => {
    if (articleContentLanguage === baseLanguage) {
      return liveArticle.title;
    }
    return liveArticle.translations?.[articleContentLanguage]?.title || liveArticle.title;
  }, [articleContentLanguage, baseLanguage, liveArticle.title, liveArticle.translations]);

  const displayContent = useMemo(() => {
    if (articleContentLanguage === baseLanguage) {
      return liveArticle.content || '';
    }
    return liveArticle.translations?.[articleContentLanguage]?.content || liveArticle.content || '';
  }, [articleContentLanguage, baseLanguage, liveArticle.content, liveArticle.translations]);

  const infrastructureTrust = useMemo(
    () => resolveInfrastructureTrust(liveArticle, liveArticle.trustScore),
    [liveArticle],
  );

  const handleTranslate = useCallback(
    async (targetLang: KBTranslateLanguage) => {
      if (targetLang === baseLanguage) {
        setArticleContentLanguage(baseLanguage);
        return;
      }

      const cached = liveArticle.translations?.[targetLang];
      if (cached?.title && cached?.content) {
        setArticleContentLanguage(targetLang);
        toast.success(`Showing ${targetLang} translation.`);
        return;
      }

      if (!isAiSearchReady) {
        toast.error('Geist AI is not configured. Connect a model in AI Orchestrator settings.');
        return;
      }

      setIsTranslating(true);
      try {
        const plainSource = (liveArticle.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const plainTitle = liveArticle.title || '';
        const [translatedBody, translatedTitle, ...translatedAlerts] = await Promise.all([
          aiAdapter.translate(plainSource, targetLang, 'Professional'),
          aiAdapter.translate(plainTitle, targetLang, 'Professional'),
          ...resolvedAlerts.map((alert) =>
            aiAdapter.translate(`${alert.title}: ${alert.body}`, targetLang, 'Professional'),
          ),
        ]);

        const htmlTranslated = `<div class="kb-translated-body">${translatedBody.replace(/\n/g, '<br/>')}</div>`;
        const alerts: KBArticleAlert[] = resolvedAlerts.map((alert, index) => {
          const translatedLine = translatedAlerts[index] || '';
          const splitIndex = translatedLine.indexOf(':');
          return {
            type: alert.type,
            title: splitIndex > 0 ? translatedLine.slice(0, splitIndex).trim() : alert.title,
            body: splitIndex > 0 ? translatedLine.slice(splitIndex + 1).trim() : translatedLine || alert.body,
          };
        });

        const translation = {
          title: translatedTitle,
          content: htmlTranslated,
          alerts,
        };

        if (!isSeedArticle(liveArticle.id)) {
          const { translations } = await kbArticleApi.saveTranslation(liveArticle.id, targetLang, translation);
          setLiveArticle((prev) => ({ ...prev, translations }));
          onArticleUpdated(liveArticle.id, { translations });
        } else {
          setLiveArticle((prev) => ({
            ...prev,
            translations: { ...(prev.translations || {}), [targetLang]: translation },
          }));
        }

        setArticleContentLanguage(targetLang);
        toast.success(`Article localized to ${targetLang}.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Translation failed.';
        toast.error(message);
        throw error;
      } finally {
        setIsTranslating(false);
      }
    },
    [
      aiAdapter,
      baseLanguage,
      isAiSearchReady,
      liveArticle.content,
      liveArticle.id,
      liveArticle.title,
      liveArticle.translations,
      onArticleUpdated,
      resolvedAlerts,
    ],
  );

  const handleRegenerateSummary = useCallback(
    async (forceRefresh = false) => {
      if (isSeedArticle(liveArticle.id)) {
        toast.info('AI summary is available for database-backed articles.');
        return;
      }

      setIsSummaryLoading(true);
      try {
        const { aiSummary: summary } = await kbArticleApi.getOrGenerateSummary(liveArticle.id, { forceRefresh });
        setAiSummary(summary);
        setLiveArticle((prev) => ({ ...prev, aiSummary: summary }));
        onArticleUpdated(liveArticle.id, { aiSummary: summary });
        toast.success(forceRefresh ? 'AI summary refreshed.' : 'AI summary loaded.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to generate summary.';
        toast.error(message);
      } finally {
        setIsSummaryLoading(false);
      }
    },
    [liveArticle.id, onArticleUpdated],
  );

  const handleToggleIndexInRag = useCallback(
    async (checked: boolean) => {
      if (isSeedArticle(liveArticle.id)) {
        setLiveArticle((prev) => ({ ...prev, index_in_rag: checked }));
        onArticleUpdated(liveArticle.id, { index_in_rag: checked });
        toast.success(
          checked
            ? 'Artikel wird wieder für KI-RAG indexiert.'
            : 'Artikel wird nicht mehr für KI-RAG indexiert.',
        );
        return;
      }
      try {
        await kbArticleApi.setIndexInRag(liveArticle.id, checked);
        setLiveArticle((prev) => ({ ...prev, index_in_rag: checked }));
        onArticleUpdated(liveArticle.id, { index_in_rag: checked });
        toast.success(
          checked
            ? 'Artikel wird wieder für KI-RAG indexiert.'
            : 'Artikel wird nicht mehr für KI-RAG indexiert.',
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'RAG-Toggle fehlgeschlagen.';
        toast.error(message);
      }
    },
    [liveArticle.id, onArticleUpdated],
  );

  const handleAiExplain = useCallback(async () => {
    if (!isAiSearchReady) {
      throw new Error('Geist AI is not configured. Connect a model in AI Orchestrator settings.');
    }
    return aiAdapter.explainArticleLayout(liveArticle.title, liveArticle.content || '', liveArticle.id);
  }, [aiAdapter, isAiSearchReady, liveArticle.content, liveArticle.id, liveArticle.title]);

  const handleSaveContent = useCallback(
    async (content: string) => {
      if (isSeedArticle(liveArticle.id)) {
        setLiveArticle((prev) => ({ ...prev, content }));
        onArticleUpdated(liveArticle.id, { content });
        return;
      }

      await kbArticleApi.updateArticleFields(liveArticle.id, { content });
      await kbService.updateArticle(liveArticle.id, { content }, liveArticle.tags || []);
      setLiveArticle((prev) => ({ ...prev, content }));
      onArticleUpdated(liveArticle.id, { content });
      void loadHistory();
    },
    [liveArticle.id, liveArticle.tags, loadHistory, onArticleUpdated],
  );

  const handleHelpful = useCallback(async () => {
    const updatedHelpful = (liveArticle.helpfulCount || 0) + 1;
    if (!isSeedArticle(liveArticle.id)) {
      await kbService.updateArticle(liveArticle.id, { helpfulCount: updatedHelpful });
      try {
        const trust = await trustScoreService.getTrustScore(liveArticle.id, liveArticle);
        const updatedInputs = { ...trust.inputs, helpfulCount: updatedHelpful };
        await trustScoreService.updateTrustScore(liveArticle.id, updatedInputs, trust.score, trust.history);
      } catch (error) {
        console.warn('Could not save trust score logs:', error);
      }
    }
    setLiveArticle((prev) => ({ ...prev, helpfulCount: updatedHelpful }));
    onArticleUpdated(liveArticle.id, { helpfulCount: updatedHelpful });
    toast.success('Thank you! Positive rating logged.');
  }, [liveArticle, onArticleUpdated]);

  const handleUnhelpful = useCallback(async () => {
    const updatedUnhelpful = (liveArticle.unhelpfulCount || 0) + 1;
    if (!isSeedArticle(liveArticle.id)) {
      await kbService.updateArticle(liveArticle.id, { unhelpfulCount: updatedUnhelpful });
      try {
        const trust = await trustScoreService.getTrustScore(liveArticle.id, liveArticle);
        const updatedInputs = { ...trust.inputs, unhelpfulCount: updatedUnhelpful };
        await trustScoreService.updateTrustScore(liveArticle.id, updatedInputs, trust.score, trust.history);
      } catch (error) {
        console.warn('Could not save trust score logs:', error);
      }
    }
    setLiveArticle((prev) => ({ ...prev, unhelpfulCount: updatedUnhelpful }));
    onArticleUpdated(liveArticle.id, { unhelpfulCount: updatedUnhelpful });
    toast.success('Feedback recorded. Trust metrics adjusted.');
  }, [liveArticle, onArticleUpdated]);

  return (
    <KBArticleDetailView
      article={liveArticle}
      title={displayTitle}
      htmlContent={displayContent}
      alerts={resolvedAlerts}
      activeReadingLanguage={articleContentLanguage}
      isTranslating={isTranslating}
      infrastructureTrust={infrastructureTrust}
      aiSummary={aiSummary}
      isSummaryLoading={isSummaryLoading}
      relationships={relationships}
      historyEntries={historyEntries}
      isHistoryLoading={isHistoryLoading}
      onBack={onBack}
      onCopyLink={() => onCopyLink(liveArticle.id)}
      onTranslate={handleTranslate}
      onAiExplain={handleAiExplain}
      onRegenerateSummary={handleRegenerateSummary}
      onLoadHistory={loadHistory}
      onSaveContent={handleSaveContent}
      onHelpful={handleHelpful}
      onUnhelpful={handleUnhelpful}
      indexInRag={liveArticle.index_in_rag !== false}
      onToggleIndexInRag={(checked) => void handleToggleIndexInRag(checked)}
    />
  );
}
