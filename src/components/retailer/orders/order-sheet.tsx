/**
 * Right-side order Sheet — opens on single-click of any card/row. Shows summary,
 * payment status, and transit history with the shared action bar pinned on top.
 * Double-click (or the "Open full page" link) goes to the full detail page.
 */
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import type { OrderDetail } from '@/lib/types';
import { deriveOrderActions } from '@/lib/order-actions';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrderActionRunner } from './use-order-action-runner';
import {
  OrderActionBar,
  PaymentStatusLine,
  SummarySection,
  TransitSection,
} from './order-sections';

export function OrderSheet({
  orderId,
  open,
  onOpenChange,
}: {
  orderId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const runner = useOrderActionRunner(orderId ?? '');
  const detailQ = useQuery({
    queryKey: ['retailer', 'order', orderId],
    queryFn: () => api<OrderDetail>(`/retailer/orders/${orderId}`),
    enabled: open && !!orderId,
    refetchInterval: open ? 4000 : false,
  });
  const detail = detailQ.data;
  const actions = detail
    ? deriveOrderActions(detail, { detail, surface: 'sheet' }).filter((a) => !a.detailOnly)
    : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] max-w-[92vw]">
        <DialogPrimitive.Title className="sr-only">Order details</DialogPrimitive.Title>

        {/* Sticky action bar */}
        <div className="sticky top-0 z-10 border-b border-line bg-bg px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-ink">Order</span>
            {orderId && (
              <Button asChild variant="ghost" size="xs" iconRight={<ExternalLink className="size-3" />}>
                <Link to={`/retailer/orders/${orderId}`}>Full page</Link>
              </Button>
            )}
          </div>
          {detail ? (
            <OrderActionBar actions={actions} runner={runner} />
          ) : (
            <Skeleton className="h-8 w-40" />
          )}
          {detail?.openDispute && (
            <Link
              to={`/retailer/disputes/${detail.openDispute.id}`}
              className="mt-2 flex items-center justify-between gap-2 rounded-md border border-warning/40 bg-warning-soft px-2.5 py-1.5 text-[11.5px] text-warning-strong hover:bg-warning-soft/80"
            >
              <span>Dispute open — funds held until an admin decides.</span>
              <span className="shrink-0 font-medium underline">View</span>
            </Link>
          )}
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {detailQ.isLoading || !detail ? (
            <>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-40 w-full" />
            </>
          ) : (
            <>
              <SummarySection order={detail} />
              <section>
                <div className="kicker mb-1.5 text-ink-3">Payment</div>
                <PaymentStatusLine detail={detail} />
              </section>
              <section>
                <div className="kicker mb-1.5 text-ink-3">Transit history</div>
                <TransitSection detail={detail} />
              </section>
            </>
          )}
        </div>
      </SheetContent>
      {runner.dialogs}
    </Sheet>
  );
}
