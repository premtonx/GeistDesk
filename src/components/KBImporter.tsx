import { useRef, useState, type ChangeEvent } from 'react';
import {
  Globe,
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  Trash2,
  Link2,
  FileCode,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { kbIngestionApi } from '../services/kbIngestionApi';
import type { KBCategoryRecord } from './kb/kbCategoryUtils';

interface ProcessingItem {
  id: string;
  name: string;
  type: 'url' | 'file';
  status: 'pending' | 'parsing' | 'saving' | 'completed' | 'error';
  progress: number;
  error?: string;
  category?: string;
  articleId?: string;
  processedTitle?: string;
}

interface KBImporterProps {
  categories?: KBCategoryRecord[];
}

export function KBImporter({ categories = [] }: KBImporterProps) {
  const [url, setUrl] = useState('');
  const [items, setItems] = useState<ProcessingItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('uncategorized');
  const [publishStatus, setPublishStatus] = useState<'draft' | 'published'>('draft');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addItem = (name: string, type: 'url' | 'file') => {
    const newItem: ProcessingItem = {
      id: Math.random().toString(36).substring(7),
      name,
      type,
      status: 'pending',
      progress: 0,
    };
    setItems((prev) => [newItem, ...prev]);
    return newItem.id;
  };

  const updateItem = (id: string, updates: Partial<ProcessingItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const handleCrawl = async () => {
    if (!url) return;
    const targetUrl = url;
    const id = addItem(targetUrl, 'url');
    setUrl('');

    try {
      updateItem(id, { status: 'parsing', progress: 25 });
      const result = await kbIngestionApi.scrapeUrl(targetUrl, {
        category: selectedCategory,
        status: publishStatus,
        save: true,
      });

      updateItem(id, {
        status: 'completed',
        progress: 100,
        processedTitle: result.title,
        category: result.category,
        articleId: result.articleId,
      });
      toast.success(`Saved article: ${result.title}`);
    } catch (error) {
      updateItem(id, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Could not crawl site',
      });
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const id = addItem(file.name, 'file');

      try {
        updateItem(id, { status: 'parsing', progress: 25 });
        const result = await kbIngestionApi.uploadFile(file, {
          category: selectedCategory,
          status: publishStatus,
          save: true,
        });

        updateItem(id, {
          status: 'completed',
          progress: 100,
          processedTitle: result.title,
          category: result.category,
          articleId: result.articleId,
        });
        toast.success(`Saved article: ${result.title}`);
      } catch (error) {
        updateItem(id, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Failed to read file',
        });
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Category</Label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full h-10 border rounded-xl bg-white px-3 text-sm font-medium"
          >
            <option value="uncategorized">Uncategorized</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Save as</Label>
          <select
            value={publishStatus}
            onChange={(e) => setPublishStatus(e.target.value as 'draft' | 'published')}
            className="w-full h-10 border rounded-xl bg-white px-3 text-sm font-medium"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-slate-200/60 shadow-sm overflow-hidden group hover:border-blue-200 transition-colors">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-500">
                <Globe className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-800">Crawl Knowledge Source</h3>
            </div>
            <p className="text-xs text-slate-500">Enter a public URL to extract documentation and save it as a KB article.</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://docs.example.com/guide"
                  className="pl-9 h-11 text-xs border-slate-200 rounded-xl"
                  onKeyDown={(e) => e.key === 'Enter' && void handleCrawl()}
                />
              </div>
              <Button onClick={() => void handleCrawl()} className="h-11 bg-blue-500 hover:bg-blue-600 px-6 rounded-xl font-bold">
                Crawl Site
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card
          className="border-2 border-dashed border-slate-200 bg-slate-50/50 hover:bg-white hover:border-indigo-200 transition-all cursor-pointer overflow-hidden group"
          onClick={() => fileInputRef.current?.click()}
        >
          <CardContent className="p-6 h-full flex flex-col items-center justify-center text-center space-y-3">
            <div className="p-3 bg-white rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
              <Upload className="w-6 h-6 text-indigo-500" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-800">Upload Knowledge Files</h3>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">PDF, DOCX, CSV, MD, TXT</p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              multiple
              accept=".pdf,.docx,.csv,.md,.txt,application/pdf,text/plain,text/csv,text/markdown"
            />
          </CardContent>
        </Card>
      </div>

      <AnimatePresence>
        {items.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                Ingestion Queue
                <Badge variant="secondary" className="rounded-full px-2">
                  {items.length}
                </Badge>
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-[10px] font-bold text-slate-400 hover:text-rose-500"
                onClick={() => setItems([])}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear Queue
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {items.map((item) => (
                <Card key={item.id} className="border-slate-100 shadow-sm overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {item.status === 'completed' ? (
                        <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                          <CheckCircle className="w-5 h-5" />
                        </div>
                      ) : item.status === 'error' ? (
                        <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
                          <AlertCircle className="w-5 h-5" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                          <Loader2 className="w-5 h-5 animate-spin" />
                        </div>
                      )}

                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-800 line-clamp-1">
                                {item.processedTitle || item.name}
                              </span>
                              {item.category ? (
                                <Badge className="bg-blue-100 text-blue-700 border-none text-[9px] font-black tracking-widest px-1.5 h-4 uppercase">
                                  {item.category}
                                </Badge>
                              ) : null}
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                              {item.type === 'url' ? <Globe className="w-3 h-3" /> : <FileCode className="w-3 h-3" />}
                              {item.status}
                              {item.articleId ? ` · ${item.articleId}` : ''}
                            </span>
                          </div>
                          <span className="text-xs font-black text-slate-800">{item.progress}%</span>
                        </div>
                        <Progress value={item.progress} className="h-1.5 rounded-full bg-slate-50" />
                        {item.error ? <p className="text-[10px] text-rose-500 font-bold">{item.error}</p> : null}
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-300 hover:text-rose-500"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
