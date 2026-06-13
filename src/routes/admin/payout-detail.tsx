import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Lock, RefreshCcw, Sliders } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatAge, formatPaise } from '@/lib/status';
import type { AdminStoreView, PayoutCycle } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';
import { WaterfallChart, type WaterfallStep } from '@/components/ui/waterfall-chart';

/**
 * Inputs are pulled by name rather than the full PayoutCycle type so the
 * waterfall has a narrow contract. Optional fields fall back to 0 to keep the
 * chart well-formed even on incomplete responses.
 */
type WaterfallInput = {
  grossPaise: number;
  commissionPaise: number;
  commissionTaxPaise?: number;
  refundsHeldPaise: number;
  adjustmentsPaise: number;
  netPaise: number;
};

function buildWaterfallSteps(p: WaterfallInput): WaterfallStep[] {
  const steps: WaterfallStep[] = [
    { label: 'Gross', amountPaise: p.grossPaise, kind: 'start' },
  ];
  if (p.commissionPaise > 0) {
    steps.push({ label: 'Commission', amountPaise: p.commissionPaise, kind: 'deduction' });
  }
  const tax = p.commissionTaxPaise ?? 0;
  if (tax > 0) {
    steps.push({ label: 'GST on commission', amountPaise: tax, kind: 'deduction' });
  }
  if (p.refundsHeldPaise > 0) {
    steps.push({ label: 'Refunds held', amountPaise: p.refundsHeldPaise, kind: 'deduction' });
  }
  if (p.adjustmentsPaise !== 0) {
    steps.push({
      label: 'Adjustments',
      // sign is encoded by the `kind` field; the chart's `+/-` prefix uses it.
      amountPaise: Math.abs(p.adjustmentsPaise),
      kind: p.adjustmentsPaise > 0 ? 'addition' : 'deduction',
    });
  }
  steps.push({ label: 'Net payout', amountPaise: p.netPaise, kind: 'total' });
  return steps;
}
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label, FieldError } from '@/components/ui/label';

type AdminPayout = PayoutCycle & { storeName: string };

export default function AdminPayoutDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payouts-pipeline', id],
    queryFn: () => api<AdminPayout>(`/admin/payouts/${id}`),
    enabled: Boolean(id),
  });

  const storesQuery = useQuery({
    queryKey: ['admin', 'stores', 'all'],
    queryFn: () => api<AdminStoreView[]>('/admin/stores'),
    enabled: Boolean(data?.storeId),
  });
  const store = storesQuery.data?.find((s) => s.id === data?.storeId);
  const retailerId = store?.retailer?.id;

  const retry = useMutation({
    mutationFn: () => api(`/admin/payouts/${id}/retry`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Retry queued');
      void qc.invalidateQueries({ queryKey: ['admin', 'payouts-pipeline'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Retry failed'),
  });

  if (isLoading) return <Page><Skeleton className="h-72" /></Page>;
  if (!data) return <Page><PageHeader title="Payout not found" /></Page>;

  return (
    <Page>
      <PageHeader
        kicker="Settlement"
        title={`${data.storeName} · ${data.period}`}
        description={`${formatPaise(data.amountPaise)} · status ${data.status}`}
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to="/admin/money?tab=payouts">Back</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge
          tone={data.status === 'failed' ? 'danger' : data.status === 'paid' ? 'success' : 'warning'}
          pulse={data.status === 'failed'}
        >
          {data.status.replace(/_/g, ' ')}
        </Badge>
        <Badge tone="neutral" flat>{data.retryCount} retries</Badge>
        {/*
         * Cross-links resolve retailerId via the stores cache. Render a
         * deterministic skeleton while that secondary query is in flight so
         * the chips don't pop in after the rest of the page is interactive.
         */}
        {data.storeId && storesQuery.isLoading ? (
          <Skeleton className="h-5 w-40 rounded-full" />
        ) : (
          <>
            {data.storeId && retailerId && (
              <Link
                to={`/admin/retailers/${retailerId}/stores/${data.storeId}`}
                className="inline-flex items-center gap-1 rounded-full border border-line bg-bg-2 px-2 py-0.5 text-[11.5px] text-ink-3 hover:text-ink hover:bg-bg-3"
              >
                Open store
              </Link>
            )}
            {retailerId && (
              <Link
                to={`/admin/retailers/${retailerId}`}
                className="inline-flex items-center gap-1 rounded-full border border-line bg-bg-2 px-2 py-0.5 text-[11.5px] text-ink-3 hover:text-ink hover:bg-bg-3"
              >
                Open retailer
              </Link>
            )}
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <SectionHeading kicker="Bank" title="Disbursal channel" />
            <MetaList
              cols={1}
              items={[
                { label: 'Account', value: data.bankAccountMasked },
                { label: 'UTR', value: data.bankConfirmationRef ?? '—', mono: true },
                ...(data.initiatedAt ? [{ label: 'Initiated', value: `${new Date(data.initiatedAt).toLocaleString('en-IN')} · ${formatAge(data.initiatedAt)}` }] : []),
                ...(data.settledAt ? [{ label: 'Settled', value: `${new Date(data.settledAt).toLocaleString('en-IN')} · ${formatAge(data.settledAt)}` }] : []),
              ]}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="outline"
                iconLeft={<RefreshCcw className="size-3.5" />}
                disabled={data.status !== 'failed' || retry.isPending}
                loading={retry.isPending}
                onClick={() => retry.mutate()}
              >
                Retry payout
              </Button>
              <Button
                variant="accent"
                iconLeft={<CheckCircle2 className="size-3.5" />}
                disabled={data.status === 'paid'}
                onClick={() => setReconcileOpen(true)}
              >
                Mark reconciled
              </Button>
              <Button variant="ghost" iconLeft={<Lock className="size-3.5" />} onClick={() => setHoldOpen(true)}>
                Hold against dispute
              </Button>
              <Button variant="ghost" iconLeft={<Sliders className="size-3.5" />} onClick={() => setAdjustOpen(true)}>
                Adjust next cycle
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-5">
            <SectionHeading kicker="Deductions" title="What came off the gross" />

            <WaterfallChart steps={buildWaterfallSteps(data)} />

            {data.deductions && data.deductions.length > 0 && (
              <ul className="divide-y divide-line border-t border-line pt-2">
                {data.deductions.map((d) => (
                  <li key={d.kind} className="flex items-center justify-between py-2 text-[13px]">
                    <span className="text-ink-2">{d.label}</span>
                    <span className="font-mono text-ink">−{formatPaise(d.amountPaise)}</span>
                  </li>
                ))}
                <li className="flex items-center justify-between py-2 text-[13px] font-semibold">
                  <span className="text-ink">Net payout</span>
                  <span className="font-mono text-ink">{formatPaise(data.netPaise)}</span>
                </li>
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ReconcileDialog
        open={reconcileOpen}
        onClose={() => setReconcileOpen(false)}
        payoutId={id ?? ''}
      />
      <HoldDialog
        open={holdOpen}
        onClose={() => setHoldOpen(false)}
        storeId={data.storeId}
        defaultAmount={data.netPaise}
      />
      <AdjustmentDialog
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        storeId={data.storeId}
      />
    </Page>
  );
}

function ReconcileDialog({
  open,
  onClose,
  payoutId,
}: { open: boolean; onClose: () => void; payoutId: string }) {
  const qc = useQueryClient();
  const [ref, setRef] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      api(`/admin/payouts/${payoutId}/mark-complete`, {
        method: 'POST',
        body: { bankConfirmationRef: ref.trim() },
      }),
    onSuccess: () => {
      toast.success('Payout marked reconciled');
      void qc.invalidateQueries({ queryKey: ['admin', 'payouts-pipeline'] });
      onClose();
      setRef('');
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'Mark complete failed';
      setError(msg);
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Mark payout reconciled</DialogTitle></DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!ref.trim()) return setError('Bank confirmation reference is required.');
            submit.mutate();
          }}
          noValidate
        >
          <div>
            <Label htmlFor="bank-ref" required>Bank confirmation reference (UTR)</Label>
            <Input
              id="bank-ref"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="HDFCN10000123456"
              maxLength={80}
            />
          </div>
          <FieldError>{error}</FieldError>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="ink" caps loading={submit.isPending}>Mark reconciled</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HoldDialog({
  open,
  onClose,
  storeId,
  defaultAmount,
}: { open: boolean; onClose: () => void; storeId: string; defaultAmount: number }) {
  const qc = useQueryClient();
  const [disputeId, setDisputeId] = useState('');
  const [amount, setAmount] = useState(String(Math.round(defaultAmount / 100)));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      api('/admin/payout-holds', {
        method: 'POST',
        body: {
          storeId,
          disputeId: disputeId.trim(),
          amountPaise: Math.round(parseFloat(amount) * 100),
          reason: reason.trim(),
        },
      }),
    onSuccess: () => {
      toast.success('Hold placed');
      void qc.invalidateQueries({ queryKey: ['admin', 'payout-holds'] });
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Hold failed'),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Hold payout against dispute</DialogTitle></DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!disputeId.trim()) return setError('Dispute ID required.');
            if (!reason.trim()) return setError('Reason required.');
            if (!(parseFloat(amount) > 0)) return setError('Amount must be positive.');
            submit.mutate();
          }}
          noValidate
        >
          <div>
            <Label htmlFor="hold-dispute" required>Dispute ID</Label>
            <Input id="hold-dispute" value={disputeId} onChange={(e) => setDisputeId(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="hold-amount" required>Amount (₹)</Label>
            <Input id="hold-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="hold-reason" required>Reason</Label>
            <textarea
              id="hold-reason"
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

function AdjustmentDialog({
  open,
  onClose,
  storeId,
}: { open: boolean; onClose: () => void; storeId: string }) {
  const qc = useQueryClient();
  const [direction, setDirection] = useState<'debit' | 'credit'>('debit');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      api('/admin/payout-adjustments', {
        method: 'POST',
        body: {
          storeId,
          direction,
          amountPaise: Math.round(parseFloat(amount) * 100),
          reason: reason.trim(),
        },
      }),
    onSuccess: () => {
      toast.success('Adjustment recorded');
      void qc.invalidateQueries({ queryKey: ['admin', 'payout-adjustments'] });
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Adjustment failed'),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Adjust next payout</DialogTitle></DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!reason.trim()) return setError('Reason required.');
            if (!(parseFloat(amount) > 0)) return setError('Amount must be positive.');
            submit.mutate();
          }}
          noValidate
        >
          <div>
            <Label required>Direction</Label>
            <div className="mt-1 flex gap-2">
              <Button
                type="button"
                variant={direction === 'debit' ? 'ink' : 'outline'}
                size="sm"
                onClick={() => setDirection('debit')}
              >
                Debit (recover)
              </Button>
              <Button
                type="button"
                variant={direction === 'credit' ? 'ink' : 'outline'}
                size="sm"
                onClick={() => setDirection('credit')}
              >
                Credit (goodwill)
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="adj-amount" required>Amount (₹)</Label>
            <Input id="adj-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
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
            <Button type="submit" variant="ink" caps loading={submit.isPending}>Record adjustment</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
