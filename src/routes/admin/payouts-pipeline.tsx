import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowUpRight, Eye, Play } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatAge, formatPaise } from '@/lib/status';
import type { AdminPayoutRow } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { BankAccountSelect } from '@/components/ui/bank-account-select';
import { Th, Td, useSort, sortRows, sortProps } from '@/components/ui/table';
import { bulkResultToast, runBulk } from '@/components/admin/bulk-result-toast';

type PreviewResp = {
  grossPaise: number;
  commissionPaise: number;
  commissionTaxPaise: number;
  refundsHeldPaise: number;
  adjustmentsPaise: number;
  disputeLiabilitiesPaise: number;
  disputeHoldPaise: number;
  tcsPaise: number;
  netPaise: number;
  orderCount: number;
  includedOrderIds: string[];
  activeHoldIds: string[];
  unattachedAdjustmentIds: string[];
};

export function PayoutsPipelinePanel() {
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const orderIdFromDeepLink = params.get('orderId');
  const [cycleOpen, setCycleOpen] = useState<'preview' | 'run' | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payouts-pipeline'],
    queryFn: () => api<AdminPayoutRow[]>('/admin/payouts'),
  });
  const list = data ?? [];
  const failed = list.filter((p) => p.status === 'failed');
  const others = list.filter((p) => p.status !== 'failed');

  const retryAllFailed = useMutation({
    mutationFn: (ids: string[]) =>
      runBulk(
        ids.map((id) => ({
          id,
          run: () => api(`/admin/payouts/${id}/retry`, { method: 'POST' }),
        })),
      ),
    onSuccess: (result) => {
      const byId = new Map(list.map((p) => [p.id, `${p.storeName} · ${p.period}`]));
      bulkResultToast({
        result,
        verb: 'retried',
        describe: (id) => byId.get(id) ?? id.slice(0, 8),
      });
      void qc.invalidateQueries({ queryKey: ['admin', 'payouts-pipeline'] });
    },
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-[13px] text-ink-3 leading-relaxed">
          Money owed to each retailer, ready to send to their bank. A payout that failed — usually
          because of wrong bank details — needs fixing and re-sending, and those are shown at the
          top so you can deal with them first.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" iconLeft={<Eye className="size-3.5" />} onClick={() => setCycleOpen('preview')}>
            Preview payout cycle
          </Button>
          <Button variant="accent" size="sm" iconLeft={<Play className="size-3.5" />} onClick={() => setCycleOpen('run')}>
            Run payout cycle
          </Button>
          {orderIdFromDeepLink && (
            <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
              <Link to={`/admin/orders/${orderIdFromDeepLink}`}>Back to order</Link>
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="failed">
        <TabsList>
          <TabsTrigger value="failed">Failed queue <span className="ml-1.5 text-danger font-mono">{failed.length}</span></TabsTrigger>
          <TabsTrigger value="all">All payouts <span className="ml-1.5 text-ink-3">{list.length}</span></TabsTrigger>
        </TabsList>
        <TabsContent value="failed">
          {isLoading ? (
            <Skeleton className="h-32" />
          ) : failed.length === 0 ? (
            <Empty kicker="All clear" title="No failed payouts." />
          ) : (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  loading={retryAllFailed.isPending}
                  onClick={() => {
                    if (!window.confirm(`Retry all ${failed.length} failed payouts?`)) return;
                    retryAllFailed.mutate(failed.map((p) => p.id));
                  }}
                >
                  Retry all failed
                </Button>
              </div>
              <Table list={failed} />
            </div>
          )}
        </TabsContent>
        <TabsContent value="all">
          {isLoading ? <Skeleton className="h-32" /> : <Table list={[...failed, ...others]} />}
        </TabsContent>
      </Tabs>

      <CycleDialog mode={cycleOpen} onClose={() => setCycleOpen(null)} />
    </div>
  );
}

function Table({ list }: { list: AdminPayoutRow[] }) {
  const { sort, toggle } = useSort<'store' | 'period' | 'amount' | 'status' | 'initiated'>({ key: 'initiated', dir: 'desc' });
  const sorted = sortRows(list, sort, (p, key) => {
    if (key === 'store') return p.storeName;
    if (key === 'period') return p.period;
    if (key === 'amount') return p.amountPaise;
    if (key === 'status') return p.status;
    if (key === 'initiated') return p.initiatedAt ? new Date(p.initiatedAt) : null;
    return null;
  });
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-[12.5px]">
          <thead className="bg-bg-2/40">
            <tr>
              <Th {...sortProps(sort, 'store', toggle)}>Store</Th>
              <Th {...sortProps(sort, 'period', toggle)}>Period</Th>
              <Th className="text-right" {...sortProps(sort, 'amount', toggle)}>Amount</Th>
              <Th {...sortProps(sort, 'status', toggle)}>Status</Th>
              <Th className="text-right">Retries</Th>
              <Th {...sortProps(sort, 'initiated', toggle)}>Initiated</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <Td className="text-ink">{p.storeName}</Td>
                <Td className="font-mono text-ink-2">{p.period}</Td>
                <Td className="text-right font-mono">{formatPaise(p.amountPaise)}</Td>
                <Td>
                  <Badge
                    tone={p.status === 'paid' ? 'success' : p.status === 'failed' ? 'danger' : p.status === 'processing' ? 'info' : 'warning'}
                    pulse={p.status === 'failed'}
                  >
                    {p.status.replace(/_/g, ' ')}
                  </Badge>
                </Td>
                <Td className="text-right">{p.retryCount}</Td>
                <Td className="text-[11.5px] text-ink-3">{p.initiatedAt ? formatAge(p.initiatedAt) : '—'}</Td>
                <Td className="text-right">
                  <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                    <Link to={`/admin/payouts/${p.id}`}>Open</Link>
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function CycleDialog({ mode, onClose }: { mode: 'preview' | 'run' | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [storeId, setStoreId] = useState('');
  const [cycleStart, setCycleStart] = useState('');
  const [cycleEnd, setCycleEnd] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResp | null>(null);

  const previewM = useMutation({
    mutationFn: () =>
      api<PreviewResp>('/admin/payouts/preview', {
        method: 'POST',
        body: { storeId: storeId.trim(), cycleStart, cycleEnd },
      }),
    onSuccess: (p) => setPreview(p),
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Preview failed'),
  });

  const runM = useMutation({
    mutationFn: () =>
      api('/admin/payouts/run-cycle', {
        method: 'POST',
        body: { storeId: storeId.trim(), cycleStart, cycleEnd, bankAccountId: bankAccountId.trim() },
      }),
    onSuccess: () => {
      toast.success('Cycle started');
      void qc.invalidateQueries({ queryKey: ['admin', 'payouts-pipeline'] });
      onClose();
      setPreview(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Run failed'),
  });

  return (
    <Dialog
      open={mode !== null}
      onOpenChange={(o) => {
        if (!o) { onClose(); setPreview(null); setError(null); }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'preview' ? 'Preview payout cycle' : 'Run payout cycle'}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!storeId.trim()) return setError('Store ID required.');
            if (!cycleStart || !cycleEnd) return setError('Cycle start and end required.');
            if (mode === 'preview') previewM.mutate();
            else {
              if (!bankAccountId.trim()) return setError('Bank account ID required.');
              runM.mutate();
            }
          }}
          noValidate
        >
          <div>
            <Label required>Store</Label>
            <StoreCombobox value={storeId} onChange={setStoreId} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cyc-start" required>Cycle start</Label>
              <Input id="cyc-start" type="date" value={cycleStart} onChange={(e) => setCycleStart(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="cyc-end" required>Cycle end</Label>
              <Input id="cyc-end" type="date" value={cycleEnd} onChange={(e) => setCycleEnd(e.target.value)} />
            </div>
          </div>
          {mode === 'run' && (
            <div>
              <Label required>Bank account</Label>
              <BankAccountSelect storeId={storeId} value={bankAccountId} onChange={setBankAccountId} />
            </div>
          )}

          {preview && (
            <Card>
              <CardContent className="p-4 space-y-1 text-[12.5px]">
                <Row label="Gross" value={formatPaise(preview.grossPaise)} />
                <Row label="Commission" value={`−${formatPaise(preview.commissionPaise)}`} tone="warn" />
                <Row label="Commission GST" value={`−${formatPaise(preview.commissionTaxPaise)}`} tone="warn" />
                <Row label="TCS" value={`−${formatPaise(preview.tcsPaise)}`} tone="warn" />
                <Row label="Refunds held back" value={`−${formatPaise(preview.refundsHeldPaise)}`} tone="warn" />
                <Row label="Money held for disputes" value={`−${formatPaise(preview.disputeHoldPaise)}`} tone="warn" />
                <Row label="Adjustments" value={formatPaise(preview.adjustmentsPaise)} />
                <div className="border-t border-line my-1" />
                <Row label="Net" value={formatPaise(preview.netPaise)} tone="good" />
                <div className="text-[11px] text-ink-4 mt-2">
                  {preview.orderCount} orders · {preview.activeHoldIds.length} amounts held · {preview.unattachedAdjustmentIds.length} adjustments pending
                </div>
              </CardContent>
            </Card>
          )}

          <FieldError>{error}</FieldError>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              variant={mode === 'run' ? 'ink' : 'outline'}
              caps
              loading={mode === 'preview' ? previewM.isPending : runM.isPending}
            >
              {mode === 'preview' ? 'Run preview' : 'Initiate cycle'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'warn' | 'good' }) {
  return (
    <div className="flex justify-between font-mono">
      <span className="text-ink-3">{label}</span>
      <span className={tone === 'warn' ? 'text-warning' : tone === 'good' ? 'text-success font-semibold' : 'text-ink'}>{value}</span>
    </div>
  );
}
