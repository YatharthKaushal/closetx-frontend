import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Truck } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';

/**
 * Delivery-agent shell. Deliberately minimal and phone-first — an agent works
 * this on the doorstep, so there's no sidebar, just a sticky header and a single
 * scrolling column. Routes underneath are gated to the 'delivery_agent' sub-role.
 */
export default function AgentLayout() {
  const navigate = useNavigate();
  const name = useAuth((s) =>
    s.session?.kind === 'retailer' ? s.session.retailer.legalName : 'Agent',
  );
  const signOut = useAuth((s) => s.signOut);

  return (
    <div className="min-h-dvh bg-bg-2/40">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-2 px-4 py-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
            <Truck className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold leading-tight text-ink">My deliveries</div>
            <div className="truncate text-[11px] text-ink-4">{name}</div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Sign out"
            title="Sign out"
            onClick={() => {
              signOut();
              navigate('/retailer/login', { replace: true });
            }}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}
