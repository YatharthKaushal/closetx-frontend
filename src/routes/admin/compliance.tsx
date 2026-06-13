import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowUpRight, Download, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import {
  accountDeletionStatusMeta,
  dataExportStatusMeta,
  formatAge,
} from '@/lib/status';
import { kycReverificationStatusMeta } from '@/lib/status';
import type {
  AccountDeletionRequest,
  DataExportRequest,
  KycReverification,
  PolicyEnforcementAction,
} from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Segmented } from '@/components/ui/segmented';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const COMPLIANCE_STALE_MS = 60_000;

const CATEGORIES = [
  { value: 'kyc', label: 'KYC due' },
  { value: 'floor', label: 'Performance issues' },
  { value: 'exports', label: 'Data exports' },
  { value: 'deletions', label: 'Account deletions' },
] as const;
type Category = (typeof CATEGORIES)[number]['value'];

/**
 * Single source of truth for the compliance inbox. The four queries are owned
 * here and shared (by query key) between the in-panel category switcher and the
 * hub's outer-tab count badge, so badge and list agree by construction and only
 * one network fetch happens per list. `staleTime` suppresses refetch storms.
 */
export function useComplianceData() {
  const kyc = useQuery({
    queryKey: ['admin', 'compliance', 'kyc'],
    queryFn: () => api<KycReverification[]>('/admin/compliance/kyc'),
    staleTime: COMPLIANCE_STALE_MS,
  });
  const floor = useQuery({
    queryKey: ['admin', 'policy-enforcement'],
    queryFn: () => api<PolicyEnforcementAction[]>('/admin/compliance/policy-enforcement?limit=100'),
    staleTime: COMPLIANCE_STALE_MS,
  });
  const exports = useQuery({
    queryKey: ['admin', 'compliance', 'data-exports'],
    queryFn: () => api<DataExportRequest[]>('/admin/compliance/data-exports'),
    staleTime: COMPLIANCE_STALE_MS,
  });
  const deletions = useQuery({
    queryKey: ['admin', 'compliance', 'deletions'],
    queryFn: () => api<AccountDeletionRequest[]>('/admin/compliance/account-deletions'),
    staleTime: COMPLIANCE_STALE_MS,
  });

  const floorActive = (floor.data ?? []).filter((a) => a.step !== 'lifted');
  const exportsActive = (exports.data ?? []).filter(
    (d) => d.status === 'pending' || d.status === 'building',
  );
  const deletionsActive = (deletions.data ?? []).filter((d) => d.status === 'pending');

  const counts: Record<Category, number> = {
    kyc: kyc.data?.length ?? 0,
    floor: floorActive.length,
    exports: exportsActive.length,
    deletions: deletionsActive.length,
  };

  return {
    kyc,
    floor,
    exports,
    deletions,
    floorActive,
    counts,
    total: counts.kyc + counts.floor + counts.exports + counts.deletions,
  };
}

/**
 * The compliance inbox body, mounted as a tab inside the Compliance hub. The
 * four categories switch via a lightweight Segmented pill row (a secondary
 * control beneath the hub's primary tab bar — avoids the double-underline a
 * nested Tabs would create).
 */
export function CompliancePanel() {
  const d = useComplianceData();
  const [cat, setCat] = useState<Category>('kyc');

  return (
    <div className="space-y-4">
      <Segmented
        value={cat}
        onChange={(v) => setCat(v as Category)}
        size="md"
        options={CATEGORIES.map((c) => ({
          value: c.value,
          label: d.counts[c.value] ? `${c.label} · ${d.counts[c.value]}` : c.label,
        }))}
      />
      {cat === 'kyc' && <KycPanel data={d.kyc.data} isLoading={d.kyc.isLoading} />}
      {cat === 'floor' && <FloorBreachPanel rows={d.floorActive} isLoading={d.floor.isLoading} />}
      {cat === 'exports' && <DataExportsPanel data={d.exports.data} isLoading={d.exports.isLoading} />}
      {cat === 'deletions' && (
        <AccountDeletionsPanel data={d.deletions.data} isLoading={d.deletions.isLoading} />
      )}
    </div>
  );
}

function KycPanel({ data, isLoading }: { data: KycReverification[] | undefined; isLoading: boolean }) {
  const list = [...(data ?? [])].sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
  );
  if (isLoading) return <Skeleton className="h-32" />;
  if (list.length === 0) return <Empty kicker="All clear" title="No KYC re-verifications due." />;
  return (
    <ul className="space-y-2">
      {list.map((k) => {
        const meta = kycReverificationStatusMeta(k.status);
        const dueIn = Math.round((new Date(k.dueAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const uploadedCount = k.documents.filter((d) => d.status !== 'missing').length;
        return (
          <Card key={k.id}>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-medium text-ink truncate">
                    {k.storeName ?? `Store ${k.storeId ?? k.retailerId ?? ''}`}
                  </span>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <Badge tone={dueIn < 0 ? 'danger' : dueIn < 7 ? 'warning' : 'neutral'} flat>
                    {dueIn < 0 ? `${-dueIn} days overdue` : `Due in ${dueIn} days`}
                  </Badge>
                </div>
                <div className="mt-1 text-[12px] text-ink-3">
                  {uploadedCount}/{k.documents.length} uploaded ·{' '}
                  {k.documents.filter((d) => d.status === 'verified').length} verified ·{' '}
                  {k.documents.filter((d) => d.status === 'rejected').length} rejected
                </div>
              </div>
              <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                <Link to={`/admin/compliance/${k.id}`}>Review</Link>
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </ul>
  );
}

const STEP_TONE: Record<string, 'neutral' | 'warning' | 'danger'> = {
  warning_1: 'warning',
  warning_2: 'warning',
  warning_3: 'warning',
  suspension: 'danger',
  termination: 'danger',
  lifted: 'neutral',
};
const BREACH_LABEL: Record<string, string> = {
  acceptance_rate: 'Acceptance rate',
  fulfilment_sla: 'Fulfilment SLA',
  dispute_rate: 'Dispute rate',
  return_rate: 'Return rate',
  kyc_overdue: 'KYC overdue',
  policy_violation: 'Policy violation',
};

function FloorBreachPanel({ rows, isLoading }: { rows: PolicyEnforcementAction[]; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-32" />;
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <Empty
            kicker="All clear"
            title="No stores are failing their performance targets right now."
            description="When a store falls below the required standards, take action from the Policy enforcement tab."
            action={
              <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                <Link to="/admin/compliance?tab=policy">Go to Policy enforcement</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-ink-3">
          Stores that fell below the required standards and now have a warning, suspension or termination against them. Use the Policy enforcement tab to add a new action or lift an existing one.
        </p>
        <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
          <Link to="/admin/compliance?tab=policy">Go to Policy enforcement</Link>
        </Button>
      </div>
      <ul className="space-y-2">
        {rows.map((a) => (
          <Card key={a.id}>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-medium text-ink truncate">
                    {a.storeName ?? `Store ${a.storeId}`}
                  </span>
                  <Badge tone={STEP_TONE[a.step] ?? 'neutral'}>
                    {a.step.replace(/_/g, ' ')}
                  </Badge>
                  <Badge tone="neutral" flat>
                    {BREACH_LABEL[a.breachKind] ?? a.breachKind}
                  </Badge>
                </div>
                <div className="mt-1 text-[12px] text-ink-3">
                  Acted {formatAge(a.actedAt)}
                  {a.actorName ? ` by ${a.actorName}` : ''}
                  {a.reason ? ` · ${a.reason}` : ''}
                </div>
                {a.metric && Object.keys(a.metric).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11.5px]">
                    {Object.entries(a.metric).map(([k, v]) => (
                      <span
                        key={k}
                        className="rounded-full border border-line bg-bg-2 px-2 py-0.5 font-mono text-ink-2"
                      >
                        {k}: {String(v)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
                <Link to={a.retailerId ? `/admin/retailers/${a.retailerId}` : `/admin/compliance?tab=policy`}>
                  Open
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </ul>
    </div>
  );
}

function DataExportsPanel({ data, isLoading }: { data: DataExportRequest[] | undefined; isLoading: boolean }) {
  const qc = useQueryClient();
  const [building, setBuilding] = useState<DataExportRequest | null>(null);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [failing, setFailing] = useState<DataExportRequest | null>(null);
  const [failureReason, setFailureReason] = useState('');

  const process = useMutation({
    mutationFn: (body: { id: string; status: 'building' | 'ready' | 'failed'; downloadUrl?: string; failureReason?: string }) =>
      api(`/admin/compliance/data-exports/${body.id}/process`, { method: 'POST', body }),
    onSuccess: () => {
      toast.success('Updated');
      void qc.invalidateQueries({ queryKey: ['admin', 'compliance', 'data-exports'] });
      setBuilding(null);
      setFailing(null);
      setDownloadUrl('');
      setFailureReason('');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Update failed'),
  });

  const list = data ?? [];
  if (isLoading) return <Skeleton className="h-32" />;
  if (list.length === 0) return <Empty kicker="All clear" title="No data export requests pending." />;
  return (
    <>
      <ul className="space-y-2">
        {list.map((d) => {
          const meta = dataExportStatusMeta(d.status);
          return (
            <Card key={d.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-medium text-ink truncate">
                      {d.consumerName ?? d.consumerEmail ?? `Consumer ${d.consumerId}`}
                    </span>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <span className="text-[11.5px] text-ink-3">requested {formatAge(d.requestedAt)}</span>
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-ink-3">
                    {d.consumerEmail ?? '—'}
                    {d.consumerPhone ? ` · ${d.consumerPhone}` : ''}
                  </div>
                  {d.readyAt && (
                    <div className="mt-1 text-[12px] text-ink-3">
                      Archive ready {formatAge(d.readyAt)}
                      {d.expiresAt && ` · expires ${new Date(d.expiresAt).toLocaleDateString()}`}
                    </div>
                  )}
                  {d.failureReason && (
                    <div className="mt-1 text-[12px] text-danger">{d.failureReason}</div>
                  )}
                </div>
                <div className="flex gap-2">
                  {d.status === 'pending' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => process.mutate({ id: d.id, status: 'building' })}
                    >
                      Start build
                    </Button>
                  )}
                  {d.status === 'building' && (
                    <Button variant="outline" size="sm" onClick={() => setBuilding(d)}>
                      Mark ready
                    </Button>
                  )}
                  {(d.status === 'pending' || d.status === 'building') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:bg-danger/5"
                      onClick={() => setFailing(d)}
                    >
                      Mark failed
                    </Button>
                  )}
                  {d.status === 'ready' && d.downloadUrl && (
                    <Button asChild variant="outline" size="sm" iconLeft={<Download className="size-3.5" />}>
                      <a href={d.downloadUrl} target="_blank" rel="noreferrer">Download</a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </ul>

      <Dialog open={building !== null} onOpenChange={(o) => !o && setBuilding(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish archive</DialogTitle>
            <DialogDescription>
              Paste the secure download link for the finished file. The customer can download it from here.
              Default expiry 7 days.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="export-url" required>Download URL</Label>
            <Input
              id="export-url"
              value={downloadUrl}
              onChange={(e) => setDownloadUrl(e.target.value)}
              placeholder="https://signed.url/…"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBuilding(null)}>Cancel</Button>
            <Button
              variant="accent"
              loading={process.isPending}
              disabled={!downloadUrl.startsWith('http')}
              onClick={() =>
                building &&
                process.mutate({
                  id: building.id,
                  status: 'ready',
                  downloadUrl: downloadUrl.trim(),
                })
              }
            >
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={failing !== null} onOpenChange={(o) => !o && setFailing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark export failed</DialogTitle>
            <DialogDescription>
              Records the failure so the consumer knows. Provide a short reason.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="export-fail" required>Reason</Label>
            <Input
              id="export-fail"
              value={failureReason}
              onChange={(e) => setFailureReason(e.target.value)}
              placeholder="e.g. archive generation timeout"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFailing(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={process.isPending}
              disabled={failureReason.trim().length < 3}
              iconLeft={<X className="size-3.5" />}
              onClick={() =>
                failing &&
                process.mutate({
                  id: failing.id,
                  status: 'failed',
                  failureReason: failureReason.trim(),
                })
              }
            >
              Mark failed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AccountDeletionsPanel({ data, isLoading }: { data: AccountDeletionRequest[] | undefined; isLoading: boolean }) {
  const qc = useQueryClient();

  const complete = useMutation({
    mutationFn: (id: string) =>
      api(`/admin/compliance/account-deletions/${id}/complete`, { method: 'POST' }),
    onSuccess: () => {
      toast.success("Deletion complete · customer's personal details removed");
      void qc.invalidateQueries({ queryKey: ['admin', 'compliance', 'deletions'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Complete failed'),
  });
  const cancel = useMutation({
    mutationFn: (id: string) =>
      api(`/admin/compliance/account-deletions/${id}/cancel`, { method: 'POST', body: {} }),
    onSuccess: () => {
      toast.success('Deletion cancelled');
      void qc.invalidateQueries({ queryKey: ['admin', 'compliance', 'deletions'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Cancel failed'),
  });

  const list = data ?? [];
  if (isLoading) return <Skeleton className="h-32" />;
  if (list.length === 0) return <Empty kicker="All clear" title="No account deletion requests pending." />;
  return (
    <ul className="space-y-2">
      {list.map((d) => {
        const meta = accountDeletionStatusMeta(d.status);
        const scheduledIn = Math.round(
          (new Date(d.scheduledFor).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );
        return (
          <Card key={d.id}>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-medium text-ink truncate">
                    {d.consumerName ?? d.consumerEmail ?? `Consumer ${d.consumerId}`}
                  </span>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  {d.status === 'pending' && (
                    <Badge tone={scheduledIn < 1 ? 'danger' : scheduledIn < 3 ? 'warning' : 'neutral'} flat>
                      {scheduledIn < 0
                        ? `${-scheduledIn} days overdue`
                        : scheduledIn === 0
                          ? 'Today'
                          : `In ${scheduledIn} days`}
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 text-[11.5px] text-ink-3">
                  {d.consumerEmail ?? '—'}
                  {d.consumerPhone ? ` · ${d.consumerPhone}` : ''}
                </div>
                <div className="mt-1 text-[12px] text-ink-3">
                  Scheduled {new Date(d.scheduledFor).toLocaleString()} · requested {formatAge(d.requestedAt)}
                </div>
              </div>
              <div className="flex gap-2">
                {d.status === 'pending' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      loading={complete.isPending && complete.variables === d.id}
                      onClick={() => {
                        if (!window.confirm("Complete deletion now? The customer's personal details will be permanently removed.")) return;
                        complete.mutate(d.id);
                      }}
                    >
                      Complete now
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:bg-danger/5"
                      loading={cancel.isPending && cancel.variables === d.id}
                      onClick={() => {
                        if (!window.confirm('Cancel this deletion request?')) return;
                        cancel.mutate(d.id);
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </ul>
  );
}
