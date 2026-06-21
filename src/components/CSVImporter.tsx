import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  Database,
  ArrowRight
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from './ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { Progress } from './ui/progress';
import { customerService } from '../services/customerService';
import { toast } from 'sonner';

interface CSVImporterProps {
  onComplete: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DB_FIELDS = [
  { id: 'company_name', label: 'Company Name', required: true, target: 'company' },
  { id: 'company_website', label: 'Company Website', target: 'company' },
  { id: 'company_domain', label: 'Company Domain', required: true, target: 'company' },
  { id: 'company_branche', label: 'Company Branche', target: 'company' },
  { id: 'company_status', label: 'Wartungsvertrag Status', target: 'company' },
  { id: 'contact_name', label: 'Contact Name', required: true, target: 'contact' },
  { id: 'contact_email', label: 'Contact Email', required: true, target: 'contact' },
  { id: 'contact_title', label: 'Contact Title', target: 'contact' },
  { id: 'contact_phone_work', label: 'Contact Phone (Work)', target: 'contact' },
  { id: 'contact_phone_mobile', label: 'Contact Phone (Mobile)', target: 'contact' },
  { id: 'contact_address', label: 'Contact Address', target: 'contact' },
];

export default function CSVImporter({ onComplete, open, onOpenChange }: CSVImporterProps) {
  const [step, setStep] = useState<'upload' | 'map' | 'process'>('upload');
  const [csvData, setCsvData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setCsvData(results.data);
          setHeaders(results.meta.fields || []);
          setStep('map');
          
          // Auto-map some fields
          const initialMappings: Record<string, string> = {};
          (results.meta.fields || []).forEach(header => {
            const lowerHeader = header.toLowerCase();
            const match = DB_FIELDS.find(field => 
              lowerHeader.includes(field.label.toLowerCase()) || 
              field.id.includes(lowerHeader)
            );
            if (match) initialMappings[match.id] = header;
          });
          setMappings(initialMappings);
        }
      });
    }
  };

  const handleImport = async () => {
    setIsProcessing(true);
    setStep('process');
    let processed = 0;

    for (const row of csvData) {
      try {
        const companyName = row[mappings['company_name']];
        const companyDomain = row[mappings['company_domain']]?.toLowerCase().trim();
        const companyWebsite = row[mappings['company_website']];
        const companyBranche = (row[mappings['company_branche']] || 'Other') as any;
        const companyStatus = (row[mappings['company_status']] || 'None') as any;

        const contactName = row[mappings['contact_name']];
        const contactEmail = row[mappings['contact_email']]?.toLowerCase().trim();
        const contactTitle = row[mappings['contact_title']];
        const contactPhoneWork = row[mappings['contact_phone_work']];
        const contactPhoneMobile = row[mappings['contact_phone_mobile']];
        const contactAddress = row[mappings['contact_address']];

        if (!companyName || !companyDomain || !contactName || !contactEmail) continue;

        // 1. Deduplication Logic: Find Company by Domain
        let companyId = '';
        const existingCompany = await customerService.findCompanyByDomain(companyDomain);
        
        if (existingCompany) {
          companyId = existingCompany.id;
        } else {
          // Create new company
          companyId = await customerService.createCompany({
            name: companyName,
            domain: companyDomain,
            website: companyWebsite || '',
            branche: companyBranche,
            wartungsvertragStatus: companyStatus,
            phoneNumbers: []
          });
        }

        // 2. Create Contact associated with Company
        // Check if contact already exists
        const existingContact = await customerService.findContactByEmail(contactEmail);
        if (!existingContact) {
          await customerService.createContact({
            companyId,
            name: contactName,
            email: contactEmail,
            title: contactTitle || '',
            phoneWork: contactPhoneWork || '',
            phoneMobile: contactPhoneMobile || '',
            address: contactAddress || '',
          });
        }

      } catch (error) {
        console.error('Error processing row:', error);
      }
      
      processed++;
      setProgress((processed / csvData.length) * 100);
    }

    setIsProcessing(false);
    toast.success('Import completed successfully');
    onComplete();
    onOpenChange(false);
    // Reset state
    setStep('upload');
    setCsvData([]);
    setProgress(0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Upload className="w-6 h-6 text-primary" />
            CSV Import Tool
          </DialogTitle>
          <DialogDescription>
            Import your B2B customers and contacts. Align your CSV columns to our database fields.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 'upload' && (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-all rounded-2xl h-64 flex flex-col items-center justify-center bg-muted/30 cursor-pointer group"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <p className="font-bold text-lg">Click or drag CSV file</p>
              <p className="text-sm text-muted-foreground mt-1">UTF-8 encoded CSV files only</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".csv" 
                onChange={handleFileChange}
              />
            </div>
          )}

          {step === 'map' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-8 items-start">
                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    Database Fields
                  </h3>
                  <div className="space-y-2">
                    {DB_FIELDS.map(field => (
                      <div key={field.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border/50">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold flex items-center gap-1">
                            {field.label}
                            {field.required && <span className="text-rose-500">*</span>}
                          </span>
                          <span className="text-[10px] uppercase font-black text-muted-foreground/60">{field.target}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground/30" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <ChevronRight className="w-4 h-4" />
                    CSV Mapping
                  </h3>
                  <div className="space-y-2">
                    {DB_FIELDS.map(field => (
                      <div key={field.id} className="h-[54px] flex items-center">
                        <Select 
                          value={mappings[field.id]} 
                          onValueChange={(val) => setMappings(prev => ({ ...prev, [field.id]: val }))}
                        >
                          <SelectTrigger className="rounded-xl border-border/50 focus:ring-primary shadow-sm bg-background h-full">
                            <SelectValue placeholder="Map to CSV column..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Ignore this field</SelectItem>
                            {headers.map(header => (
                              <SelectItem key={header} value={header}>{header}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'process' && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="relative mb-8">
                <div className="w-24 h-24 border-4 border-muted rounded-full border-t-primary animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                   <Upload className="w-8 h-8 text-primary" />
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2">Importing Customers...</h2>
              <p className="text-muted-foreground mb-8">Processing {csvData.length} records and handling deduplication.</p>
              <div className="w-full max-w-sm">
                <Progress value={progress} className="h-2" />
                <p className="text-xs font-bold text-muted-foreground mt-2">{Math.round(progress)}% complete</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 bg-muted/30 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isProcessing}>Cancel</Button>
          {step === 'map' && (
            <Button 
              className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl px-8" 
              onClick={handleImport}
              disabled={isProcessing || !DB_FIELDS.filter(f => f.required).every(f => !!mappings[f.id])}
            >
              Start Import
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
