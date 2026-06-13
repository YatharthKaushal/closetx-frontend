/**
 * Order history — terminal/inactive orders in a table with filter tabs.
 * Default tab: Fulfilled. Single-click a row → Sheet; double-click → full page.
 * The ⋯ menu exposes the same actions as everywhere else (mostly disabled here).
 */
import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MoreHorizontal } from 'lucide-react';
import { api } from '@/lib/api';
import type { OrderListRow, OrderStatus } from '@/lib/types';
import { formatAge, formatPaise, orderStatusMeta } from '@/lib/status';
import { deriveOrderActions } from '@/lib/order-actions';
import { useClickOrDouble } from '@/lib/use-click-or-double';
import { Page, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty } from '@/components/ui/empty';
import { Th, Td } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MethodChip } from '@/components/retailer/orders/method-chip';
import { OrderSheet } from '@/components/retailer/orders/order-sheet';
import { useOrderActionRunner } from '@/components/retailer/orders/use-order-action-runner';

const HISTORY_STATUSES: OrderStatus[] = [
  'delivered', 'closed', 'cancelled', 'payment_failed', 'returned_to_store', 'returning_to_store',
];

type Tab = 'all' | 'fulfilled' | 'returns' | 'cancelled' | 'not_accepted' | 'payment_failed' | 'closed';
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'fulfilled', label: 'Fulfilled' },
  { key: 'returns', label: 'Returns' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'not_accepted', label: 'Not accepted' },
  { key: 'payment_failed', label: 'Payment failed' },
  { key: 'closed', label: 'Closed' },
];

function matchesTab(o: OrderListRow, tab: Tab): boolean {
  switch (tab) {
    case 'all': return true;
    case 'fulfilled': return o.status === 'delivered' || o.status === 'closed';
    case 'returns': return o.status === 'returned_to_store' || o.status === 'returning_to_store';
    case 'cancelled': return o.status === 'cancelled' && o.acceptedAt != null;
    case 'not_accepted': return o.status === 'cancelled' && o.acceptedAt == null;
    case 'payment_failed': return o.status === 'payment_failed';
    case 'closed': return o.status === 'closed';
  }
}

export default function RetailerOrdersHistory() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('fulfilled');
  const [sheetId, setSheetId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['retailer', 'orders', 'history'],
    queryFn: () => api<OrderListRow[]>(`/retailer/orders?statusIn=${HISTORY_STATUSES.join(',')}&limit=200`),
  });
  const all = useMemo(() => data ?? [], [data]);
  const rows = useMemo(() => all.filter((o) => matchesTab(o, tab)), [all, tab]);

  return (
    <Page>
      <PageHeader
        title="Order history"
        description="Completed, cancelled, and returned orders."
        actions={
          <Button asChild variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-3.5" />}>
            <Link to="/retailer/orders">Active board</Link>
          </Button>
        }
      />

      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5 border-b border-rule pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              'rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors ' +
              (tab === t.key ? 'bg-ink text-bg' : 'text-ink-2 hover:bg-bg-3')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <Empty title="No orders here" description="Nothing matches this filter yet." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-rule">
          <table className="w-full text-[13px]">
            <thead className="border-b border-rule bg-bg-2/60">
              <tr>
                <Th>Customer</Th>
                <Th>Method</Th>
                <Th>Items</Th>
                <Th className="text-right">Total</Th>
                <Th>Status</Th>
                <Th>Placed</Th>
                <Th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <HistoryRow key={o.id} order={o} onSingle={setSheetId} onDouble={(id) => navigate(`/retailer/orders/${id}`)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <OrderSheet orderId={sheetId} open={!!sheetId} onOpenChange={(o) => !o && setSheetId(null)} />
    </Page>
  );
}

function HistoryRow({
  order,
  onSingle,
  onDouble,
}: {
  order: OrderListRow;
  onSingle: (id: string) => void;
  onDouble: (id: string) => void;
}) {
  const runner = useOrderActionRunner(order.id);
  const meta = orderStatusMeta(order.status);
  const actions = deriveOrderActions(order, { surface: 'row' });
  const click = useClickOrDouble<HTMLTableRowElement>({
    onClick: () => onSingle(order.id),
    onDoubleClick: () => onDouble(order.id),
  });

  return (
    <tr {...click} className="cursor-pointer border-b border-rule/60 last:border-0 hover:bg-bg-2/40">
      <Td>{order.consumerName}</Td>
      <Td><MethodChip method={order.deliveryMethod} /></Td>
      <Td>{order.itemCount}</Td>
      <Td className="text-right font-mono tabular-nums">{formatPaise(order.grandTotalPaise)}</Td>
      <Td><Badge tone={meta.tone}>{meta.label}</Badge></Td>
      <Td className="text-ink-3">{formatAge(order.placedAt)}</Td>
      <td
        className="px-4 py-3 align-top"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Actions"><MoreHorizontal className="size-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onDouble(order.id)}>Open full page</DropdownMenuItem>
            {actions.map((a) => (
              <DropdownMenuItem
                key={a.key}
                disabled={!a.enabled}
                title={!a.enabled ? a.disabledReason : undefined}
                onSelect={(e) => { e.preventDefault(); if (a.enabled) runner.run(a); }}
              >
                {a.icon}{a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {runner.dialogs}
      </td>
    </tr>
  );
}
