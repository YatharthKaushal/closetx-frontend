import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Coins,
  ImageOff,
  PackageX,
  RefreshCcw,
  RotateCcw,
  Truck,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import {
  deliveryMethodLabel,
  formatAge,
  formatPaise,
  heldItemDispositionLabel,
  heldItemStatusMeta,
  orderGroupStatusMeta,
  orderStatusMeta,
  paymentMethodLabel,
  paymentStatusMeta,
  refundDisbursementStatusMeta,
  refundStatusMeta,
  returnDecisionMeta,
} from '@/lib/status';
import type { HeldItem, OrderDetail, OrderListRow, Refund, RefundDisbursement, Return } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableId } from '@/components/ui/copyable-id';
import { Timeline } from '@/components/ui/timeline';
import { DoorVisitDialog } from '@/components/ui/door-visit-dialog';
import { ReturnDialog } from '@/components/ui/return-dialog';
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
import { OrderGroupCard } from '@/components/orders/OrderGroupCard';

export default function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [doorOpen, setDoorOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [feeOverrideOpen, setFeeOverrideOpen] = useState(false);
  const [feeOverrideRupees, setFeeOverrideRupees] = useState('');
  const [feeOverrideReason, setFeeOverrideReason] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'orders', id],
    queryFn: () => api<OrderDetail>(`/admin/orders/${id}`),
    enabled: !!id,
    refetchInterval: 4000,
  });

  type OrderInvoice = {
    id: string;
    number: string;
    kind: string;
    status: string;
    totalPaise: number;
    pdfUrl: string | null;
    issuedAt: string | null;
    createdAt: string;
  };
  const invoicesQ = useQuery({
    queryKey: ['admin', 'orders', id, 'invoices'],
    queryFn: () => api<OrderInvoice[]>(`/admin/orders/${id}/invoices`),
    enabled: !!id,
    staleTime: 30_000,
  });
  const taxInvoice = (invoicesQ.data ?? []).find(
    (i) => i.kind === 'tax_invoice' || i.kind === 'bill_of_supply',
  ) ?? null;

  const cancel = useMutation({
    mutationFn: (reason: string) =>
      api(`/admin/orders/${id}/cancel`, { method: 'POST', body: { reason } }),
    onSuccess: () => {
      toast.success('Order cancelled');
      setCancelOpen(false);
      void qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Cancel failed'),
  });

  const openDoor = useMutation({
    mutationFn: () => api(`/admin/orders/${id}/door/open`, { method: 'POST', body: {} }),
    onSuccess: () => {
      toast.success('Door visit opened');
      void qc.invalidateQueries({ queryKey: ['admin', 'orders', id] });
      setDoorOpen(true);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Open door failed'),
  });

  // Delivery-agent impersonation verbs (admin acts as the in-the-wild agent for testing).
  const agentVerb = useMutation({
    mutationFn: ({ storeId, verb, body }: { storeId: string; verb: string; body?: Record<string, unknown> }) =>
      api(`/admin/stores/${storeId}/orders/${id}/${verb}`, { method: 'POST', body: body ?? {} }),
    onSuccess: (_d, vars) => {
      toast.success(`Agent ${vars.verb}`);
      void qc.invalidateQueries({ queryKey: ['admin', 'orders', id] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Agent action failed'),
  });
  const [undelOpen, setUndelOpen] = useState(false);
  const [undelReason, setUndelReason] = useState('');

  const verify = useMutation({
    mutationFn: ({ returnId, decision }: { returnId: string; decision: 'accepted' | 'rejected' }) =>
      api(`/admin/returns/${returnId}/verify`, { method: 'POST', body: { decision } }),
    onSuccess: (_r, vars) => {
      toast.success(`Return ${vars.decision}`);
      void qc.invalidateQueries({ queryKey: ['admin', 'orders', id] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Verify failed'),
  });

  const forceFail = useMutation({
    mutationFn: ({ refundId, dId }: { refundId: string; dId: string }) =>
      api(`/admin/refunds/${refundId}/disbursements/${dId}/force-fail`, {
        method: 'POST',
        body: { reason: 'Admin force-fail from detail page' },
      }),
    onSuccess: () => {
      toast.success('Disbursement failed; retry chained');
      void qc.invalidateQueries({ queryKey: ['admin', 'orders', id] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Force-fail failed'),
  });

  const retry = useMutation({
    mutationFn: ({ refundId, dId }: { refundId: string; dId: string }) =>
      api(`/admin/refunds/${refundId}/disbursements/${dId}/retry`, { method: 'POST', body: {} }),
    onSuccess: () => {
      toast.success('Disbursement retried');
      void qc.invalidateQueries({ queryKey: ['admin', 'orders', id] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Retry failed'),
  });

  const feeOverride = useMutation({
    mutationFn: (body: { overridePaise: number; reason: string }) =>
      api(`/admin/orders/${id}/fee-override`, { method: 'POST', body }),
    onSuccess: () => {
      toast.success('Platform fee override recorded');
      setFeeOverrideOpen(false);
      setFeeOverrideRupees('');
      setFeeOverrideReason('');
      void qc.invalidateQueries({ queryKey: ['admin', 'orders', id] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Override failed'),
  });

  if (!id) return null;

  const order = data;
  const isTnB = order?.deliveryMethod === 'try_and_buy';
  const canOpenDoor = isTnB && order?.status === 'out_for_delivery';
  const canCloseDoor = order?.status === 'at_door';
  const canOpenReturn =
    order?.status === 'delivered' &&
    !!order.deliveredAt &&
    Date.now() - new Date(order.deliveredAt).getTime() < 7 * 24 * 60 * 60 * 1000;

  return (
    <Page>
      <div className="mb-3">
        <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
          <Link to="/admin/orders">All orders</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-64" />
        </div>
      ) : isError || !data ? (
        <p className="text-[13px] text-danger">Couldn't load order.</p>
      ) : (
        <>
          <Detail
            order={data}
            taxInvoice={taxInvoice}
            onCancelClick={() => setCancelOpen(true)}
          />

          {/* Order action simulator — admin acts on behalf of retailer staff + delivery agent */}
          {['pending', 'routing', 'accepted', 'packed', 'picked_up', 'out_for_delivery', 'undelivered', 'returned_to_store'].includes(order!.status) && (
            <Card className="mt-4 border-warning/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="size-4" /> Order action simulator
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-[12.5px] text-ink-3">
                  Drive the order through every state on behalf of the retailer / delivery agent.
                  Current status: <span className="font-mono text-ink">{order!.status}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {(order!.status === 'pending' || order!.status === 'routing') && (
                    <Button
                      variant="ink"
                      size="sm"
                      loading={agentVerb.isPending}
                      onClick={() => agentVerb.mutate({ storeId: order!.storeId, verb: 'accept' })}
                    >
                      Accept (as retailer)
                    </Button>
                  )}
                  {order!.status === 'accepted' && (
                    <Button
                      variant="ink"
                      size="sm"
                      loading={agentVerb.isPending}
                      onClick={() => agentVerb.mutate({ storeId: order!.storeId, verb: 'pack' })}
                    >
                      Pack (as retailer)
                    </Button>
                  )}
                  {order!.status === 'packed' && (
                    <>
                      <Button
                        variant="ink"
                        size="sm"
                        loading={agentVerb.isPending}
                        onClick={() => agentVerb.mutate({ storeId: order!.storeId, verb: 'handover' })}
                      >
                        Handover to agent
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        loading={agentVerb.isPending}
                        onClick={() => agentVerb.mutate({ storeId: order!.storeId, verb: 'mark-delivered' })}
                      >
                        Mark delivered (pickup)
                      </Button>
                    </>
                  )}
                  {order!.status === 'picked_up' && (
                    <Button
                      variant="ink"
                      size="sm"
                      loading={agentVerb.isPending}
                      onClick={() => agentVerb.mutate({ storeId: order!.storeId, verb: 'depart' })}
                    >
                      Depart for delivery
                    </Button>
                  )}
                  {order!.status === 'out_for_delivery' && (
                    <>
                      {!isTnB && (
                        <Button
                          variant="ink"
                          size="sm"
                          loading={agentVerb.isPending}
                          onClick={() => agentVerb.mutate({ storeId: order!.storeId, verb: 'mark-delivered' })}
                        >
                          Mark delivered (as agent)
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setUndelOpen(true)}
                      >
                        Mark undelivered (as agent)
                      </Button>
                    </>
                  )}
                  {order!.status === 'undelivered' && (
                    <Button
                      variant="ink"
                      size="sm"
                      loading={agentVerb.isPending}
                      onClick={() => agentVerb.mutate({ storeId: order!.storeId, verb: 'depart' })}
                    >
                      Retry out for delivery
                    </Button>
                  )}
                  {order!.status === 'returned_to_store' && (
                    <Button
                      variant="ink"
                      size="sm"
                      loading={agentVerb.isPending}
                      onClick={() => agentVerb.mutate({ storeId: order!.storeId, verb: 'mark-delivered' })}
                    >
                      Mark delivered (counter pickup)
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Try-and-Buy door panel */}
          {(canOpenDoor || canCloseDoor) && (
            <Card className="mt-4 accent-strip relative">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="size-4" /> Try-and-Buy door visit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {canOpenDoor && (
                  <>
                    <p className="text-[13px] text-ink-3">
                      Order is out for delivery. Open the door visit to record per-item kept / returned / refused decisions.
                    </p>
                    <Button
                      variant="accent"
                      iconLeft={<Truck className="size-3.5" />}
                      loading={openDoor.isPending}
                      onClick={() => openDoor.mutate()}
                    >
                      Open door visit
                    </Button>
                  </>
                )}
                {canCloseDoor && (
                  <>
                    <p className="text-[13px] text-ink-3">
                      Door visit in progress. Close the door with the per-item decisions to finalise.
                    </p>
                    <Button
                      variant="accent"
                      iconLeft={<X className="size-3.5" />}
                      onClick={() => setDoorOpen(true)}
                    >
                      Close door (per-item decisions)
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* §12 F3b — Platform fee override */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="size-4" /> Platform fee override
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.platformFeeOverridePaise && data.platformFeeOverridePaise > 0 ? (
                <>
                  <div className="text-[13px]">
                    Override: <strong className="font-mono">{formatPaise(data.platformFeeOverridePaise)}</strong>
                  </div>
                  {data.platformFeeOverrideReason && (
                    <div className="rounded border border-line bg-bg-2/30 p-2 text-[12.5px] text-ink-2">
                      Reason: {data.platformFeeOverrideReason}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[12.5px] text-ink-3">No override applied. Fee is computed from the store rate snapshot ({(data.platformFeeBpSnap / 100).toFixed(2)}%).</p>
              )}
              <Button variant="outline" size="sm" onClick={() => setFeeOverrideOpen(true)}>
                Override fee
              </Button>
            </CardContent>
          </Card>

          {/* Returns + held + refunds related to this order */}
          {((data.returns?.length ?? 0) > 0 ||
            (data.refunds?.length ?? 0) > 0 ||
            (data.heldItems?.length ?? 0) > 0 ||
            canOpenReturn) && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <RotateCcw className="size-4" /> Returns
                  </CardTitle>
                  {canOpenReturn && (
                    <Button variant="outline" size="sm" onClick={() => setReturnOpen(true)}>
                      Open on behalf of consumer
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {(data.returns?.length ?? 0) === 0 ? (
                    <p className="text-[12.5px] text-ink-3">No returns yet on this order.</p>
                  ) : (
                    <ReturnsList
                      returns={data.returns ?? []}
                      onVerify={(returnId, decision) => verify.mutate({ returnId, decision })}
                      pending={verify.isPending}
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coins className="size-4" /> Refunds
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(data.refunds?.length ?? 0) === 0 ? (
                    <p className="text-[12.5px] text-ink-3">No refunds yet.</p>
                  ) : (
                    <RefundsList
                      refunds={data.refunds ?? []}
                      onForceFail={(rid, did) => forceFail.mutate({ refundId: rid, dId: did })}
                      onRetry={(rid, did) => retry.mutate({ refundId: rid, dId: did })}
                    />
                  )}
                </CardContent>
              </Card>

              {(data.heldItems?.length ?? 0) > 0 && (
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PackageX className="size-4" /> Held items
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <HeldList held={data.heldItems ?? []} />
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Mark undelivered dialog */}
          <Dialog open={undelOpen} onOpenChange={setUndelOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Mark undelivered</DialogTitle>
                <DialogDescription>
                  Records an undelivered attempt. Order moves to undelivered → retry or returning_to_store.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="undel-reason">Reason</Label>
                <Input
                  id="undel-reason"
                  value={undelReason}
                  onChange={(e) => setUndelReason(e.target.value)}
                  placeholder="Consumer not at door / wrong address / refused"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setUndelOpen(false)}>Cancel</Button>
                <Button
                  variant="danger"
                  loading={agentVerb.isPending}
                  onClick={() => {
                    agentVerb.mutate(
                      { storeId: order!.storeId, verb: 'mark-undelivered', body: { reason: undelReason.trim() || 'unspecified' } },
                      {
                        onSuccess: () => {
                          setUndelOpen(false);
                          setUndelReason('');
                        },
                      },
                    );
                  }}
                >
                  Confirm
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Door visit dialog */}
          {data && (
            <DoorVisitDialog
              orderId={data.id}
              items={data.items}
              doorWindowExpiresAt={data.doorWindowExpiresAt ?? null}
              doorWindowExtendedAt={data.doorWindowExtendedAt ?? null}
              open={doorOpen}
              onOpenChange={setDoorOpen}
              onClosed={() => {
                void qc.invalidateQueries({ queryKey: ['admin', 'orders', id] });
              }}
            />
          )}

          {/* Open-return dialog */}
          {data && canOpenReturn && (
            <ReturnDialog
              items={data.items}
              open={returnOpen}
              onOpenChange={setReturnOpen}
              endpoint={`/admin/orders/${data.id}/returns/open`}
              title="Open return on behalf of consumer"
              description="Pick the items the customer wants to return. Each one becomes a pending return for the store to verify."
              onSuccess={() => {
                void qc.invalidateQueries({ queryKey: ['admin', 'orders', id] });
              }}
            />
          )}
        </>
      )}

      <Dialog open={feeOverrideOpen} onOpenChange={(o) => !feeOverride.isPending && setFeeOverrideOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override platform fee</DialogTitle>
            <DialogDescription>
              Enter the override amount (₹) and the reason. The decision is recorded and audited.
              Settlement math will pick up the override once integrated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="fee-override-amt" required>Override amount (₹)</Label>
              <Input
                id="fee-override-amt"
                type="number"
                min="0"
                step="1"
                value={feeOverrideRupees}
                onChange={(e) => setFeeOverrideRupees(e.target.value)}
                placeholder="0 to clear the override"
              />
            </div>
            <div>
              <Label htmlFor="fee-override-reason" required>Reason</Label>
              <textarea
                id="fee-override-reason"
                rows={3}
                maxLength={500}
                value={feeOverrideReason}
                onChange={(e) => setFeeOverrideReason(e.target.value)}
                placeholder="e.g. goodwill — repeated stockouts"
                className="mt-1 w-full rounded border border-line-2 bg-bg px-2 py-1 text-[13px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFeeOverrideOpen(false)} disabled={feeOverride.isPending}>Cancel</Button>
            <Button
              variant="ink"
              loading={feeOverride.isPending}
              disabled={feeOverrideReason.trim().length < 3 || feeOverrideRupees.trim() === ''}
              onClick={() => {
                const rupees = Number(feeOverrideRupees);
                if (!Number.isFinite(rupees) || rupees < 0) {
                  toast.error('Enter a non-negative amount.');
                  return;
                }
                feeOverride.mutate({
                  overridePaise: Math.round(rupees * 100),
                  reason: feeOverrideReason.trim(),
                });
              }}
            >
              Save override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel order?</DialogTitle>
            <DialogDescription>
              Reserved stock will be released. The audit log records the reason.
            </DialogDescription>
          </DialogHeader>
          {data?.status === 'delivered' && (
            <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-[12.5px] text-danger">
              <strong className="block text-danger-strong">Order already delivered.</strong>
              Cancelling now triggers a refund to the original tender and may require a pickup
              from the customer. The reason is recorded against the order.
            </div>
          )}
          <div>
            <Label htmlFor="reason" required>Reason</Label>
            <Input
              id="reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={data?.status === 'delivered' ? 'e.g. Fraud confirmed' : 'e.g. Stockout at store'}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={cancel.isPending}
              disabled={cancelReason.trim().length < 3}
              onClick={() => cancel.mutate(cancelReason.trim())}
              iconLeft={<X className="size-3.5" />}
            >
              Cancel order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

type TaxInvoiceLite = {
  id: string;
  number: string;
  kind: string;
  status: string;
  pdfUrl: string | null;
} | null;

function Detail({
  order,
  taxInvoice,
  onCancelClick,
}: {
  order: OrderDetail;
  taxInvoice: TaxInvoiceLite;
  onCancelClick: () => void;
}) {
  const meta = orderStatusMeta(order.status);
  const groupMeta = orderGroupStatusMeta(order.group.status);
  // §8 story 10 — ops-admin can cancel at any non-terminal stage, including
  // delivered orders (force-refund path). Only fully-terminal cancelled/closed
  // orders block the button.
  const canCancel = !['cancelled', 'closed'].includes(order.status);

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3 flex-wrap">
            <span>Order</span>
            <Badge tone={meta.tone} pulse={meta.pulse}>{meta.label}</Badge>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <CopyableId value={order.id} label="order id" />
            <span className="text-ink-3">in group</span>
            <CopyableId value={order.group.id} label="group id" />
            <Badge tone={groupMeta.tone}>{groupMeta.label}</Badge>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              iconRight={<ArrowUpRight className="size-3.5" />}
              disabled={!taxInvoice?.pdfUrl}
              title={
                !taxInvoice
                  ? 'Tax invoice not generated yet'
                  : !taxInvoice.pdfUrl
                    ? 'PDF not ready yet'
                    : `Open ${taxInvoice.number}`
              }
              onClick={() => {
                if (taxInvoice?.pdfUrl) window.open(taxInvoice.pdfUrl, '_blank', 'noopener');
              }}
            >
              Tax invoice
            </Button>
            <Button asChild variant="outline" size="sm" iconRight={<ArrowUpRight className="size-3.5" />}>
              <Link to={`/admin/payouts-pipeline?orderId=${order.id}`}>Payout</Link>
            </Button>
            {canCancel && (
              <Button variant="outline" iconLeft={<X className="size-3.5" />} onClick={onCancelClick}>
                Cancel order
              </Button>
            )}
          </div>
        }
      />

      <div className="-mt-2 mb-4 flex flex-wrap gap-2">
        {order.storeId && (
          <Link
            to={`/admin/stores?storeId=${order.storeId}`}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-bg-2 px-2 py-0.5 text-[11.5px] text-ink-3 hover:text-ink hover:bg-bg-3"
          >
            Open store
          </Link>
        )}
        {order.consumerId && (
          <Link
            to={`/admin/consumers/${order.consumerId}`}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-bg-2 px-2 py-0.5 text-[11.5px] text-ink-3 hover:text-ink hover:bg-bg-3"
          >
            Open consumer
          </Link>
        )}
      </div>

      {order.group.siblingOrders.length > 0 && (
        <div className="mb-4">
          <OrderGroupCard
            groupId={order.group.id}
            status={order.group.status}
            placedAt={order.group.placedAt}
            combinedTotalPaise={order.group.combinedTotalPaise}
            orders={[orderDetailToListRow(order), ...order.group.siblingOrders]}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left column: items + customer */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle>Items ({order.items.length})</CardTitle></CardHeader>
            <CardContent>
              <ul className="divide-y divide-line">
                {order.items.map((it) => (
                  <li key={it.id} className="flex gap-3 py-3">
                    <div className="size-14 shrink-0 rounded border border-line bg-bg-2 grid place-items-center overflow-hidden">
                      {it.galleryImageSnap ? (
                        <img src={it.galleryImageSnap} alt={it.listingNameSnap} className="size-full object-cover" />
                      ) : (
                        <ImageOff className="size-5 text-ink-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-ink truncate">{it.listingNameSnap}</div>
                      <div className="text-[11.5px] text-ink-3 mt-0.5">
                        {it.brandSnap} · {it.attributesLabelSnap}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-[13px] tabular-nums text-ink">
                        {formatPaise(it.unitPricePaise)} × {it.qty}
                      </div>
                      <div className="text-[11.5px] text-ink-3 mt-0.5">
                        {formatPaise(it.netLinePaise)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <PriceSnapshotDiff orderId={order.id} />

          <Card>
            <CardHeader><CardTitle>Customer & delivery</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-[13px]">
              <Row k="Name" v={order.consumerNameSnap} />
              <Row k="Phone" v={order.consumerPhoneSnap} />
              <Row k="Email" v={order.consumerEmailSnap} />
              <hr className="border-line my-2" />
              <Row k="Method" v={deliveryMethodLabel(order.deliveryMethod)} />
              {order.deliveryMethod !== 'pickup' && (
                <>
                  <Row k="Address" v={
                    <span className="text-right">
                      {order.addressLine1Snap}
                      {order.addressLine2Snap && <>, {order.addressLine2Snap}</>}
                      <br />
                      {order.addressCitySnap} {order.addressPincodeSnap}
                    </span>
                  } />
                </>
              )}
              <Row k="Store" v={`${order.storeNameSnap} (${order.storeStateCodeSnap})`} />
            </CardContent>
          </Card>
        </div>

        {/* Right column: pricing + payment + timeline */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Payment</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-[13px]">
              <Row k="Method" v={paymentMethodLabel(order.paymentMethod)} />
              {order.payments.length === 0 ? (
                <p className="text-ink-3 text-[12px]">No payment row yet.</p>
              ) : (
                <ul className="space-y-2">
                  {order.payments.map((p) => {
                    const pm = paymentStatusMeta(p.status);
                    return (
                      <li key={p.id} className="rounded border border-line bg-bg-2/50 p-2 text-[12px]">
                        <div className="flex items-center justify-between">
                          <Badge tone={pm.tone}>{pm.label}</Badge>
                          <span className="font-mono tabular-nums">{formatPaise(p.amountPaise)}</span>
                        </div>
                        {p.gatewayRef && (
                          <div className="mt-1 font-mono text-[11px] text-ink-3 truncate">
                            ref: {p.gatewayRef}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="accent-strip relative">
            <CardHeader><CardTitle>Pricing</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-[13px]">
              <PriceRow k="Items subtotal" v={order.itemsSubtotalPaise} />
              {order.retailerPromoPaise > 0 && <PriceRow k="Retailer promo" v={-order.retailerPromoPaise} />}
              {order.platformPromoPaise > 0 && <PriceRow k="Platform promo" v={-order.platformPromoPaise} />}
              {order.couponPaise > 0 && <PriceRow k="Coupon" v={-order.couponPaise} />}
              {order.pointsRedeemedPaise > 0 && <PriceRow k="Points" v={-order.pointsRedeemedPaise} />}
              <PriceRow k={`GST (${order.taxSplitKind === 'intra_state' ? 'CGST+SGST' : 'IGST'})`} v={order.taxPaise} />
              {order.deliveryFeePaise > 0 && <PriceRow k="Delivery" v={order.deliveryFeePaise} />}
              {order.handlingFeePaise > 0 && <PriceRow k="Handling" v={order.handlingFeePaise} />}
              {order.convenienceFeePaise > 0 && <PriceRow k="Convenience" v={order.convenienceFeePaise} />}
              <hr className="border-line my-2" />
              <div className="flex items-center justify-between">
                <span className="text-ink font-semibold">Grand total</span>
                <span className="font-mono text-[16px] tabular-nums text-ink font-semibold">
                  {formatPaise(order.grandTotalPaise)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline transitions={order.transitions} />
              {order.deliveryAttempts.length > 0 && (
                <>
                  <hr className="border-line my-3" />
                  <div className="kicker mb-2">Delivery attempts</div>
                  <ul className="space-y-1 text-[12px]">
                    {order.deliveryAttempts.map((a) => (
                      <li key={a.id} className="flex items-center justify-between">
                        <span>
                          #{a.attemptNumber} · {a.outcome}
                          {a.notes && <span className="text-ink-3"> — {a.notes}</span>}
                        </span>
                        <span className="text-ink-3">{formatAge(a.attemptedAt)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>

          {order.availableTransitions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>What can happen next</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-[12px]">
                  {order.availableTransitions.map((t) => {
                    const m = orderStatusMeta(t.to);
                    return (
                      <li key={`${t.from}-${t.to}`} className="flex items-center gap-2">
                        <ChevronRight className="size-3 text-ink-4" />
                        <span className="text-ink">{m.label}</span>
                        <span className="text-ink-3 italic">by {t.actors.join(', ')}</span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

type SnapshotRow = { variantId: string; listingNameSnap: string; snapshotPaise: number; currentPaise: number };

function PriceSnapshotDiff({ orderId }: { orderId: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin', 'orders', orderId, 'price-snapshot'],
    queryFn: () => api<SnapshotRow[]>(`/admin/orders/${orderId}/price-snapshot`),
  });
  const drift = data.filter((r) => r.currentPaise !== r.snapshotPaise);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Price snapshot diff</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-10 w-48" />
        ) : drift.length === 0 ? (
          <p className="text-[12.5px] text-ink-3 italic">All snapshot prices match the live variant catalogue.</p>
        ) : (
          <ul className="divide-y divide-line">
            {drift.map((r) => {
              const diff = r.currentPaise - r.snapshotPaise;
              return (
                <li key={r.variantId} className="flex items-center justify-between gap-3 py-2.5 text-[12.5px]">
                  <span className="text-ink truncate">{r.listingNameSnap}</span>
                  <span className="text-ink-3 font-mono">
                    Snap {formatPaise(r.snapshotPaise)} → Live {formatPaise(r.currentPaise)}
                    {' '}
                    <span className={diff > 0 ? 'text-warning' : 'text-success'}>
                      ({diff > 0 ? '+' : ''}{formatPaise(diff)})
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function orderDetailToListRow(order: OrderDetail): OrderListRow {
  return {
    id: order.id,
    groupId: order.groupId,
    status: order.status,
    storeId: order.storeId,
    storeName: order.storeNameSnap,
    consumerId: order.consumerId,
    consumerName: order.consumerNameSnap,
    consumerPhone: order.consumerPhoneSnap,
    deliveryMethod: order.deliveryMethod,
    paymentMethod: order.paymentMethod,
    itemCount: order.items.length,
    grandTotalPaise: order.grandTotalPaise,
    placedAt: order.placedAt,
    acceptedAt: order.acceptedAt,
    deliveredAt: order.deliveredAt,
  };
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-ink-3 shrink-0">{k}</span>
      <span className="text-ink text-right">{v}</span>
    </div>
  );
}

function PriceRow({ k, v }: { k: string; v: number }) {
  const isNeg = v < 0;
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-3">{k}</span>
      <span className={`font-mono tabular-nums ${isNeg ? 'text-success' : 'text-ink'}`}>
        {isNeg ? '−' : ''}{formatPaise(Math.abs(v))}
      </span>
    </div>
  );
}

// ─── Helper components for Returns / Refunds / Held inline panels ───

function ReturnsList({
  returns,
  onVerify,
  pending,
}: {
  returns: Return[];
  onVerify: (returnId: string, decision: 'accepted' | 'rejected') => void;
  pending: boolean;
}) {
  return (
    <ul className="divide-y divide-line">
      {returns.map((r) => {
        const meta = returnDecisionMeta(r.storeDecision);
        return (
          <li key={r.id} className="py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <span className="text-[11.5px] text-ink-3">
                    {r.kind === 'door_return' ? 'door return' : 'standard return'} · {formatAge(r.openedAt)}
                  </span>
                </div>
                {r.reasonText && (
                  <div className="text-[12px] text-ink-3 italic mt-1">{r.reasonText}</div>
                )}
                {r.agentDisposition && (
                  <div className="text-[11.5px] text-ink-3 mt-1">
                    Agent: <span className="font-mono">{r.agentDisposition}</span>
                  </div>
                )}
              </div>
              {r.storeDecision === 'pending' && (
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    iconLeft={<X className="size-3" />}
                    disabled={pending}
                    onClick={() => onVerify(r.id, 'rejected')}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="accent"
                    iconLeft={<Check className="size-3" />}
                    disabled={pending}
                    onClick={() => onVerify(r.id, 'accepted')}
                  >
                    Accept
                  </Button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function RefundsList({
  refunds,
  onForceFail,
  onRetry,
}: {
  refunds: Refund[];
  onForceFail: (refundId: string, dId: string) => void;
  onRetry: (refundId: string, dId: string) => void;
}) {
  return (
    <ul className="space-y-3">
      {refunds.map((rf) => {
        const m = refundStatusMeta(rf.status);
        return (
          <li key={rf.id} className="rounded-md border border-line bg-bg-2/40 p-3 text-[12.5px]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge tone={m.tone}>{m.label}</Badge>
                <CopyableId value={rf.id} label="refund id" />
              </div>
              <span className="font-mono tabular-nums text-ink">{formatPaise(rf.totalRefundPaise)}</span>
            </div>
            {rf.reason && <div className="text-[11.5px] text-ink-3 mb-2 italic">{rf.reason}</div>}
            <ul className="space-y-1.5">
              {rf.disbursements.map((d) => (
                <DisbursementRow
                  key={d.id}
                  d={d}
                  onForceFail={() => onForceFail(rf.id, d.id)}
                  onRetry={() => onRetry(rf.id, d.id)}
                />
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

function DisbursementRow({
  d,
  onForceFail,
  onRetry,
}: {
  d: RefundDisbursement;
  onForceFail: () => void;
  onRetry: () => void;
}) {
  const meta = refundDisbursementStatusMeta(d.status);
  return (
    <li className="flex items-center justify-between gap-2 rounded border border-line/60 bg-bg px-2 py-1.5">
      <div className="min-w-0 flex items-center gap-2">
        <Badge tone={meta.tone}>{meta.label}</Badge>
        <span className="text-[11.5px] text-ink-3">
          {d.destination === 'wallet' ? 'wallet' : 'original tender'} · {formatPaise(d.amountPaise)}
        </span>
        {d.previousDisbursementId && (
          <span className="text-[10.5px] text-ink-4 italic">retry of {d.previousDisbursementId.slice(0, 10)}…</span>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        {d.status === 'succeeded' && (
          <Button size="sm" variant="ghost" iconLeft={<AlertCircle className="size-3" />} onClick={onForceFail}>
            Force fail
          </Button>
        )}
        {d.status === 'pending' && (
          <Button size="sm" variant="outline" iconLeft={<RefreshCcw className="size-3" />} onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    </li>
  );
}

function HeldList({ held }: { held: HeldItem[] }) {
  return (
    <ul className="divide-y divide-line">
      {held.map((h) => {
        const meta = heldItemStatusMeta(h.status);
        return (
          <li key={h.id} className="py-2.5 flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge tone={meta.tone}>{meta.label}</Badge>
                <CopyableId value={h.id} label="held id" />
              </div>
              <div className="text-[11.5px] text-ink-3 mt-1">
                {h.disposition ? `Disposition: ${heldItemDispositionLabel(h.disposition)}` : `Window expires ${formatAge(h.holdingWindowExpiresAt)}`}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
