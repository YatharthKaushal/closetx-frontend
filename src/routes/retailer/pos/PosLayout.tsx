import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ScanLine, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { usePermission } from '@/lib/use-permission';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';

/**
 * Full-screen POS shell. Like the delivery-agent surface, it deliberately escapes the
 * dashboard sidebar so the cashier gets the whole viewport. Every POS surface (register,
 * sales, held bills, day summary, labels) lives here as an internal tab, so the dashboard
 * sidebar carries just one "Register" entry. Mounted at /retailer/pos.
 */
const TABS = [
  { to: '/retailer/pos', label: 'Register', end: true, action: 'pos.sell' },
  { to: '/retailer/pos/sales', label: 'Sales', end: false, action: 'pos.view' },
  { to: '/retailer/pos/held', label: 'Held bills', end: true, action: 'pos.sell' },
  { to: '/retailer/pos/day-summary', label: 'Day summary', end: true, action: 'pos.view' },
  { to: '/retailer/pos/labels', label: 'Labels', end: true, action: 'pos.labels' },
] as const;

export default function PosLayout() {
  const navigate = useNavigate();
  const name = useAuth((s) =>
    s.session?.kind === 'retailer' ? s.session.retailer.legalName : 'Counter',
  );

  return (
    <div className="flex min-h-dvh flex-col bg-bg-2/40">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
            <ScanLine className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold leading-tight text-ink">Counter</div>
            <div className="truncate text-[11px] text-ink-4">{name}</div>
          </div>
          <nav className="ml-2 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <PosTab key={t.to} to={t.to} end={t.end} action={t.action} label={t.label} />
            ))}
          </nav>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Exit"
            title="Exit to dashboard"
            onClick={() => navigate('/retailer/dashboard')}
          >
            <X className="size-4" />
          </Button>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

function PosTab({ to, end, action, label }: { to: string; end: boolean; action: string; label: string }) {
  const allowed = usePermission(action);
  if (!allowed) return null;
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
          isActive ? 'bg-ink text-bg' : 'text-ink-3 hover:bg-bg-3 hover:text-ink',
        )
      }
    >
      {label}
    </NavLink>
  );
}
