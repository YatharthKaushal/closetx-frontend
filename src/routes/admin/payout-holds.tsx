import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Lock, Plus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatAge, formatPaise } from '@/lib/status';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label, FieldError } from '@/components/ui/label';
import { StoreCombobox } from '@/components/ui/store-combobox';

type Hold = {
  id: string;
  storeId: string;
  disputeId: string;
  payoutId: string | null;
  amountPaise: number;
  reason: string;
  status: 'active' | 'released';
  createdAt: string;
  releasedAt: string | null;
  releasedReason: string | null;
};

export function PayoutHoldsPanel() {
  const [createOpen, setCreateOpen] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState<Hold | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payout-holds'],
    queryFn: () => api<Hold[]>('/admin/payout-holds?limit=200'),
  });
  const list = data ?? [];
  const active = list.filter((h) => h.status === 'active');
  const released = list.filter((h) => h.status === 'released');

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-[13px] text-ink-3 leading-relaxed">
          Hold back a disputed amount from a retailer's next payout. It releases on its own once the
          dispute is settled; a manual release is recorded with a reason.
        </p>
        <Button variant="accent" size="sm" className="shrink-0" iconLeft={<Plus className="size-3.5" />} onClick={() => setCreateOpen(true)}>
          Place hold
        </Button>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active <span className="ml-1.5 text-warning font-mono">{active.length}</span></TabsTrigger>
          <TabsTrigger value="released">Released <span className="ml-1.5 text-ink-3">{released.length}</span></TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          {isLoading ? <Skeleton className="h-32" /> : active.length === 0 ? <Empty kicker="None" title="No active holds." /> : (
            <Table rows={active} onRelease={setReleaseTarget} />
          )}
        </TabsContent>
        <TabsContent value="released">
          {isLoading ? <Skeleton className="h-32" /> : released.length === 0 ? <Empty kicker="None" title="No released holds yet." /> : (
            <Table rows={released} onRelease={() => undefined} />
          )}
        </TabsContent>
      </Tabs>

      <CreateHoldDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {releaseTarget && (
        <ReleaseDialog
          hold={releaseTarget}
          onClose={() => setReleaseTarget(null)}
        />
      )}
    </div>
  );
}

function Table({ rows, onRelease }: { rows: Hold[]; onRelease: (h: Hold) => void }) {
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-[12.5px]">
          <thead className="bg-bg-2/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-ink-3">Store</th>
              <th className="px-3 py-2 text-left font-medium text-ink-3">Dispute</th>
              <th className="px-3 py-2 text-right font-medium text-ink-3">Amount</th>
              <th className="px-3 py-2 text-left font-medium text-ink-3">Reason</th>
              <th className="px-3 py-2 text-left font-medium text-ink-3">Status</th>
              <th className="px-3 py-2 text-left font-medium text-ink-3">Created</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => (
              <tr key={h.id} className="border-t border-line">
                <td className="px-3 py-2 font-mono text-ink-2">{h.storeId.slice(0, 8)}…</td>
                <td className="px-3 py-2 font-mono text-ink-2">{h.disputeId.slice(0, 8)}…</td>
                <td className="px-3 py-2 text-right font-mono">{formatPaise(h.amountPaise)}</td>
                <td className="px-3 py-2 text-[11.5px] text-ink-3">{h.reason}</td>
                <td className="px-3 py-2">
                  <Badge tone={h.status === 'active' ? 'warning' : 'neutral'}>{h.status}</Badge>
                </td>
                <td className="px-3 py-2 text-[11.5px] text-ink-3">{formatAge(h.createdAt)}</td>
                <td className="px-3 py-1.5 text-right">
                  {h.status === 'active' && (
                    <Button variant="outline" size="sm" iconLeft={<Lock className="size-3.5" />} onClick={() => onRelease(h)}>
                      Release
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function CreateHoldDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [storeId, setStoreId] = useState('');
  const [disputeId, setDisputeId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      api('/admin/payout-holds', {
        method: 'POST',
        body: {
          storeId: storeId.trim(),
          disputeId: disputeId.trim(),
          amountPaise: Math.round(parseFloat(amount) * 100),
          reason: reason.trim(),
        },
      }),
    onSuccess: () => {
      toast.success('Hold placed');
      void qc.invalidateQueries({ queryKey: ['admin', 'payout-holds'] });
      onClose();
      setStoreId(''); setDisputeId(''); setAmount(''); setReason('');
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Hold failed'),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Place payout hold</DialogTitle></DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!storeId.trim() || !disputeId.trim()) return setError('Store and dispute IDs required.');
            if (!reason.trim()) return setError('Reason required.');
            if (!(parseFloat(amount) > 0)) return setError('Amount must be positive.');
            submit.mutate();
          }}
          noValidate
        >
          <div>
            <Label required>Store</Label>
            <StoreCombobox value={storeId} onChange={setStoreId} />
          </div>
          <div>
            <Label htmlFor="h-dispute" required>Dispute ID</Label>
            <Input id="h-dispute" value={disputeId} onChange={(e) => setDisputeId(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="h-amt" required>Amount (₹)</Label>
            <Input id="h-amt" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="h-reason" required>Reason</Label>
            <textarea
              id="h-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              className="mt-1 w-full resize-none rounded-md border border-line bg-transparent px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-1 focus:ring-ink/30"
            />
          </div>
          <FieldError>{error}</FieldError>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="ink" caps loading={submit.isPending}>Place hold</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReleaseDialog({ hold, onClose }: { hold: Hold; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      api(`/admin/payout-holds/${hold.id}/release`, {
        method: 'POST',
        body: { reason: reason.trim() },
      }),
    onSuccess: () => {
      toast.success('Hold released');
      void qc.invalidateQueries({ queryKey: ['admin', 'payout-holds'] });
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Release failed'),
  });

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Release hold of {formatPaise(hold.amountPaise)}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!reason.trim()) return setError('Reason required.');
            submit.mutate();
          }}
          noValidate
        >
          <div>
            <Label htmlFor="rel-reason" required>Reason</Label>
            <textarea
              id="rel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              className="mt-1 w-full resize-none rounded-md border border-line bg-transparent px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-1 focus:ring-ink/30"
            />
          </div>
          <FieldError>{error}</FieldError>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="ink" caps loading={submit.isPending}>Release</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
