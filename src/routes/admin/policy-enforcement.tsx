import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowUpRight, Plus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { enforcementStepMeta, formatAge } from '@/lib/status';
import type { PolicyEnforcementAction } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableId } from '@/components/ui/copyable-id';
import { Label, FieldError } from '@/components/ui/label';
import { StoreCombobox } from '@/components/ui/store-combobox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type EnforcementStep = 'warning_1' | 'warning_2' | 'warning_3' | 'suspension' | 'termination' | 'lifted';
type BreachKind = 'acceptance_rate' | 'fulfilment_sla' | 'dispute_rate' | 'return_rate' | 'kyc_overdue' | 'policy_violation';

export function PolicyEnforcementPanel() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'policy-enforcement'],
    queryFn: () => api<PolicyEnforcementAction[]>('/admin/compliance/policy-enforcement?limit=100'),
  });
  const list = data ?? [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[13px] text-ink-3 leading-relaxed">
          Warning ladder, suspensions and terminations tracked per retailer. Move up the ladder when
          breaches recur; lift the warning when fixed.
        </p>
        <Button variant="ink" caps iconLeft={<Plus className="size-3.5" />} onClick={() => setDialogOpen(true)}>
          New enforcement action
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : list.length === 0 ? (
        <Empty kicker="All clear" title="No active policy enforcement actions." />
      ) : (
        <ul className="space-y-3">
          {list.map((e) => {
            const stepMeta = enforcementStepMeta(e.step);
            const metricEntries = e.metric ? Object.entries(e.metric) : [];
            return (
              <Card key={e.id}>
                <CardContent className="flex items-start justify-between gap-4 p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-medium text-ink truncate">
                        {e.storeName ?? `Store ${e.storeId}`}
                      </span>
                      <Badge tone={stepMeta.tone}>{stepMeta.label}</Badge>
                      <Badge tone="neutral" flat>{e.breachKind.replace(/_/g, ' ')}</Badge>
                    </div>
                    {(e.retailerName || e.retailerEmail) && (
                      <div className="mt-1 text-[12px] text-ink-3">
                        Owner: {e.retailerName ?? '—'}
                        {e.retailerEmail ? ` · ${e.retailerEmail}` : ''}
                      </div>
                    )}
                    {e.reason && (
                      <p className="mt-2 text-[13px] italic text-ink-2">{e.reason}</p>
                    )}
                    {metricEntries.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px]">
                        {metricEntries.map(([k, v]) => (
                          <span
                            key={k}
                            className="rounded-full border border-line bg-bg-2 px-2 py-0.5 font-mono text-ink-2"
                          >
                            {k}: {String(v)}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 text-[11.5px] text-ink-4">
                      {formatAge(e.actedAt)}
                      {e.actorName ? ` · by ${e.actorName}` : ''}
                      <span className="ml-2"><CopyableId value={e.storeId} label="store id" /></span>
                    </div>
                  </div>
                  {e.retailerId && (
                    <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                      <Link to={`/admin/retailers/${e.retailerId}`}>Open retailer</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </ul>
      )}

      <IssueEnforcementDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}

export function IssueEnforcementDialog({
  open,
  onClose,
  prefilledStoreId,
  prefilledBreachKind,
}: {
  open: boolean;
  onClose: () => void;
  prefilledStoreId?: string;
  prefilledBreachKind?: BreachKind;
}) {
  const qc = useQueryClient();
  const [storeId, setStoreId] = useState(prefilledStoreId ?? '');
  const [step, setStep] = useState<EnforcementStep>('warning_1');
  const [breachKind, setBreachKind] = useState<BreachKind>(prefilledBreachKind ?? 'acceptance_rate');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      api('/admin/compliance/policy-enforcement', {
        method: 'POST',
        body: {
          storeId: storeId.trim(),
          step,
          breachKind,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        },
      }),
    onSuccess: () => {
      toast.success('Enforcement action issued');
      void qc.invalidateQueries({ queryKey: ['admin', 'policy-enforcement'] });
      onClose();
      setStoreId(prefilledStoreId ?? '');
      setStep('warning_1');
      setBreachKind(prefilledBreachKind ?? 'acceptance_rate');
      setReason('');
      setError(null);
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.message : 'Failed to issue enforcement action';
      setError(msg);
      toast.error(msg);
    },
  });

  function handleOpenChange(o: boolean) {
    if (!o) {
      onClose();
      setError(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New enforcement action</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!storeId.trim()) return setError('Store ID is required.');
            submit.mutate();
          }}
          className="space-y-4"
          noValidate
        >
          <div>
            <Label htmlFor="pe-store-id" required>Store</Label>
            <StoreCombobox value={storeId} onChange={setStoreId} />
          </div>

          <div>
            <Label htmlFor="pe-step" required>Step</Label>
            <Select value={step} onValueChange={(v) => setStep(v as EnforcementStep)}>
              <SelectTrigger id="pe-step"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="warning_1">Warning 1</SelectItem>
                <SelectItem value="warning_2">Warning 2</SelectItem>
                <SelectItem value="warning_3">Warning 3</SelectItem>
                <SelectItem value="suspension">Suspension</SelectItem>
                <SelectItem value="termination">Termination</SelectItem>
                <SelectItem value="lifted">Lifted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="pe-breach-kind" required>Breach kind</Label>
            <Select value={breachKind} onValueChange={(v) => setBreachKind(v as BreachKind)}>
              <SelectTrigger id="pe-breach-kind"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="acceptance_rate">Acceptance rate</SelectItem>
                <SelectItem value="fulfilment_sla">Fulfilment SLA</SelectItem>
                <SelectItem value="dispute_rate">Dispute rate</SelectItem>
                <SelectItem value="return_rate">Return rate</SelectItem>
                <SelectItem value="kyc_overdue">KYC overdue</SelectItem>
                <SelectItem value="policy_violation">Policy violation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="pe-reason">Reason (optional)</Label>
            <textarea
              id="pe-reason"
              value={reason}
              onChange={(ev) => setReason(ev.target.value)}
              rows={3}
              className="mt-1 w-full resize-none rounded-md border border-line bg-transparent px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-4 focus:outline-none focus:ring-1 focus:ring-ink/30"
              placeholder="Brief explanation for the audit trail…"
            />
          </div>

          <FieldError>{error}</FieldError>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="ink" caps loading={submit.isPending}>
              Issue action
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
