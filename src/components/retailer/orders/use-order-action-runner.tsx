/**
 * Runs an OrderAction uniformly across card / row / sheet / page. Owns the fixed
 * set of mutations + every shared confirm dialog so all surfaces reuse identical
 * UI and identical react-query invalidation.
 */
import { useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { api, ApiError, BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { uploadMedia } from '@/lib/upload';
import type { OrderDetail, RetailerSubRole } from '@/lib/types';
import type { OrderAction, OrderActionKey, OrderConfirmKind } from '@/lib/order-actions';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
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
import { ReturnDialog } from '@/components/ui/return-dialog';
import { DoorVisitDialog } from '@/components/ui/door-visit-dialog';

type RunnerResult = {
  run: (action: OrderAction) => void;
  pendingKey: OrderActionKey | null;
  dialogs: ReactNode;
};

export function useOrderActionRunner(orderId: string): RunnerResult {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [pendingKey, setPendingKey] = useState<OrderActionKey | null>(null);
  const [openConfirm, setOpenConfirm] = useState<OrderConfirmKind | null>(null);
  // Detail needed for item-level dialogs (counter-return, door visit).
  const [detail, setDetail] = useState<OrderDetail | null>(null);

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ['retailer', 'orders'] });
    void qc.invalidateQueries({ queryKey: ['retailer', 'order', orderId] });
  }

  const post = useMutation({
    mutationFn: (v: { endpoint: string; body?: Record<string, unknown> }) =>
      api(`/retailer/orders/${orderId}/${v.endpoint}`, { method: 'POST', body: v.body ?? {} }),
    onSuccess: () => {
      toast.success('Order updated');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Action failed'),
    onSettled: () => setPendingKey(null),
  });

  async function ensureDetail(): Promise<OrderDetail | null> {
    try {
      const d = await qc.fetchQuery({
        queryKey: ['retailer', 'order', orderId],
        queryFn: () => api<OrderDetail>(`/retailer/orders/${orderId}`),
      });
      setDetail(d);
      return d;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load order');
      return null;
    }
  }

  // Accept every pending return on this order (issues refunds server-side).
  const acceptReturns = useMutation({
    mutationFn: async () => {
      const d = await ensureDetail();
      const pending = (d?.returns ?? []).filter((r) => r.storeDecision === 'pending');
      if (pending.length === 0) throw new Error('No pending return to accept');
      for (const r of pending) {
        await api(`/retailer/returns/${r.id}/verify`, { method: 'POST', body: { decision: 'accepted' } });
      }
    },
    onSuccess: () => {
      toast.success('Return accepted — refund issued');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not accept return'),
    onSettled: () => setPendingKey(null),
  });

  // Decline every pending return → opens a dispute + holds funds (server-side).
  const declineReturns = useMutation({
    mutationFn: async (v: { reasonNote: string; rejectPhotos: string[] }) => {
      const d = await ensureDetail();
      const pending = (d?.returns ?? []).filter((r) => r.storeDecision === 'pending');
      if (pending.length === 0) throw new Error('No pending return to decline');
      for (const r of pending) {
        await api(`/retailer/returns/${r.id}/decline`, {
          method: 'POST',
          body: { reasonNote: v.reasonNote, rejectPhotos: v.rejectPhotos },
        });
      }
    },
    onSuccess: () => {
      toast.success('Return declined — dispute opened, funds held pending admin review');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not decline return'),
    onSettled: () => setPendingKey(null),
  });

  function run(action: OrderAction) {
    if (!action.enabled) return;
    if (action.key === 'accept-return') {
      setPendingKey('accept-return');
      acceptReturns.mutate();
      return;
    }
    if (action.kind === 'mutation' && action.endpoint) {
      setPendingKey(action.key);
      post.mutate({ endpoint: action.endpoint });
      return;
    }
    if (action.kind === 'download' && action.key === 'tax-invoice') {
      void downloadInvoice(orderId);
      return;
    }
    if (action.kind === 'dialog' && action.confirm) {
      const confirm = action.confirm;
      if (confirm === 'counter-return' || confirm === 'door-close') {
        // Need item rows — make sure detail is loaded, then open.
        void ensureDetail().then((d) => {
          if (d) setOpenConfirm(confirm);
        });
      } else {
        setOpenConfirm(confirm);
      }
    }
  }

  const close = () => setOpenConfirm(null);

  const dialogs = (
    <>
      {(openConfirm === 'request-cancel' || openConfirm === 'mark-undelivered') && (
        <ReasonDialog
          kind={openConfirm}
          onClose={close}
          onSubmit={(reason) => {
            setPendingKey(openConfirm === 'request-cancel' ? 'request-cancel' : 'mark-undelivered');
            post.mutate(
              {
                endpoint: openConfirm === 'request-cancel' ? 'request-cancel' : 'mark-undelivered',
                body: { reason },
              },
              { onSuccess: close },
            );
          }}
          pending={post.isPending}
        />
      )}

      {openConfirm === 'decline-return' && (
        <DeclineReturnDialog
          orderId={orderId}
          onClose={close}
          pending={declineReturns.isPending}
          onSubmit={(reasonNote, rejectPhotos) => {
            setPendingKey('decline-return');
            declineReturns.mutate({ reasonNote, rejectPhotos }, { onSuccess: close });
          }}
        />
      )}

      {openConfirm === 'handover' && (
        <HandoverDialog
          onClose={close}
          pending={post.isPending}
          onSubmit={(body) => {
            setPendingKey('handover');
            post.mutate({ endpoint: 'handover', body }, { onSuccess: close });
          }}
        />
      )}

      {openConfirm === 'pickup-handover' && (
        <PickupHandoverDialog
          onClose={close}
          pending={post.isPending}
          onSubmit={(pickupCode) => {
            setPendingKey('pickup-handover');
            post.mutate({ endpoint: 'pickup-handover', body: { pickupCode } }, { onSuccess: close });
          }}
        />
      )}

      {openConfirm === 'counter-return' && detail && (
        <ReturnDialog
          items={detail.items}
          open
          onOpenChange={(o) => !o && close()}
          endpoint={`/retailer/orders/${orderId}/returns/open-counter`}
          title="Counter return"
          description="Select the items the customer is returning at the counter."
          onSuccess={() => {
            invalidate();
            close();
          }}
        />
      )}

      {openConfirm === 'door-close' && detail && (
        <DoorVisitDialog
          orderId={orderId}
          items={detail.items}
          doorWindowExpiresAt={detail.doorWindowExpiresAt ?? null}
          doorWindowExtendedAt={detail.doorWindowExtendedAt ?? null}
          open
          onOpenChange={(o) => !o && close()}
          onClosed={() => {
            invalidate();
            close();
          }}
        />
      )}

      {(openConfirm === 'raise-issue' || openConfirm === 'request-refund') && (
        <IssueDialog
          orderId={orderId}
          refund={openConfirm === 'request-refund'}
          onClose={close}
          onSuccess={() => {
            invalidate();
            close();
            navigate('/retailer/disputes');
          }}
        />
      )}
    </>
  );

  const anyPending = post.isPending || acceptReturns.isPending || declineReturns.isPending;
  return { run, pendingKey: anyPending ? pendingKey : null, dialogs };
}

/* ── Shared dialogs ───────────────────────────────────────────────────── */

/** Multi-image evidence uploader — used by the raise-issue + decline dialogs. */
function EvidenceUploader({
  urls,
  onChange,
  folder,
}: {
  urls: string[];
  onChange: (next: string[]) => void;
  folder: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    const added: string[] = [];
    for (const f of Array.from(files)) {
      try {
        const r = await uploadMedia(f, { folder, purpose: 'listing-gallery', recordToLibrary: true });
        added.push(r.url);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Upload failed');
      }
    }
    if (added.length) onChange([...urls, ...added]);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div>
      <Label hint="Optional · JPG/PNG/WebP">Photos</Label>
      <div className="flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <div key={u} className="relative size-16 overflow-hidden rounded-xs border border-line">
            <img src={u} alt="" className="size-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(urls.filter((_, j) => j !== i))}
              className="absolute right-0.5 top-0.5 grid size-4 place-items-center rounded-full bg-ink/80 text-paper hover:bg-danger"
              aria-label="Remove photo"
            >
              <X className="size-2.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="grid size-16 place-items-center rounded-xs border border-dashed border-rule text-ink-3 hover:border-ink hover:text-ink disabled:opacity-60"
          aria-label="Add photos"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => void onFiles(e.target.files)}
      />
    </div>
  );
}

function ReasonDialog({
  kind,
  onClose,
  onSubmit,
  pending,
}: {
  kind: 'request-cancel' | 'mark-undelivered';
  onClose: () => void;
  onSubmit: (reason: string) => void;
  pending: boolean;
}) {
  const [reason, setReason] = useState('');
  const title = kind === 'request-cancel' ? 'Request cancellation' : 'Mark undelivered';
  const desc =
    kind === 'request-cancel'
      ? 'Tell the operator why this order should be cancelled. An admin reviews the request.'
      : 'Record why the delivery failed. The system decides whether to retry or return to store.';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>
        <Label htmlFor="reason" required>Reason</Label>
        <Textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        {reason.trim().length > 0 && reason.trim().length < 3 && (
          <FieldError>At least 3 characters.</FieldError>
        )}
        <DialogFooter className="mt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant={kind === 'request-cancel' ? 'danger' : 'ink'}
            size="sm"
            loading={pending}
            disabled={reason.trim().length < 3}
            onClick={() => onSubmit(reason.trim())}
          >
            {title}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeclineReturnDialog({
  orderId,
  onClose,
  onSubmit,
  pending,
}: {
  orderId: string;
  onClose: () => void;
  onSubmit: (reasonNote: string, rejectPhotos: string[]) => void;
  pending: boolean;
}) {
  const [reason, setReason] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Decline return &amp; raise dispute</DialogTitle>
          <DialogDescription>
            Declining opens a dispute for admin review and holds the disputed amount — no refund is
            issued and you are not paid out until the admin decides. Attach photos as evidence.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="decline-reason" required>Why are you declining?</Label>
            <Textarea id="decline-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
            {reason.trim().length > 0 && reason.trim().length < 3 && <FieldError>At least 3 characters.</FieldError>}
          </div>
          <EvidenceUploader urls={photos} onChange={setPhotos} folder={`disputes/${orderId}`} />
        </div>
        <DialogFooter className="mt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="danger" size="sm" loading={pending} disabled={reason.trim().length < 3} onClick={() => onSubmit(reason.trim(), photos)}>
            Decline &amp; dispute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type StaffRow = { id: string; legalName: string; subRole: RetailerSubRole; status: string };
type HandoverBody = { assignedAgentId?: string; agentName?: string; agentPhone?: string };
const MANUAL = '__manual__';

function HandoverDialog({
  onClose,
  onSubmit,
  pending,
}: {
  onClose: () => void;
  onSubmit: (body: HandoverBody) => void;
  pending: boolean;
}) {
  // Pick from the store's delivery-agent accounts so the order shows up in that
  // agent's app. Falls back to free-text for an external courier with no account.
  const { data: staff } = useQuery({
    queryKey: ['retailer', 'staff'],
    queryFn: () => api<StaffRow[]>('/retailer/staff'),
  });
  const agents = (staff ?? []).filter((s) => s.subRole === 'delivery_agent' && s.status === 'active');

  const [choice, setChoice] = useState<string>('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const isManual = choice === MANUAL || agents.length === 0;
  const nameOk = name.trim().length >= 2;
  const phoneOk = /^\d{10}$/.test(phone.trim());
  const canSubmit = isManual ? nameOk && phoneOk : choice !== '' && choice !== MANUAL;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Hand to delivery</DialogTitle>
          <DialogDescription>Assign the agent collecting this order.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {agents.length > 0 && (
            <div>
              <Label required>Delivery agent</Label>
              <Select value={choice} onValueChange={setChoice}>
                <SelectTrigger><SelectValue placeholder="Select an agent" /></SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.legalName}</SelectItem>
                  ))}
                  <SelectItem value={MANUAL}>Someone else (external courier)…</SelectItem>
                </SelectContent>
              </Select>
              {agents.length === 0 && (
                <p className="mt-1 text-[11.5px] text-ink-3">
                  No delivery-agent accounts yet — add one under Staff, or enter details below.
                </p>
              )}
            </div>
          )}
          {isManual && (
            <>
              <div>
                <Label htmlFor="agent-name" required>Agent name</Label>
                <Input id="agent-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
              <div>
                <Label htmlFor="agent-phone" required>Agent phone</Label>
                <Input id="agent-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" placeholder="10-digit mobile" />
                {phone.trim() && !phoneOk && <FieldError>Enter a 10-digit number.</FieldError>}
              </div>
            </>
          )}
        </div>
        <DialogFooter className="mt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="accent"
            size="sm"
            loading={pending}
            disabled={!canSubmit}
            onClick={() =>
              onSubmit(
                isManual
                  ? { agentName: name.trim(), agentPhone: phone.trim() }
                  : { assignedAgentId: choice },
              )
            }
          >
            Hand over
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PickupHandoverDialog({
  onClose,
  onSubmit,
  pending,
}: {
  onClose: () => void;
  onSubmit: (pickupCode: string) => void;
  pending: boolean;
}) {
  const [code, setCode] = useState('');
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Hand to customer</DialogTitle>
          <DialogDescription>Enter the pickup code the customer shows to confirm collection.</DialogDescription>
        </DialogHeader>
        <Label htmlFor="pickup-code" required>Pickup code</Label>
        <Input id="pickup-code" value={code} onChange={(e) => setCode(e.target.value)} mono autoFocus />
        <DialogFooter className="mt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="accent" size="sm" loading={pending} disabled={!code.trim()} onClick={() => onSubmit(code.trim())}>
            Confirm collection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IssueDialog({
  orderId,
  refund,
  onClose,
  onSuccess,
}: {
  orderId: string;
  refund: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  // Every retailer-raised item is filed as a dispute now (the kind distinction is
  // no longer shown in the UI; kind='dispute' is the backing customerIssues kind).
  const [subject, setSubject] = useState(refund ? 'Refund request' : '');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState<string[]>([]);

  const create = useMutation({
    mutationFn: () =>
      api('/retailer/issues', {
        method: 'POST',
        body: { kind: 'dispute', orderId, subject: subject.trim(), description: description.trim(), evidence },
      }),
    onSuccess: () => {
      toast.success(refund ? 'Refund request raised' : 'Dispute raised');
      onSuccess();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not raise dispute'),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{refund ? 'Request refund' : 'Raise dispute'}</DialogTitle>
          <DialogDescription>
            {refund
              ? 'Opens a dispute requesting a refund — an admin reviews it.'
              : 'Raise a dispute on this order for admin review.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="issue-subject" required>Subject</Label>
            <Input id="issue-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="issue-desc" required>Details</Label>
            <Textarea id="issue-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <EvidenceUploader urls={evidence} onChange={setEvidence} folder={`disputes/${orderId}`} />
        </div>
        <DialogFooter className="mt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="ink"
            size="sm"
            loading={create.isPending}
            disabled={subject.trim().length < 3 || description.trim().length < 3}
            onClick={() => create.mutate()}
          >
            {refund ? 'Request refund' : 'Raise dispute'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function downloadInvoice(orderId: string) {
  try {
    const list = await api<{ id: string; number: string; kind: string }[]>(
      `/retailer/invoices?orderId=${encodeURIComponent(orderId)}&kind=invoice&limit=5`,
    );
    const inv = list.find((i) => i.kind === 'invoice');
    if (!inv) {
      toast.error('Tax invoice not generated yet (issues after delivery)');
      return;
    }
    const token = getToken();
    const r = await fetch(`${BASE}/retailer/invoices/${inv.id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) throw new Error('Download failed');
    const blob = await r.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${inv.number}.pdf`;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Could not download invoice');
  }
}
