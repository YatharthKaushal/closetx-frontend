import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Banknote, Send, Timer } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAge, formatPaise } from '@/lib/status';
import type { WalletPayout, WalletPayoutStatus } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const STATUS_TONE: Record<WalletPayoutStatus, 'warning' | 'info' | 'success' | 'neutral' | 'danger'> = {
  pending_claim: 'warning',
  awaiting_bank: 'info',
  paid: 'success',
  escheated: 'neutral',
  failed: 'danger',
};

const STATUS_LABEL: Record<WalletPayoutStatus, string> = {
  pending_claim: 'Waiting for customer to claim',
  awaiting_bank: 'Ready to pay to bank',
  paid: 'Paid',
  escheated: 'Returned to platform',
  failed: 'Failed',
};

export function WalletPayoutsPanel() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'wallet-payouts'],
    queryFn: () => api<WalletPayout[]>('/admin/wallet-payouts'),
  });
  const list = data ?? [];

  async function disburse(id: string) {
    try {
      await api(`/admin/wallet-payouts/${id}/disburse`, { method: 'POST' });
      toast.success('Payout queued');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'wallet-payouts'] });
    } catch { toast.error('Failed'); }
  }

  async function escheat(id: string) {
    try {
      await api(`/admin/wallet-payouts/${id}/escheat`, { method: 'POST' });
      toast.success('Returned to platform');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'wallet-payouts'] });
    } catch { toast.error('Failed'); }
  }

  return (
    <div>
      <p className="mb-4 max-w-3xl text-[13px] text-ink-3 leading-relaxed">
        Customers who closed their account but still had money in their wallet. Pay it to their
        verified bank account while the claim window is open; after it closes, the unclaimed money
        is returned to the platform.
      </p>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active queue</TabsTrigger>
          <TabsTrigger value="settled">Settled</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <List loading={isLoading} list={list.filter((p) => p.status === 'pending_claim' || p.status === 'awaiting_bank' || p.status === 'failed')} onDisburse={disburse} onEscheat={escheat} />
        </TabsContent>
        <TabsContent value="settled">
          <List loading={isLoading} list={list.filter((p) => p.status === 'paid' || p.status === 'escheated')} onDisburse={disburse} onEscheat={escheat} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function List({ loading, list, onDisburse, onEscheat }: { loading: boolean; list: WalletPayout[]; onDisburse: (id: string) => void; onEscheat: (id: string) => void }) {
  if (loading) return <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-24" />)}</div>;
  if (list.length === 0) return <Empty kicker="Empty" title="No payouts in this bucket." />;
  return (
    <ul className="space-y-2">
      {list.map((p) => {
        const claimDaysLeft = Math.round((new Date(p.claimWindowEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return (
          <Card key={p.id}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold text-ink">{p.consumerEmail}</span>
                    <Badge tone={STATUS_TONE[p.status]} pulse={p.status === 'pending_claim' || p.status === 'failed'}>
                      {STATUS_LABEL[p.status]}
                    </Badge>
                    <Badge tone="neutral" flat>{formatPaise(p.balancePaise)}</Badge>
                  </div>
                  <div className="mt-1 text-[12px] text-ink-3">
                    Closed {formatAge(p.closedAt)}
                    {p.status !== 'paid' && p.status !== 'escheated' && (
                      <>
                        <Timer className="size-3 inline mx-1" />
                        {claimDaysLeft > 0 ? `${claimDaysLeft}d to claim` : 'Claim window expired'}
                      </>
                    )}
                    {p.bankAccountMasked && <> · Bank {p.bankAccountMasked}</>}
                    {p.paidAt && <> · Paid {formatAge(p.paidAt)}</>}
                  </div>
                </div>
                {p.status === 'awaiting_bank' && (
                  <Button size="sm" variant="accent" iconLeft={<Send className="size-3.5" />} onClick={() => onDisburse(p.id)}>
                    Pay out
                  </Button>
                )}
                {p.status === 'pending_claim' && claimDaysLeft <= 0 && (
                  <Button size="sm" variant="outline" iconLeft={<Banknote className="size-3.5" />} onClick={() => onEscheat(p.id)}>
                    Return to platform
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </ul>
  );
}
