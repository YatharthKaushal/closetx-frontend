import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, RefreshCw, CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatAge, formatPaise } from '@/lib/status';
import type {
  PaymentReconDiscrepancy,
  PaymentSettlementDetail,
  PaymentSettlementRow,
} from '@/lib/types';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const STATUS_TONE = {
  uploaded: 'warning',
  reconciled: 'success',
  partial: 'warning',
  closed: 'neutral',
} as const;

const DISC_TONE: Record<PaymentReconDiscrepancy['kind'], 'warning' | 'danger'> = {
  amount_mismatch: 'warning',
  missing_in_capture: 'danger',
  missing_in_settlement: 'danger',
  status_mismatch: 'warning',
  duplicate: 'danger',
};

const DISC_LABEL: Record<PaymentReconDiscrepancy['kind'], string> = {
  amount_mismatch: "Amount doesn't match",
  missing_in_capture: 'Not in our records',
  missing_in_settlement: 'Not in provider file',
  status_mismatch: "Status doesn't match",
  duplicate: 'Duplicate',
};

export function PaymentReconciliationPanel() {
  const qc = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [drillId, setDrillId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['admin', 'payment-reconciliation'],
    queryFn: () => api<PaymentSettlementRow[]>('/admin/payment-reconciliation'),
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-[13px] text-ink-3 leading-relaxed">
          Upload the statement from your payment provider. We check every line in it against the
          payments we recorded and flag anything that doesn't match.
        </p>
        <Button variant="ink" caps className="shrink-0" iconLeft={<Upload className="size-3.5" />} onClick={() => setUploadOpen(true)}>
          Upload statement
        </Button>
      </div>

      {list.isLoading ? (
        <Skeleton className="h-32" />
      ) : (list.data ?? []).length === 0 ? (
        <Empty kicker="No settlements yet" title="Upload a settlement file to start reconciling." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-[12.5px]">
              <thead className="bg-bg-2/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Settlement</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Gateway</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Cycle</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Total</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Match / Total</th>
                  <th className="px-3 py-2 text-right font-medium text-ink-3">Open issues</th>
                  <th className="px-3 py-2 text-left font-medium text-ink-3">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {(list.data ?? []).map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="px-3 py-2"><CopyableId value={r.id} label="settlement id" /></td>
                    <td className="px-3 py-2 capitalize">{r.gatewayName}</td>
                    <td className="px-3 py-2 text-ink-3">
                      {new Date(r.cycleStart).toLocaleDateString('en-IN')} → {new Date(r.cycleEnd).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{formatPaise(r.summary.totalAmountPaise ?? 0)}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.summary.matched ?? 0} / {r.summary.totalEntries ?? 0}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono ${r.openDiscrepancies > 0 ? 'text-danger' : 'text-ink-3'}`}>
                      {r.openDiscrepancies}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={STATUS_TONE[r.status]} pulse={r.status === 'partial'}>{r.status}</Badge>
                      <div className="mt-0.5 text-[11px] text-ink-4">uploaded {formatAge(r.uploadedAt)}</div>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <Button variant="outline" size="sm" onClick={() => setDrillId(r.id)}>
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onDone={() => qc.invalidateQueries({ queryKey: ['admin', 'payment-reconciliation'] })}
      />

      <DrillDialog
        settlementId={drillId}
        onClose={() => setDrillId(null)}
        onMutate={() => qc.invalidateQueries({ queryKey: ['admin', 'payment-reconciliation'] })}
      />
    </div>
  );
}

function UploadDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const [gatewayName, setGatewayName] = useState('mock');
  const [cycleStart, setCycleStart] = useState('');
  const [cycleEnd, setCycleEnd] = useState('');
  const [fileRef, setFileRef] = useState('');
  const [payload, setPayload] = useState('');
  const [error, setError] = useState('');

  const upload = useMutation({
    mutationFn: () =>
      api<{ id: string; summary: Record<string, number> }>(
        '/admin/payment-reconciliation/upload',
        {
          method: 'POST',
          body: {
            gatewayName,
            cycleStart: new Date(cycleStart).toISOString(),
            cycleEnd: new Date(cycleEnd).toISOString(),
            fileRef: fileRef.trim() || undefined,
            payload,
          },
        },
      ),
    onSuccess: (res) => {
      toast.success(`Reconciled — ${res.summary.matched ?? 0}/${res.summary.totalEntries ?? 0} matched`);
      onOpenChange(false);
      setPayload('');
      setFileRef('');
      onDone();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Failed'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload settlement file</DialogTitle>
          <DialogDescription>
            Paste the contents of the settlement file (a CSV with the columns
            gateway_ref, amount_paise, tx_at).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label required>Gateway</Label>
              <Input value={gatewayName} onChange={(e) => setGatewayName(e.target.value)} placeholder="mock" />
            </div>
            <div>
              <Label>File ref (optional)</Label>
              <Input value={fileRef} onChange={(e) => setFileRef(e.target.value)} placeholder="settlement-2026-05-20.csv" />
            </div>
            <div>
              <Label required>Cycle start</Label>
              <Input type="datetime-local" value={cycleStart} onChange={(e) => setCycleStart(e.target.value)} />
            </div>
            <div>
              <Label required>Cycle end</Label>
              <Input type="datetime-local" value={cycleEnd} onChange={(e) => setCycleEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <Label required>Payload (CSV)</Label>
            <textarea
              rows={8}
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              placeholder="gateway_ref,amount_paise,tx_at&#10;PAY-XYZ,100000,2026-05-20T10:00:00Z"
              className="mt-1 w-full rounded border border-line-2 bg-bg px-2 py-1 font-mono text-[12px]"
            />
          </div>
          {error && <div className="text-[12px] text-danger">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={upload.isPending}>Cancel</Button>
          <Button
            variant="ink"
            loading={upload.isPending}
            disabled={!cycleStart || !cycleEnd || !payload.trim()}
            onClick={() => upload.mutate()}
          >
            Upload + reconcile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DrillDialog({
  settlementId,
  onClose,
  onMutate,
}: {
  settlementId: string | null;
  onClose: () => void;
  onMutate: () => void;
}) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ['admin', 'payment-reconciliation', settlementId],
    queryFn: () => api<PaymentSettlementDetail>(`/admin/payment-reconciliation/${settlementId}`),
    enabled: Boolean(settlementId),
  });

  const rerunM = useMutation({
    mutationFn: () => api(`/admin/payment-reconciliation/${settlementId}/rerun`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Reconciliation rerun');
      void qc.invalidateQueries({ queryKey: ['admin', 'payment-reconciliation', settlementId] });
      onMutate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  const [resolveDialog, setResolveDialog] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const resolveM = useMutation({
    mutationFn: (dId: string) =>
      api(`/admin/payment-reconciliation/${settlementId}/discrepancies/${dId}/resolve`, {
        method: 'POST',
        body: { note: resolveNote.trim() },
      }),
    onSuccess: () => {
      toast.success('Discrepancy resolved');
      setResolveDialog(null);
      setResolveNote('');
      void qc.invalidateQueries({ queryKey: ['admin', 'payment-reconciliation', settlementId] });
      onMutate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  if (!settlementId) return null;

  return (
    <Dialog open={Boolean(settlementId)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Settlement detail</DialogTitle>
          <DialogDescription>
            Per-entry match status + open discrepancies. Resolve each manually after triage.
          </DialogDescription>
        </DialogHeader>
        {detail.isLoading || !detail.data ? (
          <Skeleton className="h-40" />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[12px] text-ink-3">
                <CopyableId value={detail.data.settlement.id} label="settlement id" /> ·
                {' '}gateway: <span className="font-mono text-ink-2">{detail.data.settlement.gatewayName}</span>
                {' '}· status: <Badge tone={STATUS_TONE[detail.data.settlement.status]}>{detail.data.settlement.status}</Badge>
              </div>
              <Button size="sm" variant="outline" iconLeft={<RefreshCw className="size-3.5" />} onClick={() => rerunM.mutate()} loading={rerunM.isPending}>
                Re-run reconciliation
              </Button>
            </div>

            <div>
              <h4 className="kicker text-ink-3 mb-2">Open discrepancies ({detail.data.discrepancies.filter((d) => !d.resolvedAt).length})</h4>
              {detail.data.discrepancies.length === 0 ? (
                <div className="text-[12px] text-ink-3">Nothing flagged.</div>
              ) : (
                <ul className="space-y-1.5">
                  {detail.data.discrepancies.map((d) => (
                    <li key={d.id} className="flex items-start gap-2 border border-line-2 p-2 text-[12px]">
                      <Badge tone={DISC_TONE[d.kind]} flat>{DISC_LABEL[d.kind] ?? d.kind.replace(/_/g, ' ')}</Badge>
                      <pre className="flex-1 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-ink-2">{JSON.stringify(d.details, null, 0)}</pre>
                      {d.resolvedAt ? (
                        <Badge tone="success" flat><CheckCircle2 className="mr-1 size-3" /> resolved</Badge>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setResolveDialog(d.id)}>
                          Resolve
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h4 className="kicker text-ink-3 mb-2">Entries ({detail.data.entries.length})</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead className="bg-bg-2/40">
                    <tr>
                      <th className="px-3 py-1.5 text-left text-ink-3">Gateway ref</th>
                      <th className="px-3 py-1.5 text-right text-ink-3">Amount</th>
                      <th className="px-3 py-1.5 text-left text-ink-3">Tx at</th>
                      <th className="px-3 py-1.5 text-left text-ink-3">Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.data.entries.map((e) => (
                      <tr key={e.id} className="border-t border-line">
                        <td className="px-3 py-1.5 font-mono">{e.gatewayRef}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{formatPaise(e.amountPaise)}</td>
                        <td className="px-3 py-1.5 text-ink-3">{new Date(e.txAt).toLocaleString('en-IN')}</td>
                        <td className="px-3 py-1.5">
                          <Badge tone={e.matchStatus === 'matched' ? 'success' : 'warning'} flat>
                            {e.matchStatus.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </DialogFooter>

        <Dialog open={resolveDialog !== null} onOpenChange={(o) => !o && setResolveDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resolve discrepancy</DialogTitle>
              <DialogDescription>Reason is recorded on the audit log.</DialogDescription>
            </DialogHeader>
            <div>
              <Label htmlFor="resolveNote" required>Resolution note</Label>
              <textarea
                id="resolveNote"
                rows={3}
                maxLength={500}
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                placeholder="e.g. gateway corrected the amount in their next file"
                className="mt-1 w-full rounded border border-line-2 bg-bg px-2 py-1 text-[13px]"
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setResolveDialog(null)}>Cancel</Button>
              <Button
                variant="ink"
                loading={resolveM.isPending}
                disabled={resolveNote.trim().length < 3}
                onClick={() => resolveDialog && resolveM.mutate(resolveDialog)}
              >
                Resolve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
