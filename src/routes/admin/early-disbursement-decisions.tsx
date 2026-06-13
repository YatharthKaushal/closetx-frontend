import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAge, formatPaise } from '@/lib/status';
import type { EarlyDisbursementRequest } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReasonActionDialog } from '@/components/admin/reason-action-dialog';

export function EarlyPayoutsPanel() {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState<EarlyDisbursementRequest | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'early-disbursement-decisions'],
    queryFn: () => api<EarlyDisbursementRequest[]>('/admin/early-disbursement-decisions'),
  });
  const list = data ?? [];

  async function approve(r: EarlyDisbursementRequest) {
    try {
      await api<{ id: string; status: string }>(`/admin/early-disbursement-decisions/${r.id}/approve`, { method: 'POST' });
      toast.success(`Approved ${r.storeName} ${formatPaise(r.amountPaise)}`);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'early-disbursement-decisions'] });
    } catch {
      toast.error('Failed to approve request');
    }
  }

  async function reject(r: EarlyDisbursementRequest, reason: string) {
    try {
      await api(`/admin/early-disbursement-decisions/${r.id}/reject`, {
        method: 'POST',
        body: { reason },
      });
      toast.success(`Rejected ${r.storeName}`);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'early-disbursement-decisions'] });
    } catch {
      toast.error('Failed to reject request');
    }
  }

  return (
    <div>
      <p className="mb-4 max-w-3xl text-[13px] text-ink-3 leading-relaxed">
        Retailers asking to be paid early, before the normal payout date. Approve to pay them now
        (the standard early-payout fee applies), or reject with a reason.
      </p>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending <span className="ml-1.5 text-warning font-mono">{list.filter((r) => r.status === 'pending').length}</span></TabsTrigger>
          <TabsTrigger value="approved">Approved <span className="ml-1.5 text-ink-3">{list.filter((r) => r.status === 'approved').length}</span></TabsTrigger>
          <TabsTrigger value="rejected">Rejected <span className="ml-1.5 text-ink-3">{list.filter((r) => r.status === 'rejected').length}</span></TabsTrigger>
        </TabsList>

        {(['pending', 'approved', 'rejected'] as const).map((tab) => (
          <TabsContent key={tab} value={tab}>
            {isLoading ? <Skeleton className="h-32" /> : (
              (() => {
                const filtered = list.filter((r) => r.status === tab);
                if (filtered.length === 0) return <Empty kicker="None" title="Nothing in this bucket." />;
                return (
                  <ul className="space-y-2">
                    {filtered.map((r) => (
                      <Card key={r.id}>
                        <CardContent className="p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[14px] font-semibold text-ink">{r.storeName}</span>
                                <Badge tone={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'} pulse={r.status === 'pending'}>{r.status}</Badge>
                                <Badge tone="neutral" flat>{formatPaise(r.amountPaise)}</Badge>
                              </div>
                              <p className="mt-1 text-[12.5px] text-ink-2">{r.reason}</p>
                              <div className="mt-1 text-[11.5px] text-ink-4">Requested {formatAge(r.requestedAt)}{r.decidedAt && <> · Decided {formatAge(r.decidedAt)}</>}</div>
                              {r.decisionNote && <p className="mt-1 text-[11.5px] italic text-ink-3">{r.decisionNote}</p>}
                            </div>
                            {r.status === 'pending' && (
                              <div className="flex gap-1.5 shrink-0">
                                <Button size="sm" variant="outline" className="text-danger border-danger/40 hover:bg-danger/5" iconLeft={<X className="size-3.5" />} onClick={() => setRejecting(r)}>Reject</Button>
                                <Button size="sm" variant="accent" iconLeft={<Check className="size-3.5" />} onClick={() => void approve(r)}>Approve</Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </ul>
                );
              })()
            )}
          </TabsContent>
        ))}
      </Tabs>

      <ReasonActionDialog
        open={Boolean(rejecting)}
        title="Reject early disbursement?"
        description="Retailer is notified with the reason. They can re-request after addressing the cause."
        confirmLabel="Reject"
        danger
        onClose={() => setRejecting(null)}
        onConfirm={(reason) => { void reject(rejecting!, reason); setRejecting(null); }}
      />
    </div>
  );
}
