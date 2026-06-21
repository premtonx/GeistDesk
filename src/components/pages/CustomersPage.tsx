import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Plus, 
  Sparkles, 
  RefreshCw,
  Key,
  Users,
  Edit3,
  Search,
  Upload,
  BookOpen,
  X,
  Trash2,
  Shield,
  Mail,
  Phone,
  User,
  MapPin,
  Clock,
  Briefcase,
  Layers,
  ExternalLink,
  Check,
  Lock,
  Building,
  ArrowRight,
  Globe
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '../../components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';

// Services
import { customerService } from '../../services/customerService';
import { ticketService } from '../../services/ticketService';
import { schemaService, CustomField } from '../../services/schemaService';
import { aiAccountService } from '../../services/aiAccountService';
import { Company, Contact, Ticket } from '../../types';

// Subcomponents
import CompanySidebar from './companies/CompanySidebar';
import CompanyHeader from './companies/CompanyHeader';
import CompanyKPI from './companies/CompanyKPI';
import CompanyOverviewTab from './companies/CompanyOverviewTab';
import CompanyOtherTabs from './companies/CompanyOtherTabs';
import { hydrateCompany } from './companies/utils';
import CSVImporter from '../CSVImporter';
import { useTranslation } from '../../lib/context/I18nContext';

const BRANCHES = ['Tech', 'Finance', 'Healthcare', 'Manufacturing', 'Retail', 'Services', 'Other'];

export default function CustomersPage() {
  const { t } = useTranslation();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  
  const [employees, setEmployees] = useState<Contact[]>([]);
  const [ticketHistory, setTicketHistory] = useState<Ticket[]>([]);
  
  // Tracks all loaded tickets by company ID, to support dynamic ticket badge counts in sidebar
  const [ticketHistoryMap, setTicketHistoryMap] = useState<Record<string, Ticket[]>>({});

  const [activeSubTab, setActiveSubTab] = useState('overview');
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dialog controls
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  const [contactSchema, setContactSchema] = useState<CustomField[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Pin / Favorite accounts
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('geistdesk_favorite_companies_v2');
    return saved ? JSON.parse(saved) : [];
  });

  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => {
      const isFav = prev.includes(id);
      const next = isFav ? prev.filter(item => item !== id) : [...prev, id];
      localStorage.setItem('geistdesk_favorite_companies_v2', JSON.stringify(next));
      if (!isFav) {
        toast.info("Company pinned to Favorites list!");
      } else {
        toast.info("Company unpinned from Favorites.");
      }
      return next;
    });
  };

  // Forms states
  const [newCompany, setNewCompany] = useState({
    name: '',
    domain: '',
    website: '',
    logoUrl: '',
    branche: 'Tech' as any,
    companySize: '201–500',
    tier: 'Enterprise',
    primaryContactName: 'John Smith',
    primaryContactEmail: 'john.smith@acme.com',
    primaryContactPhone: '+49 123 456 7890',
    primaryContactTitle: 'IT Director',
    country: 'Germany',
    timezone: 'Europe/Berlin (GMT+2)',
    address: 'Friedrichstraße 123, 10117 Berlin, Germany',
    accountOwner: 'Sarah James',
    internalNotes: 'Strategic enterprise customer. Uses managed IT and cloud services. Priority support contract in place.',
    wartungsvertragStatus: 'Active' as any,
    healthScore: 85,
    contractPlan: 'Enterprise Plus',
    contractSla: '4h response',
    contractRenewalDate: 'Jan 12, 2027 (218 days)',
    monthlySpend: '€4,520',
    usersCount: 142,
    assetsCount: 87,
    vaultEntriesCount: 23,
    slaPerformance: '99.8%'
  });

  const [newContact, setNewContact] = useState<any>({
    name: '',
    email: '',
    title: '',
    phoneWork: '',
    phoneMobile: '',
    metadata: {}
  });

  const [editCompanyData, setEditCompanyData] = useState<any>({});
  const [draggingFile, setDraggingFile] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const urlId = searchParams.get('id');
  const navigate = useNavigate();

  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      const nextQuery: Record<string, string> = {};
      if (urlId) nextQuery.id = urlId;
      setSearchParams(nextQuery, { replace: true });
      setIsCreateDialogOpen(true);
    }
  }, [searchParams, setSearchParams, urlId]);

  // Load basic custom schemas
  useEffect(() => {
    schemaService.getContactSchema().then(setContactSchema);
  }, []);

  // Subscribe to all companies in the DB
  useEffect(() => {
    return customerService.subscribeToCompanies((data) => {
      setCompanies(data);
      if (data.length > 0) {
        if (urlId && data.find(c => c.id === urlId)) {
          setSelectedCompanyId(urlId);
        } else if (!selectedCompanyId) {
          setSelectedCompanyId(data[0].id);
        }
      }
    });
  }, [urlId]);

  // Handle active selected company state
  useEffect(() => {
    if (selectedCompanyId) {
      const baseComp = companies.find(c => c.id === selectedCompanyId) || null;
      setSelectedCompany(baseComp);

      // Subscribe to contacts for this company
      const unsubscribeContacts = customerService.subscribeToContacts(selectedCompanyId, (data) => {
        setEmployees(data);
      });

      // Subscribe to ticket history for this company
      const unsubscribeTickets = ticketService.subscribeToTicketsByCompany(selectedCompanyId, (data) => {
        setTicketHistory(data);
        setTicketHistoryMap(prev => ({ ...prev, [selectedCompanyId]: data }));
      });

      return () => {
        unsubscribeContacts();
        unsubscribeTickets();
      };
    }
  }, [selectedCompanyId, companies]);

  // Seeding high-fidelity mockup companies and authors
  const seedSampleData = async () => {
    setIsSeeding(true);
    try {
      // 1. Acme Global Solutions
      const acmeId = await customerService.createCompany({
        name: "Acme Global Solutions",
        domain: "acme.com",
        website: "www.acme.com",
        logoUrl: "https://logo.clearbit.com/acme.com",
        branche: "Manufacturing",
        wartungsvertragStatus: "Active",
        phoneNumbers: ["+1 555-0199"],
        tier: "Enterprise",
        healthScore: 92,
        healthStatus: "Healthy",
        accountOwner: "Sarah James",
        contractPlan: "Enterprise Plus",
        contractSla: "4h response",
        contractRenewalDate: "Jan 12, 2027 (218 days)",
        contractStatus: "ACTIVE",
        usersCount: 142,
        assetsCount: 87,
        vaultEntriesCount: 23,
        slaPerformance: "99.8%",
        monthlySpend: "€4,520",
        customerSince: "Jan 12, 2021"
      } as any);

      await customerService.createContact({
        companyId: acmeId,
        name: "Wile E. Coyote",
        email: "wile@acme.com",
        title: "Head of R&D",
        phoneWork: "+1 555-0200",
        address: "Canyon Deserts Road, AZ"
      });

      await customerService.createContact({
        companyId: acmeId,
        name: "Road Runner",
        email: "beep@acme.com",
        title: "Fastest Delivery Specialist",
        phoneMobile: "+1 555-0300"
      });

      // 2. FinStream Inc.
      const finstreamId = await customerService.createCompany({
        name: "FinStream Inc.",
        domain: "finstream.com",
        website: "www.finstream.com",
        logoUrl: "https://logo.clearbit.com/finstream.com",
        branche: "Finance",
        wartungsvertragStatus: "Active",
        phoneNumbers: ["+1 555-0210"],
        tier: "Pro",
        healthScore: 85,
        healthStatus: "Healthy",
        accountOwner: "Sarah James",
        contractPlan: "Pro Support",
        contractSla: "8h response",
        contractRenewalDate: "Mar 10, 2027",
        contractStatus: "ACTIVE",
        usersCount: 45,
        assetsCount: 32,
        vaultEntriesCount: 12,
        slaPerformance: "98.5%",
        monthlySpend: "€2,100",
        customerSince: "Feb 20, 2022"
      } as any);

      await customerService.createContact({
        companyId: finstreamId,
        name: "Thomas Sterling",
        email: "t.sterling@finstream.com",
        title: "VP of Enterprise Security",
        phoneWork: "+1 555-0212"
      });

      // 3. CyberDyne Systems
      const cyberId = await customerService.createCompany({
        name: "CyberDyne Systems",
        domain: "cyberdyne.jp",
        website: "www.cyberdyne.jp",
        logoUrl: "https://logo.clearbit.com/cyberdyne.jp",
        branche: "Manufacturing",
        wartungsvertragStatus: "Active",
        phoneNumbers: ["+81 3-1234-5678"],
        tier: "Enterprise",
        healthScore: 42,
        healthStatus: "SLA Risk",
        accountOwner: "Mike Chen",
        contractPlan: "Enterprise Premium",
        contractSla: "2h response",
        contractRenewalDate: "Aug 15, 2026",
        contractStatus: "ACTIVE",
        usersCount: 198,
        assetsCount: 254,
        vaultEntriesCount: 48,
        slaPerformance: "92.1%",
        monthlySpend: "€8,900",
        customerSince: "Jul 11, 2020"
      } as any);

      await customerService.createContact({
        companyId: cyberId,
        name: "Sarah Connor",
        email: "s.connor@cyberdyne.jp",
        title: "Security Consultant",
        phoneWork: "+81 3-9876-5432"
      });

      // 4. Globex Corporation
      const globexId = await customerService.createCompany({
        name: "Globex Corporation",
        domain: "globex.com",
        website: "www.globex.com",
        logoUrl: "https://logo.clearbit.com/globex.com",
        branche: "Other",
        wartungsvertragStatus: "Active",
        phoneNumbers: ["+1 555-0300"],
        tier: "Enterprise",
        healthScore: 78,
        healthStatus: "Healthy",
        accountOwner: "Mike Chen",
        contractPlan: "Enterprise Standard",
        contractSla: "4h response",
        contractRenewalDate: "Nov 20, 2026",
        contractStatus: "ACTIVE",
        usersCount: 88,
        assetsCount: 41,
        vaultEntriesCount: 15,
        slaPerformance: "96.4%",
        monthlySpend: "€3,200",
        customerSince: "Mar 05, 2021"
      } as any);

      // 5. Initech
      const initechId = await customerService.createCompany({
        name: "Initech",
        domain: "initech.com",
        website: "www.initech.com",
        logoUrl: "https://logo.clearbit.com/initech.com",
        branche: "Services",
        wartungsvertragStatus: "Active",
        phoneNumbers: ["+1 555-0450"],
        tier: "Pro",
        healthScore: 94,
        healthStatus: "Healthy",
        accountOwner: "Sarah James",
        contractPlan: "Pro Support Plan",
        contractSla: "12h response",
        contractRenewalDate: "Dec 05, 2026",
        contractStatus: "ACTIVE",
        usersCount: 24,
        assetsCount: 15,
        vaultEntriesCount: 8,
        slaPerformance: "99.1%",
        monthlySpend: "€1,250",
        customerSince: "Oct 19, 2023"
      } as any);

      // 6. Umbrella Corp
      const umbrellaId = await customerService.createCompany({
        name: "Umbrella Corp",
        domain: "umbrellacorp.com",
        website: "www.umbrellacorp.com",
        logoUrl: "https://logo.clearbit.com/umbrellacorp.com",
        branche: "Healthcare",
        wartungsvertragStatus: "Expired",
        phoneNumbers: ["+1 555-0999"],
        tier: "Enterprise",
        healthScore: 30,
        healthStatus: "Contract Expiring",
        accountOwner: "Mike Chen",
        contractPlan: "Enterprise Gold",
        contractSla: "4h response",
        contractRenewalDate: "May 01, 2026",
        contractStatus: "EXPIRED",
        usersCount: 350,
        assetsCount: 512,
        vaultEntriesCount: 92,
        slaPerformance: "88.2%",
        monthlySpend: "€12,500",
        customerSince: "Apr 01, 2018"
      } as any);

      // Auto pin Acme Global is standard seed favorites behavior
      setFavorites([acmeId]);
      localStorage.setItem('geistdesk_favorite_companies_v2', JSON.stringify([acmeId]));

      toast.success("Redesigned mockup directory (Initech, CyberDyne, Globex, Acme) seeded completely!");
      setSelectedCompanyId(acmeId);
    } catch (e) {
      toast.error("Failed to seed sample environment");
    } finally {
      setIsSeeding(false);
    }
  };

  // Submit edits back to firebase
  const handleEditCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) return;
    setIsSaving(true);
    try {
      await customerService.updateCompany(selectedCompanyId, {
        ...editCompanyData,
        updatedAt: new Date()
      });
      setIsEditDialogOpen(false);
      toast.success("Support account metrics updated successfully!");
    } catch (error) {
      toast.error("Failed to update company information");
    } finally {
      setIsSaving(false);
    }
  };

  // Automated field helper for domain changes
  const handleDomainChange = (val: string) => {
    const dLower = val.toLowerCase().replace(/\s+/g, '');
    setNewCompany(prev => {
      const isAutoFilled = !prev.website || prev.website.includes(prev.domain) || prev.website === "https://www." || prev.website === "";
      return {
        ...prev,
        domain: dLower,
        website: isAutoFilled && dLower ? `https://www.${dLower}` : prev.website
      };
    });
  };

  // Smart enrichment simulation
  const handleSmartEnrich = () => {
    if (!newCompany.domain) {
      toast.error("Please enter a domain first (e.g. stripe.com)");
      return;
    }
    setIsEnriching(true);
    const toastId = toast.loading("Invoking Company360 Enrichment APIs...");
    
    setTimeout(() => {
      const dLower = newCompany.domain.toLowerCase().trim();
      let enrichedData: any = {};
      
      if (dLower.includes('stripe')) {
        enrichedData = {
          name: "Stripe, Inc.",
          branche: "Finance",
          companySize: "1000+",
          tier: "Enterprise",
          website: "https://www.stripe.com",
          country: "United States",
          timezone: "US/Pacific (GMT-8)",
          address: "354 Oyster Point Blvd, South San Francisco, CA 94080, USA",
          logoUrl: "https://logo.clearbit.com/stripe.com",
          internalNotes: "Tier-1 high volume online payment terminal aggregator. Linked infrastructure VPC.",
          primaryContactName: "John Collison",
          primaryContactEmail: "john@stripe.com",
          primaryContactTitle: "Co-Founder",
          primaryContactPhone: "+1 650 435 0000"
        };
      } else if (dLower.includes('google')) {
        enrichedData = {
          name: "Google LLC",
          branche: "Tech",
          companySize: "1000+",
          tier: "Enterprise",
          website: "https://www.google.com",
          country: "United States",
          timezone: "US/Pacific (GMT-8)",
          address: "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA",
          logoUrl: "https://logo.clearbit.com/google.com",
          internalNotes: "Strategic multi-national search, hardware & cloud provider. High contract MSP client.",
          primaryContactName: "Sundar Pichai",
          primaryContactEmail: "sundar@google.com",
          primaryContactTitle: "CEO",
          primaryContactPhone: "+1 650 253 0000"
        };
      } else if (dLower.includes('microsoft')) {
        enrichedData = {
          name: "Microsoft Corporation",
          branche: "Tech",
          companySize: "1000+",
          tier: "Enterprise",
          website: "https://www.microsoft.com",
          country: "United States",
          timezone: "US/Pacific (GMT-8)",
          address: "One Microsoft Way, Redmond, WA 98052, USA",
          logoUrl: "https://logo.clearbit.com/microsoft.com",
          internalNotes: "Standard enterprise accounts suite. Deployed across hybrid Azure instances.",
          primaryContactName: "Satya Nadella",
          primaryContactEmail: "satya@microsoft.com",
          primaryContactTitle: "CEO",
          primaryContactPhone: "+1 425 882 8080"
        };
      } else if (dLower.includes('acme')) {
        enrichedData = {
          name: "Acme Global Solutions",
          branche: "Tech",
          companySize: "201–500",
          tier: "Enterprise",
          website: "https://www.acme.com",
          country: "Germany",
          timezone: "Europe/Berlin (GMT+2)",
          address: "Friedrichstraße 123, 10117 Berlin, Germany",
          logoUrl: "",
          internalNotes: "Prioritized industrial manufacturing systems vendor. Active SLA monitoring contract.",
          primaryContactName: "John Smith",
          primaryContactEmail: "john.smith@acme.com",
          primaryContactTitle: "IT Director",
          primaryContactPhone: "+49 123 456 7890"
        };
      } else {
        const prefix = dLower.split('.')[0];
        const capName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
        enrichedData = {
          name: `${capName} Technologies`,
          branche: "Tech",
          companySize: "51–200",
          tier: "Pro",
          website: `https://www.${dLower}`,
          country: "United Kingdom",
          timezone: "Europe/London (GMT+1)",
          address: `10 Bruton St, London W1J 6PX, UK`,
          logoUrl: `https://logo.clearbit.com/${dLower}`,
          internalNotes: `Enriched via standard intelligence registry API. Domain registered under ${dLower}.`,
          primaryContactName: "Jane Doe",
          primaryContactEmail: `jane@${dLower}`,
          primaryContactTitle: "CTO",
          primaryContactPhone: "+44 20 7946 0192"
        };
      }

      setNewCompany(prev => ({
        ...prev,
        ...enrichedData
      }));
      toast.dismiss(toastId);
      toast.success("Intelligence record loaded! Form auto-populated.");
      setIsEnriching(false);
    }, 1000);
  };

  // Logo file drag operations
  const handleLogoFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file (PNG, JPG, SVG)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setNewCompany(prev => ({
          ...prev,
          logoUrl: e.target.result as string
        }));
        toast.success("Design asset / Logo saved dynamically!");
      }
    };
    reader.readAsDataURL(file);
  };

  // Create standard company
  const handleCreateCompany = async (e: React.FormEvent, isDraft = false) => {
    if (e) e.preventDefault();
    if (!newCompany.name || !newCompany.domain) {
      toast.error("Company name and domain are required");
      return;
    }
    setIsSaving(true);
    try {
      const companyId = await customerService.createCompany({
        ...newCompany,
        phoneNumbers: newCompany.primaryContactPhone ? [newCompany.primaryContactPhone] : [],
        isDraft: isDraft
      } as any);

      // Create contact if specified
      if (newCompany.primaryContactName && newCompany.primaryContactEmail) {
        try {
          await customerService.createContact({
            companyId: companyId,
            name: newCompany.primaryContactName,
            email: newCompany.primaryContactEmail,
            title: newCompany.primaryContactTitle || 'Primary Contact',
            phoneWork: newCompany.primaryContactPhone || '',
            phoneMobile: '',
            address: newCompany.address || '',
            metadata: {
              role: 'primary_contact',
              enriched: true
            }
          });
        } catch (contactErr) {
          console.warn("Failed to create associated contact record", contactErr);
        }
      }

      setIsCreateDialogOpen(false);
      setSelectedCompanyId(companyId);
      
      if (isDraft) {
        toast.success("Company profile draft saved successfully in corporate registry!");
      } else {
        toast.success("New organization registered in 360 Workspace!");
      }

      // Reset form
      setNewCompany({
        name: '',
        domain: '',
        website: '',
        logoUrl: '',
        branche: 'Tech' as any,
        companySize: '201–500',
        tier: 'Enterprise',
        primaryContactName: 'John Smith',
        primaryContactEmail: 'john.smith@acme.com',
        primaryContactPhone: '+49 123 456 7890',
        primaryContactTitle: 'IT Director',
        country: 'Germany',
        timezone: 'Europe/Berlin (GMT+2)',
        address: 'Friedrichstraße 123, 10117 Berlin, Germany',
        accountOwner: 'Sarah James',
        internalNotes: 'Strategic enterprise customer. Uses managed IT and cloud services. Priority support contract in place.',
        wartungsvertragStatus: 'Active' as any,
        healthScore: 85,
        contractPlan: 'Enterprise Plus',
        contractSla: '4h response',
        contractRenewalDate: 'Jan 12, 2027 (218 days)',
        monthlySpend: '€4,520',
        usersCount: 142,
        assetsCount: 87,
        vaultEntriesCount: 23,
        slaPerformance: '99.8%'
      });
    } catch (error) {
      toast.error(isDraft ? "Failed to save draft" : "Failed to create company");
    } finally {
      setIsSaving(false);
    }
  };

  // Create new contact
  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) return;
    if (!newContact.name || !newContact.email) {
      toast.error("Name and email are required");
      return;
    }
    setIsSaving(true);
    try {
      await customerService.createContact({
        ...newContact,
        companyId: selectedCompanyId,
      });
      setIsContactDialogOpen(false);
      toast.success("Direct contact added to organization!");
      setNewContact({
        name: '',
        email: '',
        title: '',
        phoneWork: '',
        phoneMobile: '',
        metadata: {}
      });
    } catch (error) {
      toast.error("Failed to add contact");
    } finally {
      setIsSaving(false);
    }
  };

  // Format active hydrated company details
  const hydratedCompany = hydrateCompany(selectedCompany, ticketHistory);

  return (
    <div className="flex h-full bg-background overflow-hidden">
      
      {/* Sidebar: Intelligent Company Navigator */}
      <CompanySidebar 
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        onSelectCompany={setSelectedCompanyId}
        favorites={favorites}
        onToggleFavorite={handleToggleFavorite}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onAddCompanyClick={() => setIsCreateDialogOpen(true)}
        onImportClick={() => setIsImportOpen(true)}
        onSeedClick={seedSampleData}
        isSeeding={isSeeding}
        ticketHistoryMap={ticketHistoryMap}
      />

      {/* Main View: Customer 360 Workspace Container */}
      <div className="flex-1 bg-muted/15 overflow-hidden flex flex-col min-h-0">
        {hydratedCompany ? (
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 max-w-7xl mx-auto space-y-6">
              
              {/* Header and Support Contract block */}
              <CompanyHeader 
                company={hydratedCompany}
                onEditCompanyClick={() => {
                  setEditCompanyData(hydratedCompany);
                  setIsEditDialogOpen(true);
                }}
                onViewContractClick={() => setActiveSubTab('contracts')}
              />

              {/* KPI Cards Grid Component */}
              <CompanyKPI company={hydratedCompany} />

              {/* Navigation Tabs */}
              <div className="border-b border-muted">
                <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
                  <TabsList className="bg-transparent border-none p-0 h-auto flex gap-6 select-none">
                    {[
                      { value: 'overview', label: t('nav.overview', 'Overview') },
                      { value: 'contacts', label: t('companies.contacts', 'Contacts'), count: employees.length },
                      { value: 'tickets', label: t('nav.tickets', 'Tickets'), count: ticketHistory.length },
                      { value: 'assets', label: t('companies.assetOverview', 'Assets'), count: hydratedCompany.assetsCount },
                      { value: 'contracts', label: t('companies.supportContract', 'Contracts') },
                      { value: 'vault', label: t('nav.vault', 'Vault'), count: hydratedCompany.vaultEntriesCount },
                      { value: 'insights', label: t('companies.aiInsights', 'AI Insights'), icon: Sparkles },
                      { value: 'activity', label: t('companies.activityTimeline', 'Activity') }
                    ].map(tab => {
                      const Icon = tab.icon;
                      return (
                        <TabsTrigger
                          key={tab.value}
                          value={tab.value}
                          className="px-1.5 py-2.5 text-xs font-bold bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 rounded-none transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          {Icon && <Icon className="w-3.5 h-3.5 text-indigo-500" />}
                          <span>{tab.label}</span>
                          {tab.count !== undefined && (
                            <span className="text-[10px] scale-90 px-1 bg-muted text-muted-foreground rounded-full border border-muted-foreground/10 shrink-0 font-extrabold font-mono">
                              {tab.count}
                            </span>
                          )}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </Tabs>
              </div>

              {/* Tab views body */}
              {activeSubTab === 'overview' ? (
                <CompanyOverviewTab 
                  company={hydratedCompany}
                  ticketHistory={ticketHistory}
                  onTabChange={setActiveSubTab}
                  onOpenVaultClick={() => setActiveSubTab('vault')}
                  onViewAllTicketsClick={() => setActiveSubTab('tickets')}
                />
              ) : (
                <CompanyOtherTabs 
                  activeSubTab={activeSubTab}
                  company={hydratedCompany}
                  employees={employees}
                  contactSchema={contactSchema}
                  ticketHistory={ticketHistory}
                  onAddContactClick={() => setIsContactDialogOpen(true)}
                  onSelectTicket={(ticketId) => navigate(`/tickets/${ticketId}`)}
                />
              )}

            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-muted/5">
             <div className="w-24 h-24 bg-background rounded-full border border-dashed border-primary/20 flex flex-col items-center justify-center mb-6 shadow-xs relative">
                <Building2 className="w-9 h-9 text-muted-foreground/30" />
                <Sparkles className="w-4 h-4 text-primary absolute top-5 right-5 animate-pulse" />
             </div>
             <h2 className="text-xl font-extrabold text-foreground tracking-tight">
               {companies.length === 0 ? "Companies workspace is Empty" : "Select a Company"}
             </h2>
             <p className="text-muted-foreground max-w-sm mt-2 text-xs font-semibold leading-relaxed">
               {companies.length === 0 
                 ? "Populate your Customer 360 intelligence workspace by seeding a premium sample dataset, importing client CSVs, or adding a company manually."
                 : "Use the navigator panel on the left to select a company and access its historical tickets, assets, cloud secrets, and automated AI health actions."}
             </p>
             {companies.length === 0 && (
               <Button 
                 onClick={seedSampleData} 
                 disabled={isSeeding}
                 className="mt-8 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-xl px-6 h-11 text-xs shadow-md shadow-amber-500/10 gap-2 cursor-pointer transition-all"
               >
                 {isSeeding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                 Seed Sample Environment
               </Button>
             )}
          </div>
        )}
      </div>

      <CSVImporter 
        open={isImportOpen} 
        onOpenChange={setIsImportOpen} 
        onComplete={() => {}} 
      />

      {/* CREATE DIALOG MODAL */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[1040px] md:max-w-[1100px] w-[95vw] h-[85vh] max-h-[85vh] rounded-[24px] p-0 border border-slate-200 bg-[#F8F9FA] overflow-hidden flex flex-col shadow-2xl">
          {/* Header */}
          <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-[#1A73E8] rounded-xl shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 tracking-tight leading-none">
                  Register New Company
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-medium mt-1 leading-none">
                  Create a Company 360 profile for customer management.
                </DialogDescription>
              </div>
            </div>
          </div>

          <form onSubmit={(e) => handleCreateCompany(e, false)} className="flex-1 flex flex-col overflow-hidden">
            {/* Split Column Panel */}
            <div className="flex-1 flex overflow-hidden min-h-0 bg-[#F8F9FA]">
              
              {/* Left Column: Logo Drag-and-Drop & Enrichment Sidebar */}
              <div className="w-[250px] border-r border-slate-200/60 bg-white p-5 flex flex-col gap-5 shrink-0 overflow-y-auto">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Company Profile</h3>
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setDraggingFile(true); }}
                    onDragLeave={() => setDraggingFile(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDraggingFile(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        handleLogoFile(e.dataTransfer.files[0]);
                      }
                    }}
                    onClick={() => document.getElementById('company-logo-input')?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-2xl p-4 text-center flex flex-col items-center justify-center cursor-pointer transition-all h-[170px]",
                      draggingFile ? "border-primary bg-primary/5" : "border-[#DADCE0] hover:border-slate-400 bg-slate-50/40"
                    )}
                  >
                    <input 
                      id="company-logo-input"
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleLogoFile(e.target.files[0]);
                        }
                      }}
                    />
                    {newCompany.logoUrl ? (
                      <div className="relative group w-full h-full flex items-center justify-center">
                        <img src={newCompany.logoUrl} alt="Logo" className="max-h-[130px] max-w-[150px] object-contain rounded-xl" />
                        <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                          <span className="text-[10px] text-white font-bold bg-primary px-2.5 py-1 rounded-full">Change</span>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNewCompany(prev => ({ ...prev, logoUrl: '' }));
                            }}
                            className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="p-3 bg-white text-slate-400 rounded-xl inline-block mx-auto shadow-sm border border-slate-100">
                          <Building className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-slate-800 leading-none">Drag & drop logo here</p>
                          <p className="text-[10px] text-slate-400 font-bold mt-1 leading-none">or click to upload</p>
                        </div>
                        <p className="text-[9px] text-slate-400 font-medium pt-1">PNG, JPG, SVG up to 2MB</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Automation & Enrichment panel */}
                <div className="border border-blue-100 bg-blue-50/50 rounded-2xl p-4 space-y-2.5 mt-auto">
                  <div className="flex gap-2 text-blue-700">
                    <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Smart Enrichment</span>
                  </div>
                  <p className="text-[10px] text-blue-600/80 font-semibold leading-relaxed">
                    Enter a domain and we'll automatically find company details, logo, industry and more.
                  </p>
                  <Button
                    type="button"
                    onClick={handleSmartEnrich}
                    disabled={isEnriching || !newCompany.domain}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-xl h-8.5 text-[10px] gap-1 shadow-sm shrink-0 cursor-pointer transition-all mt-1"
                  >
                    {isEnriching ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Enrich Domain
                  </Button>
                </div>
              </div>

              {/* Middle Column: Scrollable Forms */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                
                {/* Card 1: Company Information */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-50 pb-2 text-[#1A73E8]">
                    <Building className="w-4 h-4" />
                    <h4 className="text-xs font-bold uppercase tracking-wider">Company Information</h4>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 col-span-2">
                      <Label htmlFor="name" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Company Name <span className="text-red-500">*</span>
                      </Label>
                      <Input 
                        id="name" 
                        required
                        placeholder="e.g. Acme Global Solutions" 
                        value={newCompany.name}
                        onChange={(e) => setNewCompany({...newCompany, name: e.target.value})}
                        className="rounded-xl border border-slate-200 h-10 font-semibold text-slate-800 text-xs focus-visible:ring-primary"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="domain" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Domain <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input 
                          id="domain" 
                          required
                          placeholder="acme.com" 
                          value={newCompany.domain}
                          onChange={(e) => handleDomainChange(e.target.value)}
                          className="rounded-xl border border-slate-200 h-10 pr-8 font-semibold text-slate-800 text-xs focus-visible:ring-primary"
                        />
                        {newCompany.domain && (
                          <div className="absolute right-2.5 top-2.5 text-emerald-500" title="Validating domain">
                            <Check className="w-4 h-4 stroke-[3px]" />
                          </div>
                        )}
                      </div>
                      <p className="text-[9px] text-slate-400 font-semibold mt-1">Company domain for auto-enrichment</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="website" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Website URL
                      </Label>
                      <Input 
                        id="website" 
                        placeholder="https://www.acme.com" 
                        value={newCompany.website}
                        onChange={(e) => setNewCompany({...newCompany, website: e.target.value})}
                        className="rounded-xl border border-slate-200 h-10 font-semibold text-slate-800 text-xs focus-visible:ring-primary"
                      />
                      <p className="text-[9px] text-slate-400 font-semibold mt-1">Auto-filled from domain</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Industry Sector</Label>
                      <Select 
                        value={newCompany.branche} 
                        onValueChange={(val) => setNewCompany({...newCompany, branche: val as any})}
                      >
                        <SelectTrigger className="rounded-xl border border-slate-200 h-10 font-semibold text-slate-700 text-xs bg-white">
                          <SelectValue placeholder="Select industry" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl shadow-lg border-slate-100">
                          {BRANCHES.map(branch => (
                            <SelectItem key={branch} value={branch} className="rounded-lg font-semibold text-xs py-2">{branch}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Company Size</Label>
                      <Select 
                        value={newCompany.companySize} 
                        onValueChange={(val) => setNewCompany({...newCompany, companySize: val})}
                      >
                        <SelectTrigger className="rounded-xl border border-slate-200 h-10 font-semibold text-slate-700 text-xs bg-white">
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl shadow-lg border-slate-100">
                          {['1–10', '11–50', '51–200', '201–500', '501–1000', '1000+'].map(size => (
                            <SelectItem key={size} value={size} className="rounded-lg font-semibold text-xs py-2">{size} employees</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Customer Tier</Label>
                      <Select 
                        value={newCompany.tier} 
                        onValueChange={(val) => setNewCompany({...newCompany, tier: val})}
                      >
                        <SelectTrigger className="rounded-xl border border-slate-200 h-10 font-black text-slate-800 text-xs bg-white">
                          <SelectValue placeholder="Select customer tier" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl shadow-lg border-slate-100">
                          <SelectItem value="Enterprise" className="rounded-lg font-bold text-xs py-2 text-amber-600 bg-amber-50/10">⭐ Enterprise Premium</SelectItem>
                          <SelectItem value="Pro" className="rounded-lg font-bold text-xs py-2 text-blue-600">⚡ Pro Growth</SelectItem>
                          <SelectItem value="Standard" className="rounded-lg font-bold text-xs py-2 text-slate-600">👤 Standard Account</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Card 2: Contact Information */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-50 pb-2 text-[#1A73E8]">
                    <User className="w-4 h-4" />
                    <h4 className="text-xs font-bold uppercase tracking-wider">Contact Information</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="contactName" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Primary Contact Name</Label>
                      <Input
                        id="contactName"
                        placeholder="John Smith"
                        value={newCompany.primaryContactName}
                        onChange={(e) => setNewCompany({...newCompany, primaryContactName: e.target.value})}
                        className="rounded-xl border border-slate-200 h-10 font-semibold text-slate-800 text-xs focus-visible:ring-primary"
                      />
                      <p className="text-[9px] text-slate-400 font-semibold mt-1">Main point of contact</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="contactEmail" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Email Address</Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        placeholder="john.smith@acme.com"
                        value={newCompany.primaryContactEmail}
                        onChange={(e) => setNewCompany({...newCompany, primaryContactEmail: e.target.value})}
                        className="rounded-xl border border-slate-200 h-10 font-semibold text-slate-800 text-xs focus-visible:ring-primary"
                      />
                      <p className="text-[9px] text-slate-400 font-semibold mt-1">Business email address</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="contactPhone" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Phone Number</Label>
                      <Input
                        id="contactPhone"
                        placeholder="+49 123 456 7890"
                        value={newCompany.primaryContactPhone}
                        onChange={(e) => setNewCompany({...newCompany, primaryContactPhone: e.target.value})}
                        className="rounded-xl border border-slate-200 h-10 font-semibold text-slate-800 text-xs focus-visible:ring-primary"
                      />
                      <p className="text-[9px] text-slate-400 font-semibold mt-1">Include country code</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="contactTitle" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Job Title</Label>
                      <Input
                        id="contactTitle"
                        placeholder="IT Director"
                        value={newCompany.primaryContactTitle}
                        onChange={(e) => setNewCompany({...newCompany, primaryContactTitle: e.target.value})}
                        className="rounded-xl border border-slate-200 h-10 font-semibold text-slate-800 text-xs focus-visible:ring-primary"
                      />
                      <p className="text-[9px] text-slate-400 font-semibold mt-1">Contact's job title</p>
                    </div>
                  </div>
                </div>

                {/* Card 3: Business Details */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-50 pb-2 text-[#1A73E8]">
                    <MapPin className="w-4 h-4" />
                    <h4 className="text-xs font-bold uppercase tracking-wider">Business Details</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Country</Label>
                      <Select
                        value={newCompany.country}
                        onValueChange={(val) => setNewCompany({...newCompany, country: val})}
                      >
                        <SelectTrigger className="rounded-xl border border-slate-200 h-10 font-semibold text-slate-700 text-xs bg-white">
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl shadow-lg border-slate-100">
                          {['Germany', 'United States', 'United Kingdom', 'Switzerland', 'Austria', 'France', 'Other'].map(country => (
                            <SelectItem key={country} value={country} className="rounded-lg font-semibold text-xs py-2">{country}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Timezone</Label>
                      <Select
                        value={newCompany.timezone}
                        onValueChange={(val) => setNewCompany({...newCompany, timezone: val})}
                      >
                        <SelectTrigger className="rounded-xl border border-slate-200 h-10 font-semibold text-slate-700 text-xs bg-white">
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl shadow-lg border-slate-100">
                          {['Europe/Berlin (GMT+2)', 'US/Pacific (GMT-8)', 'US/Eastern (GMT-5)', 'Europe/London (GMT+1)', 'Asia/Tokyo (GMT+9)', 'Other'].map(tz => (
                            <SelectItem key={tz} value={tz} className="rounded-lg font-semibold text-xs py-2">{tz}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[9px] text-slate-400 font-semibold mt-1">Auto-detected</p>
                    </div>

                    <div className="space-y-1.5 col-span-2">
                      <Label htmlFor="address" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Physical Address</Label>
                      <Textarea
                        id="address"
                        placeholder="Friedrichstraße 123, 10117 Berlin, Germany"
                        value={newCompany.address}
                        onChange={(e) => setNewCompany({...newCompany, address: e.target.value})}
                        className="rounded-xl border border-slate-200 min-h-[60px] font-semibold text-slate-800 text-xs focus-visible:ring-primary resize-none p-3"
                      />
                    </div>
                  </div>
                </div>

                {/* Card 4: Internal Information */}
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-50 pb-2 text-[#1A73E8]">
                    <Shield className="w-4 h-4" />
                    <h4 className="text-xs font-bold uppercase tracking-wider">Internal Information</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Assigned Account Manager</Label>
                      <Select
                        value={newCompany.accountOwner}
                        onValueChange={(val) => setNewCompany({...newCompany, accountOwner: val})}
                      >
                        <SelectTrigger className="rounded-xl border border-slate-200 h-10 font-semibold text-slate-700 text-xs bg-white">
                          <SelectValue placeholder="Select account owner" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl shadow-lg border-slate-100">
                          {['Sarah James', 'Michael Scott', 'Jim Halpert', 'Dwight Schrute', 'Pam Beesly'].map(owner => (
                            <SelectItem key={owner} value={owner} className="rounded-lg font-semibold text-xs py-2">{owner}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[9px] text-slate-400 font-semibold mt-1">Responsible for this account</p>
                    </div>

                    <div className="space-y-1.5 col-span-2">
                      <Label htmlFor="internalNotes" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Internal Notes</Label>
                      <Textarea
                        id="internalNotes"
                        placeholder="Notes regarding organization structure, managed devices, etc."
                        value={newCompany.internalNotes}
                        onChange={(e) => setNewCompany({...newCompany, internalNotes: e.target.value})}
                        className="rounded-xl border border-slate-200 min-h-[70px] font-semibold text-slate-800 text-xs focus-visible:ring-primary resize-none p-3"
                      />
                      <p className="text-[9px] text-slate-400 font-semibold mt-1">Only visible to internal users</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Company Preview */}
              <div className="w-[330px] border-l border-slate-200/60 bg-white p-5 flex flex-col gap-4 shrink-0 overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Company Preview</span>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 select-none animate-pulse">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                    Live Preview
                  </span>
                </div>

                {/* Identity Preview Group */}
                <div className="bg-[#F8F9FA]/80 border border-slate-100 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center gap-3.5">
                    {newCompany.logoUrl ? (
                      <div className="w-13 h-13 rounded-2xl border border-slate-100 bg-white flex items-center justify-center p-1.5 shrink-0 shadow-sm">
                        <img src={newCompany.logoUrl} alt="Logo" className="w-full h-full object-contain rounded-xl" />
                      </div>
                    ) : (
                      <div className="w-13 h-13 rounded-2xl bg-blue-600 text-white flex items-center justify-center p-2 shadow-md shadow-blue-600/10 shrink-0 font-bold text-lg select-none">
                        {newCompany.name ? newCompany.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : <Building className="w-5 h-5" />}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-slate-900 truncate leading-tight tracking-tight">
                        {newCompany.name || "Acme Global Solutions"}
                      </h4>
                      {newCompany.domain && (
                        <a 
                          href={`https://${newCompany.domain}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-[#1A73E8] hover:underline text-[10.5px] font-bold flex items-center gap-0.5 mt-1 truncate"
                        >
                          {newCompany.domain} <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        </a>
                      )}
                      
                      <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1 mt-1.5 truncate">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        {newCompany.country || "Germany"}
                      </span>
                    </div>
                  </div>

                  {/* Specification Table */}
                  <div className="border-t border-slate-200/50 pt-3.5 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2 text-slate-500 font-semibold">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                        <span>Industry</span>
                      </div>
                      <span className="font-bold text-slate-800">{newCompany.branche || "Technology"}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2 text-slate-500 font-semibold">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>Company Size</span>
                      </div>
                      <span className="font-bold text-slate-800">{newCompany.companySize || "201–500"} emp</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2 text-slate-500 font-semibold">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        <span>Tier Level</span>
                      </div>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                        newCompany.tier === 'Enterprise' ? "text-amber-700 bg-amber-50 border-amber-200" :
                        newCompany.tier === 'Pro' ? "text-blue-700 bg-blue-50 border-blue-200" :
                        "text-slate-700 bg-slate-50 border-slate-200"
                      )}>
                        {newCompany.tier || "Enterprise"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2 text-slate-500 font-semibold">
                        <Globe className="w-3.5 h-3.5 text-slate-400" />
                        <span>Website</span>
                      </div>
                      <span className="font-bold text-slate-800 max-w-[140px] truncate" title={newCompany.website}>
                        {newCompany.website ? newCompany.website.replace(/^https?:\/\//, '') : "www.acme.com"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Primary Contact Group */}
                <div className="space-y-2">
                  <span className="text-[10.5px] font-black text-slate-400 uppercase tracking-widest leading-none">Primary Contact</span>
                  <div className="border border-slate-100 rounded-2xl p-3.5 bg-slate-50/50 flex flex-col gap-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8.5 h-8.5 rounded-full bg-slate-200/80 text-slate-600 font-bold text-xs flex items-center justify-center select-none uppercase shadow-inner">
                        {newCompany.primaryContactName ? newCompany.primaryContactName.split(' ').map(n => n[0]).slice(0, 2).join('') : "A"}
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-xs font-black text-slate-800 tracking-tight leading-tight truncate">
                          {newCompany.primaryContactName || "John Smith"}
                        </h5>
                        <p className="text-[10px] text-slate-500 font-bold leading-tight truncate mt-0.5">
                          {newCompany.primaryContactTitle || "IT Director"}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-2 space-y-1 text-[10px] text-slate-500 font-semibold leading-relaxed">
                      <div className="flex items-center gap-2 truncate">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{newCompany.primaryContactEmail || "john.smith@acme.com"}</span>
                      </div>
                      <div className="flex items-center gap-2 truncate mt-1">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{newCompany.primaryContactPhone || "+49 123 456 7890"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assigned Account owner Preview */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Account Manager</span>
                  <div className="flex items-center gap-2.5 px-1 py-1">
                    <div className="w-7 h-7 rounded-full bg-[#1A73E8]/10 text-primary text-[11px] font-bold flex items-center justify-center select-none uppercase shadow-inner border border-[#1A73E8]/5">
                      {newCompany.accountOwner ? newCompany.accountOwner.split(' ').map(n => n[0]).join('') : "SJ"}
                    </div>
                    <span className="text-xs font-bold text-slate-700">{newCompany.accountOwner || "Sarah James"}</span>
                  </div>
                </div>

                {/* Quick status preview */}
                <div className="mt-auto border-t border-slate-100 pt-3 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-semibold">Account Status</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping"></span>
                    Active Account
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-200/60 px-6 py-4 flex items-center justify-between shrink-0">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setIsCreateDialogOpen(false)}
                className="rounded-xl font-bold h-10 px-5 text-xs text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </Button>

              <div className="hidden md:flex items-center gap-1.5 text-slate-400 select-none">
                <Lock className="w-3 h-3" />
                <span className="text-[9.5px] font-bold uppercase tracking-wider">Zero-Knowledge Encrypted Architecture</span>
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={(e) => handleCreateCompany(e as any, true)}
                  disabled={isSaving}
                  className="rounded-xl border border-slate-200 font-bold h-10 px-5 text-xs text-slate-700 bg-white hover:bg-slate-50"
                >
                  Save Draft
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSaving}
                  className="bg-primary hover:bg-primary/95 text-white font-extrabold rounded-xl px-5 h-10 text-xs shadow-md shadow-primary/10 gap-1.5 cursor-pointer transition-all"
                >
                  {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Create Company
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT MODAL DIALOG */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[550px] rounded-[24px] p-6 border border-muted-foreground/10 overflow-hidden bg-background max-h-[90vh] overflow-y-auto">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-extrabold tracking-tight flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-xl text-primary shrink-0">
                <Edit3 className="w-5 h-5" />
              </div>
              Edit support profile: {editCompanyData.name}
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold text-muted-foreground leading-relaxed">
              Manage contract SLAs, support tiers, and simulate organization health scores.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditCompanySubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3.5 text-xs text-foreground font-semibold">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="edit-name" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Company Name</Label>
                <Input 
                  id="edit-name" 
                  value={editCompanyData.name || ''}
                  onChange={(e) => setEditCompanyData({...editCompanyData, name: e.target.value})}
                  className="rounded-xl border border-muted-foreground/15 h-10 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-website" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Website URL</Label>
                <Input 
                  id="edit-website" 
                  value={editCompanyData.website || ''}
                  onChange={(e) => setEditCompanyData({...editCompanyData, website: e.target.value})}
                  className="rounded-xl border border-muted-foreground/15 h-10 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-domain" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Primary Domain</Label>
                <Input 
                  id="edit-domain" 
                  value={editCompanyData.domain || ''}
                  onChange={(e) => setEditCompanyData({...editCompanyData, domain: e.target.value})}
                  className="rounded-xl border border-muted-foreground/15 h-10 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-branch" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sector Industry</Label>
                <Select 
                  value={editCompanyData.branche || ''} 
                  onValueChange={(val) => setEditCompanyData({...editCompanyData, branche: val as any})}
                >
                  <SelectTrigger className="rounded-xl border border-muted-foreground/15 h-10">
                    <SelectValue placeholder="Industry" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {BRANCHES.map(b => (
                      <SelectItem key={b} value={b} className="font-semibold">{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-tier" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tiers Category</Label>
                <Select 
                  value={editCompanyData.tier || ''} 
                  onValueChange={(val) => setEditCompanyData({...editCompanyData, tier: val as any})}
                >
                  <SelectTrigger className="rounded-xl border border-muted-foreground/15 h-10">
                    <SelectValue placeholder="Support tier" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Enterprise" className="font-semibold">Enterprise</SelectItem>
                    <SelectItem value="Pro" className="font-semibold">Pro</SelectItem>
                    <SelectItem value="Standard" className="font-semibold">Standard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-owner" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Account Owner</Label>
                <Input 
                  id="edit-owner" 
                  value={editCompanyData.accountOwner || ''}
                  onChange={(e) => setEditCompanyData({...editCompanyData, accountOwner: e.target.value})}
                  className="rounded-xl border border-muted-foreground/15 h-10 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-spend" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Monthly Spend</Label>
                <Input 
                  id="edit-spend" 
                  value={editCompanyData.monthlySpend || ''}
                  onChange={(e) => setEditCompanyData({...editCompanyData, monthlySpend: e.target.value})}
                  className="rounded-xl border border-muted-foreground/15 h-10 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-plan" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Contract SLA Plan</Label>
                <Input 
                  id="edit-plan" 
                  value={editCompanyData.contractPlan || ''}
                  onChange={(e) => setEditCompanyData({...editCompanyData, contractPlan: e.target.value})}
                  className="rounded-xl border border-muted-foreground/15 h-10 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-sla" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Support SLA Response</Label>
                <Input 
                  id="edit-sla" 
                  value={editCompanyData.contractSla || ''}
                  onChange={(e) => setEditCompanyData({...editCompanyData, contractSla: e.target.value})}
                  className="rounded-xl border border-muted-foreground/15 h-10 font-semibold"
                />
              </div>

              {/* Health Score Slider representation */}
              <div className="space-y-1.5 col-span-2 p-3 bg-muted/30 rounded-xl border">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Customer Health Score</span>
                  <span className="text-primary font-black">{editCompanyData.healthScore || 0} / 100</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={editCompanyData.healthScore || 0}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    let hStatus = 'Healthy';
                    if (val < 40) hStatus = 'Contract Expiring';
                    else if (val < 55) hStatus = 'SLA Risk';
                    else if (val < 80) hStatus = 'Warning';
                    setEditCompanyData({
                      ...editCompanyData, 
                      healthScore: val,
                      healthStatus: hStatus
                    });
                  }}
                  className="w-full h-1.5 bg-primary/20 accent-primary rounded-lg appearance-auto cursor-pointer"
                />
                <p className="text-[10px] text-muted-foreground/75 font-semibold mt-1">
                  Sliding changes the account health pill state dynamically. Less than 40 = Expiring Contract, less than 55 = SLA Risk, less than 80 = Warning.
                </p>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-muted">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setIsEditDialogOpen(false)}
                className="rounded-xl font-bold h-10 px-4 text-xs"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSaving}
                className="bg-primary hover:bg-primary/95 text-white font-extrabold rounded-xl px-5 h-10 text-xs shadow-md shadow-primary/10"
              >
                {isSaving ? <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Edit3 className="w-3.5 h-3.5 mr-2" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ADD CONTACT DIALOG */}
      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-[24px] p-6 border border-muted-foreground/10 overflow-hidden bg-background">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-extrabold tracking-tight flex items-center gap-2">
              <div className="p-2 bg-indigo-505/10 text-indigo-500 rounded-xl shrink-0">
                <Users className="w-5 h-5" />
              </div>
              Add New Contact
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold text-muted-foreground">
              Register a client contact associated with {hydratedCompany?.name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateContact} className="space-y-4">
            <div className="grid grid-cols-2 gap-3.5 text-xs text-foreground font-semibold">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="contact-name" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Full Name</Label>
                <Input 
                  id="contact-name" 
                  placeholder="John Doe" 
                  value={newContact.name}
                  onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                  className="rounded-xl border border-muted-foreground/15 h-10 font-medium"
                />
              </div>
              
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="contact-email" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email Address</Label>
                <Input 
                  id="contact-email" 
                  type="email"
                  placeholder="john@example.com" 
                  value={newContact.email}
                  onChange={(e) => setNewContact({...newContact, email: e.target.value})}
                  className="rounded-xl border border-muted-foreground/15 h-10 font-medium"
                />
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="contact-title" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Job Title</Label>
                <Input 
                  id="contact-title" 
                  placeholder="Engineering Lead" 
                  value={newContact.title}
                  onChange={(e) => setNewContact({...newContact, title: e.target.value})}
                  className="rounded-xl border border-muted-foreground/15 h-10 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contact-work" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Work Phone</Label>
                <Input 
                  id="contact-work" 
                  placeholder="+1..." 
                  value={newContact.phoneWork}
                  onChange={(e) => setNewContact({...newContact, phoneWork: e.target.value})}
                  className="rounded-xl border border-muted-foreground/15 h-10 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contact-mobile" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mobile Phone</Label>
                <Input 
                  id="contact-mobile" 
                  placeholder="+1..." 
                  value={newContact.phoneMobile}
                  onChange={(e) => setNewContact({...newContact, phoneMobile: e.target.value})}
                  className="rounded-xl border border-muted-foreground/15 h-10 font-medium"
                />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-muted">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setIsContactDialogOpen(false)}
                className="rounded-xl font-bold h-10 px-4 text-xs"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSaving}
                className="bg-primary hover:bg-primary/95 text-white font-extrabold rounded-xl px-5 h-10 text-xs shadow-md shadow-primary/10"
              >
                {isSaving ? <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-2" />}
                Add Contact
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
