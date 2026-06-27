import { useRef, useState, type ChangeEvent } from 'react';
import { 
  Globe, 
  Upload, 
  FileText, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Trash2, 
  Sparkles,
  Link2,
  FileCode,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { kbService } from '../services/kbService';
import { useAuth } from '../lib/hooks';
import { auth } from '../lib/firebase';
import { getSessionToken } from 'firebase/auth';

import { getCachedLegacyAiConfig } from '../lib/aiOrchestratorClient';

interface ProcessingItem {
  id: string;
  name: string;
  type: 'url' | 'file';
  status: 'pending' | 'parsing' | 'ai_processing' | 'saving' | 'staged' | 'completed' | 'error';
  progress: number;
  error?: string;
  category?: string;
  tags?: string[];
  markdown?: string;
  processedTitle?: string;
}

export function KBImporter() {
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  const [items, setItems] = useState<ProcessingItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addItem = (name: string, type: 'url' | 'file') => {
    const newItem: ProcessingItem = {
      id: Math.random().toString(36).substring(7),
      name,
      type,
      status: 'pending',
      progress: 0
    };
    setItems(prev => [newItem, ...prev]);
    return newItem.id;
  };

  const updateItem = (id: string, updates: Partial<ProcessingItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const processContent = async (id: string, title: string, content: string) => {
    try {
      updateItem(id, { status: 'ai_processing', progress: 60 });
      const config = { ai: getCachedLegacyAiConfig() };
      const isGoogle = config.ai.sentimentModel === 'gemini-flash';
      
      const prompt = `You are a technical writer for GeistDesk. Analyze this raw text. 
      1. Clean up formatting. 
      2. Remove ads, navigation, or junk. 
      3. Format it into professional Markdown. 
      4. Suggest 3 relevant tags. 
      5. Suggest which category it belongs to (e.g., Billing, Setup, API).
      
      Original Title: ${title}
      Raw Content: ${content}`;

      let aiData: any = {};

      if (isGoogle) {
        const apiKey = config.ai.apiKey || process.env.GEMINI_API_KEY || "";
        if (!apiKey) {
          throw new Error("Gemini API key is not configured for KB Importer");
        }
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                markdown: { type: Type.STRING },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                category: { type: Type.STRING }
              },
              required: ['title', 'markdown', 'tags', 'category']
            }
          }
        });
        aiData = JSON.parse(response.text || '{}');
      } else {
        const endpoint = config.ai.localEndpoint || "http://localhost:11434/v1";
        const modelName = config.ai.sentimentModel === 'custom-local'
          ? (config.ai.customSentimentModelName || "gemma")
          : (config.ai.sentimentModel === 'local-gemma' ? "gemma" : "llama3");

        const response = await fetch(`${endpoint}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.ai.customApiKey || "ollama"}`
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: "system", content: "You are a professional technical writer and document parser. Respond only with JSON." },
              { role: "user", content: prompt + "\nProvide formatted JSON matching format: { title, markdown, tags: Array<string>, category }." }
            ],
            response_format: { type: "json_object" }
          })
        });
        const rdata = await response.json();
        aiData = JSON.parse(rdata.choices[0].message.content || '{}');
      }

      updateItem(id, { 
        status: 'staged', 
        progress: 100, 
        category: aiData.category, 
        tags: aiData.tags,
        markdown: aiData.markdown,
        processedTitle: aiData.title
      });
      
      toast.success(`Staged: ${aiData.title}`);
    } catch (error) {
      console.error(error);
      updateItem(id, { status: 'error', error: "Failed to process content" });
      toast.error(`Error processing ${title}`);
    }
  };

  const handleApprove = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item || !item.markdown || !item.processedTitle) return;

    try {
      updateItem(id, { status: 'saving', progress: 90 });
      await kbService.createArticle({
        title: item.processedTitle,
        content: item.markdown,
        category: item.category || 'General',
        tags: item.tags || [],
        authorId: user?.uid || 'anonymous'
      });
      updateItem(id, { status: 'completed', progress: 100 });
      toast.success(`Published: ${item.processedTitle}`);
    } catch (error) {
      updateItem(id, { status: 'error', error: "Failed to save" });
    }
  };

  const handleApproveAll = async () => {
    const processable = items.filter(i => i.status === 'staged');
    if (processable.length === 0) return;
    
    toast.info(`Publishing ${processable.length} articles...`);
    for (const item of processable) {
      await handleApprove(item.id);
    }
  };

  const handleCrawl = async () => {
    if (!url) return;
    const id = addItem(url, 'url');
    setUrl('');

    try {
      updateItem(id, { status: 'parsing', progress: 20 });
      const crawlToken = getSessionToken();
      const response = await fetch('/api/kb/crawl', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(crawlToken ? { Authorization: `Bearer ${crawlToken}` } : {})
        },
        body: JSON.stringify({ url })
      });
      
      if (!response.ok) throw new Error("Crawl failed");
      const data = await response.json();
      
      await processContent(id, data.title, data.content);
    } catch (error) {
      updateItem(id, { status: 'error', error: "Could not crawl site" });
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = addItem(file.name, 'file');
      
      try {
        updateItem(id, { status: 'parsing', progress: 20 });
        const formData = new FormData();
        formData.append('file', file);

        const parseToken = getSessionToken();
        const response = await fetch('/api/kb/parse-file', {
          method: 'POST',
          headers: {
            ...(parseToken ? { Authorization: `Bearer ${parseToken}` } : {})
          },
          body: formData
        });

        if (!response.ok) throw new Error("File parse failed");
        const data = await response.json();

        await processContent(id, data.title, data.content);
      } catch (error) {
        updateItem(id, { status: 'error', error: "Failed to read file" });
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Web Crawler Card */}
        <Card className="border-slate-200/60 shadow-sm overflow-hidden group hover:border-blue-200 transition-colors">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-500">
                <Globe className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-800">Crawl Knowledge Source</h3>
            </div>
            <p className="text-xs text-slate-500">Enter a public URL to extract documentation and articles.</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://docs.example.com/guide"
                  className="pl-9 h-11 text-xs border-slate-200 rounded-xl"
                  onKeyDown={(e) => e.key === 'Enter' && handleCrawl()}
                />
              </div>
              <Button 
                onClick={handleCrawl}
                className="h-11 bg-blue-500 hover:bg-blue-600 px-6 rounded-xl font-bold"
              >
                Crawl Site
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* File Importer Card */}
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
              accept=".pdf,.docx,.csv,.md,.txt" 
            />
          </CardContent>
        </Card>
      </div>

      {/* Processing Section */}
      <AnimatePresence>
        {items.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  Knowledge Staging Area
                  <Badge variant="secondary" className="rounded-full px-2">{items.length}</Badge>
                </h3>
                <div className="h-4 w-px bg-slate-200" />
                <p className="text-[10px] text-slate-400 font-bold">Items here are processed by AI and awaiting approval.</p>
              </div>
              <div className="flex items-center gap-2">
                {items.some(i => i.status === 'staged') && (
                  <Button 
                    size="sm" 
                    className="h-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold text-[10px] px-4 shadow-sm"
                    onClick={handleApproveAll}
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Approve All Staged
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-[10px] font-bold text-slate-400 hover:text-rose-500"
                  onClick={() => setItems([])}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear Queue
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {items.map((item) => (
                <Card key={item.id} className={cn(
                  "border-slate-100 shadow-sm overflow-hidden transition-all",
                  item.status === 'staged' && "border-l-4 border-l-blue-500 bg-blue-50/20"
                )}>
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
                          <Loader2 className={cn("w-5 h-5", item.status !== 'staged' && "animate-spin")} />
                        </div>
                      )}

                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-800 line-clamp-1">
                                {item.processedTitle || item.name}
                              </span>
                              {item.category && (
                                <Badge className="bg-blue-100 text-blue-700 border-none text-[9px] font-black tracking-widest px-1.5 h-4 uppercase">
                                  {item.category}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                {item.type === 'url' ? <Globe className="w-3 h-3" /> : <FileCode className="w-3 h-3" />}
                                {item.status.replace('_', ' ')}
                              </span>
                              {item.tags && (
                                <div className="flex gap-1">
                                  {item.tags.map((t, idx) => (
                                    <span key={idx} className="text-[10px] text-blue-500 font-bold">#{t}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {item.status === 'staged' && (
                              <Button 
                                size="sm" 
                                className="h-8 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] px-4 rounded-lg"
                                onClick={() => handleApprove(item.id)}
                              >
                                Approve & Save
                              </Button>
                            )}
                            <span className="text-xs font-black text-slate-800">{item.progress}%</span>
                          </div>
                        </div>
                        <Progress value={item.progress} className="h-1.5 rounded-full bg-slate-50" />
                        {item.error && <p className="text-[10px] text-rose-500 font-bold">{item.error}</p>}
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
