import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatAge, formatPaise } from '@/lib/status';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label, FieldError } from '@/components/ui/label';
import { StoreCombobox } from '@/components/ui/store-combobox';

type Adjustment = {
  id: string;
  storeId: string;
  payoutId: string | null;
  direction: 'debit' | 'credit';
  amountPaise: number;
  reason: string;
  createdAt: string;
};

export function PayoutAdjustmentsPanel() {
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payout-adjustments'],
    queryFn: () => api<Adjustment[]>('/admin/payout-adjustments?limit=200'),
  });
  const list = data ?? [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-[13px] text-ink-3 leading-relaxed">
          Add a charge to a retailer's next payout (to recover money they were overpaid) or a credit
          (a goodwill payment to them).
        </p>
        <Button variant="accent" size="sm" className="shrink-0" iconLeft={<Plus className="size-3.5" />} onClick={() => setCreateOpen(true)}>
          New adjustment
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-32" />
      ) : list.length === 0 ? (
        <Empty kicker="None" title="No adjustments recorded." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bg-2/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Store</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Direction</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Amount</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Reason</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Applied to payout</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id} className="border-t border-line">
                    <td className="px-3 py-2 font-mono text-ink-2">{a.storeId.slice(0, 8)}…</td>
                    <td className="px-3 py-2">
                      <Badge tone={a.direction === 'debit' ? 'danger' : 'success'} flat>
                        {a.direction}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {a.direction === 'debit' ? '−' : '+'}{formatPaise(a.amountPaise)}
                    </td>
                    <td className="px-3 py-2 text-[11.5px] text-ink-3">{a.reason}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-ink-3">
                      {a.payoutId ? `${a.payoutId.slice(0, 8)}…` : 'pending'}
                    </td>
                    <td className="px-3 py-2 text-[11.5px] text-ink-3">{formatAge(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function CreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [storeId, setStoreId] = useState('');
  const [direction, setDirection] = useState<'debit' | 'credit'>('debit');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      api('/admin/payout-adjustments', {
        method: 'POST',
        body: {
          storeId: storeId.trim(),
          direction,
          amountPaise: Math.round(parseFloat(amount) * 100),
          reason: reason.trim(),
        },
      }),
    onSuccess: () => {
      toast.success('Adjustment recorded');
      void qc.invalidateQueries({ queryKey: ['admin', 'payout-adjustments'] });
      onClose();
      setStoreId(''); setAmount(''); setReason('');
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Adjustment failed'),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>New payout adjustment</DialogTitle></DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!storeId.trim()) return setError('Store ID required.');
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
            <Label required>Direction</Label>
            <div className="mt-1 flex gap-2">
              <Button type="button" variant={direction === 'debit' ? 'ink' : 'outline'} size="sm" onClick={() => setDirection('debit')}>
                Debit (recover)
              </Button>
              <Button type="button" variant={direction === 'credit' ? 'ink' : 'outline'} size="sm" onClick={() => setDirection('credit')}>
                Credit (goodwill)
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="adj-amt" required>Amount (₹)</Label>
            <Input id="adj-amt" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="adj-reason" required>Reason</Label>
            <textarea
              id="adj-reason"
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
            <Button type="submit" variant="ink" caps loading={submit.isPending}>Record</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
