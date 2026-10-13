import React, { useState, useEffect } from 'react';
import { Search, BookOpen, ChevronRight, ArrowRight, MessageCircle } from 'lucide-react';
import { kbService } from '../../services/kbService';
import { KBArticle } from '../../types';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';

export default function HelpCenterPage() {
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchArticles = async () => {
      setLoading(true);
      const data = await kbService.getPublicArticles();
      setArticles(data);
      setLoading(false);
    };
    fetchArticles();
  }, []);

  const filteredArticles = articles.filter(a => 
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="bg-slate-50 border-b border-slate-100 py-20 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h1 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight">
            How can we help you?
          </h1>
          <div className="relative max-w-2xl mx-auto group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
            <Input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for articles, guides, and more..."
              className="h-16 pl-14 pr-6 text-lg rounded-2xl border-slate-200 shadow-xl shadow-blue-500/5 focus:ring-4 focus:ring-blue-100 transition-all border-none bg-white"
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto py-16 px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loading ? (
            Array(6).fill(0).map((_, i) => (
              <Card key={i} className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
                <CardContent className="p-6 space-y-4">
                  <Skeleton className="h-4 w-1/4 rounded-full" />
                  <Skeleton className="h-8 w-3/4" />
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))
          ) : filteredArticles.length > 0 ? (
            filteredArticles.map(article => (
              <Card key={article.id} className="rounded-3xl border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group">
                <CardContent className="p-8 space-y-6">
                  <Badge className="bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-bold uppercase tracking-widest px-3 h-6 rounded-full group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all">
                    {article.category}
                  </Badge>
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors">
                      {article.title}
                    </h3>
                    <p className="text-slate-500 text-sm leading-relaxed line-clamp-3">
                      {article.content.replace(/<[^>]*>?/gm, '')}
                    </p>
                  </div>
                  <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 capitalize">
                      {article.createdAt?.toDate ? article.createdAt.toDate().toLocaleDateString() : 'Today'}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-200 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full py-20 text-center space-y-4">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                <Search className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">No public articles found matching your search.</p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Contact Support */}
      <div className="fixed bottom-10 right-10">
        <button className="bg-blue-600 text-white rounded-full p-4 shadow-2xl flex items-center gap-3 pr-6 hover:scale-105 active:scale-95 transition-all group">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <MessageCircle className="w-6 h-6" />
          </div>
          <span className="font-bold">Contact Support</span>
        </button>
      </div>
    </div>
  );
}
