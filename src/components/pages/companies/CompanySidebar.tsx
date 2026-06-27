import { useMemo, type MouseEvent } from 'react';
import { 
  Building2, 
  Search, 
  Plus, 
  Upload, 
  RefreshCw, 
  Star, 
  ChevronRight, 
  SlidersHorizontal,
  FolderHeart
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Company, Ticket } from '../../../types';
import { hydrateCompany } from './utils';
import { motion } from 'framer-motion';
import { useTranslation } from '../../../lib/context/I18nContext';
import { cn } from '../../../lib/utils';

interface CompanySidebarProps {
  companies: Company[];
  selectedCompanyId: string | null;
  onSelectCompany: (id: string) => void;
  favorites: string[];
  onToggleFavorite: (id: string, e: MouseEvent) => void;
  activeFilter: string;
  setActiveFilter: (filter: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onAddCompanyClick: () => void;
  onImportClick: () => void;
  onSeedClick: () => void;
  isSeeding: boolean;
  ticketHistoryMap: Record<string, Ticket[]>;
}

export default function CompanySidebar({
  companies,
  selectedCompanyId,
  onSelectCompany,
  favorites,
  onToggleFavorite,
  activeFilter,
  setActiveFilter,
  searchQuery,
  setSearchQuery,
  onAddCompanyClick,
  onImportClick,
  onSeedClick,
  isSeeding,
  ticketHistoryMap
}: CompanySidebarProps) {
  const { t } = useTranslation();

  // Hydrate all companies for listing
  const hydratedCompanies = useMemo(() => {
    return companies.map(c => {
      const tickets = ticketHistoryMap[c.id] || [];
      return hydrateCompany(c, tickets)!;
    });
  }, [companies, ticketHistoryMap]);

  // Filter accounts
  const filteredCompanies = useMemo(() => {
    return hydratedCompanies.filter(c => {
      // Search matching
      const matchesSearch = 
         c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
         c.domain.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;

      // Filter category matching
      if (activeFilter === 'all') return true;
      if (activeFilter === 'enterprise') return c.tier === 'Enterprise';
      if (activeFilter === 'pro') return c.tier === 'Pro';
      if (activeFilter === 'expiring') return c.contractStatus === 'EXPIRED';
      if (activeFilter === 'slarisk') return c.healthStatus === 'SLA Risk';
      if (activeFilter === 'active') return c.openTicketsCount > 0;
      return true;
    });
  }, [hydratedCompanies, activeFilter, searchQuery]);

  // Calculate counts dynamically
  const filterCounts = useMemo(() => {
    return {
      all: hydratedCompanies.length,
      enterprise: hydratedCompanies.filter(c => c.tier === 'Enterprise').length,
      pro: hydratedCompanies.filter(c => c.tier === 'Pro').length,
      expiring: hydratedCompanies.filter(c => c.contractStatus === 'EXPIRED').length,
      slarisk: hydratedCompanies.filter(c => c.healthStatus === 'SLA Risk').length,
      active: hydratedCompanies.filter(c => c.openTicketsCount > 0).length
    };
  }, [hydratedCompanies]);

  const pinnedCompanies = useMemo(() => {
    return hydratedCompanies.filter(c => favorites.includes(c.id));
  }, [hydratedCompanies, favorites]);

  const standardCompanies = useMemo(() => {
    return hydratedCompanies.filter(c => !favorites.includes(c.id));
  }, [hydratedCompanies, favorites]);

  return (
    <div className={cn(
      "w-full lg:w-[360px] shrink-0 border-r flex-col bg-background min-h-0 select-none",
      // Master-detail on mobile: the list takes the full screen until a company
      // is picked, then it yields to the detail view (still side-by-side on lg+).
      selectedCompanyId ? "hidden lg:flex" : "flex"
    )}>
      {/* Search and Action Row */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-extrabold tracking-tight text-foreground">{t('nav.companies', 'Companies')}</h1>
          </div>
          <div className="flex gap-1 items-center">
            {companies.length === 0 && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onSeedClick} 
                disabled={isSeeding}
                className="h-8 w-8 rounded-full hover:bg-amber-50 text-amber-600 transition-all"
                title={t('companies.seedPlaceholder', 'Seed Sample Database')}
              >
                <RefreshCw className={`w-4 h-4 ${isSeeding ? 'animate-spin' : ''}`} />
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onImportClick} 
              className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground"
              title={t('companies.importCsv', 'Import CSV')}
            >
              <Upload className="w-4 h-4" />
            </Button>
            <Button 
              type="button"
              onClick={onAddCompanyClick}
              className="h-8 gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3.5 rounded-lg text-xs font-bold shadow-sm shadow-blue-600/10 transition-all hover:scale-[1.02] active:scale-95 shrink-0 cursor-pointer"
              title={t('companies.createCompany', 'Create Company')}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('actions.create', 'Create')}</span>
            </Button>
          </div>
        </div>

        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder={t('companies.searchPlaceholder', 'Search companies...')} 
              className="pl-9 pr-3 h-9 bg-muted/40 border border-muted-foreground/10 rounded-xl text-xs focus-visible:ring-1 focus-visible:ring-primary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-muted-foreground/15 text-muted-foreground shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Navigation & List Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        
        {/* Pinned / Favorites */}
        {pinnedCompanies.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 px-2 text-[10px] font-bold text-amber-500 uppercase tracking-wider">
              <Star className="w-3 h-3 fill-amber-500 text-amber-500 animate-pulse" />
              <span>{t('companies.favorites', 'Favorites')}</span>
            </div>
            <div className="space-y-1">
              {pinnedCompanies.map(c => (
                <CompanyCard 
                  key={c.id}
                  company={c}
                  isSelected={selectedCompanyId === c.id}
                  isStarred={true}
                  onSelect={() => onSelectCompany(c.id)}
                  onToggleStar={(e) => onToggleFavorite(c.id, e)}
                />
              ))}
            </div>
          </div>
        )}

        {/* All Companies */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3 h-3" />
              {t('companies.allCompanies', 'All Companies')}
            </span>
            <Badge variant="ghost" className="h-4 px-1.5 text-[9px] font-extrabold bg-muted text-muted-foreground rounded-full border-none">
              {filterCounts.all}
            </Badge>
          </div>

          {filteredCompanies.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground font-semibold italic">
              {t('companies.noCompaniesMatchingFilter', 'No companies matching filter')}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredCompanies.map(c => (
                <CompanyCard 
                  key={c.id}
                  company={c}
                  isSelected={selectedCompanyId === c.id}
                  isStarred={favorites.includes(c.id)}
                  onSelect={() => onSelectCompany(c.id)}
                  onToggleStar={(e) => onToggleFavorite(c.id, e)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Dynamic Filters Section */}
        <div className="pt-2 border-t border-muted/85 space-y-1.5">
          <div className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            {t('companies.filters', 'Filters')}
          </div>
          <div className="space-y-0.5 text-xs text-muted-foreground font-semibold">
            {[
              { id: 'all', label: t('companies.allCompaniesFilter', 'All companies'), count: filterCounts.all },
              { id: 'enterprise', label: fCountString(filterCounts.enterprise, t('companies.enterpriseFilter', 'Enterprise')), count: filterCounts.enterprise },
              { id: 'pro', label: fCountString(filterCounts.pro, t('companies.proFilter', 'Pro')), count: filterCounts.pro },
              { id: 'expiring', label: t('companies.contractExpiringFilter', 'Contract expiring'), count: filterCounts.expiring, colorClass: filterCounts.expiring > 0 ? 'text-rose-500 font-bold' : '' },
              { id: 'slarisk', label: t('companies.slaRiskFilter', 'SLA risk'), count: filterCounts.slarisk, colorClass: filterCounts.slarisk > 0 ? 'text-amber-500 font-bold' : '' },
              { id: 'active', label: t('companies.recentlyActiveFilter', 'Recently active'), count: filterCounts.active }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-all text-left ${
                  activeFilter === f.id 
                    ? 'bg-primary/5 text-primary font-bold' 
                    : 'hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                <span className={f.colorClass}>{f.label}</span>
                <span className={`text-[10px] ${activeFilter === f.id ? 'text-primary' : 'text-muted-foreground'}`}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function fCountString(cnt: number, label: string) {
  return label;
}

// Inner helper company card component
function CompanyCard({ 
  company, 
  isSelected, 
  isStarred, 
  onSelect, 
  onToggleStar 
}: { 
  company: any; 
  isSelected: boolean; 
  isStarred: boolean; 
  onSelect: () => void;
  onToggleStar: (e: MouseEvent) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      onClick={onSelect}
      className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 group border border-transparent ${
        isSelected 
          ? 'bg-primary/5 border-primary/20 text-foreground shadow-sm' 
          : 'hover:bg-muted/50'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Logo/Avatar */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm overflow-hidden shrink-0 border border-muted shadow-xs bg-muted/10 relative">
          {company.logoUrl ? (
            <img src={company.logoUrl} alt={company.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
          ) : (
            <span className="text-muted-foreground">{company.name.charAt(0)}</span>
          )}
        </div>

        {/* Details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1.5">
            <p className="font-bold text-xs truncate leading-snug text-foreground">
              {company.name}
            </p>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground font-semibold">
            <span>{t('companies.openTicketsWithCount', '{{count}} open tickets').replace('{{count}}', String(company.openTicketsCount))}</span>
            <span>•</span>
            <span className="font-bold text-primary">{company.tier}</span>
          </div>
        </div>
      </div>

      {/* Health Status badge or star */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Show active indicators */}
        {company.healthStatus === 'SLA Risk' && (
          <Badge className="text-[7px] font-extrabold bg-rose-500/10 hover:bg-rose-500/10 text-rose-500 border-none uppercase rounded-full px-1.5 h-4 tracking-wider">
            {t('companies.slaRiskFilter', 'SLA RISK')}
          </Badge>
        )}
        {company.healthStatus === 'Healthy' && (
          <Badge className="text-[7px] font-extrabold bg-emerald-500/10 hover:bg-emerald-500/10 text-emerald-500 border-none uppercase rounded-full px-1.5 h-4 tracking-wider">
            {t('companies.healthy', 'HEALTHY')}
          </Badge>
        )}
        {company.healthStatus === 'Contract Expiring' && (
          <Badge className="text-[7px] font-extrabold bg-amber-500/10 hover:bg-amber-500/10 text-amber-500 border-none uppercase rounded-full px-1.5 h-4 tracking-wider">
            {t('companies.contractExpiringFilter', 'EXPIRED')}
          </Badge>
        )}

        <button 
          onClick={onToggleStar}
          className="p-1 rounded-md text-muted-foreground/30 hover:text-amber-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
        >
          <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-amber-500 text-amber-500 opacity-100' : ''}`} />
        </button>
      </div>
    </div>
  );
}
