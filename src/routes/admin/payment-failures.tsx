import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowUpRight, BellRing, Lock } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatAge, formatPaise, paymentMethodLabel } from '@/lib/status';
import type { PaymentFailureRow } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableId } from '@/components/ui/copyable-id';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

type DialogState = { kind: 'notify' | 'release'; row: PaymentFailureRow } | null;

export function PaymentFailuresPanel() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [note, setNote] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payment-failures'],
    queryFn: () => api<PaymentFailureRow[]>('/admin/payment-failures'),
  });
  const list = data ?? [];

  const notifyM = useMutation({
    mutationFn: (id: string) =>
      api(`/admin/payment-failures/${id}/contact-consumer`, {
        method: 'POST',
        body: note.trim() ? { note: note.trim() } : {},
      }),
    onSuccess: () => {
      toast.success('Consumer notified');
      setDialog(null);
      setNote('');
      void qc.invalidateQueries({ queryKey: ['admin', 'payment-failures'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  const releaseM = useMutation({
    mutationFn: (id: string) =>
      api(`/admin/payment-failures/${id}/release-inventory`, {
        method: 'POST',
        body: note.trim() ? { reason: note.trim() } : {},
      }),
    onSuccess: () => {
      toast.success('Inventory released');
      setDialog(null);
      setNote('');
      void qc.invalidateQueries({ queryKey: ['admin', 'payment-failures'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  return (
    <div>
      <p className="mb-4 max-w-3xl text-[13px] text-ink-3 leading-relaxed">
        Payments that didn't go through. Ask the customer to try again, or release the items being
        held for that order so other shoppers can buy them.
      </p>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : list.length === 0 ? (
        <Empty kicker="All clear" title="No payment failures right now." />
      ) : (
        <ul className="space-y-2">
          {list.map((f) => (
            <Card key={f.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold text-ink">{f.consumerEmail ?? '—'}</span>
                      {f.failureCode && <Badge tone="danger" pulse>{f.failureCode}</Badge>}
                      <Badge tone="neutral" flat>{paymentMethodLabel(f.method)}</Badge>
                      {f.reservationStillHeld && <Badge tone="warning" pulse>Reservation held</Badge>}
                      {f.consumerNotifiedAt && <Badge tone="success" flat>Notified</Badge>}
                      {f.inventoryReleasedAt && <Badge tone="neutral" flat>Inventory released</Badge>}
                    </div>
                    <div className="mt-1 text-[12px] text-ink-3">
                      <CopyableId value={f.orderId} label="order id" /> · {formatPaise(f.amountPaise)} · failed {formatAge(f.failedAt)}
                    </div>
                    {f.failureMessage && <div className="mt-1 text-[12px] text-ink-2 italic">{f.failureMessage}</div>}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0 sm:flex-row">
                    <Button
                      size="sm"
                      variant="outline"
                      iconLeft={<BellRing className="size-3.5" />}
                      disabled={Boolean(f.consumerNotifiedAt)}
                      onClick={() => setDialog({ kind: 'notify', row: f })}
                    >
                      {f.consumerNotifiedAt ? 'Notified' : 'Notify consumer'}
                    </Button>
                    {f.reservationStillHeld && (
                      <Button
                        size="sm"
                        variant="outline"
                        iconLeft={<Lock className="size-3.5" />}
                        onClick={() => setDialog({ kind: 'release', row: f })}
                      >
                        Release reservation
                      </Button>
                    )}
                    <Button asChild variant="ghost" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                      <Link to={`/admin/orders/${f.orderId}`}>Open order</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </ul>
      )}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && !(notifyM.isPending || releaseM.isPending) && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.kind === 'notify' ? 'Notify consumer about failed payment' : 'Release inventory reservation'}
            </DialogTitle>
            <DialogDescription>
              {dialog?.kind === 'notify'
                ? 'A notification is sent to the consumer inbox. Optional note is recorded on the audit trail.'
                : 'Frees the reserved units for other shoppers. This is irreversible.'}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="note">{dialog?.kind === 'release' ? 'Reason' : 'Note'}</Label>
            <textarea
              id="note"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={dialog?.kind === 'release' ? 'e.g. consumer unreachable for 24h' : 'optional'}
              className="mt-1 w-full rounded border border-line-2 bg-bg px-2 py-1 text-[13px]"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={notifyM.isPending || releaseM.isPending}>Cancel</Button>
            <Button
              variant={dialog?.kind === 'release' ? 'danger' : 'ink'}
              loading={notifyM.isPending || releaseM.isPending}
              onClick={() => {
                if (!dialog) return;
                if (dialog.kind === 'notify') notifyM.mutate(dialog.row.id);
                else releaseM.mutate(dialog.row.id);
              }}
            >
              {dialog?.kind === 'notify' ? 'Send notification' : 'Release inventory'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
