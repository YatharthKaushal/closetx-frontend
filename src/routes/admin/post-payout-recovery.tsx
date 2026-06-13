import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAge, formatPaise } from '@/lib/status';
import type { PostPayoutRecoveryRow } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Segmented } from '@/components/ui/segmented';
import { CopyableId } from '@/components/ui/copyable-id';

const TONE: Record<PostPayoutRecoveryRow['status'], 'warning' | 'success' | 'danger' | 'neutral'> = {
  planned: 'warning',
  debited: 'success',
  failed: 'danger',
  cancelled: 'neutral',
};

type RecoveryFilter = 'planned' | 'debited' | 'failed' | 'all';

export function PostPayoutRecoveryPanel() {
  const [filter, setFilter] = useState<RecoveryFilter>('planned');
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'post-payout-recovery'],
    queryFn: () => api<PostPayoutRecoveryRow[]>('/admin/post-payout-recovery'),
  });
  const list = data ?? [];
  const counts = {
    planned: list.filter((r) => r.status === 'planned').length,
    debited: list.filter((r) => r.status === 'debited').length,
    failed: list.filter((r) => r.status === 'failed').length,
  };
  const shown = filter === 'all' ? list : list.filter((r) => r.status === filter);

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-[13px] text-ink-3 leading-relaxed">
        Refunds for orders where the retailer was already paid. We recover that money by subtracting
        it from the retailer's next payout.
      </p>
      <Segmented
        value={filter}
        onChange={(v) => setFilter(v as RecoveryFilter)}
        size="md"
        options={[
          { value: 'planned', label: counts.planned ? `Planned · ${counts.planned}` : 'Planned' },
          { value: 'debited', label: counts.debited ? `Deducted · ${counts.debited}` : 'Deducted' },
          { value: 'failed', label: counts.failed ? `Failed · ${counts.failed}` : 'Failed' },
          { value: 'all', label: 'All' },
        ]}
      />
      <List loading={isLoading} list={shown} />
    </div>
  );
}

function List({ loading, list }: { loading: boolean; list: PostPayoutRecoveryRow[] }) {
  if (loading) return <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-24" />)}</div>;
  if (list.length === 0) return <Empty kicker="All clear" title="Nothing here." />;
  return (
    <ul className="space-y-2">
      {list.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold text-ink">{r.retailerName}</span>
                  <Badge tone={TONE[r.status]} pulse={r.status === 'planned' || r.status === 'failed'}>{r.status === 'debited' ? 'deducted' : r.status}</Badge>
                  <Badge tone="neutral" flat>{formatPaise(r.plannedDebitPaise)} to deduct</Badge>
                </div>
                <div className="mt-1 text-[12px] text-ink-3">
                  Refund <CopyableId value={r.refundId} label="refund id" /> · Order <CopyableId value={r.orderId} label="order id" />
                </div>
                <div className="mt-1 text-[11.5px] text-ink-4">
                  Created {formatAge(r.createdAt)} · Scheduled debit {new Date(r.scheduledFor).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  {r.settledAt && <> · Settled {formatAge(r.settledAt)}</>}
                </div>
                {r.reason && <div className="mt-1 text-[12px] italic text-ink-2">{r.reason}</div>}
              </div>
              <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                <Link to={`/admin/orders/${r.orderId}`}>Open order</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </ul>
  );
}
