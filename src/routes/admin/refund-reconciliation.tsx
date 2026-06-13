import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowUpRight, Coins, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import {
  formatAge,
  formatPaise,
  refundDisbursementStatusMeta,
  refundStatusMeta,
} from '@/lib/status';
import type { Refund, RefundStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableId } from '@/components/ui/copyable-id';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Segmented } from '@/components/ui/segmented';
import { PostPayoutRecoveryPanel } from './post-payout-recovery';

const STATUS_OPTIONS: ReadonlyArray<{ value: RefundStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'partially_disbursed', label: 'Partly paid' },
  { value: 'failed', label: 'Failed' },
];

export function RefundsPanel() {
  const [section, setSection] = useState<'refunds' | 'recovery'>('refunds');
  const [status, setStatus] = useState<RefundStatus | 'all'>('all');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'refunds', status],
    queryFn: () => {
      const qs = status === 'all' ? '' : `?status=${status}`;
      return api<Refund[]>(`/admin/refunds${qs}`);
    },
    refetchInterval: 6000,
  });

  const forceFail = useMutation({
    mutationFn: ({ refundId, dId }: { refundId: string; dId: string }) =>
      api(`/admin/refunds/${refundId}/disbursements/${dId}/force-fail`, {
        method: 'POST',
        body: { reason: 'Admin force-fail from refunds page' },
      }),
    onSuccess: () => {
      toast.success('Disbursement failed; retry chained');
      void qc.invalidateQueries({ queryKey: ['admin', 'refunds'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Force-fail failed'),
  });

  const retry = useMutation({
    mutationFn: ({ refundId, dId }: { refundId: string; dId: string }) =>
      api(`/admin/refunds/${refundId}/disbursements/${dId}/retry`, { method: 'POST', body: {} }),
    onSuccess: () => {
      toast.success('Disbursement retried');
      void qc.invalidateQueries({ queryKey: ['admin', 'refunds'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Retry failed'),
  });

  const list = data ?? [];

  return (
    <div>
      <Segmented
        value={section}
        onChange={(v) => setSection(v as 'refunds' | 'recovery')}
        size="md"
        className="mb-4"
        options={[
          { value: 'refunds', label: 'Refunds' },
          { value: 'recovery', label: 'Post-payout recovery' },
        ]}
      />

      {section === 'recovery' ? (
        <PostPayoutRecoveryPanel />
      ) : (
        <>
      <p className="mb-4 max-w-3xl text-[13px] text-ink-3 leading-relaxed">
        Money sent back to customers after a return was accepted. A single refund can be paid out in
        more than one way — as store wallet credit, back to the card or UPI the customer originally
        paid with, or both. Each of those payments shows below the refund.
      </p>

      <div className="mb-4 rounded-md border border-info/30 bg-info-soft/30 px-3 py-2 text-[12px] text-ink-2">
        <strong className="text-info uppercase tracking-wide text-[11px]">Good to know:</strong>{' '}
        When an order is refunded, the customer gets back any loyalty points they earned on it — even
        if they're banned from rewards. A rewards ban only stops them earning <em>new</em> points; it
        never takes away points they had already earned.
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[12px] text-ink-3">{list.length} refund{list.length === 1 ? '' : 's'}</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : list.length === 0 ? (
        <Empty kicker="No refunds yet" title="Refunds appear here when returns are accepted." />
      ) : (
        <ul className="space-y-3">
          {list.map((rf) => {
            const m = refundStatusMeta(rf.status);
            return (
              <Card key={rf.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge tone={m.tone}>{m.label}</Badge>
                        <CopyableId value={rf.id} label="refund id" />
                        <span className="text-[11.5px] text-ink-3">{formatAge(rf.createdAt)}</span>
                      </div>
                      <div className="text-[12px] text-ink-3 mt-1">
                        Order:{' '}
                        <Link to={`/admin/orders/${rf.orderId}`} className="font-mono hover:text-accent inline-flex items-center gap-0.5">
                          {rf.orderId} <ArrowUpRight className="size-3" />
                        </Link>
                      </div>
                      {rf.reason && <div className="text-[11.5px] text-ink-3 italic mt-1">{rf.reason}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono tabular-nums text-[16px] text-ink">
                        {formatPaise(rf.totalRefundPaise)}
                      </div>
                      <div className="text-[10.5px] text-ink-3 mt-0.5 inline-flex items-center gap-1">
                        <Coins className="size-3" /> {rf.disbursements.length} disbursement{rf.disbursements.length === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>
                  <ul className="space-y-1.5 border-t border-line pt-3">
                    {rf.disbursements.map((d) => {
                      const dm = refundDisbursementStatusMeta(d.status);
                      return (
                        <li key={d.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge tone={dm.tone}>{dm.label}</Badge>
                            <span className="text-ink-3">
                              {d.destination === 'wallet' ? 'Store wallet' : 'Original payment method'}
                            </span>
                            <span className="font-mono tabular-nums text-ink">{formatPaise(d.amountPaise)}</span>
                            {d.previousDisbursementId && (
                              <span className="text-[10.5px] text-ink-4 italic">
                                retry of {d.previousDisbursementId.slice(0, 10)}…
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {d.status === 'succeeded' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                iconLeft={<AlertCircle className="size-3" />}
                                onClick={() => forceFail.mutate({ refundId: rf.id, dId: d.id })}
                              >
                                Force fail
                              </Button>
                            )}
                            {d.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="outline"
                                iconLeft={<RefreshCcw className="size-3" />}
                                onClick={() => retry.mutate({ refundId: rf.id, dId: d.id })}
                              >
                                Retry
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </ul>
      )}
        </>
      )}
    </div>
  );
}
