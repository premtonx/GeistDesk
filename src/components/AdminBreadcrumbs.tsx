import { Fragment } from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';

interface BreadcrumbItem {
  label: string;
  path: string;
}

export function AdminBreadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  const breadcrumbs: BreadcrumbItem[] = pathnames.map((value, index) => {
    const last = index === pathnames.length - 1;
    const path = `/${pathnames.slice(0, index + 1).join('/')}`;
    
    // Custom labels for path segments
    const labels: Record<string, string> = {
      admin: 'Admin Hub',
      ai: 'AI Orchestrator',
      legal: 'Legal Guardrails',
      pii: 'PII Shield',
      sovereignty: 'Sovereignty Center',
      integrations: 'Integrations',
      notifications: 'Notifications',
      schema: 'Company Schema',
      groups: 'Functional Teams',
      'vault-portfolio': 'Vault-Portfoliomanagement',
      import: 'Data Import & Migration',
      settings: 'Settings'
    };

    return {
      label: labels[value] || value.charAt(0) + value.slice(1).replace('-', ' '),
      path: path
    };
  });

  return (
    <nav className="flex items-center space-x-1 text-sm font-medium text-slate-500 mb-6">
      <Link 
        to="/admin" 
        className="flex items-center hover:text-primary transition-colors gap-1.5"
      >
        <Home className="w-3.5 h-3.5" />
      </Link>
      
      {breadcrumbs.map((item, index) => (
        <Fragment key={item.path}>
          <ChevronRight className="w-4 h-4 text-slate-300" />
          <Link
            to={item.path}
            className={cn(
              "hover:text-primary transition-colors",
              index === breadcrumbs.length - 1 && "text-primary font-bold cursor-default hover:text-primary"
            )}
            onClick={index === breadcrumbs.length - 1 ? (e) => e.preventDefault() : undefined}
          >
            {item.label}
          </Link>
        </Fragment>
      ))}
    </nav>
  );
}
