/**
 * Kanban order card. Try-and-buy orders are visually distinct (accent left rail
 * + chip); exceptions get a warning rail + "Needs attention". A depleting bar
 * tops time-boxed cards (acceptance window / try-on window). Single-click opens
 * the Sheet, double-click the full page; action buttons sit on top of the body.
 */
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import type { OrderListRow } from '@/lib/types';
import { deriveOrderActions } from '@/lib/order-actions';
import { formatAge, formatPaise, orderStatusMeta } from '@/lib/status';
import { cardDeadline, isException } from '@/lib/order-deadline';
import { useClickOrDouble } from '@/lib/use-click-or-double';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/badge';
import { CountdownBar } from '@/components/retailer/countdown-bar';
import { MethodChip } from './method-chip';
import { OrderActionBar } from './order-sections';
import { useOrderActionRunner } from './use-order-action-runner';

export type ColumnId = 'col1' | 'col2' | 'col3';

export function OrderCard({
  order,
  onSingleClick,
  onDoubleClick,
}: {
  order: OrderListRow;
  onSingleClick: (id: string) => void;
  onDoubleClick: (id: string) => void;
}) {
  const runner = useOrderActionRunner(order.id);
  const meta = orderStatusMeta(order.status);
  const tnb = order.deliveryMethod === 'try_and_buy';
  const exception = isException(order);
  const deadline = cardDeadline(order);
  const windowMs = order.status === 'at_door' ? 600_000 : 180_000;

  const actions = deriveOrderActions(order, { surface: 'card' });

  const click = useClickOrDouble<HTMLDivElement>({
    onClick: () => onSingleClick(order.id),
    onDoubleClick: () => onDoubleClick(order.id),
  });

  const items = order.items ?? [];

  return (
    <div
      {...click}
      aria-label={`Order ${order.id}`}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-lg border bg-bg transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
        exception ? 'border-warning/50' : tnb ? 'border-success/40' : 'border-rule',
      )}
    >
      {/* Depleting window bar */}
      {deadline && <CountdownBar deadlineAt={deadline} windowMs={windowMs} />}

      {/* Kind accent rail */}
      <div
        className={cn(
          'absolute inset-y-0 left-0 w-1',
          exception ? 'bg-warning' : tnb ? 'bg-success' : 'bg-transparent',
        )}
        aria-hidden
      />

      <div className="space-y-2.5 p-3 pl-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-medium text-ink">{order.consumerName}</div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <Badge tone={meta.tone} pulse={meta.pulse}>{meta.label}</Badge>
              {tnb && <MethodChip method={order.deliveryMethod} />}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-mono text-[13px] font-semibold tabular-nums text-ink">{formatPaise(order.grandTotalPaise)}</div>
            <div className="text-[10.5px] text-ink-4">{formatAge(order.placedAt)}</div>
          </div>
        </div>

        {exception && (
          <div className="flex items-center gap-1 text-[11px] font-medium text-warning">
            <AlertTriangle className="size-3" /> Needs attention
          </div>
        )}

        {/* Line items — links opt out of card-nav via the click hook's guard */}
        {items.length > 0 && (
          <div className="text-[12px] text-ink-2">
            {items.map((it, i) => (
              <span key={i}>
                {i > 0 && ', '}
                <span className="text-ink-3">{it.qty}×</span>{' '}
                <Link to={`/retailer/listings/${it.listingId}`} className="hover:text-accent hover:underline">
                  {it.name}
                </Link>
              </span>
            ))}
            {order.itemCount > items.length && (
              <span className="text-ink-4"> +{order.itemCount - items.length} more</span>
            )}
          </div>
        )}

        {/* Actions — same set/labels/design as sheet, row menu, and detail page */}
        {actions.length > 0 && <OrderActionBar actions={actions} runner={runner} className="pt-0.5" />}
      </div>

      {runner.dialogs}
    </div>
  );
}
