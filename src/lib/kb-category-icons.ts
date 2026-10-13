import {
  BookOpen,
  FileText,
  FileJson,
  Link,
  Wrench,
  ShieldCheck,
  Package,
  Code2,
  Plug,
  CreditCard,
  Shield,
  Building2,
  Folder,
  type LucideIcon,
} from 'lucide-react';

const ICON_BY_NAME: Record<string, LucideIcon> = {
  BookOpen,
  FileText,
  FileJson,
  Link,
  Wrench,
  ShieldCheck,
  Package,
  Code2,
  Plug,
  CreditCard,
  Shield,
  Building2,
  Folder,
};

export function resolveCategoryIcon(iconName?: string): LucideIcon {
  if (!iconName) return BookOpen;
  return ICON_BY_NAME[iconName] ?? BookOpen;
}

export function iconNameForCategoryId(id: string): string {
  const map: Record<string, string> = {
    'getting-started': 'BookOpen',
    billing: 'CreditCard',
    'api-documentation': 'Code2',
    integrations: 'Plug',
    troubleshooting: 'Wrench',
    'internal-sops': 'ShieldCheck',
    security: 'Shield',
    'product-guides': 'Package',
    'company-policies': 'Building2',
  };
  return map[id] ?? 'BookOpen';
}
