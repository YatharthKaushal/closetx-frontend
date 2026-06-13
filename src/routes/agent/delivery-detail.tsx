import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  DoorOpen,
  ImageOff,
  MapPin,
  Phone,
  Send,
  Truck,
  XCircle,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { uploadMedia } from '@/lib/upload';
import { formatPaise } from '@/lib/status';
import type { DeliveryDetail, DoorDecision, OrderItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AcceptanceCountdown } from '@/components/retailer/acceptance-countdown';
import { cn } from '@/lib/cn';

// The agent's per-item choices. 'refused' (customer refuses the delivery outright)
// is still supported by the API but kept out of this UI to match the agent's mental
// model: keep / accept the return / reject the return.
type AgentDecision = Extract<DoorDecision, 'kept' | 'returned' | 'return_rejected'>;
const DECISIONS: ReadonlyArray<{ value: AgentDecision; label: string; tone: 'success' | 'warning' | 'danger' }> = [
  { value: 'kept', label: 'Keep', tone: 'success' },
  { value: 'returned', label: 'Accept return', tone: 'warning' },
  { value: 'return_rejected', label: 'Reject return', tone: 'danger' },
];

type ItemState = { decision: AgentDecision; reason: string; photoUrl: string };

export default function AgentDeliveryDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['agent', 'delivery', id],
    queryFn: () => api<DeliveryDetail>(`/retailer/deliveries/${id}`),
    enabled: Boolean(id),
    refetchInterval: 5000,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['agent', 'delivery', id] });
    void qc.invalidateQueries({ queryKey: ['agent', 'deliveries'] });
  };
  const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Action failed');

  const depart = useMutation({
    mutationFn: () => api(`/retailer/deliveries/${id}/depart`, { method: 'POST' }),
    onSuccess: () => { toast.success('On the way'); invalidate(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const doorOpen = useMutation({
    mutationFn: () => api(`/retailer/deliveries/${id}/door/open`, { method: 'POST' }),
    onSuccess: () => { toast.success('Handover started'); invalidate(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (isLoading || !data) return <Skeleton className="h-80 w-full" />;

  const phone = data.consumerPhoneSnap;
  const address = [data.addressLine1Snap, data.addressLine2Snap, data.addressCitySnap, data.addressPincodeSnap]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-4">
      <Link to="/retailer/deliveries" className="inline-flex items-center gap-1 text-[12.5px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-3.5" /> All deliveries
      </Link>

      {/* Customer card */}
      <div className="rounded-xl border border-line bg-bg p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[15px] font-semibold text-ink">{data.consumerNameSnap}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-ink-3">
              <Truck className="size-3.5" /> {formatPaise(data.grandTotalPaise)}
              {data.deliveryMethod === 'try_and_buy' && <Badge tone="success" flat>Try &amp; buy</Badge>}
            </div>
          </div>
          {phone && (
            <Button asChild variant="outline" size="sm" iconLeft={<Phone className="size-3.5" />}>
              <a href={`tel:${phone}`}>Call</a>
            </Button>
          )}
        </div>
        {address && (
          <div className="flex items-start gap-1.5 text-[12.5px] text-ink-2">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-ink-4" /> {address}
          </div>
        )}
      </div>

      {/* Status-driven action area */}
      {data.status === 'picked_up' && (
        <Button
          variant="accent"
          size="lg"
          className="w-full"
          loading={depart.isPending}
          iconLeft={<Send className="size-4" />}
          onClick={() => depart.mutate()}
        >
          Start delivery
        </Button>
      )}

      {data.status === 'out_for_delivery' && (
        <div className="space-y-2">
          <Button
            variant="accent"
            size="lg"
            className="w-full"
            loading={doorOpen.isPending}
            iconLeft={<DoorOpen className="size-4" />}
            onClick={() => doorOpen.mutate()}
          >
            Arrived — start handover
          </Button>
          <UndeliveredButton id={id} onDone={() => { invalidate(); navigate('/retailer/deliveries'); }} />
        </div>
      )}

      {data.status === 'at_door' && (
        <DoorPanel detail={data} onDone={() => { invalidate(); navigate('/retailer/deliveries'); }} />
      )}

      {(data.status === 'delivered' ||
        data.status === 'undelivered' ||
        data.status === 'returning_to_store') && (
        <div className="rounded-xl border border-line bg-bg-2/40 p-4 text-center">
          <CheckCircle2 className="mx-auto mb-1.5 size-6 text-success" />
          <div className="text-[13.5px] font-medium text-ink">Visit complete</div>
          <div className="text-[12px] text-ink-3">Status: {data.status.replaceAll('_', ' ')}</div>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to="/retailer/deliveries">Back to deliveries</Link>
          </Button>
        </div>
      )}

      {/* Items (read-only context outside the door panel) */}
      {data.status !== 'at_door' && (
        <div className="space-y-2">
          <div className="text-[12px] font-medium text-ink-3">{data.items.length} item{data.items.length === 1 ? '' : 's'}</div>
          {data.items.map((it) => <ItemRow key={it.id} item={it} />)}
        </div>
      )}
    </div>
  );
}

function ItemRow({ item }: { item: OrderItem }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-bg p-2.5">
      <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded border border-line bg-bg-2">
        {item.galleryImageSnap ? (
          <img src={item.galleryImageSnap} alt={item.listingNameSnap} className="size-full object-cover" />
        ) : (
          <ImageOff className="size-4 text-ink-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-ink">{item.listingNameSnap}</div>
        <div className="text-[11.5px] text-ink-3">{item.attributesLabelSnap} · qty {item.qty}</div>
      </div>
    </div>
  );
}

function DoorPanel({ detail, onDone }: { detail: DeliveryDetail; onDone: () => void }) {
  const qc = useQueryClient();
  const [state, setState] = useState<Record<string, ItemState>>({});

  useEffect(() => {
    const init: Record<string, ItemState> = {};
    for (const it of detail.items) init[it.id] = { decision: 'kept', reason: '', photoUrl: '' };
    setState(init);
  }, [detail.items]);

  const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Action failed');

  const extend = useMutation({
    mutationFn: () =>
      api(`/retailer/deliveries/${detail.id}/door/extend`, {
        method: 'POST',
        body: { reason: 'Customer needs more time' },
      }),
    onSuccess: () => { toast.success('Window extended'); void qc.invalidateQueries({ queryKey: ['agent', 'delivery', detail.id] }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const close = useMutation({
    mutationFn: () =>
      api(`/retailer/deliveries/${detail.id}/door/close`, {
        method: 'POST',
        body: {
          items: detail.items.map((it) => {
            const s = state[it.id]!;
            return {
              orderItemId: it.id,
              decision: s.decision,
              ...(s.reason.trim() && { reason: s.reason.trim() }),
              ...(s.photoUrl.trim() && { photos: [s.photoUrl.trim()] }),
            };
          }),
        },
      }),
    onSuccess: () => { toast.success('Visit completed'); onDone(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  // return_rejected needs reason + photo (mirrors backend guard).
  const allEvidenceComplete = detail.items.every((it) => {
    const s = state[it.id];
    if (!s || s.decision !== 'return_rejected') return true;
    return s.reason.trim().length >= 3 && s.photoUrl.trim().length > 0;
  });

  const counts = detail.items.reduce(
    (acc, it) => { acc[state[it.id]?.decision ?? 'kept']++; return acc; },
    { kept: 0, returned: 0, return_rejected: 0 } as Record<AgentDecision, number>,
  );
  const stays = counts.kept + counts.return_rejected;

  return (
    <div className="space-y-3 rounded-xl border border-accent/30 bg-accent/[0.03] p-3.5">
      {detail.doorWindowExpiresAt && (
        <AcceptanceCountdown deadlineAt={detail.doorWindowExpiresAt} label="Try-on window" />
      )}

      <ul className="space-y-3">
        {detail.items.map((it) => {
          const s = state[it.id] ?? { decision: 'kept' as const, reason: '', photoUrl: '' };
          return (
            <li key={it.id} className="rounded-lg border border-line bg-bg p-3 space-y-2.5">
              <div className="flex items-center gap-3">
                <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded border border-line bg-bg-2">
                  {it.galleryImageSnap ? (
                    <img src={it.galleryImageSnap} alt={it.listingNameSnap} className="size-full object-cover" />
                  ) : (
                    <ImageOff className="size-4 text-ink-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink">{it.listingNameSnap}</div>
                  <div className="text-[11.5px] text-ink-3">{it.attributesLabelSnap} · qty {it.qty}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {DECISIONS.map((d) => {
                  const active = s.decision === d.value;
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setState((c) => ({ ...c, [it.id]: { ...s, decision: d.value } }))}
                      className={cn(
                        'rounded-md border px-2 py-2 text-[12px] font-medium transition-colors',
                        active
                          ? d.tone === 'success'
                            ? 'border-success bg-success-soft text-success'
                            : d.tone === 'warning'
                              ? 'border-warning bg-warning-soft text-warning'
                              : 'border-danger bg-danger-soft text-danger'
                          : 'border-line bg-bg text-ink-2 hover:border-line-2',
                      )}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>

              {s.decision === 'return_rejected' && (
                <div className="space-y-2 rounded-md bg-danger-soft/40 p-2.5">
                  <p className="text-[11.5px] text-danger">
                    Wrong/defective item — customer keeps it, no refund. Photo + reason required.
                  </p>
                  <div>
                    <Label htmlFor={`r-${it.id}`} required>Reason</Label>
                    <Input
                      id={`r-${it.id}`}
                      value={s.reason}
                      onChange={(e) => setState((c) => ({ ...c, [it.id]: { ...s, reason: e.target.value } }))}
                      placeholder="e.g. Different item / visible damage"
                    />
                  </div>
                  <PhotoField
                    value={s.photoUrl}
                    onUploaded={(url) => setState((c) => ({ ...c, [it.id]: { ...s, photoUrl: url } }))}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="text-[12px] text-ink-3">
        {counts.kept} keep · {counts.returned} return · {counts.return_rejected} reject
        {stays > 0 ? ' → marks delivered.' : ' → goods go back to store.'}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          loading={extend.isPending}
          disabled={Boolean(detail.doorWindowExtendedAt)}
          onClick={() => extend.mutate()}
        >
          {detail.doorWindowExtendedAt ? 'Extended' : 'Extend window'}
        </Button>
        <Button
          variant="accent"
          className="flex-1"
          loading={close.isPending}
          disabled={!allEvidenceComplete}
          iconLeft={<Check className="size-4" />}
          onClick={() => close.mutate()}
        >
          Complete visit
        </Button>
      </div>
    </div>
  );
}

function PhotoField({ value, onUploaded }: { value: string; onUploaded: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <Label required>Photo</Label>
      <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-line bg-bg px-3 py-2 text-[12.5px] text-ink-3 hover:border-line-2">
        <Camera className="size-4" />
        {busy ? 'Uploading…' : value ? 'Replace photo' : 'Take / upload photo'}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            uploadMedia(f, { folder: 'door-visits' })
              .then((r) => onUploaded(r.url))
              .catch(() => toast.error('Upload failed'))
              .finally(() => setBusy(false));
            e.target.value = '';
          }}
        />
      </label>
      {value && <img src={value} alt="evidence" className="mt-2 size-20 rounded object-cover" />}
    </div>
  );
}

function UndeliveredButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const mark = useMutation({
    mutationFn: () =>
      api(`/retailer/deliveries/${id}/undelivered`, { method: 'POST', body: { reason: reason.trim() } }),
    onSuccess: () => { toast.success('Marked undelivered'); onDone(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  if (!open) {
    return (
      <Button
        variant="outline"
        className="w-full"
        iconLeft={<XCircle className="size-4" />}
        onClick={() => setOpen(true)}
      >
        Couldn't deliver
      </Button>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border border-line bg-bg p-3">
      <Label htmlFor="ud-reason" required>What happened?</Label>
      <Input
        id="ud-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Customer not reachable / address not found"
      />
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
        <Button
          variant="danger"
          className="flex-1"
          disabled={reason.trim().length < 3}
          loading={mark.isPending}
          iconRight={<ChevronRight className="size-4" />}
          onClick={() => mark.mutate()}
        >
          Confirm
        </Button>
      </div>
    </div>
  );
}
