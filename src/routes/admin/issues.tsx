import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowUpRight, BarChart3, Gavel, MessageSquare, TrendingUp, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { actorLabel, formatAge, issueDecisionLabel, issueStatusMeta } from '@/lib/status';
import type { IssueDecision, IssueKind, IssueListRow, IssueStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableId } from '@/components/ui/copyable-id';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const STATUS_OPTIONS: ReadonlyArray<{ value: IssueStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'requested_evidence', label: 'Evidence requested' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'decided', label: 'Decided' },
];

const DECISION_OPTIONS: ReadonlyArray<{ value: IssueDecision; label: string }> = [
  // Only the two money outcomes apply: prepaid try-and-buy + COD-after-payment
  // mean goods are never left unpaid with the consumer, so the pickup/fresh-
  // delivery remedies are moot. (Backend may still auto-compute 'split' per item.)
  { value: 'refund', label: 'Refund' },
  { value: 'no_refund', label: 'No refund' },
];

type DialogKind = 'request-evidence' | 'decide' | 'escalate';
type DialogState = { kind: DialogKind; issueId: string } | null;

type WorkloadRow = { assignedAdminId: string; openCount: number };

export function DisputesPanel() {
  // One unified Disputes queue — the query/complaint/dispute kind distinction is
  // no longer surfaced (all are shown and treated as "disputes").
  const [status, setStatus] = useState<IssueStatus | 'all'>('all');
  const [storeId, setStoreId] = useState('');
  const [assignedAdminId, setAssignedAdminId] = useState('');
  const [olderThanDays, setOlderThanDays] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [note, setNote] = useState('');
  const [evFromParty, setEvFromParty] = useState<'retailer' | 'consumer'>('retailer');
  const [decision, setDecision] = useState<IssueDecision>('no_refund');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCloseOpen, setBulkCloseOpen] = useState(false);
  const [bcOlderThan, setBcOlderThan] = useState('');
  const [bcNoReply, setBcNoReply] = useState('');
  const [workloadOpen, setWorkloadOpen] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'issues', status, storeId, assignedAdminId, olderThanDays],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      if (storeId.trim()) params.set('storeId', storeId.trim());
      if (assignedAdminId.trim()) params.set('assignedAdminId', assignedAdminId.trim());
      if (olderThanDays && Number(olderThanDays) > 0) params.set('olderThanDays', olderThanDays);
      const qs = params.toString();
      return api<IssueListRow[]>(`/admin/issues${qs ? `?${qs}` : ''}`);
    },
    refetchInterval: 8000,
  });

  const requestEvidence = useMutation({
    mutationFn: ({ issueId, fromParty, note }: { issueId: string; fromParty: 'retailer' | 'consumer'; note: string }) =>
      api(`/admin/issues/${issueId}/request-evidence`, { method: 'POST', body: { fromParty, note } }),
    onSuccess: () => {
      toast.success('Evidence requested');
      setDialog(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'issues'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Request failed'),
  });

  const decide = useMutation({
    mutationFn: ({ issueId, decision, decisionNote }: { issueId: string; decision: IssueDecision; decisionNote: string }) =>
      api(`/admin/issues/${issueId}/decide`, { method: 'POST', body: { decision, decisionNote } }),
    onSuccess: () => {
      toast.success('Dispute decided');
      setDialog(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'issues'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Decision failed'),
  });

  const escalate = useMutation({
    mutationFn: ({ issueId, note }: { issueId: string; note?: string }) =>
      api(`/admin/issues/${issueId}/escalate`, { method: 'POST', body: note ? { note } : {} }),
    onSuccess: () => {
      toast.success('Dispute escalated');
      setDialog(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'issues'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Escalation failed'),
  });

  const bulkClose = useMutation({
    mutationFn: (body: { olderThanDays: number; noConsumerReplySinceDays?: number; kind?: IssueKind }) =>
      api<{ closedCount: number }>('/admin/issues/bulk-close', { method: 'POST', body }),
    onSuccess: (res) => {
      toast.success(`Bulk-closed ${res.closedCount} dispute${res.closedCount === 1 ? '' : 's'}`);
      setBulkCloseOpen(false);
      void qc.invalidateQueries({ queryKey: ['admin', 'issues'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Bulk close failed'),
  });

  const workload = useQuery({
    queryKey: ['admin', 'issues-workload'],
    queryFn: () => api<WorkloadRow[]>('/admin/issues-workload'),
    enabled: workloadOpen,
  });

  const list = data ?? [];
  const visibleList = list;

  function openDialog(kind: DialogKind, issueId: string) {
    setNote('');
    setDecision('no_refund');
    setDialog({ kind, issueId } as DialogState);
  }

  return (
    <div>
      <p className="mb-4 max-w-3xl text-[13px] text-ink-3 leading-relaxed">
        Open, evidence-gathering, escalated, and decided disputes across all orders and returns.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="sm:w-40 h-9"
          placeholder="Store ID"
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
        />
        <Input
          className="sm:w-44 h-9"
          placeholder="Assigned admin ID"
          value={assignedAdminId}
          onChange={(e) => setAssignedAdminId(e.target.value)}
        />
        <Input
          className="sm:w-36 h-9"
          type="number"
          min={0}
          placeholder="Older than (days)"
          value={olderThanDays}
          onChange={(e) => setOlderThanDays(e.target.value)}
        />
        <span className="text-[12px] text-ink-3">{visibleList.length} dispute{visibleList.length === 1 ? '' : 's'}</span>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" iconLeft={<BarChart3 className="size-3" />} onClick={() => setWorkloadOpen(true)}>
            Workload
          </Button>
          <Button size="sm" variant="outline" iconLeft={<X className="size-3" />} onClick={() => setBulkCloseOpen(true)}>
            Bulk close
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : visibleList.length === 0 ? (
        <Empty
          kicker="No disputes"
          title="No disputes match this filter."
          description="Disputes are opened against an order or return."
        />
      ) : (
        <ul className="space-y-3">
          {visibleList.map((d) => {
            const meta = issueStatusMeta(d.status);
            const canRequestEvidence = d.status === 'open';
            const canDecide = d.status === 'open' || d.status === 'requested_evidence' || d.status === 'escalated';
            // Escalate (bump to super-admin) is hidden for now — single-tier admin
            // handling. Backend escalateIssue + the dialog/mutation are kept; flip
            // this back to `d.status === 'open' || d.status === 'requested_evidence'`
            // to re-enable the button.
            const canEscalate = false;
            return (
              <Card key={d.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="checkbox"
                          checked={selected.has(d.id)}
                          onChange={(e) => {
                            setSelected((s) => {
                              const next = new Set(s);
                              if (e.target.checked) next.add(d.id);
                              else next.delete(d.id);
                              return next;
                            });
                          }}
                          className="size-4 cursor-pointer accent-accent"
                          aria-label="Select dispute"
                        />
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <CopyableId value={d.id} label="dispute id" />
                        <span className="text-[11.5px] text-ink-3">{formatAge(d.createdAt)}</span>
                      </div>

                      <div className="mt-2 flex items-center gap-1 text-[12px] text-ink-3">
                        <AlertTriangle className="size-3 shrink-0" />
                        <span className="capitalize">{d.targetKind ?? (d.orderId ? 'order' : 'return')}</span>:&nbsp;
                        {/* Only orders have an admin detail route; a return-linked
                            dispute shows its id as plain text. */}
                        {d.targetKind === 'order' && d.targetId ? (
                          <Link
                            to={`/admin/orders/${d.targetId}`}
                            className="font-mono hover:text-accent inline-flex items-center gap-0.5"
                          >
                            {d.targetId} <ArrowUpRight className="size-3" />
                          </Link>
                        ) : (
                          <span className="font-mono text-ink">{d.targetId ?? d.returnId ?? '—'}</span>
                        )}
                      </div>

                      <div className="mt-1 text-[12px] text-ink-3">
                        Opened by{' '}
                        <span className="text-ink font-medium">{actorLabel(d.openedByActorType)}</span>
                        <span className="font-mono text-[11px] ml-1 text-ink-4">· {d.openedByActorId}</span>
                      </div>

                      <p className="mt-2 text-[13px] text-ink line-clamp-2">{d.description}</p>

                      {d.decision && (
                        <div className="mt-1.5 text-[12px]">
                          <span className="text-ink-3">Decision: </span>
                          <span className="font-medium text-ink">{issueDecisionLabel(d.decision)}</span>
                          {d.decisionNote && (
                            <span className="text-ink-3 italic"> — {d.decisionNote}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {(canRequestEvidence || canDecide || canEscalate) && (
                      <div className="flex gap-1.5 shrink-0 flex-col sm:flex-row items-end sm:items-start">
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/admin/disputes/${d.id}`}>Open</Link>
                        </Button>
                        {canRequestEvidence && (
                          <Button
                            size="sm"
                            variant="ghost"
                            iconLeft={<MessageSquare className="size-3" />}
                            onClick={() => openDialog('request-evidence', d.id)}
                          >
                            Request evidence
                          </Button>
                        )}
                        {canEscalate && (
                          <Button
                            size="sm"
                            variant="ghost"
                            iconLeft={<TrendingUp className="size-3" />}
                            onClick={() => openDialog('escalate', d.id)}
                          >
                            Escalate
                          </Button>
                        )}
                        {canDecide && (
                          <Button
                            size="sm"
                            variant="outline"
                            iconLeft={<Gavel className="size-3" />}
                            onClick={() => openDialog('decide', d.id)}
                          >
                            Decide
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </ul>
      )}

      <Dialog open={dialog?.kind === 'request-evidence'} onOpenChange={(o) => { if (!o) setDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request additional evidence</DialogTitle>
            <DialogDescription>
              Moves the dispute to "Evidence requested". Your note will be recorded.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="ev-from" required>Request from</Label>
              <Select value={evFromParty} onValueChange={(v) => setEvFromParty(v as 'retailer' | 'consumer')}>
                <SelectTrigger id="ev-from"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="retailer">Retailer</SelectItem>
                  <SelectItem value="consumer">Consumer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ev-note" required>Note</Label>
              <Textarea
                id="ev-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What evidence is needed?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant="accent"
              disabled={note.trim().length < 5}
              loading={requestEvidence.isPending}
              onClick={() => {
                if (dialog?.kind === 'request-evidence') {
                  requestEvidence.mutate({ issueId: dialog.issueId, fromParty: evFromParty, note: note.trim() });
                }
              }}
            >
              Request evidence
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog?.kind === 'decide'} onOpenChange={(o) => { if (!o) setDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decide dispute</DialogTitle>
            <DialogDescription>
              This action is final. Choose a resolution and record your reasoning.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label required>Decision</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {DECISION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDecision(opt.value)}
                    className={
                      'rounded-md border px-2.5 py-1 text-[12px] transition-colors ' +
                      (decision === opt.value
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line bg-bg text-ink-2 hover:border-line-2')
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="dec-note" required>Decision note</Label>
              <Textarea
                id="dec-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Explain the reasoning behind this decision."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant="accent"
              disabled={note.trim().length < 10}
              loading={decide.isPending}
              onClick={() => {
                if (dialog?.kind === 'decide') {
                  decide.mutate({ issueId: dialog.issueId, decision, decisionNote: note.trim() });
                }
              }}
            >
              Confirm decision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog?.kind === 'escalate'} onOpenChange={(o) => { if (!o) setDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escalate dispute</DialogTitle>
            <DialogDescription>
              Flags this dispute as needing senior review. You can still decide after escalation.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="esc-note">Note (optional)</Label>
            <Textarea
              id="esc-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why is this being escalated?"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant="accent"
              loading={escalate.isPending}
              onClick={() => {
                if (dialog?.kind === 'escalate') {
                  const trimmed = note.trim();
                  escalate.mutate(trimmed ? { issueId: dialog.issueId, note: trimmed } : { issueId: dialog.issueId });
                }
              }}
            >
              Escalate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkCloseOpen} onOpenChange={setBulkCloseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk close stale disputes</DialogTitle>
            <DialogDescription>
              Close disputes older than a given number of days. Optionally filter by no consumer reply.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="bc-older" required>Older than (days)</Label>
              <Input id="bc-older" type="number" min={1} value={bcOlderThan} onChange={(e) => setBcOlderThan(e.target.value)} placeholder="e.g. 30" />
            </div>
            <div>
              <Label htmlFor="bc-noreply">No consumer reply since (days)</Label>
              <Input id="bc-noreply" type="number" min={1} value={bcNoReply} onChange={(e) => setBcNoReply(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkCloseOpen(false)}>Cancel</Button>
            <Button
              variant="accent"
              disabled={!bcOlderThan || Number(bcOlderThan) < 1}
              loading={bulkClose.isPending}
              onClick={() => {
                const body: Parameters<typeof bulkClose.mutate>[0] = {
                  olderThanDays: Number(bcOlderThan),
                };
                if (bcNoReply && Number(bcNoReply) >= 1) body.noConsumerReplySinceDays = Number(bcNoReply);
                bulkClose.mutate(body);
              }}
            >
              Bulk close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={workloadOpen} onOpenChange={setWorkloadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispute workload</DialogTitle>
            <DialogDescription>Open disputes per assigned admin.</DialogDescription>
          </DialogHeader>
          {workload.isLoading ? (
            <Skeleton className="h-24" />
          ) : workload.data && workload.data.length > 0 ? (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-ink-3">
                  <th className="pb-1.5">Admin ID</th>
                  <th className="pb-1.5 text-right">Open</th>
                </tr>
              </thead>
              <tbody>
                {workload.data.map((r) => (
                  <tr key={r.assignedAdminId} className="border-b border-line/50">
                    <td className="py-1.5 font-mono text-[12px]">{r.assignedAdminId}</td>
                    <td className="py-1.5 text-right">{r.openCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[13px] text-ink-3">No workload data.</p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWorkloadOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
