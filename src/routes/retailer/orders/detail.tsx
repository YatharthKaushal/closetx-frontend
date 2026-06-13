/**
 * Full order detail page (double-click / "Full page"). Reuses the shared
 * action-system + section components so labels/design match the board, history,
 * and sheet — and adds the comprehensive blocks (full payment, customer, returns
 * verification, refunds, disputes) plus detail-only actions.
 */
import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  KeyRound,
  RotateCcw,
  Truck,
  User,
  XCircle,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { OrderDetail, OrderDispute, OrderListRow, Return } from '@/lib/types';
import {
  actorLabel,
  formatAge,
  formatPaise,
  issueDecisionLabel,
  issueStatusMeta,
  orderStatusMeta,
  returnDecisionMeta,
} from '@/lib/status';
import { deriveOrderActions } from '@/lib/order-actions';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CopyableId } from '@/components/ui/copyable-id';
import { AcceptanceCountdown } from '@/components/retailer/acceptance-countdown';
import { useOrderActionRunner } from '@/components/retailer/orders/use-order-action-runner';
import {
  CostSection,
  ItemsSection,
  OrderActionBar,
  PaymentStatusLine,
  RefundsSection,
  TransitSection,
} from '@/components/retailer/orders/order-sections';

export default function RetailerOrderDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const runner = useOrderActionRunner(id);

  // Prev/next: observe-only subscriber to the board's cached list.
  const listQuery = useQuery({
    queryKey: ['retailer', 'orders', 'board'],
    queryFn: () => api<OrderListRow[]>('/retailer/orders'),
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const snap = listQuery.data;
  const idx = snap?.findIndex((o) => o.id === id) ?? -1;
  const prev = idx > 0 ? snap![idx - 1] : null;
  const next = snap && idx >= 0 && idx < snap.length - 1 ? snap[idx + 1] : null;
  const navHint = 'Open this order from the board to use prev / next.';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['retailer', 'order', id],
    queryFn: () => api<OrderDetail>(`/retailer/orders/${id}`),
    enabled: !!id,
    refetchInterval: 4000,
  });

  function invalidateOrder() {
    void qc.invalidateQueries({ queryKey: ['retailer', 'order', id] });
    void qc.invalidateQueries({ queryKey: ['retailer', 'orders'] });
  }

  const verify = useMutation({
    mutationFn: (returnId: string) =>
      api(`/retailer/returns/${returnId}/verify`, { method: 'POST', body: { decision: 'accepted' } }),
    onSuccess: () => {
      toast.success('Return accepted — refund issued');
      invalidateOrder();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Accept failed'),
  });

  // Declining a return raises a dispute and holds funds until an admin decides.
  const decline = useMutation({
    mutationFn: (v: { returnId: string; reasonNote?: string }) =>
      api(`/retailer/returns/${v.returnId}/decline`, { method: 'POST', body: { reasonNote: v.reasonNote } }),
    onSuccess: () => {
      toast.success('Return declined — dispute opened, funds held pending admin review');
      invalidateOrder();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Decline failed'),
  });


  const actions = useMemo(
    () => (data ? deriveOrderActions(data, { detail: data, surface: 'page' }) : []),
    [data],
  );
  const pendingReturns = (data?.returns ?? []).filter((r) => r.storeDecision === 'pending');

  if (!id) return null;

  return (
    <Page>
      <PageHeader
        kicker="Order"
        title={data ? orderStatusMeta(data.status).label : 'Order'}
        actions={
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon-sm" disabled={!prev} title={prev ? `Order ${prev.id}` : navHint} onClick={() => prev && navigate(`/retailer/orders/${prev.id}`)}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" disabled={!next} title={next ? `Order ${next.id}` : navHint} onClick={() => next && navigate(`/retailer/orders/${next.id}`)}>
              <ChevronRight className="size-4" />
            </Button>
            <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
              <Link to="/retailer/orders">Board</Link>
            </Button>
          </div>
        }
      />

      {isError ? (
        <Card><CardContent className="py-10 text-center text-ink-3">Order not found.</CardContent></Card>
      ) : isLoading || !data ? (
        <Card><CardContent className="py-10 text-center text-ink-3">Loading…</CardContent></Card>
      ) : (
        <>
          {/* Status hero + action bar */}
          <Card className="mb-4 accent-strip relative">
            <CardContent className="space-y-3 pt-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={orderStatusMeta(data.status).tone} pulse={orderStatusMeta(data.status).pulse}>
                  {orderStatusMeta(data.status).label}
                </Badge>
                <CopyableId value={data.id} label="order id" />
                <span className="text-[11.5px] text-ink-3">{formatAge(data.placedAt)}</span>
              </div>
              {data.status === 'routing' && data.acceptanceDeadlineAt && (
                <AcceptanceCountdown deadlineAt={data.acceptanceDeadlineAt} label="Acceptance window" />
              )}
              {data.status === 'at_door' && data.doorWindowExpiresAt && (
                <AcceptanceCountdown deadlineAt={data.doorWindowExpiresAt} label="Try-on window" />
              )}
              <OrderActionBar actions={actions} runner={runner} />
              {data.openDispute && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-[12.5px]">
                  <span className="text-warning-strong">
                    A dispute is open on this order — funds are held until an admin
                    decides. No further refund actions until it's resolved.
                  </span>
                  <Button asChild variant="outline" size="xs" className="shrink-0">
                    <Link to={`/retailer/disputes/${data.openDispute.id}`}>View dispute</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Returns verification */}
          {pendingReturns.length > 0 && (
            <Card className="mb-4 accent-strip relative">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><RotateCcw className="size-4" /> Verify returns ({pendingReturns.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-line">
                  {pendingReturns.map((r) => (
                    <ReturnVerifyRow
                      key={r.id}
                      ret={r}
                      onAccept={(rid) => verify.mutate(rid)}
                      onDecline={(rid) => decline.mutate({ returnId: rid })}
                      busy={verify.isPending || decline.isPending}
                    />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Balanced masonry — cards flow to fill both columns evenly so no
              column is left with dead space when content height is uneven. */}
          <div className="gap-4 lg:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">
            <Card>
              <CardHeader><CardTitle>Items ({data.items.length})</CardTitle></CardHeader>
              <CardContent><ItemsSection detail={data} /></CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Payment</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <PaymentStatusLine detail={data} />
                <CostSection detail={data} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Customer &amp; delivery</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-[13px]">
                <Row icon={<User className="size-3.5" />} k="Customer" v={data.consumerNameSnap} />
                <Row icon={<User className="size-3.5" />} k="Phone" v={data.consumerPhoneSnap} />
                {data.consumerEmailSnap && <Row icon={<User className="size-3.5" />} k="Email" v={data.consumerEmailSnap} />}
                {data.deliveryMethod !== 'pickup' && (
                  <Row icon={<Truck className="size-3.5" />} k="Address" v={
                    <span className="text-right">
                      {data.addressLine1Snap}{data.addressLine2Snap && <>, {data.addressLine2Snap}</>}<br />
                      {data.addressCitySnap} {data.addressPincodeSnap}
                    </span>
                  } />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Disputes</CardTitle></CardHeader>
              <CardContent className="space-y-2.5 text-[13px]">
                {(data.disputes?.length ?? 0) === 0 ? (
                  <p className="text-ink-3">No disputes on this order.</p>
                ) : (
                  (data.disputes ?? []).map((d) => <DisputeRow key={d.id} dispute={d} />)
                )}
              </CardContent>
            </Card>

            {data.deliveryMethod === 'pickup' && (
              <Card>
                <CardHeader><CardTitle>Pickup slot</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-[13px]">
                  {data.pickupSlotStart && data.pickupSlotEnd ? (
                    <Row icon={<Clock className="size-3.5" />} k="Window" v={
                      <span className="text-right">
                        {new Date(data.pickupSlotStart).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                        {' – '}
                        {new Date(data.pickupSlotEnd).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    } />
                  ) : <Row icon={<Clock className="size-3.5" />} k="Window" v="—" />}
                  {data.pickupCode && (
                    <Row icon={<KeyRound className="size-3.5" />} k="Handover code" v={<span className="font-mono text-[14px] font-semibold text-ink">{data.pickupCode}</span>} />
                  )}
                </CardContent>
              </Card>
            )}

            {(data.refunds ?? []).length > 0 && (
              <Card>
                <CardHeader><CardTitle>Refunds</CardTitle></CardHeader>
                <CardContent><RefundsSection detail={data} /></CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
              <CardContent><TransitSection detail={data} /></CardContent>
            </Card>
          </div>
        </>
      )}

      {runner.dialogs}
    </Page>
  );
}

function Row({ icon, k, v }: { icon: React.ReactNode; k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="inline-flex shrink-0 items-center gap-1.5 text-ink-3">{icon} {k}</span>
      <span className="text-right text-ink">{v}</span>
    </div>
  );
}

function DisputeRow({ dispute }: { dispute: OrderDispute }) {
  const meta = issueStatusMeta(dispute.status);
  const open = dispute.status !== 'decided' && dispute.status !== 'closed' && dispute.status !== 'resolved';
  return (
    <div
      className={
        'rounded-md border px-3 py-2.5 ' +
        (open ? 'border-warning/40 bg-warning-soft/40' : 'border-line bg-bg-2/30')
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={meta.tone} pulse={open}>{meta.label}</Badge>
        {dispute.heldAmountPaise != null && dispute.heldAmountPaise > 0 && (
          <Badge tone="warning" flat>Held {formatPaise(dispute.heldAmountPaise)}</Badge>
        )}
        <span className="ml-auto text-[11px] text-ink-4">{formatAge(dispute.createdAt)}</span>
      </div>
      <div className="mt-1.5 truncate font-medium text-ink">{dispute.subject}</div>
      <div className="mt-0.5 text-[11.5px] text-ink-3">
        Opened by {actorLabel(dispute.openedByActorType)}
        {dispute.returnId && <> · on a return</>}
      </div>
      {dispute.decision && (
        <div className="mt-1.5 text-[12px]">
          <span className="text-ink-3">Decision: </span>
          <span className="font-medium text-ink">{issueDecisionLabel(dispute.decision)}</span>
          {dispute.decisionNote && <span className="text-ink-3 italic"> — {dispute.decisionNote}</span>}
        </div>
      )}
      <div className="mt-2">
        <Button asChild variant="outline" size="xs">
          <Link to={`/retailer/disputes/${dispute.id}`}>View dispute</Link>
        </Button>
      </div>
    </div>
  );
}

function ReturnVerifyRow({
  ret,
  onAccept,
  onDecline,
  busy,
}: {
  ret: Return;
  onAccept: (returnId: string) => void;
  onDecline: (returnId: string) => void;
  busy: boolean;
}) {
  const meta = returnDecisionMeta(ret.storeDecision);
  return (
    <li className="flex items-start justify-between gap-2 py-2.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <span className="text-[11.5px] text-ink-3">
            {ret.kind === 'door_return' ? 'door return' : 'standard return'} · {formatAge(ret.openedAt)}
          </span>
        </div>
        {ret.reasonText && <div className="mt-1 text-[12px] italic text-ink-3">{ret.reasonText}</div>}
        {ret.agentDisposition && <div className="mt-1 text-[11.5px] text-ink-3">Agent: <span className="font-mono">{ret.agentDisposition}</span></div>}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          size="sm"
          variant="outline"
          iconLeft={<XCircle className="size-3" />}
          disabled={busy}
          title="Opens a dispute and holds funds until an admin decides"
          onClick={() => onDecline(ret.id)}
        >
          Decline &amp; dispute
        </Button>
        <Button size="sm" variant="accent" iconLeft={<Check className="size-3" />} disabled={busy} onClick={() => onAccept(ret.id)}>
          Accept (refund)
        </Button>
      </div>
    </li>
  );
}
