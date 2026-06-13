import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, MapPin, Package } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/status';
import type { DeliveryRow } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty } from '@/components/ui/empty';

const GROUPS: { key: DeliveryRow['status']; title: string; hint: string }[] = [
  { key: 'picked_up', title: 'To dispatch', hint: 'Picked up — head out' },
  { key: 'out_for_delivery', title: 'On the way', hint: 'Out for delivery' },
  { key: 'at_door', title: 'At the door', hint: 'Try-on in progress' },
];

export default function AgentDeliveries() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['agent', 'deliveries'],
    queryFn: () => api<DeliveryRow[]>('/retailer/deliveries'),
    refetchInterval: 8000,
  });
  const rows = data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <Empty
        kicker="All clear"
        title="No deliveries assigned"
        description="Orders the store assigns to you will show up here."
      />
    );
  }

  return (
    <div className="space-y-6">
      {GROUPS.map((g) => {
        const items = rows.filter((r) => r.status === g.key);
        if (items.length === 0) return null;
        return (
          <section key={g.key} className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[13px] font-semibold text-ink">{g.title}</h2>
              <span className="text-[11px] text-ink-4">{g.hint}</span>
            </div>
            <div className="space-y-2">
              {items.map((o) => (
                <DeliveryCard key={o.id} order={o} onClick={() => navigate(`/retailer/deliveries/${o.id}`)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function DeliveryCard({ order, onClick }: { order: DeliveryRow; onClick: () => void }) {
  const itemCount = order.items.reduce((n, i) => n + i.qty, 0);
  const firstItems = order.items.slice(0, 2).map((i) => `${i.qty}× ${i.listingNameSnap}`).join(', ');
  const more = order.items.length > 2 ? ` +${order.items.length - 2}` : '';
  const city = [order.addressCitySnap, order.addressPincodeSnap].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-line bg-bg p-3.5 text-left transition-colors hover:border-line-2 active:bg-bg-2"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium text-ink">{order.consumerNameSnap}</span>
          {order.deliveryMethod === 'try_and_buy' && (
            <Badge tone="success" flat>Try &amp; buy</Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-ink-3">
          <Package className="size-3 shrink-0" />
          <span className="truncate">{firstItems}{more} · {itemCount} item{itemCount === 1 ? '' : 's'}</span>
        </div>
        {city && (
          <div className="flex items-center gap-1.5 text-[12px] text-ink-3">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{city}</span>
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-[13px] font-semibold tabular-nums text-ink">
          {formatPaise(order.grandTotalPaise)}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-ink-4" />
    </button>
  );
}
