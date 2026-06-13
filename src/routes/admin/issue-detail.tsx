import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowUpRight,
  Camera,
  Flag,
  Gavel,
  MessageSquare,
  ShieldCheck,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatAge, issueStatusMeta } from '@/lib/status';
import type { AwaitingParty, IssueDecision, IssueDetail } from '@/lib/types';
import { Page, PageHeader, SectionHeading } from '@/components/ui/page';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MetaList } from '@/components/ui/meta-list';
import { CopyableId } from '@/components/ui/copyable-id';
import { AttachmentThumbs } from '@/components/ui/attachment-thumbs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input, Textarea } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEffect, useState } from 'react';

const DECISION_OPTIONS: ReadonlyArray<{ value: IssueDecision; label: string }> = [
  // Only the two money outcomes apply: prepaid try-and-buy + COD-after-payment
  // mean goods are never left unpaid with the consumer, so the pickup/fresh-
  // delivery remedies are moot. (Backend may still auto-compute 'split' per item.)
  { value: 'refund', label: 'Refund' },
  { value: 'no_refund', label: 'No refund' },
];

function awaitingBadgeTone(p: AwaitingParty): 'warning' | 'info' | 'danger' {
  if (p === 'consumer') return 'warning';
  if (p === 'retailer') return 'danger';
  return 'info';
}

function senderBadgeTone(s: string): 'neutral' | 'info' | 'warning' | 'danger' {
  if (s === 'admin') return 'info';
  if (s === 'consumer') return 'warning';
  if (s === 'retailer') return 'danger';
  return 'neutral';
}

type DetailDialog =
  | null
  | { kind: 'decide' }
  | { kind: 'assign' }
  | { kind: 'flag-party' }
  | { kind: 'request-evidence' };

export default function AdminIssueDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<DetailDialog>(null);
  const [decision, setDecision] = useState<IssueDecision>('no_refund');
  const [decisionNote, setDecisionNote] = useState('');
  // Rupees input; required by the server for refund/split decisions.
  const [adjustmentRupees, setAdjustmentRupees] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [assignId, setAssignId] = useState('');
  const [flagParty, setFlagParty] = useState<'consumer' | 'retailer'>('consumer');
  const [flagReason, setFlagReason] = useState('');
  const [evFromParty, setEvFromParty] = useState<'consumer' | 'retailer'>('consumer');
  const [evNote, setEvNote] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'issues', id],
    queryFn: () => api<IssueDetail>(`/admin/issues/${id}`),
    enabled: Boolean(id),
  });

  /**
   * Reset only the inputs that belong to the currently-active inline panel.
   * Keeps any text typed in *other* panels from leaking into a freshly-opened
   * one. Open-handlers below pre-seed values; this effect handles the close →
   * reopen path.
   */
  const dialogKind = dialog?.kind ?? null;
  useEffect(() => {
    if (dialogKind === null) {
      // All panels closed — clear every form's transient text so the next open
      // shows a clean slate (open-handlers may re-seed where appropriate).
      setDecision('no_refund');
      setDecisionNote('');
      setAssignId('');
      setFlagParty('consumer');
      setFlagReason('');
      setEvFromParty('consumer');
      setEvNote('');
    }
  }, [dialogKind]);

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['admin', 'issues', id] });
  const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Action failed');

  const needsAmount = decision === 'refund' || decision === 'split';
  const decide = useMutation({
    mutationFn: () =>
      api(`/admin/issues/${id}/decide`, {
        method: 'POST',
        body: {
          decision,
          decisionNote,
          ...(needsAmount ? { adjustmentPaise: Math.round(Number(adjustmentRupees) * 100) } : {}),
        },
      }),
    onSuccess: () => { toast.success('Decision recorded'); setDialog(null); setAdjustmentRupees(''); invalidate(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const sendReply = useMutation({
    mutationFn: (body: string) =>
      api(`/admin/issues/${id}/messages`, { method: 'POST', body: { body, attachments: [] } }),
    onSuccess: () => { toast.success('Reply sent'); setReplyBody(''); invalidate(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const assign = useMutation({
    mutationFn: (adminId: string) =>
      api(`/admin/issues/${id}/assign`, { method: 'POST', body: { adminId } }),
    onSuccess: () => { toast.success('Dispute assigned'); setDialog(null); invalidate(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const flagPartyMut = useMutation({
    mutationFn: (body: { party: 'consumer' | 'retailer'; reason: string }) =>
      api(`/admin/issues/${id}/flag-party`, { method: 'POST', body }),
    onSuccess: () => { toast.success('Party flagged'); setDialog(null); invalidate(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const closeIssue = useMutation({
    mutationFn: () =>
      api(`/admin/issues/${id}/close`, { method: 'POST', body: {} }),
    onSuccess: () => { toast.success('Dispute closed'); invalidate(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const requestEvidence = useMutation({
    mutationFn: (body: { fromParty: 'consumer' | 'retailer'; note: string }) =>
      api(`/admin/issues/${id}/request-evidence`, { method: 'POST', body }),
    onSuccess: () => { toast.success('Evidence requested'); setDialog(null); invalidate(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (isLoading || !data) return <Page><Skeleton className="h-72" /></Page>;
  const meta = issueStatusMeta(data.status);
  const isDecided = data.status === 'decided';
  const canClose = !isDecided && data.status !== 'closed' && data.status !== 'resolved';

  return (
    <Page>
      <PageHeader
        kicker="Disputes"
        title={`Dispute · ${data.id.slice(0, 12)}…`}
        description={`Opened ${formatAge(data.createdAt)} · ${data.orderId ? `Order ${data.orderId}` : data.returnId ? `Return ${data.returnId}` : ''}`}
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to="/admin/disputes">Back</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={meta.tone}>{meta.label}</Badge>
        {data.awaitingParty && (
          <Badge tone={awaitingBadgeTone(data.awaitingParty)}>Awaiting {data.awaitingParty}</Badge>
        )}
        <CopyableId value={data.id} label="dispute id" />
        {data.payoutAdjustmentPaise != null && data.payoutAdjustmentPaise !== 0 && (
          <Badge tone="warning" flat>
            Payout adj: {(data.payoutAdjustmentPaise / 100).toFixed(2)}
          </Badge>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        {/* ── Left column ── */}
        <div className="space-y-6">
          {/* Description card */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <SectionHeading kicker="Description" title="Consumer's account" />
              <p className="text-[13.5px] text-ink-2">{data.description || '—'}</p>

              {(data.evidence?.length ?? 0) > 0 && (
                <div>
                  <div className="mb-2 text-[11.5px] font-medium uppercase tracking-wider text-ink-4">Evidence files</div>
                  <AttachmentThumbs urls={data.evidence ?? []} />
                </div>
              )}

              {data.decisionNote && (
                <div>
                  <div className="mb-1 text-[11.5px] font-medium uppercase tracking-wider text-ink-4">Decision note</div>
                  <p className="rounded-md bg-bg-2 px-3 py-2 text-[13px] text-ink-2">{data.decisionNote}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Message thread */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <SectionHeading kicker="Conversation" title="Message thread" />
              {(data.messages?.length ?? 0) === 0 ? (
                <p className="text-[13px] text-ink-3">No messages yet.</p>
              ) : (
                <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                  {(data.messages ?? []).map((m) => (
                    <div key={m.id} className="rounded-md border border-line p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge tone={senderBadgeTone(m.senderType)} flat className="text-[10.5px]">
                          {m.senderType}
                        </Badge>
                        <span className="text-[11.5px] text-ink-3 font-mono">{m.senderId}</span>
                        <span className="ml-auto text-[11px] text-ink-4">{formatAge(m.at)}</span>
                      </div>
                      <p className="text-[13px] text-ink-2 whitespace-pre-wrap">{m.body}</p>
                      {(m.attachments?.length ?? 0) > 0 && (
                        <AttachmentThumbs urls={m.attachments ?? []} size="sm" className="mt-2" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Reply form */}
              <div className="pt-2 border-t border-line">
                <Textarea
                  rows={2}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Type a reply..."
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="accent"
                    iconLeft={<MessageSquare className="size-3" />}
                    disabled={replyBody.trim().length < 1}
                    loading={sendReply.isPending}
                    onClick={() => sendReply.mutate(replyBody.trim())}
                  >
                    Send
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Evidence photos */}
          {data.evidencePhotos && data.evidencePhotos.length > 0 && (
            <Card>
              <CardContent className="p-6 space-y-3">
                <SectionHeading kicker="Evidence" title="Photos" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {data.evidencePhotos.map((p, i) => (
                    <div key={i} className="relative rounded-md overflow-hidden border border-line">
                      <a href={p.url} target="_blank" rel="noopener noreferrer">
                        <img src={p.url} alt={p.label ?? `Evidence ${i + 1}`} className="h-32 w-full object-cover" />
                      </a>
                      <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-2 py-0.5 text-[10.5px] text-white">
                        {p.label ?? p.source}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Held goods — the returned physical item(s) sitting at the store for
              this dispute. Disposition is set automatically when you decide. */}
          {data.heldItems && data.heldItems.length > 0 && (
            <Card>
              <CardContent className="p-6 space-y-3">
                <SectionHeading kicker="Goods" title="Held at store" />
                <div className="space-y-2">
                  {data.heldItems.map((h) => (
                    <div key={h.id} className="rounded-md border border-line px-3 py-2 text-[12.5px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={h.status === 'resolved' ? 'success' : 'warning'} flat>
                          {h.status === 'resolved' ? 'Resolved' : 'Holding'}
                        </Badge>
                        {h.disposition && (
                          <span className="text-ink-2">
                            {h.disposition === 'restocked'
                              ? 'Restocked by store'
                              : h.disposition === 'forfeited_to_store'
                                ? 'Kept by store'
                                : h.disposition}
                          </span>
                        )}
                        <CopyableId value={h.id} label="held item id" />
                      </div>
                      {h.status !== 'resolved' && h.holdingWindowExpiresAt && (
                        <div className="mt-1 text-ink-3">
                          Holding window ends {formatAge(h.holdingWindowExpiresAt)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[11.5px] text-ink-4">
                  Deciding this dispute sets the item's fate automatically — refund →
                  restocked; no refund → kept by the store.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Party context */}
          {data.partyContext && (
            ((data.partyContext.consumerFlags?.length ?? 0) > 0 || (data.partyContext.retailerEnforcements?.length ?? 0) > 0) && (
              <Card>
                <CardContent className="p-6 space-y-3">
                  <SectionHeading kicker="Context" title="Party history" />
                  {(data.partyContext.consumerFlags ?? []).map((f, i) => (
                    <div key={`cf-${i}`} className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-[12.5px]">
                      <span className="font-medium text-yellow-800">Consumer flag:</span>{' '}
                      <span className="text-yellow-700">{f.kind} — {f.reason}</span>
                      <span className="ml-2 text-[11px] text-yellow-600">{formatAge(f.at)}</span>
                    </div>
                  ))}
                  {(data.partyContext.retailerEnforcements ?? []).map((e, i) => (
                    <div key={`re-${i}`} className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[12.5px]">
                      <span className="font-medium text-red-800">Retailer enforcement:</span>{' '}
                      <span className="text-red-700">{e.step} ({e.breachKind}){e.reason ? ` — ${e.reason}` : ''}</span>
                      <span className="ml-2 text-[11px] text-red-600">{formatAge(e.actedAt)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          )}
        </div>

        {/* ── Right column ── */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <SectionHeading kicker="Context" title="Linked target" />
              <MetaList
                cols={1}
                items={[
                  {
                    label: 'Target',
                    // Orders have an admin detail route; return-linked disputes show
                    // the return id as plain text (no /admin/returns/:id route).
                    value:
                      data.targetKind === 'order' && data.targetId ? (
                        <Link
                          to={`/admin/orders/${data.targetId}`}
                          className="hover:text-accent inline-flex items-center gap-1 font-mono text-[12.5px]"
                        >
                          {data.targetId} <ArrowUpRight className="size-3" />
                        </Link>
                      ) : (
                        <span className="font-mono text-[12.5px]">{data.targetId ?? data.returnId ?? '—'}</span>
                      ),
                  },
                  { label: 'Kind', value: data.targetKind ?? (data.orderId ? 'order' : 'return') },
                  { label: 'Opened by', value: `${data.openedByActorType} · ${data.openedByActorId.slice(0, 12)}…`, mono: true },
                  { label: 'Assigned to', value: data.assignedAdminId ?? '—', mono: true },
                  { label: 'Decided by', value: data.decidedByAdmin?.email ?? '—' },
                  { label: 'Decision', value: data.decision ?? '—' },
                ]}
              />
            </CardContent>
          </Card>

          {/* Action panel — inline forms swap in instead of opening modals */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <SectionHeading kicker="Controls" title="Actions" />
              <div className="flex flex-wrap gap-2">
                {!isDecided && data.status !== 'closed' && data.status !== 'resolved' && (
                  <Button
                    variant={dialog?.kind === 'decide' ? 'ink' : 'accent'}
                    size="sm"
                    iconLeft={<Gavel className="size-3.5" />}
                    onClick={() => {
                      if (dialog?.kind === 'decide') setDialog(null);
                      else { setDecisionNote(''); setDecision('no_refund'); setDialog({ kind: 'decide' }); }
                    }}
                  >
                    Decide
                  </Button>
                )}
                {/* Escalate (bump to super-admin) hidden for now — single-tier
                    admin handling. Backend /escalate stays; re-enable by changing
                    `false &&` back to the status guard below. */}
                {false && !isDecided && data?.status !== 'closed' && data?.status !== 'resolved' && (
                  <Button
                    variant="outline"
                    size="sm"
                    iconLeft={<ShieldCheck className="size-3.5" />}
                    onClick={() =>
                      api(`/admin/issues/${id}/escalate`, { method: 'POST', body: {} })
                        .then(() => { toast.success('Escalated'); invalidate(); })
                        .catch((e) => toast.error(errMsg(e)))
                    }
                  >
                    Escalate
                  </Button>
                )}
                <Button
                  variant={dialog?.kind === 'assign' ? 'ink' : 'outline'}
                  size="sm"
                  iconLeft={<UserPlus className="size-3.5" />}
                  onClick={() => {
                    if (dialog?.kind === 'assign') setDialog(null);
                    else { setAssignId(data.assignedAdminId ?? ''); setDialog({ kind: 'assign' }); }
                  }}
                >
                  Assign
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={<Flag className="size-3.5" />}
                  onClick={() => { setFlagParty('consumer'); setFlagReason(''); setDialog({ kind: 'flag-party' }); }}
                >
                  Flag party
                </Button>
                <Button
                  variant={dialog?.kind === 'request-evidence' ? 'ink' : 'outline'}
                  size="sm"
                  iconLeft={<Camera className="size-3.5" />}
                  onClick={() => {
                    if (dialog?.kind === 'request-evidence') setDialog(null);
                    else { setEvFromParty('consumer'); setEvNote(''); setDialog({ kind: 'request-evidence' }); }
                  }}
                >
                  Request evidence
                </Button>
                {canClose && (
                  <Button
                    variant="outline"
                    size="sm"
                    iconLeft={<XCircle className="size-3.5" />}
                    loading={closeIssue.isPending}
                    onClick={() => {
                      if (!window.confirm('Close this dispute? This cannot be undone.')) return;
                      closeIssue.mutate();
                    }}
                  >
                    Close
                  </Button>
                )}
              </div>

              {dialog?.kind === 'decide' && (
                <div
                  className="rounded-md border border-line bg-bg-2/40 p-4 space-y-3"
                  role="region"
                  aria-label="Decide dispute"
                >
                  <div className="text-[12.5px] text-ink-3">
                    Records the resolution and books the liability line on the retailer's monthly statement.
                  </div>
                  <div>
                    <Label>Decision</Label>
                    <Select value={decision} onValueChange={(v) => setDecision(v as IssueDecision)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DECISION_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {needsAmount && (
                    <div>
                      <Label>Refund / liability amount (₹, required)</Label>
                      <Input
                        inputMode="decimal"
                        value={adjustmentRupees}
                        onChange={(e) => setAdjustmentRupees(e.target.value)}
                        placeholder="e.g. 1359"
                      />
                      <p className="mt-1 text-[11.5px] text-ink-3">
                        Refunds the consumer and debits this from the retailer's payout.
                      </p>
                    </div>
                  )}
                  <div>
                    <Label>Note (required)</Label>
                    <Textarea rows={3} value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} placeholder="Explain the reasoning…" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setDialog(null)}>Cancel</Button>
                    <Button
                      variant="accent"
                      size="sm"
                      disabled={
                        decisionNote.trim().length < 3 ||
                        (needsAmount && !(Number(adjustmentRupees) > 0))
                      }
                      loading={decide.isPending}
                      onClick={() => decide.mutate()}
                    >
                      Confirm decision
                    </Button>
                  </div>
                </div>
              )}

              {dialog?.kind === 'assign' && (
                <div
                  className="rounded-md border border-line bg-bg-2/40 p-4 space-y-3"
                  role="region"
                  aria-label="Assign dispute"
                >
                  <div className="text-[12.5px] text-ink-3">Set the admin responsible for this dispute.</div>
                  <div>
                    <Label htmlFor="assign-id" required>Admin ID</Label>
                    <Input id="assign-id" value={assignId} onChange={(e) => setAssignId(e.target.value)} placeholder="Admin account ID" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setDialog(null)}>Cancel</Button>
                    <Button
                      variant="accent"
                      size="sm"
                      disabled={!assignId.trim()}
                      loading={assign.isPending}
                      onClick={() => assign.mutate(assignId.trim())}
                    >
                      Assign
                    </Button>
                  </div>
                </div>
              )}

              {dialog?.kind === 'request-evidence' && (
                <div
                  className="rounded-md border border-line bg-bg-2/40 p-4 space-y-3"
                  role="region"
                  aria-label="Request evidence"
                >
                  <div className="text-[12.5px] text-ink-3">Ask a party to submit additional evidence for this dispute.</div>
                  <div>
                    <Label>From party</Label>
                    <Select value={evFromParty} onValueChange={(v) => setEvFromParty(v as typeof evFromParty)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="consumer">Consumer</SelectItem>
                        <SelectItem value="retailer">Retailer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="ev-note" required>Note</Label>
                    <Textarea id="ev-note" rows={2} value={evNote} onChange={(e) => setEvNote(e.target.value)} placeholder="What evidence is needed?" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setDialog(null)}>Cancel</Button>
                    <Button
                      variant="accent"
                      size="sm"
                      disabled={evNote.trim().length < 3}
                      loading={requestEvidence.isPending}
                      onClick={() => requestEvidence.mutate({ fromParty: evFromParty, note: evNote.trim() })}
                    >
                      Request evidence
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transitions timeline */}
          {(data.transitions?.length ?? 0) > 0 && (
            <Card>
              <CardContent className="p-6">
                <SectionHeading kicker="History" title="Status transitions" />
                <div className="space-y-1.5 text-[12px]">
                  {(data.transitions ?? []).map((t) => (
                    <div key={t.id} className="flex items-baseline gap-1.5">
                      <span className="text-ink-4 shrink-0">{formatAge(t.at)}</span>
                      <span className="text-ink-3">{t.fromStatus ?? '—'} → {t.toStatus}</span>
                      <span className="ml-auto text-ink-4 text-[11px]">{t.actorType}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Flag party dialog (kept as modal — destructive) ── */}
      <Dialog open={dialog?.kind === 'flag-party'} onOpenChange={(o) => { if (!o) setDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag party</DialogTitle>
            <DialogDescription>Record a compliance concern against the consumer or retailer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Party</Label>
              <Select value={flagParty} onValueChange={(v) => setFlagParty(v as typeof flagParty)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="consumer">Consumer</SelectItem>
                  <SelectItem value="retailer">Retailer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="flag-reason" required>Reason</Label>
              <Textarea id="flag-reason" rows={2} value={flagReason} onChange={(e) => setFlagReason(e.target.value)} placeholder="Why are you flagging this party?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant="accent"
              disabled={flagReason.trim().length < 3}
              loading={flagPartyMut.isPending}
              onClick={() => flagPartyMut.mutate({ party: flagParty, reason: flagReason.trim() })}
            >
              Flag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Page>
  );
}
