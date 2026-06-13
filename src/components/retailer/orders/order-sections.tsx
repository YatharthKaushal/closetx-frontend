/**
 * Reusable order detail sections + the shared action bar, used by both the right
 * Sheet and the full detail page so layout/labels never diverge.
 */
import { Link } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import type { OrderDetail, OrderListRow } from '@/lib/types';
import type { OrderAction } from '@/lib/order-actions';
import {
  formatAge,
  formatPaise,
  orderStatusMeta,
  paymentMethodLabel,
  paymentStatusMeta,
  refundDisbursementStatusMeta,
  refundStatusMeta,
} from '@/lib/status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CopyableId } from '@/components/ui/copyable-id';
import { Timeline } from '@/components/ui/timeline';
import { MethodChip } from './method-chip';

type Runner = { run: (a: OrderAction) => void; pendingKey: string | null };

/** Action bar — primary CTA + secondaries, disabled-with-reason, loading-aware. */
export function OrderActionBar({
  actions,
  runner,
  className,
}: {
  actions: OrderAction[];
  runner: Runner;
  className?: string;
}) {
  if (actions.length === 0) return null;
  return (
    <div className={'flex flex-wrap items-center gap-2 ' + (className ?? '')}>
      {actions.map((a) => (
        <Button
          key={a.key}
          variant={a.variant}
          size="sm"
          iconLeft={a.icon}
          disabled={!a.enabled}
          loading={runner.pendingKey === a.key}
          title={!a.enabled ? a.disabledReason : undefined}
          onClick={() => runner.run(a)}
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}

export function SummarySection({ order }: { order: OrderListRow | OrderDetail }) {
  const meta = orderStatusMeta(order.status);
  const isDetail = 'consumerNameSnap' in order;
  const name = isDetail ? order.consumerNameSnap : order.consumerName;
  const phone = isDetail ? order.consumerPhoneSnap : order.consumerPhone;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone={meta.tone} pulse={meta.pulse}>{meta.label}</Badge>
          <MethodChip method={order.deliveryMethod} />
        </div>
        <span className="text-[11.5px] text-ink-3">{formatAge(order.placedAt)}</span>
      </div>
      <div className="text-[13px]">
        <div className="font-medium text-ink">{name}</div>
        {phone && <div className="text-[12px] text-ink-3">{phone}</div>}
      </div>
      <div className="flex items-center justify-between text-[13px]">
        <CopyableId value={order.id} label="order id" />
        <span className="font-mono tabular-nums font-semibold text-ink">{formatPaise(order.grandTotalPaise)}</span>
      </div>
    </div>
  );
}

export function PaymentStatusLine({ detail }: { detail: OrderDetail }) {
  const p = detail.payments[0];
  if (!p) return <span className="text-[12px] text-ink-3">No payment recorded</span>;
  const m = paymentStatusMeta(p.status);
  return (
    <div className="flex items-center gap-2 text-[12.5px]">
      <Badge tone={m.tone}>{m.label}</Badge>
      <span className="text-ink-3">{paymentMethodLabel(detail.paymentMethod)}</span>
    </div>
  );
}

export function TransitSection({ detail }: { detail: OrderDetail }) {
  return (
    <div>
      <Timeline transitions={detail.transitions} />
      {detail.deliveryAttempts.length > 0 && (
        <>
          <hr className="border-line my-3" />
          <div className="kicker mb-2">Delivery attempts</div>
          <ul className="space-y-1 text-[12px]">
            {detail.deliveryAttempts.map((a) => (
              <li key={a.id} className="flex items-center justify-between">
                <span>#{a.attemptNumber} · {a.outcome}</span>
                <span className="text-ink-3">{formatAge(a.attemptedAt)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function ItemsSection({ detail }: { detail: OrderDetail }) {
  return (
    <ul className="divide-y divide-line">
      {detail.items.map((it) => (
        <li key={it.id} className="flex gap-3 py-2.5">
          <div className="size-12 shrink-0 overflow-hidden rounded border border-line bg-bg-2 grid place-items-center">
            {it.galleryImageSnap ? (
              <img src={it.galleryImageSnap} alt={it.listingNameSnap} className="size-full object-cover" />
            ) : (
              <ImageOff className="size-4 text-ink-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            {/* Every entity deep-links: product → its edit page, variant → its
                inventory row, brand → the brands page. */}
            <Link
              to={`/retailer/listings/${it.listingId}`}
              className="block truncate text-[13px] font-medium text-ink hover:text-accent hover:underline"
            >
              {it.listingNameSnap}
            </Link>
            <div className="mt-0.5 text-[11.5px] text-ink-3">
              <Link to="/retailer/brands" className="hover:text-accent hover:underline">{it.brandSnap}</Link>
              {' · '}
              <Link
                to={`/retailer/inventory?productId=${it.listingId}`}
                className="hover:text-accent hover:underline"
              >
                {it.attributesLabelSnap}
              </Link>
            </div>
          </div>
          <div className="shrink-0 text-right font-mono text-[12.5px] tabular-nums text-ink">
            {formatPaise(it.unitPricePaise)} × {it.qty}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CostSection({ detail }: { detail: OrderDetail }) {
  return (
    <div className="space-y-1.5 text-[13px]">
      <Line k="Items" v={formatPaise(detail.itemsSubtotalPaise)} />
      {detail.couponPaise > 0 && <Line k="Coupon" v={`−${formatPaise(detail.couponPaise)}`} tone="success" />}
      {detail.walletAppliedPaise > 0 && <Line k="Wallet" v={`−${formatPaise(detail.walletAppliedPaise)}`} tone="success" />}
      {detail.pointsRedeemedPaise > 0 && <Line k="Points" v={`−${formatPaise(detail.pointsRedeemedPaise)}`} tone="success" />}
      <Line k="Tax" v={formatPaise(detail.taxPaise)} />
      {detail.deliveryFeePaise > 0 && <Line k="Delivery" v={formatPaise(detail.deliveryFeePaise)} />}
      {detail.handlingFeePaise > 0 && <Line k="Handling" v={formatPaise(detail.handlingFeePaise)} />}
      {detail.convenienceFeePaise > 0 && <Line k="Convenience" v={formatPaise(detail.convenienceFeePaise)} />}
      <hr className="border-line my-2" />
      <div className="flex justify-between text-[15px] font-semibold">
        <span className="text-ink">Total</span>
        <span className="font-mono tabular-nums text-ink">{formatPaise(detail.grandTotalPaise)}</span>
      </div>
    </div>
  );
}

export function RefundsSection({ detail }: { detail: OrderDetail }) {
  const refunds = detail.refunds ?? [];
  if (refunds.length === 0) return null;
  return (
    <ul className="space-y-3">
      {refunds.map((rf) => {
        const m = refundStatusMeta(rf.status);
        return (
          <li key={rf.id} className="space-y-2">
            <div className="flex items-center justify-between text-[12.5px]">
              <div className="flex items-center gap-2">
                <Badge tone={m.tone}>{m.label}</Badge>
                <CopyableId value={rf.id} label="refund id" />
              </div>
              <span className="font-mono tabular-nums">{formatPaise(rf.totalRefundPaise)}</span>
            </div>
            {rf.disbursements.length > 0 && (
              <ul className="space-y-1.5 rounded-md border border-line bg-bg-2/30 p-2">
                {rf.disbursements.map((d) => {
                  const dm = refundDisbursementStatusMeta(d.status);
                  return (
                    <li key={d.id} className="flex items-center justify-between text-[11.5px]">
                      <div className="flex items-center gap-2">
                        <Badge tone={dm.tone}>{dm.label}</Badge>
                        <span className="capitalize text-ink-2">{d.destination === 'wallet' ? 'Store wallet' : 'Original payment method'}</span>
                      </div>
                      <span className="font-mono tabular-nums text-ink">{formatPaise(d.amountPaise)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Line({ k, v, tone }: { k: string; v: string; tone?: 'success' }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-3">{k}</span>
      <span className={'font-mono tabular-nums ' + (tone === 'success' ? 'text-success' : '')}>{v}</span>
    </div>
  );
}
