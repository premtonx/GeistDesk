import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Ticket,
  PlusCircle,
  Users,
  Mail,
  LogOut,
  Building2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { logout } from '../../lib/hooks';
import { useClientPortalSession } from '../../hooks/useClientPortalSession';
import { GeistDeskLogo } from '../ui/GeistDeskLogo';

const NAV_ALL = [
  { to: '/portal/tickets', label: 'Übersicht / Tickets', icon: Ticket, end: true },
  { to: '/portal/tickets/new', label: 'Neues Ticket erstellen', icon: PlusCircle, end: true },
] as const;

const NAV_ADMIN_ONLY = [
  { to: '/portal/members', label: 'Mitarbeiter & Rollen', icon: Users, end: false },
  { to: '/portal/email', label: 'E-Mail & M365 Integration', icon: Mail, end: false },
] as const;

export default function ClientPortalLayout() {
  const { session, isClientAdmin, loading } = useClientPortalSession();
  const navigate = useNavigate();

  if (loading || !session) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#f7f8fa]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800" />
      </div>
    );
  }

  const navItems = [
    ...NAV_ALL,
    ...(isClientAdmin ? NAV_ADMIN_ONLY : []),
  ];

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#f7f8fa] text-slate-900">
      <aside className="w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col min-h-0">
        <div className="px-5 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <GeistDeskLogo size="xs" showText={false} />
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                Kunden-Portal
              </p>
              <p className="text-sm font-black truncate">Hubcom ServiceDesk</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="leading-snug">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-4 space-y-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-slate-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{session.name || session.email}</p>
              <p className="text-[11px] text-slate-500 truncate">{session.role.replace('CLIENT_', '')}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
          >
            <LogOut className="w-3.5 h-3.5" />
            Abmelden
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
